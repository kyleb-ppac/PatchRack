/* =====================================================================
   PatchRack - app logic
   Sections: 1 utilities · 2 state & saving · 3 signal model · 4 checks
             5 top bar · 6 rack view · 7 inspector · 8 patchlist
             9 dante · 10 print · 11 library · 12 checks view
             13 events · 14 start-up
   ===================================================================== */

/* ---------- 1. utilities ---------- */
const SCHEMA = 2;
const STORE_KEY = 'patchrack.project';
const U = 48;      // pixels per rack unit
const W = 520;     // pixels per 19" panel width
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9);
const push = (map, k, v) => { const a = map.get(k); a ? a.push(v) : map.set(k, [v]); };
let inFrame = false;
try { inFrame = window.top !== window.self; } catch { inFrame = true; }

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function download(name, text, mime = 'application/json') {
  try {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  } catch { /* ignore */ }
  if (inFrame) toast('Downloads are blocked in this preview. Use Copy instead, or open the app file on your Mac.', 5000);
}
async function copyText(text, what = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(what); }
  catch { openModal('Copy this text', `<textarea id="copy-area" readonly>${esc(text)}</textarea><p class="muted small">Select all, then copy.</p>`); }
}
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ---------- 2. state & saving ---------- */
let project;
const ui = {
  tab: 'rack', patchId: null, sel: null, faces: {}, showTies: false,
  layer: 'patch', libSel: null, libQuery: '', addQuery: '', armed: null,
};
const undoStack = [], redoStack = [];

function patch() { return project.patches.find((p) => p.id === ui.patchId) || project.patches[0]; }

function migrate(p) {
  // Every saved file carries a schema number. When the format changes,
  // add a step here so older files keep opening.
  if (!p.schema) p.schema = 1;
  p.library ||= []; p.racks ||= []; p.locations ||= []; p.devices ||= []; p.connections ||= [];
  p.patches ||= []; p.groups ||= []; p.columns ||= []; p.history ||= [];
  p.view ||= {}; p.view.cableMode ||= 'all'; p.view.cables ||= {};
  p.view.colorBy ||= 'type'; p.view.hideTypes ||= {}; if (p.view.photos === undefined) p.view.photos = true;
  if ((p.schema || 1) < 2) {
    // v0.0.6: the Avantis gets its own control network jack (separate from the Dante card)
    const av = p.library.find((d) => d.id === 'ah-avantis');
    if (av && !av.groups.some((g) => g.id === 'ctl')) {
      const i = av.groups.findIndex((g) => g.id === 'pwr');
      av.groups.splice(i < 0 ? av.groups.length : i, 0, { id: 'ctl', label: 'Network', count: 1, start: 1, conn: 'rj45', dir: 'io', face: 'rear' });
    }
    // switch ports don't get IP addresses; the switch gets one management address
    const gc = p.library.find((d) => d.id === 'luminex-gigacore30i');
    if (gc && !gc.groups.some((g) => g.id === 'mgmt')) {
      for (const g of gc.groups) if (g.id === 'eth' || g.id === 'sfp') g.ip = false;
      gc.groups.push({ id: 'mgmt', label: 'Management', count: 1, start: 1, conn: 'rj45', dir: 'io', face: 'virtual' });
    }
  }
  p.cableColors ||= JSON.parse(JSON.stringify(DEFAULT_CABLE_COLORS));
  p.print = { ...defaultPrint(), ...(p.print || {}) };
  p.print.include = { ...defaultPrint().include, ...(p.print.include || {}) };
  const have = new Set(p.library.map((d) => d.id));
  for (const d of DEFAULT_LIBRARY) if (!have.has(d.id)) p.library.push(JSON.parse(JSON.stringify(d)));
  if (!p.patches.length) p.patches.push(newPatch('Patch 1'));
  for (const pt of p.patches) { pt.sources ||= []; pt.outputs ||= []; }
  for (const d of p.devices) { d.portNames ||= {}; d.labels ||= {}; d.ips ||= {}; }
  p.schema = SCHEMA;
  return p;
}
function newPatch(name) {
  return { id: uid('p'), name, event: name, date: new Date().toISOString().slice(0, 10), sources: [], outputs: [] };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(project)); } catch { /* storage unavailable */ }
  if (typeof ghMarkDirty === 'function' && project.modified) ghMarkDirty();
}
function load() {
  let p = null;
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) p = JSON.parse(raw); } catch { p = null; }
  project = migrate(p || buildSample());
  fixUi();
}
function fixUi() {
  if (!project.patches.some((p) => p.id === ui.patchId)) ui.patchId = project.patches[0]?.id;
  ui.sel = null;
}
function commit(msg, fn, { quiet = false } = {}) {
  undoStack.push(JSON.stringify(project)); if (undoStack.length > 80) undoStack.shift();
  redoStack.length = 0;
  fn(project);
  if (msg) {
    project.history.unshift({ t: new Date().toISOString(), msg, patch: patch()?.name || '' });
    if (project.history.length > 500) project.history.length = 500;
  }
  project.modified = new Date().toISOString();
  save();
  if (!quiet) scheduleRender();
}
let renderPending = false;
function scheduleRender() {
  if (renderPending) return; renderPending = true;
  setTimeout(() => { renderPending = false; render(); }, 0);
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(project)); project = JSON.parse(undoStack.pop());
  if (!project.patches.some((p) => p.id === ui.patchId)) fixUi();
  save(); render(); toast('Undone');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(project)); project = JSON.parse(redoStack.pop());
  if (!project.patches.some((p) => p.id === ui.patchId)) fixUi();
  save(); render(); toast('Redone');
}
function replaceProject(p, msg) {
  undoStack.push(JSON.stringify(project)); redoStack.length = 0;
  project = migrate(p); ui.patchId = null; fixUi();
  // a different project is now open, so it's no longer linked to a GitHub file (ghOpen re-links it)
  if (typeof gh !== 'undefined') { gh.file = null; ghStoreFile(); }
  project.history.unshift({ t: new Date().toISOString(), msg, patch: '' });
  save(); render(); toast(msg);
}

/* ---------- 3. signal model ---------- */
let idx = {};
const mkRef = (devId, gid, n) => `${devId}.${gid}:${n}`;
function parseRef(ref) {
  const m = /^([^.]+)\.([^:]+):(\d+)$/.exec(ref || '');
  return m && { devId: m[1], gid: m[2], n: +m[3] };
}
function port(ref) {
  const r = parseRef(ref); if (!r) return null;
  const dev = idx.dev.get(r.devId); if (!dev) return null;
  const def = idx.def.get(dev.defId); if (!def) return null;
  const g = def.groups.find((x) => x.id === r.gid);
  if (!g || r.n < 1 || r.n > g.count) return null;
  return { ref, dev, def, g, n: r.n };
}
function portNum(p) {
  const ov = p.dev.labels?.[p.g.id] || {};
  if (p.g.names?.[p.n - 1]) return p.g.names[p.n - 1];
  return String((+(ov.start ?? p.g.start ?? 1)) + p.n - 1);
}
function portParts(p) {
  const custom = p.dev.portNames?.[`${p.g.id}:${p.n}`];
  if (custom) return { custom };
  const ov = p.dev.labels?.[p.g.id] || {};
  return { prefix: ov.prefix ?? `${p.dev.short} ${p.g.label}`, num: portNum(p) };
}
function portLabel(ref) {
  const p = port(ref); if (!p) return '(missing port)';
  const x = portParts(p); return x.custom ?? `${x.prefix} ${x.num}`.trim();
}
function portShort(ref) {
  const p = port(ref); if (!p) return '(missing port)';
  const custom = p.dev.portNames?.[`${p.g.id}:${p.n}`];
  const base = `${p.dev.short} ${p.g.label} ${p.g.names?.[p.n - 1] ?? ((p.g.start ?? 1) + p.n - 1)}`;
  return custom ? `${base} “${custom}”` : base;
}
function portLong(ref) {
  const p = port(ref); if (!p) return '(missing port)';
  const custom = p.dev.portNames?.[`${p.g.id}:${p.n}`];
  const base = `${p.dev.name} · ${p.g.label} ${p.g.names?.[p.n - 1] ?? ((p.g.start ?? 1) + p.n - 1)}`;
  return custom ? `${base} “${custom}”` : base;
}
function stereoLabel(refs) {
  refs = (refs || []).filter(Boolean);
  if (!refs.length) return '';
  if (refs.length === 1) return portLabel(refs[0]);
  const a = port(refs[0]), b = port(refs[1]);
  if (a && b) {
    const pa = portParts(a), pb = portParts(b);
    if (!pa.custom && !pb.custom && pa.prefix === pb.prefix) return `${pa.prefix} ${pa.num}/${pb.num}`;
  }
  return refs.map(portLabel).join(' + ');
}
const isPhysical = (g) => g.face === 'front' || g.face === 'rear';

function buildIndex() {
  idx = {
    dev: new Map(project.devices.map((d) => [d.id, d])),
    def: new Map(project.library.map((d) => [d.id, d])),
    out: new Map(), in: new Map(), cables: new Map(), active: [], broken: [],
    srcAt: new Map(), mark: new Map(), outMark: new Map(),
  };
  const pid = patch()?.id;
  for (const c of project.connections) {
    if (c.layer !== 'rig' && c.layer !== pid) continue;
    if (!port(c.a) || !port(c.b)) { idx.broken.push(c); continue; }
    idx.active.push(c); push(idx.out, c.a, c); push(idx.in, c.b, c);
    if (c.kind !== 'dante') {
      idx.cables.set(c.a, (idx.cables.get(c.a) || 0) + 1);
      idx.cables.set(c.b, (idx.cables.get(c.b) || 0) + 1);
    }
  }
  const pt = patch();
  for (const s of pt.sources) for (const r of s.ports || []) {
    if (!r) continue;
    push(idx.srcAt, r, s);
    for (const x of traceTree(r).parent.keys()) if (!idx.mark.has(x)) idx.mark.set(x, s);
  }
  for (const o of pt.outputs) if (o.port) for (const x of traceTree(o.port).parent.keys()) if (!idx.outMark.has(x)) idx.outMark.set(x, o);
}

// where does the signal at `ref` go next?
function next(ref) {
  const p = port(ref); if (!p) return [];
  const res = [];
  for (const c of idx.out.get(ref) || []) {
    const b = port(c.b); if (!b) continue;
    if (p.g.dir === 'io' || b.g.dir === 'io') continue;   // network links aren't audio paths
    res.push(c.b);
  }
  for (const L of p.def.links || []) {
    if (L.from !== p.g.id) continue;
    const fs = L.fromStart || 1, ts = L.toStart || 1, cnt = L.count ?? 1e9;
    if (p.n < fs || p.n >= fs + cnt) continue;
    const tn = ts + (p.n - fs);
    const tg = p.def.groups.find((g) => g.id === L.to);
    if (tg && tn >= 1 && tn <= tg.count) res.push(mkRef(p.dev.id, L.to, tn));
  }
  const pb = p.def.patchbay;
  if (pb) {
    const mode = p.dev.normalling?.[p.n] || pb.mode || 'half';
    const used = (g) => (idx.cables.get(mkRef(p.dev.id, g, p.n)) || 0) > 0;
    if (p.g.id === pb.rt) {
      if (used(pb.ft)) res.push(mkRef(p.dev.id, pb.ft, p.n));
      const normalled = mode === 'normal' ? !used(pb.ft) && !used(pb.fb) : mode === 'half' ? !used(pb.fb) : false;
      if (normalled) res.push(mkRef(p.dev.id, pb.rb, p.n));
    }
    if (p.g.id === pb.fb) res.push(mkRef(p.dev.id, pb.rb, p.n));
  }
  return res;
}
// where did the signal at `ref` come from?
function prev(ref) {
  const p = port(ref); if (!p) return [];
  const res = [];
  for (const c of idx.in.get(ref) || []) {
    const a = port(c.a); if (!a) continue;
    if (p.g.dir === 'io' || a.g.dir === 'io') continue;
    res.push(c.a);
  }
  for (const L of p.def.links || []) {
    if (L.to !== p.g.id) continue;
    const fs = L.fromStart || 1, ts = L.toStart || 1, cnt = L.count ?? 1e9;
    const fn = fs + (p.n - ts);
    if (fn < fs || fn >= fs + cnt) continue;
    const fg = p.def.groups.find((g) => g.id === L.from);
    if (fg && fn >= 1 && fn <= fg.count) res.push(mkRef(p.dev.id, L.from, fn));
  }
  const pb = p.def.patchbay;
  if (pb) {
    const mode = p.dev.normalling?.[p.n] || pb.mode || 'half';
    const used = (g) => (idx.cables.get(mkRef(p.dev.id, g, p.n)) || 0) > 0;
    if (p.g.id === pb.ft) res.push(mkRef(p.dev.id, pb.rt, p.n));
    if (p.g.id === pb.rb) {
      if (used(pb.fb)) res.push(mkRef(p.dev.id, pb.fb, p.n));
      const normalled = mode === 'normal' ? !used(pb.ft) && !used(pb.fb) : mode === 'half' ? !used(pb.fb) : false;
      if (normalled) res.push(mkRef(p.dev.id, pb.rt, p.n));
    }
  }
  return res;
}
function traceTree(start, step = next) {
  const parent = new Map([[start, null]]); const q = [start]; const ends = [];
  while (q.length) {
    const r = q.shift();
    const nx = step(r).filter((x) => !parent.has(x));
    if (!nx.length) ends.push(r);
    for (const x of nx) { parent.set(x, r); q.push(x); }
    if (parent.size > 3000) break;
  }
  return { parent, ends };
}
function pathTo(tree, end) { const out = []; for (let r = end; r; r = tree.parent.get(r)) out.unshift(r); return out; }
function consoleChannels(start) {
  return [...traceTree(start).parent.keys()].filter((r) => port(r)?.g.conn === 'channel');
}
function chLabel(ref) {
  const p = port(ref); if (!p) return '';
  const consoles = project.devices.filter((d) => idx.def.get(d.defId)?.groups.some((g) => g.conn === 'channel')).length;
  return `${consoles > 1 ? p.dev.short + ' ' : ''}Ch ${portNum(p)}`;
}
function sourceChannels(s) {
  const out = [];
  for (const r of s.ports || []) if (r && port(r)) out.push(...consoleChannels(r));
  return out;
}
function sourcePaths(s) {
  const paths = [];
  for (const r of s.ports || []) {
    if (!r || !port(r)) continue;
    const t = traceTree(r);
    const ends = t.ends.length ? t.ends : [r];
    const pref = ends.filter((e) => port(e)?.g.conn === 'channel');
    for (const e of (pref.length ? pref : ends).slice(0, 2)) paths.push(pathTo(t, e));
  }
  return paths;
}

// ----- signal types -----
function inferSignal(g) {
  const L = (g.label || '').toLowerCase(), c = g.conn;
  if (['iec', 'nema', 'powercon', 'dc'].includes(c)) return 'power';
  if (['rj45', 'ethercon', 'sfp'].includes(c)) return 'network';
  if (['lc', 'opticalcon'].includes(c)) return 'fiber';
  if (c === 'speakon') return 'speaker';
  if (c === 'hdmi' || c === 'displayport') return 'hdmi';
  if (c === 'usb' || c === 'usbc') return 'usb';
  if (c === 'thunderbolt') return 'thunderbolt';
  if (c === 'dmx5' || c === 'dmx3' || /dmx/.test(L)) return 'dmx';
  if (c === 'bnc') return /ant|rf|cascade/.test(L) ? 'rf' : /word|clock|sync|ref/.test(L) ? 'control' : 'sdi';
  if (/aes|spdif|s\/pdif/.test(L) || c === 'toslink') return 'aes';
  if (c === 'phoenix' && /gpi|gpo|serial|rs-?232|rs-?485|control/.test(L)) return 'control';
  if (['xlr', 'combo', 'trs', 'phoenix', 'headphone', 'rca', 'mini'].includes(c)) return 'analog';
  return 'other';
}
const sigOf = (g) => g.signal || inferSignal(g);
function autoType(c) { const a = port(c.a), b = port(c.b); return a ? sigOf(a.g) : b ? sigOf(b.g) : 'other'; }
const connType = (c) => c.type || autoType(c);
const sigName = (t) => (SIGNALS[t] || SIGNALS.other).name;

// ----- network jacks & IP addresses -----
const NET_CONNS = ['rj45', 'ethercon', 'sfp', 'lc', 'opticalcon'];
// network jacks that can have an IP address (a switch's ports can't: it gets one virtual "Management" entry)
const isNetGroup = (g) => (isPhysical(g) || g.face === 'virtual') && g.dir === 'io' && NET_CONNS.includes(g.conn) && g.ip !== false;
function netPorts(d) {
  const def = idx.def.get(d.defId); if (!def) return [];
  const out = [];
  for (const g of def.groups) if (isNetGroup(g)) for (let n = 1; n <= g.count; n++) out.push(mkRef(d.id, g.id, n));
  return out;
}
const IP_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([0-9]|[12]\d|3[0-2]))?$/;
const ipOf = (ref) => { const p = port(ref); return p ? p.dev.ips?.[`${p.g.id}:${p.n}`]?.ip || '' : ''; };

// ----- fold-open sections (open/closed state remembered in this browser) -----
const secState = (() => { try { return JSON.parse(localStorage.getItem('patchrack.sections') || '{}'); } catch { return {}; } })();
function sec(key, title, body, defOpen = true) {
  const open = key in secState ? secState[key] : defOpen;
  return `<details class="sec" data-sec="${key}" ${open ? 'open' : ''}><summary>${title}</summary><div class="sec-body">${body}</div></details>`;
}

// ----- gear photos -----
const phCls = (id) => id.replace(/[^\w-]/g, '_');
let photoKey = '';
function updatePhotoCSS() {
  const defs = project.library.filter((d) => d.images && (d.images.front || d.images.rear));
  const key = defs.map((d) => `${d.id}:${d.images.front?.length || 0}:${d.images.rear?.length || 0}`).join('|');
  if (key === photoKey) return;
  photoKey = key;
  let st = document.getElementById('photo-css');
  if (!st) { st = document.createElement('style'); st.id = 'photo-css'; document.head.appendChild(st); }
  st.textContent = defs.flatMap((d) => ['front', 'rear'].filter((f) => d.images[f]).map((f) => `.dev.photo.ph-${phCls(d.id)}-${f}{background-image:url("${d.images[f]}")}`)).join('\n');
}
function resizeImage(file, maxW = 1040) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxW / img.width);
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const cx = cv.getContext('2d'); cx.fillStyle = '#202327'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}
function photoHTML(def, editable = true) {
  return `<div class="photos">${['front', 'rear'].map((f) => `<div class="photo-slot"><div class="eyebrow">${f}</div>
    ${def.images?.[f] ? `<img src="${def.images[f]}" alt="${esc(def.model)} ${f} panel">` : '<div class="photo-empty">No photo</div>'}
    ${editable ? `<div class="toolbar"><button data-act="addPhoto" data-def="${def.id}" data-face="${f}">${def.images?.[f] ? 'Replace' : 'Add photo'}</button>${def.images?.[f] ? `<button data-act="removePhoto" data-def="${def.id}" data-face="${f}">Remove</button>` : ''}</div>` : ''}</div>`).join('')}</div>
    <p class="small muted" style="margin:0">Photos belong to the gear definition, so every ${esc(def.model)} shows them. Crop the photo to just the faceplate for the best fit, then line the jacks up in Library → Panel layout. Turn photos off in View.</p>`;
}

const COMPAT = {
  xlr: ['xlr', 'combo', 'dmx5'], combo: ['xlr', 'trs', 'combo'], trs: ['trs', 'combo', 'headphone'],
  headphone: ['trs', 'headphone'], ethercon: ['ethercon', 'rj45'], rj45: ['rj45', 'ethercon'],
  iec: ['iec', 'nema'], nema: ['nema', 'iec'], usbc: ['usbc', 'thunderbolt'], thunderbolt: ['thunderbolt', 'usbc'],
  lc: ['lc', 'opticalcon'], opticalcon: ['opticalcon', 'lc'],
};
const compatible = (a, b) => a === b || (COMPAT[a] || []).includes(b);

/* ---------- 4. checks ---------- */
function runChecks() {
  const out = [];
  const add = (sev, msg, sel) => out.push({ sev, msg, sel });
  const pt = patch();
  if (idx.broken.length) add('warn', `${idx.broken.length} cable(s) point at ports that no longer exist (the gear was changed or removed). Delete them from the Rig, or undo the gear change.`, null);
  for (const [ref, n] of idx.cables) if (n > 1) add('error', `${portLong(ref)} has ${n} cables in one jack.`, { kind: 'port', ref });
  for (const [ref, list] of idx.in) {
    const d = list.filter((c) => c.kind === 'dante');
    if (d.length > 1) add('error', `Dante receiver ${portLong(ref)} is subscribed ${d.length} times. A receive channel can only take one.`, { kind: 'port', ref });
  }
  for (const c of idx.active) {
    if (c.kind === 'dante') continue;
    const a = port(c.a), b = port(c.b);
    if (a.g.dir === b.g.dir && a.g.dir !== 'io') add('error', `${portLong(c.a)} is cabled to ${portLong(c.b)}: that joins two ${a.g.dir === 'in' ? 'inputs' : 'outputs'}.`, { kind: 'conn', id: c.id });
    else if (!compatible(a.g.conn, b.g.conn)) add('info', `${portLong(c.a)} (${CONN_NAMES[a.g.conn] || a.g.conn}) to ${portLong(c.b)} (${CONN_NAMES[b.g.conn] || b.g.conn}) needs an adapter or a different cable.`, { kind: 'conn', id: c.id });
    else if (!c.type && sigOf(a.g) !== sigOf(b.g) && sigOf(a.g) !== 'other' && sigOf(b.g) !== 'other') add('info', `${portLong(c.a)} carries ${sigName(sigOf(a.g))} but ${portLong(c.b)} expects ${sigName(sigOf(b.g))}.`, { kind: 'conn', id: c.id });
  }
  const ipUse = new Map();
  for (const d of project.devices) {
    for (const r of netPorts(d)) {
      const ip = ipOf(r); if (!ip) continue;
      if (!IP_RE.test(ip)) add('warn', `${portLong(r)} has “${ip}”, which isn't a valid IP address.`, { kind: 'port', ref: r });
      else push(ipUse, ip.split('/')[0], r);
    }
  }
  for (const [ip, refs] of ipUse) if (refs.length > 1) add('error', `IP address ${ip} is used ${refs.length} times: ${refs.map(portLong).join(', ')}.`, { kind: 'port', ref: refs[0] });
  const chUse = new Map();
  for (const s of pt.sources) {
    const nm = s.name || 'Untitled source';
    const ports = (s.ports || []).filter(Boolean);
    if (!ports.length) { add('warn', `“${nm}” has no stage input yet.`, { kind: 'source', id: s.id }); continue; }
    for (const r of ports) {
      const p = port(r);
      if (!p) { add('warn', `“${nm}” is assigned to a port that no longer exists.`, { kind: 'source', id: s.id }); continue; }
      if (p.g.dir === 'out' && p.g.conn !== 'dante') add('error', `“${nm}” is assigned to an output (${portLong(r)}).`, { kind: 'source', id: s.id });
      const at = idx.srcAt.get(r) || [];
      if (at.length > 1 && at[0] === s) add('error', `${portLabel(r)} has ${at.length} sources: ${at.map((x) => '“' + (x.name || '?') + '”').join(', ')}.`, { kind: 'port', ref: r });
      const chs = consoleChannels(r);
      if (!chs.length) add('warn', `“${nm}” (${portLabel(r)}) doesn't reach a console channel. Check the cable or Dante route after ${portShort(traceTree(r).ends[0] || r)}.`, { kind: 'source', id: s.id });
      for (const ch of chs) push(chUse, ch, s);
    }
  }
  for (const [ch, list] of chUse) {
    const uniq = [...new Set(list)];
    if (uniq.length > 1) add('error', `${portLong(ch)} receives ${uniq.map((s) => '“' + s.name + '”').join(' and ')}.`, { kind: 'port', ref: ch });
  }
  const order = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}

/* ---------- 5. top bar & render ---------- */
let checks = [];
function render() {
  renderPending = false;
  const focusId = document.activeElement?.closest?.('#main') ? document.activeElement.id : null;
  const keep = $$('[data-keep-scroll]').map((el) => [el.id, el.scrollLeft, el.scrollTop]);
  buildIndex();
  checks = runChecks();
  updatePhotoCSS();
  renderTop();
  const main = $('#main');
  const views = { rack: rackView, list: listView, dante: danteView, print: printView, library: libraryView, checks: checksView };
  main.innerHTML = (views[ui.tab] || rackView)();
  for (const [id, x, y] of keep) { const el = document.getElementById(id); if (el) { el.scrollLeft = x; el.scrollTop = y; } }
  for (const s of $$('select[data-val]')) s.value = s.dataset.val;
  if (focusId) { const f = document.getElementById(focusId); if (f) { f.focus({ preventScroll: true }); if (f.select && f.type === 'text') f.select(); } }
  if (ui.tab === 'rack') requestAnimationFrame(drawCables);
}
function renderTop() {
  const pn = $('#proj-name'); if (document.activeElement !== pn) pn.value = project.name || '';
  $('#patch-select').innerHTML = project.patches.map((p) => `<option value="${p.id}" ${p.id === ui.patchId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  for (const b of $$('#tabs button')) b.classList.toggle('on', b.dataset.tab === ui.tab);
  const errs = checks.filter((c) => c.sev === 'error').length, warns = checks.filter((c) => c.sev === 'warn').length;
  const badge = $('#checks-badge');
  badge.textContent = errs || warns || '✓';
  badge.className = 'badge ' + (errs ? '' : warns ? 'warn' : 'zero');
  $('#btn-undo').disabled = !undoStack.length; $('#btn-redo').disabled = !redoStack.length;
}

/* ---------- 6. rack view ---------- */
const PITCH = { rca: 18, mini: 14, usbc: 14, thunderbolt: 14, displayport: 18, lc: 16, opticalcon: 26, toslink: 16, xlr: 26, combo: 26, dmx5: 26, dmx3: 26, ethercon: 24, rj45: 19, trs: 18, headphone: 18, bnc: 17, sfp: 19, phoenix: 13, iec: 28, nema: 28, dc: 16, speakon: 28, powercon: 28, usb: 15, hdmi: 20 };
const layoutCache = new Map();
function groupDims(g, s, h, top) {
  const p = (PITCH[g.conn] || 20) * s;
  const lab = g.nolabel ? 0 : 10 * Math.max(s, 0.7);
  const maxRows = Math.max(1, Math.floor((h - top - lab - 2) / p));
  let rows = g.rows || (g.count <= 12 ? 1 : g.count <= 24 ? 2 : 4);
  rows = Math.max(1, Math.min(rows, maxRows, g.count));
  const cols = Math.ceil(g.count / rows);
  return { p, lab, rows, cols, bw: cols * p, bh: rows * p + lab };
}
function layoutFace(def, face, w, h) {
  const key = `${def.id}|${face}|${w}|${h}|${JSON.stringify(def.groups.map((g) => [g.id, g.label, g.count, g.conn, g.face, g.rows, g.pos]))}|${JSON.stringify(def.layout?.[face] || null)}`;
  if (layoutCache.has(key)) return layoutCache.get(key);
  const gs = def.groups.filter((g) => g.face === face);
  let best = null;
  const fixed = def.layout?.[face];
  if (fixed) {
    // positions set by dragging port groups in the Library
    const s = fixed.s || 1, pad = 14, top = 14;
    const ports = [], labels = [], blocks = [];
    let bottom = top;
    for (const g of [...gs.filter((g) => g.pos), ...gs.filter((g) => !g.pos)]) {
      const dm = groupDims(g, s, h, top);
      const x = g.pos ? g.pos.x : pad, y = g.pos ? g.pos.y : bottom + 3;
      if (!g.nolabel) labels.push({ x, y, text: g.label, s });
      for (let i = 0; i < g.count; i++) {
        const r = Math.floor(i / dm.cols), c = i % dm.cols;
        ports.push({ gid: g.id, n: i + 1, x: x + c * dm.p, y: y + dm.lab + r * dm.p, p: dm.p, conn: g.conn, dir: g.dir });
      }
      blocks.push({ gid: g.id, x, y, w: dm.bw, h: dm.bh });
      bottom = Math.max(bottom, y + dm.bh);
    }
    best = { ports, labels, blocks, s, fixed: true };
    layoutCache.set(key, best);
    return best;
  }
  for (let s = 1; s >= 0.3; s -= 0.06) {
    const pad = 14, top = 14; let x = pad, y = top, bandH = 0, maxR = 0;
    const ports = [], labels = [], blocks = [];
    for (const g of gs) {
      const { p, lab, cols, bw, bh } = groupDims(g, s, h, top);
      if (x + bw > w - pad && x > pad) { x = pad; y += bandH + 3; bandH = 0; }
      blocks.push({ gid: g.id, x, y, w: bw, h: bh });
      if (!g.nolabel) labels.push({ x, y, text: g.label, s });
      for (let i = 0; i < g.count; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        ports.push({ gid: g.id, n: i + 1, x: x + c * p, y: y + lab + r * p, p, conn: g.conn, dir: g.dir });
      }
      x += bw + 12 * s; bandH = Math.max(bandH, bh); maxR = Math.max(maxR, x - 12 * s);
    }
    best = { ports, labels, blocks, s };
    if (y + bandH <= h - 1 && maxR <= w - pad + 2) break;
  }
  layoutCache.set(key, best);
  return best;
}
function portShape(conn, p) {
  const d = p * 0.68;
  if (conn === 'phoenix') return { w: p * 0.62, h: p * 0.5 };
  if (conn === 'iec' || conn === 'nema') return { w: p * 0.7, h: p * 0.52 };
  if (conn === 'rj45' || conn === 'sfp') return { w: p * 0.66, h: p * 0.56 };
  if (['hdmi', 'usb', 'usbc', 'thunderbolt', 'displayport', 'lc', 'toslink'].includes(conn)) return { w: p * 0.72, h: p * 0.38 };
  return { w: d, h: d };
}

// which device sits in each U (left/right half) of a rack.
// `ov` optionally overrides some devices' places, to test a move before making it.
function occupancy(rack, ov = null) {
  const occ = {}; for (let u = 1; u <= rack.ru; u++) occ[u] = { L: null, R: null };
  for (const d of project.devices) {
    const place = ov?.get(d.id) || d.place;
    if (place?.type !== 'rack' || place.rackId !== rack.id) continue;
    const def = idx.def.get(d.defId); const ru = def?.ru || 1;
    for (let u = place.u; u < place.u + ru; u++) {
      const o = occ[u];
      if (!o) { occ.over = true; continue; }
      if (place.side === 'full') { if (o.L || o.R) occ.clash = true; o.L = d.id; o.R = d.id; }
      else { if (o[place.side]) occ.clash = true; o[place.side] = d.id; }
    }
  }
  return occ;
}
function canPlace(rack, u, ru, side, ignoreId) {
  if (u < 1 || u + ru - 1 > rack.ru) return false;
  const occ = occupancy(rack);
  for (let x = u; x < u + ru; x++) {
    const o = occ[x]; const L = o.L === ignoreId ? null : o.L, R = o.R === ignoreId ? null : o.R;
    if (side === 'full' && (L || R)) return false;
    if (side === 'L' && L) return false;
    if (side === 'R' && R) return false;
  }
  return true;
}

// Work out how to move gear to `dest`. If other gear is in the way in the same
// rack, it slides into the space being vacated (e.g. drag a 5U unit down past a
// 1U unit and the 1U ends up above it). Returns { ok, moves: [[devId, place]], msg }.
function planMove(d, dest) {
  const def = idx.def.get(d.defId); const h = def?.ru || 1;
  if (dest.type === 'loc') {
    const loc = project.locations.find((l) => l.id === dest.locId);
    if (dest.x == null) return { ok: true, moves: [[d.id, { type: 'loc', locId: loc.id }]], shuffled: 0 };
    // pin every other piece of gear in this location to where it is shown now
    const before = locLayout(loc);
    const moves = [[d.id, { type: 'loc', locId: loc.id, x: dest.x, y: dest.y }]];
    for (const o of before.devs) if (o.id !== d.id && o.place.x == null) { const b = before.map.get(o.id); if (b) moves.push([o.id, { ...o.place, x: b.x, y: b.y }]); }
    const sz = devSize(def);
    for (const [oid, b] of before.map) {
      if (oid === d.id) continue;
      if (dest.x < b.x + b.w && dest.x + sz.w > b.x && dest.y < b.y + b.h && dest.y + sz.h > b.y) return { ok: false, msg: `That spot overlaps ${idx.dev.get(oid)?.name}.` };
    }
    return { ok: true, moves, shuffled: 0 };
  }
  if (def.form !== 'rack') return { ok: false, msg: `${def.model} isn't rack-mountable. Change its mounting in the Library first.` };
  const rack = project.racks.find((r) => r.id === dest.rackId);
  const side = def.width === 'half' ? (dest.side === 'full' ? 'L' : dest.side) : 'full';
  const u = dest.u;
  if (u < 1 || u + h - 1 > rack.ru) return { ok: false, msg: `A ${h}U unit at U${u} runs past the bottom of ${rack.name}.` };
  const target = { type: 'rack', rackId: rack.id, u, side };
  if (canPlace(rack, u, h, side, d.id)) return { ok: true, moves: [[d.id, target]], shuffled: 0 };
  if (d.place.type !== 'rack' || d.place.rackId !== rack.id) return { ok: false, msg: `That space in ${rack.name} is taken. Make room there first.` };
  const others = project.devices.filter((x) => x.id !== d.id && x.place.type === 'rack' && x.place.rackId === rack.id);
  const span = (x) => [x.place.u, x.place.u + (idx.def.get(x.defId)?.ru || 1) - 1];
  const moves = [[d.id, target]];
  if (side !== 'full') {
    // half-rack gear trades places with one half-rack unit of the same height
    const hit = others.filter((x) => { const [a, b] = span(x); return a <= u + h - 1 && b >= u && (x.place.side === 'full' || x.place.side === side); });
    const x = hit[0];
    if (hit.length === 1 && x.place.side !== 'full' && x.place.u === u && (idx.def.get(x.defId)?.ru || 1) === h) moves.push([x.id, { ...d.place }]);
    else return { ok: false, msg: 'Half-rack gear can only trade places with another half-rack unit of the same height.' };
  } else {
    const u0 = d.place.u;
    const [r0, r1, shift] = u > u0 ? [u0 + h, u + h - 1, -h] : [u, u0 - 1, h];
    for (const x of others) {
      const [a, b] = span(x);
      if (b < r0 || a > r1) continue;
      if (a < r0 || b > r1) return { ok: false, msg: `${x.name} (${b - a + 1}U) is in the way and can't slide past cleanly. Try one space further, or move it first.` };
      moves.push([x.id, { ...x.place, u: a + shift }]);
    }
  }
  const occ = occupancy(rack, new Map(moves));
  if (occ.clash || occ.over) return { ok: false, msg: "There isn't room to shuffle the gear that way." };
  return { ok: true, moves, shuffled: moves.length - 1 };
}
function applyMoves(moves, msg, extra = moves.length - 1) {
  commit(msg + (extra ? ` (${extra} other item${extra > 1 ? 's' : ''} slid to make room)` : ''), (p) => {
    for (const [id, place] of moves) p.devices.find((x) => x.id === id).place = place;
  });
  if (extra) toast(`${extra} item${extra > 1 ? 's' : ''} slid to make room.`);
}
const rigMode = () => ui.layer === 'rig';
function lockNote(what) {
  return `<div class="note"><span>This is part of the rig. Switch to <b>The rig</b> to ${what}.</span><button data-act="layer" data-layer="rig">Edit the rig</button></div>`;
}
function modeSeg() {
  const b = (v, t) => `<button data-act="layer" data-layer="${v}" class="${v === 'rig' ? 'rigbtn ' : ''}${ui.layer === v ? 'on' : ''}">${t}</button>`;
  return `<div class="seg"><span>Editing</span>${b('patch', 'Patch: ' + esc(patch().name))}${b('rig', 'The rig')}</div>`;
}

function viewMenuHTML() {
  const v = project.view;
  const present = new Set(idx.active.filter((c) => c.kind !== 'dante').map(connType));
  const types = Object.keys(SIGNALS).filter((k) => present.has(k));
  return `<details class="menu view-menu" id="view-menu" ${ui.viewOpen ? 'open' : ''}><summary>View ▾</summary><div class="menu-pop view-pop">
    <label class="field"><span>Cables</span><select id="cable-mode" data-chg="cableMode" data-val="${v.cableMode}"><option value="all">All units</option><option value="picked">Only units I pick</option><option value="none">Hidden</option></select></label>
    <label class="field"><span>Colour cables by</span><select id="color-by" data-chg="viewField" data-f="colorBy" data-val="${v.colorBy}"><option value="type">Signal type</option><option value="cable">Cable colour (length)</option></select></label>
    <div class="eyebrow">Cable types</div>
    <div class="typelist">${types.length ? types.map((k) => `<label class="tog"><input type="checkbox" id="ty-${k}" data-chg="typeVis" data-t="${k}" ${v.hideTypes[k] ? '' : 'checked'}><span class="swl" style="--c:${SIGNALS[k].color}"></span>${esc(SIGNALS[k].name)}</label>`).join('') : '<span class="muted small">No cables in this patch yet.</span>'}</div>
    <hr>
    <label class="tog"><input type="checkbox" id="tg-ties" data-chg="showTies" ${ui.showTies ? 'checked' : ''}> Show in-wall tie lines</label>
    <label class="tog"><input type="checkbox" id="tg-photos" data-chg="viewField" data-f="photos" ${v.photos !== false ? 'checked' : ''}> Show gear photos</label>
    <hr>
    <div class="eyebrow">Jack rings</div>
    <div class="legend"><span><i style="--ring:var(--ring-in)"></i>Input</span><span><i style="--ring:var(--ring-out)"></i>Output</span><span><i style="--ring:var(--ring-io)"></i>Network / two-way</span><span>Filled = source colour · white dot = plugged in</span></div>
  </div></details>`;
}
function rackView() {
  const pt = patch();
  return `<section class="view">
    ${project.sample ? `<div class="note"><span><b>Sample rig built from your Nov 8 patchlist.</b> The inputs match your PDF. Rack layouts, the pocket-to-Rio tie lines and the Dante numbering are placeholders, so move gear and fix routes to match the real thing. Gear marked <span class="pill unv">unverified</span> needs checking against the manual.</span><button data-act="dismissSample">Got it</button></div>` : ''}
    <div class="toolbar">
      ${modeSeg()}
      ${rigMode() ? `<div class="seg"><span>New connections</span><button data-act="newKind" data-k="cable" class="${ui.newKind !== 'tie' ? 'on' : ''}">Cables</button><button data-act="newKind" data-k="tie" class="${ui.newKind === 'tie' ? 'on' : ''}">Tie lines</button></div>` : ''}
      <span class="spacer"></span>
      ${viewMenuHTML()}
      ${rigMode() ? '<button data-act="addRack">+ Rack</button><button data-act="addLoc">+ Location</button>' : ''}
    </div>
    ${ui.pick && port(ui.pick) ? `<div class="note pick"><span><b>Click the jack to connect to ${esc(portLong(ui.pick))}.</b> Use Front / Rear / Front + Rear to reach the other side of a rack. Esc cancels.</span><button data-act="cancelPick">Cancel</button></div>` : ''}
    <div class="mode-hint ${rigMode() ? 'rig' : ''}">${rigMode()
      ? '<b>Editing the rig.</b> Changes apply to every patch. Drag gear by its name strip; drag from jack to jack (or Shift-click) to connect.'
      : `<b>Editing ${esc(pt.name)}.</b> Gear is locked. Cables and sources you add belong to this patch only.`}</div>
    <div class="rack-split">
      <div class="stage ${rigMode() ? 'rig' : ''}" id="stage" data-keep-scroll>
        <div class="stage-inner" id="stage-inner">
          ${stageHTML()}
          <svg class="cables" id="cables"></svg>
        </div>
      </div>
      <aside class="inspector" id="inspector">${inspectorHTML()}</aside>
    </div>
  </section>`;
}
// The stage is a stack of locations (Stage, FOH…). Each shows its racks and its
// loose gear. Racks not yet in a location are shown first.
function stageHTML() {
  const locIds = new Set(project.locations.map((l) => l.id));
  const loose = project.racks.filter((r) => !r.locId || !locIds.has(r.locId));
  let html = loose.length ? areaHTML(null, loose) : '';
  for (const l of project.locations) html += areaHTML(l, project.racks.filter((r) => r.locId === l.id));
  return html || `<p class="muted" style="margin:0">Nothing here yet.${rigMode() ? ' Use + Location and + Rack above.' : ' Switch to The rig to add locations and racks.'}</p>`;
}
function areaHTML(loc, racks) {
  if (!loc) {
    return `<section class="area"><div class="area-head"><span class="area-title muted">Racks not in a location</span>${rigMode() ? '<span class="small muted">Choose a location in each rack’s panel (click the rack name).</span>' : ''}</div>
      <div class="area-row">${racks.map(rackHTML).join('')}</div></section>`;
  }
  const sel = ui.sel?.kind === 'loc' && ui.sel.id === loc.id;
  const gear = project.devices.some((d) => d.place?.type === 'loc' && d.place.locId === loc.id);
  return `<section class="area loc" data-loc="${loc.id}">
    <div class="area-head"><button class="rack-title area-title" data-act="selLoc" data-id="${loc.id}" ${sel ? 'style="color:var(--accent)"' : ''}>${esc(loc.name)}</button>
      ${rigMode() ? `<button class="face-btn" data-act="addRack" data-loc="${loc.id}">+ Rack</button><button class="face-btn" data-act="locAdd" data-id="${loc.id}">+ Gear</button><span class="reorder"><button data-act="moveLoc" data-id="${loc.id}" data-d="-1" title="Move up" aria-label="Move location up">▲</button><button data-act="moveLoc" data-id="${loc.id}" data-d="1" title="Move down" aria-label="Move location down">▼</button></span>` : ''}</div>
    <div class="area-row">${racks.map(rackHTML).join('')}${gear || rigMode() ? locGearHTML(loc, racks.length > 0) : ''}${!racks.length && !gear && !rigMode() ? '<span class="muted small">Empty</span>' : ''}</div>
  </section>`;
}
function faceBtn(id) {
  const f = ui.faces[id] || 'front';
  return `<button class="face-btn" data-act="flip" data-id="${id}" title="Switch view: front, rear, or both side by side">${f === 'front' ? 'Front' : f === 'rear' ? 'Rear' : 'Front + Rear'} ⇄</button>`;
}
function rackHTML(rack) {
  const view = ui.faces[rack.id] || 'front';
  const faces = view === 'both' ? ['front', 'rear'] : [view];
  const sel = ui.sel?.kind === 'rack' && ui.sel.id === rack.id;
  return `<div class="rack" data-rack-id="${rack.id}">
    <div class="rack-head"><button class="rack-title" data-act="selRack" data-id="${rack.id}" ${sel ? 'style="color:var(--accent)"' : ''}>${esc(rack.name)}</button><span class="muted small mono">${rack.ru}U</span>${faceBtn(rack.id)}${rigMode() ? `<span class="reorder"><button data-act="moveRack" data-id="${rack.id}" data-d="-1" title="Move rack left" aria-label="Move rack left">◀</button><button data-act="moveRack" data-id="${rack.id}" data-d="1" title="Move rack right" aria-label="Move rack right">▶</button></span>` : ''}</div>
    <div class="rack-faces">${faces.map((f) => rackFaceHTML(rack, f, faces.length > 1)).join('')}</div>
    ${rigMode() ? `<div class="rack-foot"><button data-act="rackRU" data-id="${rack.id}" data-d="-1" ${rack.ru <= rackMinRU(rack) ? 'disabled title="Gear is in the bottom space"' : ''}>− 1U</button><span class="muted small">drag the bottom edge or use the buttons</span><button data-act="rackRU" data-id="${rack.id}" data-d="1">+ 1U</button></div>` : ''}
  </div>`;
}
function rackFaceHTML(rack, face, caption) {
  const occ = occupancy(rack);
  const H = rack.ru * U;
  const selSlot = ui.sel?.kind === 'slot' && ui.sel.rackId === rack.id ? ui.sel : null;
  let slots = '', rail = '';
  for (let u = 1; u <= rack.ru; u++) {
    const top = (u - 1) * U;
    rail += `<span style="top:${top + U / 2 - 4}px">${u}</span><i style="top:${top + 6}px"></i><i style="top:${top + U - 11}px"></i>`;
    const o = occ[u];
    const slot = (side) => {
      const left = side === 'full' ? 0 : ((side === 'L') === (face === 'front') ? 0 : W / 2);
      const w = side === 'full' ? W : W / 2;
      const on = selSlot && selSlot.u === u && selSlot.side === side;
      return `<div class="slot ${on ? 'sel' : ''}" data-act="slot" data-rack="${rack.id}" data-u="${u}" data-side="${side}" style="top:${top}px;left:${left}px;width:${w}px;height:${U}px">+ add gear at U${u}${side === 'full' ? '' : ' ' + (side === 'L' ? 'left' : 'right')}</div>`;
    };
    if (!rigMode()) continue;
    if (!o.L && !o.R) slots += slot('full');
    else { if (!o.L) slots += slot('L'); if (!o.R) slots += slot('R'); }
  }
  const devs = project.devices.filter((d) => d.place?.type === 'rack' && d.place.rackId === rack.id).map((d) => {
    const def = idx.def.get(d.defId); if (!def) return '';
    const side = d.place.side || 'full';
    const left = side === 'full' ? 0 : ((side === 'L') === (face === 'front') ? 0 : W / 2);
    return devHTML(d, def, face, { top: (d.place.u - 1) * U, left, w: side === 'full' ? W : W / 2, h: def.ru * U, cls: side === 'full' ? '' : 'half-' + side });
  }).join('');
  return `<div class="rack-face">${caption ? `<div class="face-cap">${face}</div>` : ''}
    <div class="rack-body">
      <div class="rail" style="height:${H}px">${rail}</div>
      <div class="rack-bay" data-rack="${rack.id}" data-face="${face}" style="width:${W}px;height:${H}px">${slots}${devs}</div>
      <div class="rail" style="height:${H}px">${rail}</div>
      ${rigMode() ? `<div class="rack-grip" data-rack="${rack.id}" title="Drag to make the rack taller or shorter"></div>` : ''}
    </div></div>`;
}
const LOC_GRID = 10, LOC_MIN_W = 550;
const devSize = (def) => ({ w: def.width === 'half' ? W / 2 : W, h: (def.ru || 1) * U });
// where each piece of gear sits inside a location. Gear never dragged there is
// laid out automatically (in rows), or stacked below gear that has been placed.
function locLayout(loc, ov = null) {
  const devs = project.devices.filter((d) => { const pl = ov?.get(d.id) || d.place; return pl?.type === 'loc' && pl.locId === loc.id; });
  const map = new Map(); let right = 0, bottom = 0;
  const placeOf = (d) => ov?.get(d.id) || d.place;
  const anyFixed = devs.some((d) => placeOf(d).x != null);
  for (const d of devs) {
    const pl = placeOf(d); if (pl.x == null) continue;
    const def = idx.def.get(d.defId); if (!def) continue; const sz = devSize(def);
    map.set(d.id, { x: pl.x, y: pl.y, ...sz }); right = Math.max(right, pl.x + sz.w); bottom = Math.max(bottom, pl.y + sz.h);
  }
  let x = LOC_GRID, y = anyFixed ? bottom + LOC_GRID : LOC_GRID, rowH = 0;
  for (const d of devs) {
    if (placeOf(d).x != null) continue;
    const def = idx.def.get(d.defId); if (!def) continue; const sz = devSize(def);
    if (x + sz.w > LOC_MIN_W - LOC_GRID && x > LOC_GRID) { x = LOC_GRID; y += rowH + LOC_GRID; rowH = 0; }
    map.set(d.id, { x, y, ...sz });
    right = Math.max(right, x + sz.w); bottom = Math.max(bottom, y + sz.h);
    x += sz.w + LOC_GRID; rowH = Math.max(rowH, sz.h);
  }
  return { map, devs, w: Math.max(LOC_MIN_W, right + LOC_GRID), h: Math.max(64, bottom + LOC_GRID) };
}
function locGearHTML(loc, withCaption) {
  const view = ui.faces[loc.id] || 'front';
  const faces = view === 'both' ? ['front', 'rear'] : [view];
  const lay = locLayout(loc);
  const bodyFor = (face) => lay.devs.map((d) => {
    const def = idx.def.get(d.defId); const b = lay.map.get(d.id); if (!def || !b) return '';
    return devHTML(d, def, face, { top: b.y, left: b.x, w: b.w, h: b.h, cls: 'free' });
  }).join('');
  return `<div class="loc-gear">
    <div class="rack-head">${withCaption ? '<span class="face-cap" style="margin:0">Gear outside racks</span>' : ''}${lay.devs.length ? faceBtn(loc.id) : ''}</div>
    <div class="rack-faces">${faces.map((f) => `<div class="rack-face">${faces.length > 1 ? `<div class="face-cap">${f}</div>` : ''}<div class="loc-body" data-face="${f}" style="width:${lay.w}px;height:${lay.h}px">${bodyFor(f) || `<span class="loc-empty">No loose gear.${rigMode() ? ' Use “+ Gear”, or drag gear here.' : ''}</span>`}</div></div>`).join('')}</div>
  </div>`;
}
function devHTML(d, def, face, box) {
  const lay = layoutFace(def, face, box.w, box.h);
  const selDev = ui.sel?.kind === 'device' && ui.sel.id === d.id;
  const hl = highlightSet();
  const sub = d.zone ? `${d.zone} · ${d.position || ''}` : `${def.make} ${def.model}`;
  const photo = project.view.photos !== false && def.images?.[face] ? ` photo ph-${phCls(def.id)}-${face}` : '';
  let html = `<div class="dev ${box.cls || ''} ${def.style ? 'st-' + def.style : ''} ${selDev ? 'sel' : ''}${photo}" data-dev="${d.id}" style="${box.free ? '' : `top:${box.top}px;left:${box.left}px;`}width:${box.w}px;height:${box.h}px">`;
  html += `<div class="dev-label" data-act="selDev" data-id="${d.id}" title="${esc(def.make + ' ' + def.model)}"><b>${esc(d.name)}</b> <em>${esc(sub)}</em>${def.verified ? '' : '<span class="unv">· unverified</span>'}</div>`;
  const mode = project.view.cableMode;
  if (mode !== 'none' && !def.style && !box.preview && def.groups.some(isPhysical)) {
    const on = cablesOn(d.id);
    html += `<button class="cab-tog ${on ? 'on' : ''}" data-act="cabTog" data-id="${d.id}" title="${on ? 'Hide' : 'Show'} this unit's cables" aria-pressed="${on}">cables</button>`;
  }
  if (!lay.ports.length && !def.style) html += `<div class="dev-empty">No connectors on the ${face}</div>`;
  if (def.style === 'drawer') html += `<div class="dev-empty"></div>`;
  for (const l of lay.labels) html += `<div class="grp-label" style="left:${l.x}px;top:${l.y}px;font-size:${Math.max(7, 8.5 * l.s)}px">${esc(l.text)}</div>`;
  for (const pp of lay.ports) {
    const ref = mkRef(d.id, pp.gid, pp.n);
    const sh = portShape(pp.conn, pp.p);
    const x = pp.x + (pp.p - sh.w) / 2, y = pp.y + (pp.p * 0.72 - sh.h) / 2;
    const src = idx.mark.get(ref);
    const grp = src && project.groups.find((g) => g.id === src.groupId);
    const fill = grp ? `--fill:${grp.color};` : idx.outMark.get(ref) ? '--fill:#5b6f86;' : '';
    const cls = ['port', 'c-' + pp.conn, 'd-' + pp.dir];
    if (idx.cables.get(ref)) cls.push('plugged');
    if ((ui.sel?.kind === 'port' && ui.sel.ref === ref) || ui.pick === ref) cls.push('sel');
    else if (hl.has(ref)) cls.push('hl');
    const p = port(ref);
    const num = p ? portNum(p) : pp.n;
    const tip = [portLong(ref), ipOf(ref) ? `IP ${ipOf(ref)}` : '', src ? `Source: ${src.name}` : '', ...(idx.out.get(ref) || []).concat(idx.in.get(ref) || []).filter((c) => c.kind !== 'dante').map((c) => '↔ ' + portLong(c.a === ref ? c.b : c.a))].filter(Boolean).join('\n');
    html += `<div class="${cls.join(' ')}" data-ref="${ref}" title="${esc(tip)}" style="${fill}left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${sh.w.toFixed(1)}px;height:${sh.h.toFixed(1)}px"></div>`;
    if (lay.s > 0.45) html += `<div class="pn" style="left:${pp.x.toFixed(1)}px;width:${pp.p.toFixed(1)}px;top:${(pp.y + pp.p * 0.72).toFixed(1)}px;font-size:${Math.max(6.5, 8 * lay.s).toFixed(1)}px">${esc(num)}</div>`;
  }
  return html + '</div>';
}
let hlCache = null;
function highlightSet() {
  if (hlCache && hlCache.key === JSON.stringify(ui.sel) + project.modified + ui.patchId) return hlCache.set;
  const set = new Set();
  const addRef = (r) => { for (const x of traceTree(r).parent.keys()) set.add(x); for (const x of traceTree(r, prev).parent.keys()) set.add(x); };
  if (ui.sel?.kind === 'port') addRef(ui.sel.ref);
  if (ui.sel?.kind === 'source') { const s = patch().sources.find((x) => x.id === ui.sel.id); for (const r of s?.ports || []) if (r && port(r)) for (const x of traceTree(r).parent.keys()) set.add(x); }
  if (ui.sel?.kind === 'output') { const o = patch().outputs.find((x) => x.id === ui.sel.id); if (o?.port && port(o.port)) addRef(o.port); }
  if (ui.sel?.kind === 'conn') { const c = project.connections.find((x) => x.id === ui.sel.id); if (c) { set.add(c.a); set.add(c.b); } }
  hlCache = { key: JSON.stringify(ui.sel) + project.modified + ui.patchId, set };
  return set;
}

function cablesOn(devId) {
  const v = project.view.cables[devId];
  return project.view.cableMode === 'picked' ? v === true : v !== false;
}
function drawCables() {
  const svg = $('#cables'), inner = $('#stage-inner'); if (!svg || !inner) return;
  svg.setAttribute('width', inner.scrollWidth); svg.setAttribute('height', inner.scrollHeight);
  if (project.view.cableMode === 'none') { svg.innerHTML = ''; return; }
  const box = inner.getBoundingClientRect();
  const pos = new Map();
  for (const el of $$('.port', inner)) {
    const r = el.getBoundingClientRect();
    pos.set(el.dataset.ref, [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]);
  }
  let html = '';
  const selConn = ui.sel?.kind === 'conn' ? ui.sel.id : null;
  for (const c of idx.active) {
    if (c.kind === 'dante') continue;
    if (c.kind === 'tie' && !ui.showTies) continue;
    const da = parseRef(c.a).devId, db = parseRef(c.b).devId;
    if (project.view.cableMode === 'picked' ? !(cablesOn(da) || cablesOn(db)) : !(cablesOn(da) && cablesOn(db))) continue;
    const t = connType(c); if (project.view.hideTypes[t]) continue;
    const S = SIGNALS[t] || SIGNALS.other;
    // draw a cable only between the jacks it is really plugged into (both must be on screen)
    const a = pos.get(c.a), b = pos.get(c.b); if (!a || !b) continue;
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sag = Math.min(140, 24 + dist * 0.22);
    const d = `M${a[0]},${a[1]} C${a[0]},${a[1] + sag} ${b[0]},${b[1] + sag} ${b[0]},${b[1]}`;
    const physical = project.cableColors.find((x) => x.id === c.color)?.hex;
    const col = project.view.colorBy === 'cable' ? (physical || (c.kind === 'tie' ? '#7b8590' : S.color)) : S.color;
    const dash = c.kind === 'tie' ? 'stroke-dasharray="3 4"' : S.dash ? `stroke-dasharray="${S.dash}"` : '';
    const wd = S.w || 2.6;
    const sel = c.id === selConn;
    // rig cables get a dark outline; cables that belong to this patch only get a light one
    html += `<path d="${d}" fill="none" stroke="${c.layer === 'rig' ? '#000' : '#fff'}" stroke-opacity="${c.layer === 'rig' ? '.55' : '.7'}" stroke-width="${(sel ? 4.5 : 2.4) + wd}" stroke-linecap="round"/>`;
    html += `<path d="${d}" fill="none" stroke="${sel ? '#f2a900' : col}" stroke-width="${sel ? wd + 1.4 : wd}" stroke-linecap="round" ${dash}/>`;
    html += `<path class="hit" data-conn="${c.id}" d="${d}" fill="none" stroke="transparent" stroke-width="12"><title>${esc(`${portLong(c.a)} → ${portLong(c.b)}\n${sigName(t)}${c.spec ? ' · ' + c.spec : ''}${c.kind === 'tie' ? ' · tie line' : ''}${c.layer === 'rig' ? '' : ' · this patch only'}`)}</title></path>`;
  }
  html += `<path id="cable-temp" fill="none" stroke="#6fbf8e" stroke-width="3" stroke-dasharray="6 4" d=""/>`;
  svg.innerHTML = html;
}

// drag-to-patch
let drag = null;
function onPointerDown(e) {
  if (e.button > 0) return;
  if (e.target.closest('.cab-tog')) return;
  const grip = e.target.closest('.rack-grip');
  if (grip && rigMode()) { startRackResize(e, grip); return; }
  const gb = e.target.closest('.grp-box');
  if (gb) { startGroupDrag(e, gb); return; }
  const lab = e.target.closest('.dev-label');
  if (lab && rigMode() && lab.closest('#stage-inner')) { startDevDrag(e, lab); return; }
  const el = e.target.closest('.port'); if (!el || !el.closest('#stage-inner')) return;
  e.preventDefault();
  const inner = $('#stage-inner').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  drag = { from: el.dataset.ref, x0: e.clientX, y0: e.clientY, moved: false, ax: r.left - inner.left + r.width / 2, ay: r.top - inner.top + r.height / 2 };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}
function onPointerMove(e) {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
  drag.moved = true;
  const inner = $('#stage-inner').getBoundingClientRect();
  const x = e.clientX - inner.left, y = e.clientY - inner.top;
  const t = $('#cable-temp');
  if (t) t.setAttribute('d', `M${drag.ax},${drag.ay} C${drag.ax},${drag.ay + 60} ${x},${y + 60} ${x},${y}`);
  for (const p of $$('.port.drop')) p.classList.remove('drop');
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.port');
  if (over && over.dataset.ref !== drag.from) over.classList.add('drop');
}
function onPointerUp(e) {
  window.removeEventListener('pointermove', onPointerMove);
  const d = drag; drag = null; if (!d) return;
  if (!d.moved) {
    const from = ui.pick || (e.shiftKey && ui.sel?.kind === 'port' ? ui.sel.ref : null);
    ui.pick = null;
    if (from && from !== d.from) { connect(from, d.from, { keepSel: from }); return; }
    select({ kind: 'port', ref: d.from }); return;
  }
  suppressNextClick();
  const t = $('#cable-temp'); if (t) t.setAttribute('d', '');
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.port');
  if (over && over.dataset.ref !== d.from) connect(d.from, over.dataset.ref);
}
// dragging gear by its name strip (rig mode only)
let devDrag = null;
function suppressNextClick() { ui.suppressClick = true; setTimeout(() => { ui.suppressClick = false; }, 0); }
function startDevDrag(e, lab) {
  e.preventDefault();
  const el = lab.closest('.dev'); const r = el.getBoundingClientRect();
  devDrag = { id: lab.dataset.id, el, x0: e.clientX, y0: e.clientY, moved: false, grabU: Math.max(0, Math.floor((e.clientY - r.top) / U)), grabX: e.clientX - r.left, grabY: e.clientY - r.top, plan: null, target: null };
  window.addEventListener('pointermove', onDevMove);
  window.addEventListener('pointerup', onDevUp, { once: true });
}
function devDropTarget(e) {
  const d = idx.dev.get(devDrag.id); const def = idx.def.get(d.defId); const h = def.ru || 1;
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const bay = hit?.closest('.rack-bay');
  if (bay) {
    const rack = project.racks.find((r) => r.id === bay.dataset.rack); const br = bay.getBoundingClientRect();
    const u = Math.max(1, Math.min(rack.ru - h + 1, Math.floor((e.clientY - br.top) / U) + 1 - devDrag.grabU));
    const face = bay.dataset.face || 'front';
    const leftHalf = e.clientX - br.left < W / 2;
    const side = def.width === 'half' ? (leftHalf === (face === 'front') ? 'L' : 'R') : 'full';
    const left = side === 'full' ? 0 : ((side === 'L') === (face === 'front') ? 0 : W / 2);
    return { dest: { type: 'rack', rackId: rack.id, u, side }, el: bay, top: (u - 1) * U, left, w: side === 'full' ? W : W / 2, h: Math.min(h, rack.ru) * U };
  }
  const loc = hit?.closest('.loc');
  if (loc) {
    const body = hit.closest('.loc-body') || loc.querySelector('.loc-body'); if (!body) return null;
    const br = body.getBoundingClientRect(); const sz = devSize(def);
    const snap = (v) => Math.round(v / LOC_GRID) * LOC_GRID;
    const x = Math.max(0, Math.min(1200 - sz.w, snap(e.clientX - br.left - devDrag.grabX)));
    const y = Math.max(0, Math.min(br.height + 2 * U, snap(e.clientY - br.top - devDrag.grabY)));
    return { dest: { type: 'loc', locId: loc.dataset.loc, x, y }, el: body, top: y, left: x, w: sz.w, h: sz.h };
  }
  return null;
}
function onDevMove(e) {
  if (!devDrag) return;
  if (!devDrag.moved && Math.hypot(e.clientX - devDrag.x0, e.clientY - devDrag.y0) < 5) return;
  if (!devDrag.moved) { devDrag.moved = true; devDrag.el.classList.add('dragging'); }
  let g = $('#dev-ghost');
  if (!g) { g = document.createElement('div'); g.id = 'dev-ghost'; g.className = 'ghost'; $('#stage-inner').appendChild(g); }
  const t = devDropTarget(e); devDrag.target = t;
  if (!t) { g.hidden = true; devDrag.plan = null; return; }
  const plan = planMove(idx.dev.get(devDrag.id), t.dest); devDrag.plan = plan;
  const inner = $('#stage-inner').getBoundingClientRect(), br = t.el.getBoundingClientRect();
  Object.assign(g.style, { left: `${br.left - inner.left + t.left}px`, top: `${br.top - inner.top + t.top}px`, width: `${t.w}px`, height: `${t.h}px` });
  g.hidden = false; g.classList.toggle('bad', !plan.ok);
  g.textContent = !plan.ok ? "✕ Can't go here" : t.dest.type === 'loc' ? ''
    : `U${t.dest.u}${plan.shuffled ? ` · ${plan.shuffled} item${plan.shuffled > 1 ? 's' : ''} will slide over` : ''}`;
}
function onDevUp() {
  window.removeEventListener('pointermove', onDevMove);
  const dd = devDrag; devDrag = null; $('#dev-ghost')?.remove();
  if (!dd || !dd.moved) return;               // a plain click selects via the click handler
  suppressNextClick();
  dd.el.classList.remove('dragging');
  const d = idx.dev.get(dd.id);
  if (!dd.plan || !dd.target) { render(); return; }
  if (!dd.plan.ok) { toast(dd.plan.msg, 5000); render(); return; }
  const dest = dd.target.dest;
  const same = dest.type === 'loc' ? d.place.type === 'loc' && d.place.locId === dest.locId && d.place.x === dest.x && d.place.y === dest.y
    : d.place.type === 'rack' && d.place.rackId === dest.rackId && d.place.u === dest.u && d.place.side === (dest.side === 'full' && idx.def.get(d.defId).width === 'half' ? 'L' : dest.side);
  if (same) { render(); return; }
  const where = dest.type === 'loc' ? project.locations.find((l) => l.id === dest.locId)?.name : `${project.racks.find((r) => r.id === dest.rackId)?.name} U${dest.u}`;
  ui.sel = { kind: 'device', id: d.id };
  applyMoves(dd.plan.moves, `Moved ${d.name} to ${where}`, dd.plan.shuffled);
}
// resizing a rack by dragging its bottom edge (rig mode)
let rackDrag = null;
function rackMinRU(rack) {
  let min = 1;
  for (const d of project.devices) if (d.place.type === 'rack' && d.place.rackId === rack.id) min = Math.max(min, d.place.u + (idx.def.get(d.defId)?.ru || 1) - 1);
  return min;
}
function startRackResize(e, grip) {
  e.preventDefault();
  const rack = project.racks.find((r) => r.id === grip.dataset.rack);
  rackDrag = { rack, y0: e.clientY, ru: rack.ru, min: rackMinRU(rack), bay: grip.closest('.rack').querySelector('.rack-bay') };
  window.addEventListener('pointermove', onRackResize);
  window.addEventListener('pointerup', endRackResize, { once: true });
}
function onRackResize(e) {
  if (!rackDrag) return;
  const r = rackDrag;
  r.ru = Math.max(r.min, Math.min(60, r.rack.ru + Math.round((e.clientY - r.y0) / U)));
  let g = $('#rack-ghost');
  if (!g) { g = document.createElement('div'); g.id = 'rack-ghost'; g.className = 'ghost'; $('#stage-inner').appendChild(g); }
  const inner = $('#stage-inner').getBoundingClientRect(), br = r.bay.getBoundingClientRect();
  Object.assign(g.style, { left: `${br.left - inner.left}px`, top: `${br.top - inner.top}px`, width: `${br.width}px`, height: `${r.ru * U}px` });
  g.classList.toggle('bad', r.ru === r.min && e.clientY - r.y0 < (r.min - r.rack.ru) * U - U / 2);
  g.textContent = `${r.ru}U${r.ru === r.min && r.min > 1 ? ' (gear below stops it shrinking further)' : ''}`;
}
function endRackResize() {
  window.removeEventListener('pointermove', onRackResize);
  const r = rackDrag; rackDrag = null; $('#rack-ghost')?.remove();
  if (!r) return;
  suppressNextClick();
  if (r.ru !== r.rack.ru) commit(`Resized ${r.rack.name} to ${r.ru}U`, () => { r.rack.ru = r.ru; });
}

// dragging a port group around a panel in the Library preview
let grpDrag = null;
function startGroupDrag(e, box) {
  e.preventDefault();
  grpDrag = { box, face: box.dataset.face, gid: box.dataset.gid, x0: e.clientX, y0: e.clientY, left: parseFloat(box.style.left), top: parseFloat(box.style.top), moved: false };
  window.addEventListener('pointermove', onGroupDrag);
  window.addEventListener('pointerup', endGroupDrag, { once: true });
}
const GRID = 4;
function grpTarget(e, g = grpDrag) {
  const pv = g.box.parentElement;
  const snap = (v) => Math.round(v / GRID) * GRID;
  const x = Math.max(0, Math.min(pv.offsetWidth - g.box.offsetWidth, snap(g.left + e.clientX - g.x0)));
  const y = Math.max(0, Math.min(pv.offsetHeight - g.box.offsetHeight, snap(g.top + e.clientY - g.y0)));
  return { x, y };
}
function onGroupDrag(e) {
  if (!grpDrag) return;
  if (!grpDrag.moved && Math.hypot(e.clientX - grpDrag.x0, e.clientY - grpDrag.y0) < 3) return;
  grpDrag.moved = true; grpDrag.box.classList.add('moving');
  const t = grpTarget(e);
  grpDrag.box.style.left = t.x + 'px'; grpDrag.box.style.top = t.y + 'px';
}
function endGroupDrag(e) {
  window.removeEventListener('pointermove', onGroupDrag);
  const g = grpDrag; grpDrag = null; if (!g || !g.moved) return;
  suppressNextClick();
  const t = grpTarget(e, g);
  const def = libDef(); const sz = devSize(def);
  const lay = layoutFace(def, g.face, sz.w, sz.h);
  commit(`Moved ${def.groups.find((x) => x.id === g.gid)?.label} on the ${g.face} of ${def.model}`, () => {
    def.layout ||= {};
    def.layout[g.face] = { s: lay.s };
    for (const b of lay.blocks) { const grp = def.groups.find((x) => x.id === b.gid); if (grp) grp.pos = { x: b.x, y: b.y }; }
    def.groups.find((x) => x.id === g.gid).pos = { x: t.x, y: t.y };
    layoutCache.clear();
  });
}

function connect(a, b, opts = {}) {
  let pa = port(a), pb = port(b); if (!pa || !pb) return;
  if (!isPhysical(pa.g) || !isPhysical(pb.g)) { toast('Dante channels are routed in the Dante tab.'); return; }
  if ((pa.g.dir === 'in' && pb.g.dir !== 'in') || (pb.g.dir === 'out' && pa.g.dir !== 'out')) { [a, b] = [b, a]; [pa, pb] = [pb, pa]; }
  if (idx.active.some((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a))) { toast('Those two jacks are already connected.'); return; }
  const kind = opts.kind || (rigMode() && ui.newKind === 'tie' ? 'tie' : 'cable');
  const layer = kind === 'tie' || rigMode() ? 'rig' : patch().id;
  const id = uid('c');
  commit(`${kind === 'tie' ? 'Added tie line' : 'Cabled'} ${portLong(a)} → ${portLong(b)}${layer === 'rig' && kind !== 'tie' ? ' (rig)' : ''}`, (p) => p.connections.push({ id, a, b, kind, layer, color: '' }), { quiet: true });
  if (kind === 'tie' && !ui.showTies) ui.showTies = true;
  ui.sel = opts.keepSel ? { kind: 'port', ref: opts.keepSel } : { kind: 'conn', id };
  render();
  const mine = checks.filter((c) => c.sev !== 'info' && c.sel && ((c.sel.kind === 'conn' && c.sel.id === id) || (c.sel.kind === 'port' && (c.sel.ref === a || c.sel.ref === b))));
  if (mine.length) toast('⚠ ' + mine[0].msg, 5000); else toast(`Patched ${portLabel(a)} → ${portLabel(b)}`);
}
function select(sel) { ui.sel = sel; ui.addQuery = ''; ui.connQuery = ''; render(); }

/* ---------- 7. inspector ---------- */
function confirmBtn(act, label, attrs = '') {
  const armed = ui.armed === act + attrs;
  return `<button class="danger ${armed ? 'armed' : ''}" data-act="${armed ? act : 'arm'}" data-arm="${esc(act + attrs)}" ${attrs}>${armed ? 'Click again to confirm' : label}</button>`;
}
function inspectorHTML() {
  const s = ui.sel;
  if (!s) return inspectorHome();
  if (s.kind === 'slot') return addGearHTML(`Add gear to ${esc(project.racks.find((r) => r.id === s.rackId)?.name)} at U${s.u}`, s);
  if (s.kind === 'locAdd') return addGearHTML(`Add gear to ${esc(project.locations.find((l) => l.id === s.id)?.name)}`, s);
  if (s.kind === 'device') return deviceInspector(idx.dev.get(s.id));
  if (s.kind === 'port') return portInspector(s.ref);
  if (s.kind === 'conn') return connInspector(project.connections.find((c) => c.id === s.id));
  if (s.kind === 'rack') return rackInspector(project.racks.find((r) => r.id === s.id));
  if (s.kind === 'loc') return locInspector(project.locations.find((l) => l.id === s.id));
  if (s.kind === 'source') return sourceInspector(patch().sources.find((x) => x.id === s.id));
  if (s.kind === 'output') return outputInspector(patch().outputs.find((x) => x.id === s.id));
  return inspectorHome();
}
function inspectorHome() {
  const errs = checks.filter((c) => c.sev !== 'info').slice(0, 4);
  return `<div class="eyebrow">How it works</div>
  <ul class="small" style="margin:0;padding-left:18px;display:grid;gap:4px">
    <li><b>Drag</b> from one jack to another to run a cable.</li>
    <li><b>Click a jack</b> to see what's plugged in and trace the signal to the console.</li>
    <li><b>Front/Rear</b> flips a rack. Half-rack items swap sides, just like walking around the back.</li>
    <li><b>Editing: Patch</b> is for this week. Gear is locked, and cables you draw belong to this patch only.</li>
    <li><b>Editing: The rig</b> is for permanent setup: drag gear by its name strip to move it, click an empty space to add gear, reorder racks with ◀ ▶. Cables you draw stay in every patch.</li>
  </ul>
  <div class="eyebrow">Checks</div>
  ${errs.length ? errs.map(checkHTML).join('') + (checks.length > 4 ? `<button data-act="tab" data-tab="checks">See all ${checks.length}</button>` : '') : '<p class="small muted" style="margin:0">No problems found in this patch.</p>'}`;
}
function addGearHTML(title, s) {
  const q = ui.addQuery.toLowerCase();
  let defs = project.library.filter((d) => !q || `${d.make} ${d.model} ${d.category}`.toLowerCase().includes(q));
  let fits = (d) => true;
  if (s.kind === 'slot') {
    const rack = project.racks.find((r) => r.id === s.rackId);
    defs = defs.filter((d) => d.form === 'rack');
    fits = (d) => s.side === 'full'
      ? canPlace(rack, s.u, d.ru, d.width === 'half' ? 'L' : 'full')
      : d.width === 'half' && canPlace(rack, s.u, d.ru, s.side);
  } else defs.sort((a, b) => (a.form === 'rack') - (b.form === 'rack'));
  const byCat = new Map();
  for (const d of defs) push(byCat, d.category || 'other', d);
  let list = '';
  for (const [cat, ds] of byCat) {
    list += `<div class="eyebrow" style="margin-top:6px">${esc(CATEGORY_NAMES[cat] || cat)}</div><div class="list">`;
    for (const d of ds) {
      const ok = fits(d);
      list += `<button data-act="install" data-def="${d.id}" ${ok ? '' : 'disabled title="Does not fit here"'}><span>${esc(d.make)} ${esc(d.model)}</span><small>${d.form === 'rack' ? `${d.ru}U${d.width === 'half' ? ' ½' : ''}` : d.form}</small></button>`;
    }
    list += '</div>';
  }
  return `<h3>${title}</h3>
    <input id="add-q" data-inp="addQuery" placeholder="Search gear…" value="${esc(ui.addQuery)}">
    <div id="add-list">${list || '<p class="muted small">No matching gear. Add it in the Library tab.</p>'}</div>
    <button data-act="newGearFromAdd">+ Define new gear…</button>`;
}
function deviceInspector(d) {
  if (!d) return inspectorHome();
  const def = idx.def.get(d.defId);
  const head = `<div><div class="eyebrow">${esc(def.make)} ${esc(def.model)} · ${def.form === 'rack' ? def.ru + 'U' + (def.width === 'half' ? ' half-width' : '') : def.form}</div>
    <h3>${esc(d.name)}</h3> ${def.verified ? '<span class="pill ver">verified</span>' : '<span class="pill unv">unverified gear definition</span>'}</div>`;
  const nets = netPorts(d);
  const ipRows = nets.map((r) => {
    const p = port(r); const key = `${p.g.id}:${p.n}`; const v = d.ips?.[key] || {};
    const lab = `${esc(p.g.label)} ${esc(portNum(p))}`;
    return rigMode()
      ? `<div class="iprow"><label for="ip-${p.g.id}-${p.n}">${lab}</label><input id="ip-${p.g.id}-${p.n}" class="mono" value="${esc(v.ip || '')}" placeholder="192.168.1.10" data-chg="devIp" data-dev="${d.id}" data-k="${key}" data-f="ip"><input id="ipn-${p.g.id}-${p.n}" value="${esc(v.note || '')}" placeholder="note, e.g. Dante primary" data-chg="devIp" data-dev="${d.id}" data-k="${key}" data-f="note"></div>`
      : `<div class="iprow ro"><span>${lab}</span><span class="mono">${esc(v.ip || '—')}</span><span class="muted small">${esc(v.note || '')}</span></div>`;
  }).join('');
  const ipSec = nets.length ? sec('dev-ip', 'Network &amp; IP addresses', ipRows + '<p class="small muted" style="margin:0">One address per network jack. Every address in the rig is listed in the Dante &amp; IP tab.</p>', true) : '';
  const ref = def.ref ? sec('dev-ref', 'Reference', `<p class="small muted" style="margin:0">${esc(def.ref)}</p>`, false) : '';
  if (!rigMode()) {
    const where = d.place.type === 'rack' ? project.racks.find((r) => r.id === d.place.rackId)?.name : project.locations.find((l) => l.id === d.place.locId)?.name;
    return `${head}
      <dl class="kv"><dt>Where</dt><dd>${esc(where)}</dd>${d.place.type === 'rack' ? `<dt>Position</dt><dd>U${d.place.u}${d.place.side === 'full' ? '' : d.place.side === 'L' ? ', left half' : ', right half'}</dd>` : ''}${d.zone ? `<dt>Stage</dt><dd>${esc(d.zone)} · ${esc(d.position || '')}</dd>` : ''}</dl>
      ${ipSec}${ref}
      ${lockNote('rename, move, relabel or remove it')}`;
  }
  const containers = [...project.racks.map((r) => `<option value="r:${r.id}">Rack: ${esc(r.name)}</option>`), ...project.locations.map((l) => `<option value="l:${l.id}">Location: ${esc(l.name)}</option>`)].join('');
  const cur = d.place.type === 'rack' ? 'r:' + d.place.rackId : 'l:' + d.place.locId;
  const labelRows = def.groups.filter((g) => (g.src || g.id === 'tie') && isPhysical(g)).map((g) => {
    const ov = d.labels?.[g.id] || {};
    return `<div class="row"><label>${esc(g.label)} label</label><div class="inline-fields" style="gap:4px;flex-wrap:nowrap"><input id="lp-${g.id}" style="width:90px" placeholder="${esc(d.short + ' ' + g.label)}" value="${esc(ov.prefix ?? '')}" data-chg="devLabel" data-g="${g.id}" data-f="prefix"><input id="ls-${g.id}" type="number" style="width:64px" placeholder="1" value="${esc(ov.start ?? '')}" data-chg="devLabel" data-g="${g.id}" data-f="start"></div></div>`;
  }).join('');
  let pb = '';
  if (def.patchbay) {
    const n = def.groups.find((g) => g.id === def.patchbay.rt)?.count || 0;
    pb = sec('dev-normal', 'Normalling per point', `<div class="tbl-wrap"><table class="grid"><tr><th>Pt</th><th>Mode</th></tr>${Array.from({ length: n }, (_, i) => `<tr><td class="num">${i + 1}</td><td><select id="nm-${i + 1}" data-chg="normal" data-n="${i + 1}" data-val="${d.normalling?.[i + 1] || def.patchbay.mode || 'half'}"><option value="normal">Full normal</option><option value="half">Half normal</option><option value="thru">Isolated (no normal)</option></select></td></tr>`).join('')}</table></div>`, false);
  }
  return `${head}
    <div class="row"><label for="dv-name">Name</label><input id="dv-name" value="${esc(d.name)}" data-chg="devField" data-f="name"></div>
    <div class="row"><label for="dv-short">Short label</label><input id="dv-short" value="${esc(d.short)}" data-chg="devField" data-f="short"></div>
    <div class="row"><label for="dv-where">Where</label><select id="dv-where" data-chg="devMove" data-val="${cur}">${containers}</select></div>
    ${d.place.type === 'rack' ? `<div class="row"><label for="dv-u">Top U</label><div class="inline-fields" style="gap:4px;flex-wrap:nowrap"><input id="dv-u" type="number" min="1" style="width:70px" value="${d.place.u}" data-chg="devU">${def.width === 'half' ? `<select id="dv-side" data-chg="devSide" data-val="${d.place.side}"><option value="L">Left half</option><option value="R">Right half</option></select>` : ''}</div></div>` : ''}
    ${ipSec}
    ${labelRows || def.category === 'pocket' || d.zone ? sec('dev-labels', 'Jack labels &amp; stage position', `${labelRows ? `<p class="small muted" style="margin:0">What volunteers see printed. For example, prefix “RIO” and start 31 makes these jacks RIO 31–36.</p>${labelRows}` : ''}
      <div class="row"><label for="dv-zone">Stage zone</label><input id="dv-zone" value="${esc(d.zone || '')}" placeholder="Down-stage" data-chg="devField" data-f="zone"></div>
      <div class="row"><label for="dv-pos">Position</label><input id="dv-pos" value="${esc(d.position || '')}" placeholder="Stage Right" data-chg="devField" data-f="position"></div>`, false) : ''}
    ${sec('dev-photo', 'Photos', photoHTML(def), !!def.images?.front || !!def.images?.rear)}
    ${pb}${ref}
    <div class="toolbar"><button data-act="dupDev" data-id="${d.id}">Duplicate</button><button data-act="editDef" data-def="${def.id}">Edit gear definition</button>${confirmBtn('delDev', 'Remove', `data-id="${d.id}"`)}</div>`;
}
function traceHTML(paths) {
  if (!paths.length) return '<p class="small muted" style="margin:0">Nothing connected.</p>';
  return paths.map((pth) => `<div class="path">${pth.map((r, i) => {
    const p = port(r); const ch = p?.g.conn === 'channel';
    return `${i ? '<span class="arrow">→</span>' : ''}<span class="chip ${ch ? 'ch' : ''}" data-act="selPort" data-ref="${r}" style="cursor:pointer">${esc(ch ? (p.dev.short + ' Ch ' + portNum(p)) : portShort(r))}</span>`;
  }).join('')}</div>`).join('');
}
function portInspector(ref) {
  const p = port(ref); if (!p) return inspectorHome();
  const conns = project.connections.filter((c) => (c.a === ref || c.b === ref) && (c.layer === 'rig' || c.layer === patch().id));
  const srcs = idx.srcAt.get(ref) || [];
  const fw = traceTree(ref), bw = traceTree(ref, prev);
  const fpaths = fw.ends.filter((e) => e !== ref).slice(0, 4).map((e) => pathTo(fw, e));
  const bpaths = bw.ends.filter((e) => e !== ref).slice(0, 3).map((e) => pathTo(bw, e).reverse());
  const key = `${p.g.id}:${p.n}`;
  const canSrc = p.g.dir === 'in' || p.g.conn === 'dante';
  const net = isNetGroup(p.g); const ipv = p.dev.ips?.[key] || {};
  const srcOpts = patch().sources.map((s) => `<option value="${s.id}">${esc(s.name || 'Untitled')}${(s.ports || []).some(Boolean) ? ' · ' + esc(stereoLabel(s.ports)) : ''}</option>`).join('');
  const more = rigMode() ? `<div class="row"><label for="pt-name">Custom name</label><input id="pt-name" value="${esc(p.dev.portNames?.[key] || '')}" placeholder="e.g. PREACH MIC" data-chg="portName" data-ref="${ref}"></div>
    ${net ? `<div class="row"><label for="pt-ip">IP address</label><input id="pt-ip" class="mono" value="${esc(ipv.ip || '')}" placeholder="192.168.1.10" data-chg="devIp" data-dev="${p.dev.id}" data-k="${key}" data-f="ip"></div>
    <div class="row"><label for="pt-ipn">IP note</label><input id="pt-ipn" value="${esc(ipv.note || '')}" placeholder="e.g. Dante primary" data-chg="devIp" data-dev="${p.dev.id}" data-k="${key}" data-f="note"></div>` : ''}` : '';
  return `<div><div class="eyebrow">${esc(p.dev.name)} · ${esc(CONN_NAMES[p.g.conn] || p.g.conn)} ${p.g.dir === 'in' ? 'input' : p.g.dir === 'out' ? 'output' : 'two-way'}${isPhysical(p.g) ? ' · ' + esc(sigName(sigOf(p.g))) : ''}</div>
    <h3>${esc(portLabel(ref))}</h3><div class="small muted">${esc(portLong(ref))}</div>${net && ipv.ip ? `<div class="small mono">IP ${esc(ipv.ip)}${ipv.note ? ` · ${esc(ipv.note)}` : ''}</div>` : ''}</div>
    ${canSrc ? sec('pt-src', 'Source plugged in here', `
      ${srcs.length ? srcs.map((s) => `<div class="chips"><span class="chip"><span class="sw" style="background:${project.groups.find((g) => g.id === s.groupId)?.color || '#ccc'}"></span>${esc(s.name)}</span><span class="small muted">${esc(s.mic || '')}</span><button data-act="unassign" data-src="${s.id}" data-ref="${ref}" style="padding:1px 6px">Remove</button></div>`).join('') : '<p class="small muted" style="margin:0">None in this patch.</p>'}
      <div class="inline-fields" style="gap:4px"><select id="pt-assign" style="flex:1"><option value="">Assign a source…</option>${srcOpts}</select><button data-act="assign" data-ref="${ref}">Assign</button></div>
      <button data-act="newSrcHere" data-ref="${ref}">+ New source on this jack</button>`) : ''}
    ${isPhysical(p.g) ? sec('pt-connect', 'Connect to', `
      <input id="pt-q" data-inp="connQuery" data-ref="${ref}" placeholder="Search, e.g. PSM or Out 3" value="${esc(ui.connQuery || '')}" autocomplete="off">
      <select id="pt-target" size="7" style="width:100%" aria-label="Jack to connect to">${connectOptions(ref, ui.connQuery)}</select>
      <div class="toolbar"><button class="primary" data-act="connectPicked" data-ref="${ref}">Connect${rigMode() && ui.newKind === 'tie' ? ' tie line' : ''}</button><button data-act="pickMode" data-ref="${ref}">Pick on the rack…</button></div>
      <p class="small muted" style="margin:0">Shortcut: with this jack selected, hold <b>Shift</b> and click another jack. New connections go in ${rigMode() ? '<b>the rig</b>' : `<b>${esc(patch().name)}</b>`}.</p>`) : ''}
    ${sec('pt-cables', `Cables (${conns.length})`, conns.length ? conns.map((c) => `<div class="chips"><span class="pill ${c.layer === 'rig' ? 'rig' : 'patch'}">${c.kind === 'dante' ? 'Dante' : c.kind === 'tie' ? 'Tie line' : c.layer === 'rig' ? 'Rig' : 'Patch'}</span>${c.kind === 'dante' ? '' : `<span class="swl" style="--c:${(SIGNALS[connType(c)] || SIGNALS.other).color}" title="${esc(sigName(connType(c)))}"></span>`}<span class="chip" data-act="selConn" data-id="${c.id}" style="cursor:pointer">${c.a === ref ? '→' : '←'} ${esc(portLong(c.a === ref ? c.b : c.a))}</span></div>`).join('') : '<p class="small muted" style="margin:0">Nothing plugged in.</p>')}
    ${sec('pt-trace', 'Signal trace', `<div class="small muted">Comes from</div>${traceHTML(bpaths)}<div class="small muted">Goes to</div>${traceHTML(fpaths)}`)}
    ${more ? sec('pt-more', net ? 'Name &amp; IP address' : 'Custom name', more, net) : ''}`;
}
// jacks that `ref` could be cabled to, for the "Connect to" list
function connectOptions(ref, q = '') {
  const p = port(ref); if (!p) return '';
  const want = p.g.dir === 'in' ? ['out', 'io'] : p.g.dir === 'out' ? ['in', 'io'] : ['io'];
  q = (q || '').toLowerCase().trim();
  let html = '';
  for (const d of project.devices) {
    const def = idx.def.get(d.defId); if (!def) continue;
    let opts = '';
    for (const g of def.groups) {
      if (!isPhysical(g) || !want.includes(g.dir)) continue;
      for (let i = 1; i <= g.count; i++) {
        const r = mkRef(d.id, g.id, i); if (r === ref) continue;
        const pp = port(r); const custom = d.portNames?.[`${g.id}:${i}`];
        const flags = [g.face, idx.cables.get(r) ? 'in use' : '', compatible(p.g.conn, g.conn) ? '' : 'needs adapter'].filter(Boolean).join(', ');
        const text = `${g.label} ${pp.g.names?.[i - 1] ?? ((g.start ?? 1) + i - 1)}${custom ? ` “${custom}”` : ''}${portLabel(r) !== `${d.short} ${g.label} ${(g.start ?? 1) + i - 1}` && !custom ? ` (${portLabel(r)})` : ''} · ${flags}`;
        if (q && !`${d.name} ${d.short} ${text}`.toLowerCase().includes(q)) continue;
        opts += `<option value="${r}">${esc(text)}</option>`;
      }
    }
    if (opts) html += `<optgroup label="${esc(d.name)}">${opts}</optgroup>`;
  }
  return html || '<option disabled>No matching jacks</option>';
}
function connInspector(c) {
  if (!c) return inspectorHome();
  const colors = project.cableColors.map((x) => `<option value="${x.id}">${esc(x.name)}${x.length ? ' · ' + esc(x.length) : ''}</option>`).join('');
  const t = connType(c);
  const typeOpts = `<option value="">Automatic (${esc(sigName(autoType(c)))})</option>` + Object.entries(SIGNALS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
  return `<div><div class="eyebrow">${c.kind === 'dante' ? 'Dante subscription' : c.kind === 'tie' ? 'In-wall tie line' : 'Cable'}${c.kind === 'dante' ? '' : ' · ' + esc(sigName(t))}</div>
    <h3>${esc(portLabel(c.a))} → ${esc(portLabel(c.b))}</h3></div>
    <dl class="kv"><dt>From</dt><dd><a href="#" data-act="selPort" data-ref="${c.a}">${esc(portLong(c.a))}</a></dd><dt>To</dt><dd><a href="#" data-act="selPort" data-ref="${c.b}">${esc(portLong(c.b))}</a></dd></dl>
    ${c.kind !== 'dante' ? `<div class="row"><label for="cn-type">Signal</label><select id="cn-type" data-chg="connType" data-id="${c.id}" data-val="${c.type || ''}">${typeOpts}</select></div>
      <div class="row"><label for="cn-spec">Spec</label><input id="cn-spec" list="spec-list" value="${esc(c.spec || '')}" placeholder="e.g. ${esc((SPEC_SUGGEST[t] || ['3G', 'Cat6'])[0])}" data-chg="connSpec" data-id="${c.id}"><datalist id="spec-list">${(SPEC_SUGGEST[t] || []).map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist></div>` : ''}
    ${c.kind === 'cable' ? `<div class="row"><label for="cn-col">Cable colour</label><select id="cn-col" data-chg="connColor" data-id="${c.id}" data-val="${c.color || ''}"><option value="">Not set</option>${colors}</select></div>` : ''}
    ${c.kind !== 'dante' && rigMode() ? `<div class="row"><label for="cn-kind">Type</label><select id="cn-kind" data-chg="connKind" data-id="${c.id}" data-val="${c.kind}"><option value="cable">Cable</option><option value="tie">Tie line (installed)</option></select></div>` : ''}
    ${c.kind === 'tie' ? '<p class="small muted" style="margin:0">Tie lines are part of the rig and appear in every patch.</p>' : `<div class="row"><label for="cn-layer">Belongs to</label><select id="cn-layer" data-chg="connLayer" data-id="${c.id}" data-val="${c.layer === 'rig' ? 'rig' : 'patch'}"><option value="patch">${esc(patch().name)} only</option><option value="rig">The rig (every patch)</option></select></div>`}
    <div class="toolbar">${confirmBtn('delConn', 'Remove cable', `data-id="${c.id}"`)}</div>`;
}
function rackInspector(r) {
  if (!r) return inspectorHome();
  const n = project.devices.filter((d) => d.place?.type === 'rack' && d.place.rackId === r.id).length;
  const locName = project.locations.find((l) => l.id === r.locId)?.name;
  if (!rigMode()) return `<div class="eyebrow">Rack</div><h3>${esc(r.name)}</h3><dl class="kv"><dt>Location</dt><dd>${esc(locName || 'Not in a location')}</dd><dt>Size</dt><dd>${r.ru}U</dd><dt>Gear</dt><dd>${n} items</dd></dl>${lockNote('rename, resize, move or delete it')}`;
  return `<div class="eyebrow">Rack</div><h3>${esc(r.name)}</h3>
    <div class="row"><label for="rk-name">Name</label><input id="rk-name" value="${esc(r.name)}" data-chg="rackField" data-f="name" data-id="${r.id}"></div>
    <div class="row"><label for="rk-loc">Location</label><select id="rk-loc" data-chg="rackLoc" data-id="${r.id}" data-val="${r.locId && locName ? r.locId : ''}"><option value="">Not in a location</option>${project.locations.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>
    <div class="row"><label for="rk-ru">Size (U)</label><input id="rk-ru" type="number" min="1" max="60" value="${r.ru}" data-chg="rackField" data-f="ru" data-id="${r.id}"></div>
    <div class="toolbar"><button data-act="moveRack" data-id="${r.id}" data-d="-1">◀ Move left</button><button data-act="moveRack" data-id="${r.id}" data-d="1">Move right ▶</button></div>
    <div class="toolbar">${confirmBtn('delRack', n ? `Delete rack and its ${n} items` : 'Delete rack', `data-id="${r.id}"`)}</div>`;
}
function locInspector(l) {
  if (!l) return inspectorHome();
  const n = project.devices.filter((d) => d.place?.type === 'loc' && d.place.locId === l.id).length;
  const nr = project.racks.filter((r) => r.locId === l.id).length;
  if (!rigMode()) return `<div class="eyebrow">Location</div><h3>${esc(l.name)}</h3><dl class="kv"><dt>Racks</dt><dd>${nr}</dd><dt>Loose gear</dt><dd>${n} items</dd></dl>${lockNote('rename, reorder or delete it, or add racks and gear')}`;
  return `<div class="eyebrow">Location</div><h3>${esc(l.name)}</h3>
    <p class="small muted" style="margin:0">A location is a place in the building (Stage, FOH, Backstage, the amp room). It holds racks, plus loose gear like floor pockets, wall plates and the console.</p>
    <div class="row"><label for="lc-name">Name</label><input id="lc-name" value="${esc(l.name)}" data-chg="locField" data-id="${l.id}"></div>
    <div class="toolbar"><button data-act="moveLoc" data-id="${l.id}" data-d="-1">▲ Move up</button><button data-act="moveLoc" data-id="${l.id}" data-d="1">Move down ▼</button></div>
    <div class="toolbar"><button data-act="addRack" data-loc="${l.id}">+ Rack here</button><button data-act="locAdd" data-id="${l.id}">+ Gear</button></div>
    <div class="toolbar">${confirmBtn('delLoc', n ? `Delete location and its ${n} loose items` : 'Delete location', `data-id="${l.id}"`)}</div>
    ${nr ? `<p class="small muted" style="margin:0">Deleting keeps its ${nr} rack${nr > 1 ? 's' : ''}; they move to “not in a location”.</p>` : ''}`;
}
function sourceInspector(s) {
  if (!s) return inspectorHome();
  const g = project.groups.find((x) => x.id === s.groupId);
  return `<div class="eyebrow">Source · ${esc(g?.name || 'No group')}</div><h3>${esc(s.name)}</h3>
    <dl class="kv"><dt>Mic/DI</dt><dd>${esc(s.mic)}</dd><dt>Stage input</dt><dd>${esc(stereoLabel(s.ports)) || '—'}</dd><dt>Person</dt><dd>${esc(s.person)}</dd><dt>Console</dt><dd>${esc(sourceChannels(s).map(chLabel).join(', ') || '—')}</dd></dl>
    <div class="eyebrow">Signal path</div>${traceHTML(sourcePaths(s))}
    <button data-act="tab" data-tab="list">Edit in patchlist</button>`;
}
function outputInspector(o) {
  if (!o) return inspectorHome();
  const t = o.port && port(o.port) ? traceTree(o.port) : null;
  return `<div class="eyebrow">Output</div><h3>${esc(o.name)}</h3>
    <dl class="kv"><dt>Mix</dt><dd>${esc(o.mix)}</dd><dt>Leaves on</dt><dd>${esc(o.port ? portLong(o.port) : '—')}</dd><dt>Person</dt><dd>${esc(o.person)}</dd></dl>
    <div class="eyebrow">Signal goes to</div>${t ? traceHTML(t.ends.filter((e) => e !== o.port).map((e) => pathTo(t, e))) : ''}
    <button data-act="tab" data-tab="list">Edit in patchlist</button>`;
}

/* ---------- 8. patchlist ---------- */
const BUILTIN_COLS = {
  group: 'Group', source: 'Source', mic: 'Mic/DI', input: 'Stage Input(s)', person: 'Person',
  cable: 'Cable', consoleCh: 'Console Ch', path: 'Signal path', notes: 'Notes',
};
function sourcePortOptions() {
  let html = '<option value="">—</option>';
  const devs = [...project.devices].sort((a, b) => (a.place.type === 'loc' ? 0 : 1) - (b.place.type === 'loc' ? 0 : 1));
  for (const d of devs) {
    const def = idx.def.get(d.defId); if (!def) continue;
    const gs = def.groups.filter((g) => g.src); if (!gs.length) continue;
    html += `<optgroup label="${esc(d.name)}">`;
    for (const g of gs) for (let n = 1; n <= g.count; n++) { const r = mkRef(d.id, g.id, n); html += `<option value="${r}">${esc(portLabel(r))}</option>`; }
    html += '</optgroup>';
  }
  return html;
}
function outputPortOptions() {
  let html = '<option value="">—</option>';
  for (const d of project.devices) {
    const def = idx.def.get(d.defId); if (!def || !['console', 'processor'].includes(def.category)) continue;
    const gs = def.groups.filter((g) => g.dir === 'out' && isPhysical(g) && !['iec', 'nema', 'dc'].includes(g.conn)); if (!gs.length) continue;
    html += `<optgroup label="${esc(d.name)}">`;
    for (const g of gs) for (let n = 1; n <= g.count; n++) { const r = mkRef(d.id, g.id, n); html += `<option value="${r}">${esc(portShort(r))}</option>`; }
    html += '</optgroup>';
  }
  return html;
}
function listView() {
  const pt = patch();
  const portOpts = sourcePortOptions();
  const grpOpts = '<option value="">—</option>' + project.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
  const colOpts = '<option value="">—</option>' + project.cableColors.map((c) => `<option value="${c.id}">${esc(c.name)}${c.length ? ' ' + esc(c.length) : ''}</option>`).join('');
  const cust = project.columns;
  const rows = pt.sources.map((s, i) => {
    const g = project.groups.find((x) => x.id === s.groupId);
    const st = (s.ports || []).length > 1;
    const chs = sourceChannels(s);
    const sel = ui.sel?.kind === 'source' && ui.sel.id === s.id;
    return `<tr class="${sel ? 'sel' : ''}">
      <td class="num">${i + 1}</td>
      <td><div class="grpcell"><span class="sw" style="background:${g?.color || 'transparent'}"></span><select id="sg-${s.id}" data-chg="src" data-id="${s.id}" data-f="groupId" data-val="${s.groupId || ''}">${grpOpts}</select></div></td>
      <td><input id="sn-${s.id}" value="${esc(s.name)}" data-chg="src" data-id="${s.id}" data-f="name" style="min-width:120px"></td>
      <td><input id="sm-${s.id}" value="${esc(s.mic)}" data-chg="src" data-id="${s.id}" data-f="mic" style="min-width:110px"></td>
      <td><div class="inputcell"><select id="sp0-${s.id}" data-chg="srcPort" data-id="${s.id}" data-i="0" data-val="${s.ports?.[0] || ''}">${portOpts}</select>${st ? `<select id="sp1-${s.id}" data-chg="srcPort" data-id="${s.id}" data-i="1" data-val="${s.ports?.[1] || ''}">${portOpts}</select>` : ''}<button class="st-tog ${st ? 'on' : ''}" data-act="stereo" data-id="${s.id}" title="Stereo (two inputs)">ST</button></div></td>
      <td><input id="spn-${s.id}" value="${esc(s.person)}" data-chg="src" data-id="${s.id}" data-f="person" style="min-width:80px"></td>
      <td><select id="sc-${s.id}" data-chg="src" data-id="${s.id}" data-f="cable" data-val="${s.cable || ''}">${colOpts}</select></td>
      ${cust.map((c) => `<td><input id="cu-${c.id}-${s.id}" value="${esc(s.custom?.[c.id] || '')}" data-chg="srcCustom" data-id="${s.id}" data-c="${c.id}" style="min-width:80px"></td>`).join('')}
      <td class="comp" title="Worked out from the cables and Dante routes">${chs.length ? esc(chs.map(chLabel).join(', ')) : '<span style="color:var(--warn)">none</span>'}</td>
      <td><input id="snt-${s.id}" value="${esc(s.notes)}" data-chg="src" data-id="${s.id}" data-f="notes" style="min-width:100px"></td>
      <td><div class="rowbtns"><button data-act="showSrc" data-id="${s.id}" title="Trace in rack">Trace</button><button data-act="moveSrc" data-id="${s.id}" data-d="-1" title="Move up">↑</button><button data-act="moveSrc" data-id="${s.id}" data-d="1" title="Move down">↓</button>${confirmBtn('delSrc', '✕', `data-id="${s.id}"`)}</div></td>
    </tr>`;
  }).join('');
  const outOpts = outputPortOptions();
  const orows = pt.outputs.map((o, i) => {
    const goes = o.port && port(o.port) ? next(o.port).map(portShort).join(', ') : '';
    return `<tr><td class="num">${i + 1}</td>
      <td><input id="on-${o.id}" value="${esc(o.name)}" data-chg="out" data-id="${o.id}" data-f="name"></td>
      <td><input id="om-${o.id}" value="${esc(o.mix)}" data-chg="out" data-id="${o.id}" data-f="mix" style="min-width:70px"></td>
      <td><select id="op-${o.id}" data-chg="out" data-id="${o.id}" data-f="port" data-val="${o.port || ''}">${outOpts}</select></td>
      <td class="comp">${esc(goes) || '<span class="muted">—</span>'}</td>
      <td><input id="opn-${o.id}" value="${esc(o.person)}" data-chg="out" data-id="${o.id}" data-f="person"></td>
      <td><input id="ont-${o.id}" value="${esc(o.notes)}" data-chg="out" data-id="${o.id}" data-f="notes"></td>
      <td><div class="rowbtns"><button data-act="showOut" data-id="${o.id}">Trace</button><button data-act="moveOut" data-id="${o.id}" data-d="-1">↑</button><button data-act="moveOut" data-id="${o.id}" data-d="1">↓</button>${confirmBtn('delOut', '✕', `data-id="${o.id}"`)}</div></td></tr>`;
  }).join('');
  return `<section class="view">
    <div class="card"><div class="card-head"><h2>${esc(pt.name)}</h2><span class="spacer"></span><button data-act="dupPatch">Save a copy as new patch</button><button data-act="newPatch">New empty patch</button>${project.patches.length > 1 ? confirmBtn('delPatch', 'Delete this patch') : ''}</div>
      <div class="inline-fields">
        <label class="field"><span>Patch name</span><input id="pt-nm" value="${esc(pt.name)}" data-chg="patchField" data-f="name"></label>
        <label class="field"><span>Event</span><input id="pt-ev" value="${esc(pt.event)}" data-chg="patchField" data-f="event"></label>
        <label class="field"><span>Date</span><input id="pt-dt" type="date" value="${esc(pt.date)}" data-chg="patchField" data-f="date"></label>
      </div>
      <p class="small muted" style="margin:0">Templates: keep a patch called “Template – Full Band” and use “Save a copy as new patch” each week, then fine-tune.</p>
    </div>
    <div class="card"><div class="card-head"><h3>Inputs</h3><span class="muted small">${pt.sources.length} sources · Console Ch is worked out from your cables and Dante routes</span><span class="spacer"></span><button class="primary" data-act="addSrc">+ Add source</button></div>
      <div class="tbl-wrap"><table class="grid"><thead><tr><th></th><th>Group</th><th>Source</th><th>Mic/DI</th><th>Stage input</th><th>Person</th><th>Cable</th>${cust.map((c) => `<th>${esc(c.name)}</th>`).join('')}<th>Console Ch</th><th>Notes</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <div class="card"><div class="card-head"><h3>Outputs</h3><span class="muted small">Monitor mixes, mains, stream feeds…</span><span class="spacer"></span><button data-act="addOut">+ Add output</button></div>
      <div class="tbl-wrap"><table class="grid"><thead><tr><th></th><th>Name</th><th>Mix</th><th>Leaves on</th><th>Goes to</th><th>Person</th><th>Notes</th><th></th></tr></thead><tbody>${orows || '<tr><td colspan="8" class="muted small">No outputs yet.</td></tr>'}</tbody></table></div>
    </div>
    ${sec('list-settings', 'Groups, custom columns &amp; cable colours', `<div class="editor-grid">
      <div class="card"><div class="card-head"><h3>Groups &amp; row colours</h3><span class="spacer"></span><button data-act="addGroup">+ Group</button></div>
        ${project.groups.map((g) => `<div class="inline-fields" style="gap:6px;align-items:center"><input type="color" id="gc-${g.id}" value="${esc(g.color)}" data-chg="groupField" data-id="${g.id}" data-f="color"><input id="gn-${g.id}" value="${esc(g.name)}" data-chg="groupField" data-id="${g.id}" data-f="name" style="flex:1">${confirmBtn('delGroup', '✕', `data-id="${g.id}"`)}</div>`).join('')}
      </div>
      <div class="card"><div class="card-head"><h3>Custom columns</h3><span class="spacer"></span><button data-act="addCol">+ Column</button></div>
        ${cust.length ? cust.map((c) => `<div class="inline-fields" style="gap:6px;align-items:center"><input id="cn-${c.id}" value="${esc(c.name)}" data-chg="colName" data-id="${c.id}" style="flex:1">${confirmBtn('delCol', '✕', `data-id="${c.id}"`)}</div>`).join('') : '<p class="muted small" style="margin:0">None yet.</p>'}
      </div>
      <div class="card"><div class="card-head"><h3>Cable colours</h3><span class="spacer"></span><button data-act="addCableColor">+ Colour</button></div>
        ${project.cableColors.map((c) => `<div class="inline-fields" style="gap:6px;align-items:center;flex-wrap:nowrap"><input type="color" id="cc-${c.id}" value="${esc(c.hex)}" data-chg="ccField" data-id="${c.id}" data-f="hex"><input id="ccn-${c.id}" value="${esc(c.name)}" data-chg="ccField" data-id="${c.id}" data-f="name" style="flex:1;min-width:0"><input id="ccl-${c.id}" value="${esc(c.length)}" data-chg="ccField" data-id="${c.id}" data-f="length" style="width:60px" placeholder="length">${confirmBtn('delCC', '✕', `data-id="${c.id}"`)}</div>`).join('')}
      </div>
    </div>`, false)}
  </section>`;
}

/* ---------- 9. dante ---------- */
function danteView() {
  const txDevs = [], rxDevs = [];
  for (const d of project.devices) {
    const def = idx.def.get(d.defId); if (!def) continue;
    const tx = def.groups.find((g) => g.conn === 'dante' && g.dir === 'out');
    const rx = def.groups.find((g) => g.conn === 'dante' && g.dir === 'in');
    if (tx) txDevs.push([d, tx]); if (rx) rxDevs.push([d, rx]);
  }
  const subOf = (ref) => (idx.in.get(ref) || []).filter((c) => c.kind === 'dante');
  const layerBtn = (v, t) => `<button data-act="layer" data-layer="${v}" class="${ui.layer === v ? 'on' : ''}">${t}</button>`;
  const rxHTML = rxDevs.map(([d, g]) => {
    let used = 0;
    const rows = Array.from({ length: g.count }, (_, i) => {
      const r = mkRef(d.id, g.id, i + 1); const subs = subOf(r); if (subs.length) used++;
      const src = idx.mark.get(r);
      const editing = ui.danteEdit === r;
      const cell = editing
        ? `<select id="dsel" data-chg="danteSub" data-ref="${r}" data-val="${subs[0]?.a || ''}">${danteTxOptions(txDevs)}</select>`
        : `<button class="dsub ${subs.length ? 'set' : ''}" data-act="danteEdit" data-ref="${r}">${subs.length ? subs.map((c) => esc(portShort(c.a))).join(' + ') : '—'}</button>`;
      return `<tr><td class="num">${i + 1}</td><td><input id="dn-${d.id}-${i}" value="${esc(d.portNames?.[`${g.id}:${i + 1}`] || '')}" placeholder="—" data-chg="portName" data-ref="${r}" ${rigMode() ? '' : 'disabled'}></td><td>${cell}</td><td class="comp">${src ? esc(src.name) : ''}</td></tr>`;
    }).join('');
    return `<details class="dgrp card" ${ui.danteOpen?.[d.id] ?? (g.count <= 64) ? 'open' : ''} data-dev="${d.id}"><summary>${esc(d.name)} <span class="muted small">· receives ${used}/${g.count}</span></summary>
      <div class="tbl-wrap"><table class="grid"><thead><tr><th>Rx</th><th>Channel name</th><th>Subscribed to</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }).join('');
  const txHTML = txDevs.map(([d, g]) => `<details class="dgrp card"><summary>${esc(d.name)} <span class="muted small">· ${g.count} transmit channels</span></summary>
    <div class="tbl-wrap"><table class="grid"><thead><tr><th>Tx</th><th>Channel name</th><th>Source</th></tr></thead><tbody>${Array.from({ length: g.count }, (_, i) => {
      const r = mkRef(d.id, g.id, i + 1); const src = idx.mark.get(r);
      return `<tr><td class="num">${i + 1}</td><td><input id="tn-${d.id}-${i}" value="${esc(d.portNames?.[`${g.id}:${i + 1}`] || '')}" placeholder="—" data-chg="portName" data-ref="${r}" ${rigMode() ? '' : 'disabled'}></td><td class="comp">${src ? esc(src.name) : ''}</td></tr>`;
    }).join('')}</tbody></table></div></details>`).join('');
  return `<section class="view">
    <div class="card"><div class="card-head"><h2>Dante &amp; IP</h2><span class="spacer"></span>${modeSeg()}</div>
      ${sec('ip-table', 'IP addresses', ipTableHTML())}
    </div>
    <div class="card"><div class="card-head"><h3>Dante routing</h3></div>
      <p class="small muted" style="margin:0">${rigMode() ? 'Routes you set now are permanent (every patch). Channel names can be edited.' : `Routes you set now apply to ${esc(patch().name)} only. Switch to The rig to make permanent routes or rename channels.`} Click a “Subscribed to” cell to choose which transmitter feeds that receive channel. The signal trace and Console Ch columns follow these routes. Importing and exporting Dante Controller preset files is planned for a later phase.</p></div>
    ${sec('dante-rx', 'Receivers', rxHTML)}
    ${sec('dante-tx', 'Transmitters', txHTML, false)}
  </section>`;
}
function ipTableHTML() {
  const rows = [];
  for (const d of project.devices) for (const r of netPorts(d)) rows.push([d, r]);
  if (!rows.length) return '<p class="small muted" style="margin:0">No network jacks in the rig yet.</p>';
  const dup = new Map();
  for (const [, r] of rows) { const ip = ipOf(r).split('/')[0]; if (ip) dup.set(ip, (dup.get(ip) || 0) + 1); }
  return `<p class="small muted" style="margin:0">${rigMode() ? 'Type an address next to each network jack. Duplicates and typos show up in Checks.' : 'Switch to The rig to edit addresses.'}</p>
    <div class="tbl-wrap"><table class="grid"><thead><tr><th>Gear</th><th>Jack</th><th>IP address</th><th>Note</th></tr></thead><tbody>${rows.map(([d, r]) => {
      const p = port(r); const key = `${p.g.id}:${p.n}`; const v = d.ips?.[key] || {};
      const bad = v.ip && (!IP_RE.test(v.ip) || dup.get(v.ip.split('/')[0]) > 1);
      return `<tr><td>${esc(d.name)}</td><td>${esc(p.g.label)} ${esc(portNum(p))}</td>
        <td>${rigMode() ? `<input id="ipt-${d.id}-${p.g.id}-${p.n}" class="mono ${bad ? 'bad' : ''}" value="${esc(v.ip || '')}" placeholder="—" data-chg="devIp" data-dev="${d.id}" data-k="${key}" data-f="ip">` : `<span class="mono ${bad ? 'bad' : ''}">${esc(v.ip || '—')}</span>`}</td>
        <td>${rigMode() ? `<input id="iptn-${d.id}-${p.g.id}-${p.n}" value="${esc(v.note || '')}" placeholder="—" data-chg="devIp" data-dev="${d.id}" data-k="${key}" data-f="note">` : esc(v.note || '')}</td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="toolbar"><button data-act="copyIps">Copy IP list (CSV)</button></div>`;
}
function ipListRows() {
  const out = [];
  for (const d of project.devices) for (const r of netPorts(d)) {
    const p = port(r); const v = d.ips?.[`${p.g.id}:${p.n}`];
    if (v?.ip) out.push([d.name, `${p.g.label} ${portNum(p)}`, v.ip, v.note || '']);
  }
  return out;
}
let txOptCache = null;
function danteTxOptions(txDevs) {
  let html = '<option value="">— none —</option>';
  for (const [d, g] of txDevs) {
    html += `<optgroup label="${esc(d.name)}">`;
    for (let n = 1; n <= g.count; n++) { const r = mkRef(d.id, g.id, n); const nm = d.portNames?.[`${g.id}:${n}`]; html += `<option value="${r}">${esc(d.short)} ${n}${nm ? ' · ' + esc(nm) : ''}</option>`; }
    html += '</optgroup>';
  }
  return html;
}

/* ---------- 10. print ---------- */
function colLabel(key) {
  if (key.startsWith('custom:')) return project.columns.find((c) => 'custom:' + c.id === key)?.name || '';
  return BUILTIN_COLS[key] || key;
}
function printColumns() {
  const pr = project.print;
  const keys = new Set(pr.columns.map((c) => c.key));
  for (const c of project.columns) if (!keys.has('custom:' + c.id)) pr.columns.push({ key: 'custom:' + c.id, on: false });
  pr.columns = pr.columns.filter((c) => !c.key.startsWith('custom:') || project.columns.some((x) => 'custom:' + x.id === c.key));
  return pr.columns;
}
function cellValue(s, key) {
  switch (key) {
    case 'group': return project.groups.find((g) => g.id === s.groupId)?.name || '';
    case 'source': return s.name;
    case 'mic': return s.mic;
    case 'input': return stereoLabel(s.ports);
    case 'person': return s.person;
    case 'cable': { const c = project.cableColors.find((x) => x.id === s.cable); return c ? `${c.name}${c.length ? ' ' + c.length : ''}` : ''; }
    case 'consoleCh': return sourceChannels(s).map(chLabel).join(', ');
    case 'path': return sourcePaths(s).map((p) => p.map((r) => { const pp = port(r); return pp?.g.conn === 'channel' ? 'Ch ' + portNum(pp) : portShort(r); }).join(' → ')).join(' | ');
    case 'notes': return s.notes;
    default: if (key.startsWith('custom:')) return s.custom?.[key.slice(7)] || ''; return '';
  }
}
function paperHTML() {
  const pr = project.print, pt = patch();
  const cols = printColumns().filter((c) => c.on).map((c) => c.key);
  const hc = pr.headerColor || '#3a5068';
  let body = '';
  if (pr.include.inputs && cols.length) {
    const srcs = pt.sources;
    const span = new Map();
    if (pr.mergePerson && cols.includes('person')) {
      for (let i = 0; i < srcs.length;) {
        let j = i + 1; while (j < srcs.length && srcs[i].person && srcs[j].person === srcs[i].person && srcs[j].groupId === srcs[i].groupId) j++;
        span.set(i, j - i); for (let k = i + 1; k < j; k++) span.set(k, 0); i = j;
      }
    }
    const colored = (k) => pr.colorMode === 'row' || (pr.colorMode === 'cells' && (k === 'source' || k === 'mic' || k === 'group'));
    body += `<table><thead><tr>${cols.map((k) => `<th style="background:${esc(hc)}">${esc(colLabel(k))}</th>`).join('')}</tr></thead><tbody>`;
    srcs.forEach((s, i) => {
      const bg = project.groups.find((g) => g.id === s.groupId)?.color || '';
      body += '<tr>' + cols.map((k) => {
        if (k === 'person' && span.has(i)) { const n = span.get(i); if (!n) return ''; return `<td class="c" rowspan="${n}">${esc(s.person)}</td>`; }
        const center = k === 'person' || k === 'consoleCh' || k === 'cable';
        let v = esc(cellValue(s, k));
        if (k === 'cable' && s.cable) { const c = project.cableColors.find((x) => x.id === s.cable); if (c) v = `<span style="display:inline-block;width:10px;height:10px;border:1px solid #333;background:${esc(c.hex)};vertical-align:-1px;margin-right:4px"></span>${v}`; }
        return `<td class="${center ? 'c' : ''}" style="${bg && colored(k) ? `background:${esc(bg)}` : ''}">${v}</td>`;
      }).join('') + '</tr>';
    });
    body += '</tbody></table>';
  }
  if (pr.include.outputs && pt.outputs.length) {
    body += `<h4>Outputs</h4><table><thead><tr>${['Output', 'Mix', 'Leaves on', 'Goes to', 'Person'].map((h) => `<th style="background:${esc(hc)}">${h}</th>`).join('')}</tr></thead><tbody>`;
    for (const o of pt.outputs) {
      const goes = o.port && port(o.port) ? next(o.port).map(portShort).join(', ') : '';
      body += `<tr><td>${esc(o.name)}</td><td class="c">${esc(o.mix)}</td><td>${esc(o.port ? portShort(o.port) : '')}</td><td>${esc(goes)}</td><td class="c">${esc(o.person)}</td></tr>`;
    }
    body += '</tbody></table>';
  }
  if (pr.include.stageMap) {
    const zones = new Map();
    for (const d of project.devices) {
      if (!d.zone) continue;
      const def = idx.def.get(d.defId); const g = def?.groups.find((x) => x.src && isPhysical(x)); if (!g) continue;
      const a = port(mkRef(d.id, g.id, 1)), b = port(mkRef(d.id, g.id, g.count));
      push(zones, d.zone, `${d.position || d.name}: ${portNum(a)}-${portNum(b)}`);
    }
    if (zones.size) {
      body += `<div class="map"><h4>Stage Box’s Inputs:</h4>`;
      const rank = (z) => /down/i.test(z) ? 0 : /mid/i.test(z) ? 1 : /up/i.test(z) ? 2 : 3;
      for (const [z, items] of [...zones].sort((a, b) => rank(a[0]) - rank(b[0]))) body += `<p>${esc(z)}:</p><p class="ind">${esc(items.join(', '))}</p>`;
      body += '</div>';
    }
  }
  if (pr.include.ipList) {
    const rows = ipListRows();
    if (rows.length) body += `<h4>IP addresses</h4><table><thead><tr>${['Gear', 'Jack', 'IP address', 'Note'].map((h) => `<th style="background:${esc(hc)}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="c" style="font-family:var(--f-mono)">${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table>`;
  }
  if (pr.include.pull) {
    const mics = new Map(), cables = new Map();
    for (const s of pt.sources) {
      const n = (s.ports || []).filter(Boolean).length > 1 && /L\s*[+/&]\s*R/i.test(s.name + ' ' + s.mic) ? 2 : 1;
      for (const part of (s.mic || '').split(/\s*\+\s*/)) {
        const k = part.trim(); if (!k || /dante|direct/i.test(k)) continue;
        mics.set(k, (mics.get(k) || 0) + n);
      }
      if (s.cable) cables.set(s.cable, (cables.get(s.cable) || 0) + Math.max(1, (s.ports || []).filter(Boolean).length));
    }
    body += `<h4>Equipment needed</h4><div class="pull">${[...mics].map(([k, n]) => `<div>${n} × ${esc(k)}</div>`).join('')}${[...cables].map(([k, n]) => { const c = project.cableColors.find((x) => x.id === k); return `<div>${n} × ${esc(c?.name || k)} cable${c?.length ? ' (' + esc(c.length) + ')' : ''}</div>`; }).join('')}</div>
      <p class="pnote">Stereo rows count as two mics only when the name says L+R.</p>`;
  }
  return `<div class="paper ${pr.orientation === 'landscape' ? 'landscape' : ''}" style="--pfs:${+pr.fontSize || 11}px">
    <div class="phead" style="background:${esc(hc)}">${pr.logo ? `<img src="${esc(pr.logo)}" alt="${esc(pr.org)}">` : `<span class="org">${esc(pr.org)}</span>`}</div>
    <div class="pbody">
      <div class="ptitle">${esc(pr.title)}</div>
      <div class="pmeta"><div>Event: ${esc(pt.event)}</div><div>Date: ${esc(fmtDate(pt.date))}</div></div>
      ${body}
    </div>
  </div>`;
}
function printView() {
  const pr = project.print;
  const cols = printColumns();
  const inc = (k, t) => `<label class="tog"><input type="checkbox" id="inc-${k}" data-chg="printInc" data-k="${k}" ${pr.include[k] ? 'checked' : ''}> ${t}</label>`;
  return `<section class="view">
    <div class="print-split">
      <div class="print-opts card">
        <div class="card-head"><h3>Layout</h3></div>
        <div class="seg"><span>Preset</span><button data-act="preset" data-p="volunteer" class="${pr.preset === 'volunteer' ? 'on' : ''}">Volunteer</button><button data-act="preset" data-p="tech" class="${pr.preset === 'tech' ? 'on' : ''}">Technical</button></div>
        ${sec('pr-cols', 'Columns (order top to bottom)', `<div class="colpick">${cols.map((c, i) => `<div><label><input type="checkbox" id="pc-${i}" data-chg="printCol" data-k="${esc(c.key)}" ${c.on ? 'checked' : ''}> ${esc(colLabel(c.key))}</label><button data-act="printColMove" data-k="${esc(c.key)}" data-d="-1" aria-label="Move up">↑</button><button data-act="printColMove" data-k="${esc(c.key)}" data-d="1" aria-label="Move down">↓</button></div>`).join('')}</div>`)}
        ${sec('pr-inc', 'Include', `<div style="display:grid;gap:4px">${inc('inputs', 'Input list')}${inc('outputs', 'Output list')}${inc('stageMap', 'Stage box map')}${inc('pull', 'Equipment pull list')}${inc('ipList', 'IP address list')}</div>`)}
        ${sec('pr-look', 'Look', `
        <label class="field"><span>Title</span><input id="pr-title" value="${esc(pr.title)}" data-chg="printField" data-f="title"></label>
        <label class="field"><span>Header name (shown when there's no logo)</span><input id="pr-org" value="${esc(pr.org)}" data-chg="printField" data-f="org"></label>
        <div class="inline-fields"><label class="field"><span>Header colour</span><input type="color" id="pr-hc" value="${esc(pr.headerColor)}" data-chg="printField" data-f="headerColor"></label>
          <label class="field"><span>Text size</span><select id="pr-fs" data-chg="printField" data-f="fontSize" data-val="${pr.fontSize}" style="width:90px"><option value="9">Small</option><option value="11">Normal</option><option value="13">Large</option><option value="15">Extra large</option></select></label></div>
        <div class="inline-fields"><label class="field"><span>Paper</span><select id="pr-or" data-chg="printField" data-f="orientation" data-val="${pr.orientation}" style="width:130px"><option value="portrait">Letter portrait</option><option value="landscape">Letter landscape</option></select></label>
          <label class="field"><span>Row colours</span><select id="pr-cm" data-chg="printField" data-f="colorMode" data-val="${pr.colorMode}" style="width:150px"><option value="cells">Source &amp; Mic cells</option><option value="row">Whole row</option><option value="none">None</option></select></label></div>
        <label class="tog"><input type="checkbox" id="pr-merge" data-chg="printField" data-f="mergePerson" ${pr.mergePerson ? 'checked' : ''}> Merge repeated names in Person</label>
        <div class="toolbar"><button data-act="pickLogo">${pr.logo ? 'Replace logo' : 'Add logo'}</button>${pr.logo ? '<button data-act="clearLogo">Remove logo</button>' : ''}</div>`, false)}
        <div class="eyebrow">Output</div>
        <div class="toolbar"><button class="primary" data-act="print">Print / Save as PDF</button><button data-act="csv">Download CSV</button><button data-act="copyCsv">Copy CSV</button></div>
        ${inFrame ? '<p class="small muted" style="margin:0">This preview inside Claude blocks printing and downloads. They work when the app runs in its own browser tab or from the file on your Mac.</p>' : '<p class="small muted" style="margin:0">To make a PDF, choose “Save as PDF” in the print dialog.</p>'}
      </div>
      <div class="paper-wrap" id="paper-wrap" data-keep-scroll>${paperHTML()}</div>
    </div>
  </section>`;
}
function csvText() {
  const cols = printColumns().filter((c) => c.on).map((c) => c.key);
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.map((k) => q(colLabel(k))).join(','), ...patch().sources.map((s) => cols.map((k) => q(cellValue(s, k))).join(','))].join('\n');
}

/* ---------- 11. library ---------- */
function libraryView() {
  const q = ui.libQuery.toLowerCase();
  const defs = project.library.filter((d) => !q || `${d.make} ${d.model} ${d.category}`.toLowerCase().includes(q))
    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
  const sel = project.library.find((d) => d.id === ui.libSel) || null;
  let cat = '';
  const list = defs.map((d) => {
    const h = d.category !== cat ? `<div class="eyebrow" style="margin-top:8px">${esc(CATEGORY_NAMES[d.category] || d.category)}</div>` : '';
    cat = d.category;
    const used = project.devices.filter((x) => x.defId === d.id).length;
    return `${h}<button class="${d.id === ui.libSel ? 'on' : ''}" data-act="libSel" data-def="${d.id}"><span>${esc(d.make)} ${esc(d.model)} ${d.verified ? '' : '<span class="pill unv">?</span>'}</span><small>${used ? used + ' in use' : ''}</small></button>`;
  }).join('');
  return `<section class="view">
    <div class="card-head"><h2>Gear library</h2><span class="muted small">${project.library.length} definitions</span><span class="spacer"></span>
      <button class="primary" data-act="newDef">+ New gear</button><button data-act="exportLib">Export library</button><button data-act="importLib">Import library</button></div>
    <div class="lib-split">
      <div class="card"><input id="lib-q" data-inp="libQuery" placeholder="Search…" value="${esc(ui.libQuery)}"><div class="list lib-list" id="lib-list">${list}</div></div>
      <div class="card">${sel ? defEditor(sel) : '<p class="muted">Pick a piece of gear to see or edit its definition. A definition is the template for one model: its size and every connector. Change it once and every unit of that model updates.</p>'}</div>
    </div>
  </section>`;
}
function defEditor(d) {
  const used = project.devices.filter((x) => x.defId === d.id).length;
  const opt = (obj, v) => Object.entries(obj).map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const f = (key, label, type = 'text', extra = '') => `<label class="field"><span>${label}</span><input id="df-${key}" type="${type}" value="${esc(d[key] ?? '')}" data-chg="defField" data-f="${key}" ${extra}></label>`;
  const groupRows = d.groups.map((g, i) => `<tr>
    <td><input id="gl-${i}" value="${esc(g.label)}" data-chg="grpField" data-i="${i}" data-f="label" style="min-width:90px"></td>
    <td><input id="gcnt-${i}" type="number" min="1" max="256" value="${g.count}" data-chg="grpField" data-i="${i}" data-f="count" style="width:64px"></td>
    <td><select id="gconn-${i}" data-chg="grpField" data-i="${i}" data-f="conn">${opt(CONN_NAMES, g.conn)}</select></td>
    <td><select id="gdir-${i}" data-chg="grpField" data-i="${i}" data-f="dir">${opt({ in: 'Input', out: 'Output', io: 'Two-way / network' }, g.dir)}</select></td>
    <td><select id="gface-${i}" data-chg="grpField" data-i="${i}" data-f="face">${opt({ front: 'Front', rear: 'Rear', dante: 'Dante', virtual: 'Virtual' }, g.face)}</select></td>
    <td><input id="grows-${i}" type="number" min="0" max="8" value="${g.rows || ''}" placeholder="auto" data-chg="grpField" data-i="${i}" data-f="rows" style="width:56px"></td>
    <td><input id="gnames-${i}" value="${esc((g.names || []).join(', '))}" placeholder="1, 2, 3…" data-chg="grpField" data-i="${i}" data-f="names" style="min-width:90px"></td>
    <td>${isPhysical(g) ? `<select id="gsig-${i}" data-chg="grpField" data-i="${i}" data-f="signal" data-val="${g.signal || ''}"><option value="">Auto: ${esc(sigName(inferSignal(g)))}</option>${Object.entries(SIGNALS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select>` : '<span class="muted small">—</span>'}</td>
    <td style="text-align:center"><input type="checkbox" id="gsrc-${i}" data-chg="grpField" data-i="${i}" data-f="src" ${g.src ? 'checked' : ''}></td>
    <td><div class="rowbtns"><button data-act="grpMove" data-i="${i}" data-d="-1">↑</button><button data-act="grpMove" data-i="${i}" data-d="1">↓</button>${confirmBtn('grpDel', '✕', `data-i="${i}"`)}</div></td></tr>`).join('');
  const gopt = (v) => d.groups.map((g) => `<option value="${g.id}" ${g.id === v ? 'selected' : ''}>${esc(g.label)}</option>`).join('');
  const linkRows = (d.links || []).map((L, i) => `<tr><td><select id="lf-${i}" data-chg="linkField" data-i="${i}" data-f="from">${gopt(L.from)}</select></td><td><input id="lfs-${i}" type="number" min="1" value="${L.fromStart || 1}" data-chg="linkField" data-i="${i}" data-f="fromStart" style="width:60px"></td><td>→</td><td><select id="lt-${i}" data-chg="linkField" data-i="${i}" data-f="to">${gopt(L.to)}</select></td><td><input id="lts-${i}" type="number" min="1" value="${L.toStart || 1}" data-chg="linkField" data-i="${i}" data-f="toStart" style="width:60px"></td><td><input id="lc-${i}" type="number" min="1" value="${L.count ?? ''}" placeholder="all" data-chg="linkField" data-i="${i}" data-f="count" style="width:60px"></td><td>${confirmBtn('linkDel', '✕', `data-i="${i}"`)}</td></tr>`).join('');
  return `<div class="card-head"><h3>${esc(d.make)} ${esc(d.model)}</h3>${d.verified ? '<span class="pill ver">verified</span>' : '<span class="pill unv">unverified</span>'}<span class="muted small">${used} in use</span><span class="spacer"></span>
      <button data-act="dupDef" data-def="${d.id}">Duplicate</button>${used ? '' : confirmBtn('delDef', 'Delete', `data-def="${d.id}"`)}</div>
    <div class="inline-fields">${f('make', 'Make')}${f('model', 'Model')}${f('short', 'Short label')}
      <label class="field"><span>Category</span><select id="df-category" data-chg="defField" data-f="category">${opt(CATEGORY_NAMES, d.category)}</select></label>
      <label class="field"><span>Mounting</span><select id="df-form" data-chg="defField" data-f="form">${opt({ rack: '19" rack', desk: 'Desk / free-standing', pocket: 'Floor pocket / wall plate' }, d.form)}</select></label>
      ${f('ru', 'Height (U)', 'number', 'min="1" max="20" style="width:80px"')}
      <label class="field"><span>Width</span><select id="df-width" data-chg="defField" data-f="width">${opt({ full: 'Full rack width', half: 'Half rack width' }, d.width)}</select></label>
      ${f('watts', 'Power (W)', 'number', 'min="0" style="width:90px"')}
      <label class="tog"><input type="checkbox" id="df-verified" data-chg="defField" data-f="verified" ${d.verified ? 'checked' : ''}> Verified against the real unit</label>
    </div>
    <label class="field"><span>Reference / notes</span><input id="df-ref" value="${esc(d.ref || '')}" data-chg="defField" data-f="ref"></label>
    <div class="card-head"><h3>Connectors &amp; channels</h3><span class="spacer"></span><button data-act="grpAdd">+ Port group</button></div>
    <p class="small muted" style="margin:0">One row per set of identical jacks. “Sources” marks jacks a mic or instrument can be assigned to in the patchlist. “Dante” and “Virtual” groups aren't drawn on the panel.</p>
    <div class="tbl-wrap"><table class="grid"><thead><tr><th>Label</th><th>Count</th><th>Connector</th><th>Direction</th><th>Side</th><th>Rows</th><th>Names</th><th>Signal</th><th>Sources</th><th></th></tr></thead><tbody>${groupRows}</tbody></table></div>
    ${sec('lib-routing', 'Internal routing', `<div class="toolbar"><span class="small muted" style="flex:1">What feeds what inside the box, number for number. Example: In 1 → Dante Tx 1 means input 5 comes out on Dante Tx 5.</span><button data-act="linkAdd" ${d.groups.length < 2 ? 'disabled' : ''}>+ Route</button></div>
    <div class="tbl-wrap"><table class="grid"><thead><tr><th>From</th><th>Start</th><th></th><th>To</th><th>Start</th><th>How many</th><th></th></tr></thead><tbody>${linkRows || '<tr><td colspan="7" class="muted small">No internal routing.</td></tr>'}</tbody></table></div>`, false)}
    ${sec('lib-photos', 'Photos', photoHTML(d), !!d.images?.front || !!d.images?.rear)}
    <div class="card-head"><h3>Panel layout</h3><span class="muted small">Drag a block of ports to move it. It snaps to a ${GRID}px grid.</span></div>
    <div style="overflow-x:auto"><div style="display:grid;gap:14px">${['front', 'rear'].map((face) => {
      const sz = devSize(d); const lay = layoutFace(d, face, sz.w, sz.h);
      const boxes = lay.blocks.map((b) => `<div class="grp-box" data-face="${face}" data-gid="${b.gid}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px" title="Drag to move"></div>`).join('');
      return `<div><div class="card-head"><span class="eyebrow">${face}</span>${d.layout?.[face] ? `<button class="face-btn" data-act="resetLayout" data-face="${face}">Reset to automatic</button>` : '<span class="muted small">automatic layout</span>'}</div>
        <div class="pv" style="position:relative;width:${sz.w}px;height:${sz.h}px">${previewDev(d, face)}${boxes}</div></div>`;
    }).join('')}</div></div>`;
}
function previewDev(def, face) {
  const fake = { id: '__pv', defId: def.id, name: def.model, short: def.short || '', place: {}, portNames: {}, labels: {} };
  idx.dev.set('__pv', fake);
  const html = devHTML(fake, def, face, { top: 0, left: 0, w: def.width === 'half' ? W / 2 : W, h: (def.ru || 1) * U, cls: 'free', preview: true });
  idx.dev.delete('__pv');
  return html;
}

/* ---------- 12. checks view ---------- */
function checkHTML(c) {
  const sel = c.sel ? `data-act="goCheck" data-sel="${esc(JSON.stringify(c.sel))}"` : '';
  return `<div class="check"><span class="sev ${c.sev}">${c.sev === 'error' ? 'Error' : c.sev === 'warn' ? 'Check' : 'Note'}</span><span class="msg small">${esc(c.msg)}</span>${sel ? `<button ${sel} style="padding:1px 8px">Show</button>` : ''}</div>`;
}
function checksView() {
  return `<section class="view"><div class="card"><div class="card-head"><h2>Checks for “${esc(patch().name)}”</h2><span class="muted small">${checks.length} found</span></div>
    <p class="small muted" style="margin:0">Errors are things that can't work (two cables in one jack, output into output). Checks are things that are probably wrong (a source that never reaches the console). Notes are things to look at (an XLR into a Phoenix input needs a pigtail).</p>
    ${checks.length ? checks.map(checkHTML).join('') : '<p>No problems found.</p>'}</div></section>`;
}

/* ---------- 13. events ---------- */
function openModal(title, html) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="card-head"><h3>${esc(title)}</h3><span class="spacer"></span><button data-act="closeModal">Close</button></div>${html}</div>`;
  m.hidden = false;
}
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
const findSrc = (id) => patch().sources.find((s) => s.id === id);
const defaultsFor = (def) => {
  const same = project.devices.filter((d) => d.defId === def.id).length;
  return { name: same ? `${def.model} ${same + 1}` : def.model, short: same ? `${def.short || 'DEV'} ${same + 1}` : (def.short || 'DEV') };
};
function moveIn(arr, id, d) { const i = arr.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
function libDef() { return project.library.find((d) => d.id === ui.libSel); }

const actions = {
  tab: (el) => { ui.tab = el.dataset.tab; ui.danteEdit = null; render(); window.scrollTo(0, 0); },
  undo, redo,
  arm: (el) => { ui.armed = el.dataset.arm; render(); setTimeout(() => { if (ui.armed === el.dataset.arm) { ui.armed = null; render(); } }, 3500); },
  closeModal,
  dismissSample: () => commit('', (p) => { p.sample = false; }),
  layer: (el) => { ui.layer = el.dataset.layer; render(); },
  flip: (el) => { const next = { front: 'rear', rear: 'both', both: 'front' }; ui.faces[el.dataset.id] = next[ui.faces[el.dataset.id] || 'front']; render(); },
  addRack: (el) => { const id = uid('r'); const locId = el?.dataset?.loc || undefined; commit('Added a rack', (p) => p.racks.push({ id, name: `Rack ${p.racks.length + 1}`, ru: 12, locId })); select({ kind: 'rack', id }); },
  addLoc: () => { const id = uid('l'); commit('Added a location', (p) => p.locations.push({ id, name: `Location ${p.locations.length + 1}` })); select({ kind: 'loc', id }); },
  slot: (el) => select({ kind: 'slot', rackId: el.dataset.rack, u: +el.dataset.u, side: el.dataset.side }),
  locAdd: (el) => { ui.tab = 'rack'; select({ kind: 'locAdd', id: el.dataset.id }); },
  selRack: (el) => select({ kind: 'rack', id: el.dataset.id }),
  selLoc: (el) => select({ kind: 'loc', id: el.dataset.id }),
  selDev: (el) => select({ kind: 'device', id: el.dataset.id }),
  selPort: (el, e) => { e.preventDefault(); ui.tab = 'rack'; const p = port(el.dataset.ref); if (p) revealFace(p); select({ kind: 'port', ref: el.dataset.ref }); },
  selConn: (el) => select({ kind: 'conn', id: el.dataset.id }),
  install: (el) => {
    const def = project.library.find((d) => d.id === el.dataset.def); const s = ui.sel;
    const id = uid('d'); const nm = defaultsFor(def);
    let place;
    if (s.kind === 'slot') place = { type: 'rack', rackId: s.rackId, u: s.u, side: def.width === 'half' ? (s.side === 'full' ? 'L' : s.side) : 'full' };
    else place = { type: 'loc', locId: s.id };
    commit(`Installed ${def.make} ${def.model}`, (p) => p.devices.push({ id, defId: def.id, name: nm.name, short: nm.short, place, portNames: {}, labels: {} }));
    select({ kind: 'device', id });
  },
  newGearFromAdd: () => { ui.tab = 'library'; actions.newDef(); },
  newKind: (el) => { ui.newKind = el.dataset.k; render(); },
  pickMode: (el) => { ui.pick = el.dataset.ref; render(); },
  cancelPick: () => { ui.pick = null; render(); },
  connectPicked: (el) => {
    const t = $('#pt-target')?.value;
    if (!t) { toast('Choose a jack from the list first.'); return; }
    connect(el.dataset.ref, t, { keepSel: el.dataset.ref });
  },
  resetLayout: (el) => commit('Reset panel layout', () => {
    const d = libDef(); const face = el.dataset.face;
    if (d.layout) delete d.layout[face];
    for (const g of d.groups) if (g.face === face) delete g.pos;
    layoutCache.clear();
  }),
  cabTog: (el) => {
    const id = el.dataset.id, v = project.view;
    if (v.cableMode === 'picked') { if (v.cables[id] === true) delete v.cables[id]; else v.cables[id] = true; }
    else { if (v.cables[id] === false) delete v.cables[id]; else v.cables[id] = false; }
    save(); render();
  },
  rackRU: (el) => {
    const r = project.racks.find((x) => x.id === el.dataset.id); const ru = r.ru + +el.dataset.d;
    if (ru < rackMinRU(r)) { toast('Gear is in the bottom space. Move it up first.'); return; }
    if (ru > 60) return;
    commit(`Resized ${r.name} to ${ru}U`, () => { r.ru = ru; });
  },
  moveRack: (el) => commit('Reordered racks', (p) => {
    // swap with the next rack in the same location
    const r = p.racks.find((x) => x.id === el.dataset.id); const locIds = new Set(p.locations.map((l) => l.id));
    const same = (x) => (locIds.has(x.locId) ? x.locId : null) === (locIds.has(r.locId) ? r.locId : null);
    const i = p.racks.indexOf(r); const d = +el.dataset.d;
    for (let j = i + d; j >= 0 && j < p.racks.length; j += d) if (same(p.racks[j])) { [p.racks[i], p.racks[j]] = [p.racks[j], p.racks[i]]; break; }
  }),
  addPhoto: (el) => { ui.photoTarget = { defId: el.dataset.def, face: el.dataset.face }; $('#file-photo').click(); },
  removePhoto: (el) => commit('Removed a photo', (p) => { const d = p.library.find((x) => x.id === el.dataset.def); if (d?.images) delete d.images[el.dataset.face]; }),
  copyIps: () => copyText(['Gear,Jack,IP address,Note', ...ipListRows().map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n'), 'IP list copied.'),
  moveLoc: (el) => commit('Reordered locations', (p) => moveIn(p.locations, el.dataset.id, +el.dataset.d)),
  dupDev: (el) => {
    const d = idx.dev.get(el.dataset.id); const def = idx.def.get(d.defId);
    const id = uid('d'); const copy = { ...JSON.parse(JSON.stringify(d)), id, name: d.name + ' copy' };
    if (copy.place.type === 'rack') {
      const rack = project.racks.find((r) => r.id === copy.place.rackId); let found = false;
      for (let u = 1; u <= rack.ru && !found; u++) for (const side of def.width === 'half' ? ['L', 'R'] : ['full']) if (!found && canPlace(rack, u, def.ru, side)) { copy.place = { ...copy.place, u, side }; found = true; }
      if (!found) { toast('No room in this rack for a copy. Add rack space or move it to a location.'); return; }
    }
    commit(`Duplicated ${d.name}`, (p) => p.devices.push(copy)); select({ kind: 'device', id });
  },
  delDev: (el) => { const d = idx.dev.get(el.dataset.id); ui.armed = null; commit(`Removed ${d.name}`, (p) => { p.devices = p.devices.filter((x) => x.id !== d.id); p.connections = p.connections.filter((c) => !c.a.startsWith(d.id + '.') && !c.b.startsWith(d.id + '.')); }); select(null); },
  delConn: (el) => { ui.armed = null; commit('Removed a cable', (p) => { p.connections = p.connections.filter((c) => c.id !== el.dataset.id); }); select(null); },
  delRack: (el) => { ui.armed = null; const id = el.dataset.id; commit('Deleted a rack', (p) => { const gone = new Set(p.devices.filter((d) => d.place.type === 'rack' && d.place.rackId === id).map((d) => d.id)); p.racks = p.racks.filter((r) => r.id !== id); p.devices = p.devices.filter((d) => !gone.has(d.id)); p.connections = p.connections.filter((c) => !gone.has(parseRef(c.a)?.devId) && !gone.has(parseRef(c.b)?.devId)); }); select(null); },
  delLoc: (el) => { ui.armed = null; const id = el.dataset.id; commit('Deleted a location', (p) => { for (const r of p.racks) if (r.locId === id) delete r.locId; const gone = new Set(p.devices.filter((d) => d.place.type === 'loc' && d.place.locId === id).map((d) => d.id)); p.locations = p.locations.filter((r) => r.id !== id); p.devices = p.devices.filter((d) => !gone.has(d.id)); p.connections = p.connections.filter((c) => !gone.has(parseRef(c.a)?.devId) && !gone.has(parseRef(c.b)?.devId)); }); select(null); },
  assign: (el) => {
    const sid = $('#pt-assign').value; if (!sid) return; const ref = el.dataset.ref;
    commit(`Assigned ${findSrc(sid)?.name} to ${portLabel(ref)}`, () => { const s = findSrc(sid); s.ports = (s.ports || []).filter(Boolean); if (s.ports.length >= 2) s.ports[1] = ref; else if (s.ports.length === 1 && s.ports[0] !== ref) s.ports[0] = ref; else s.ports = [ref]; });
  },
  unassign: (el) => commit(`Unassigned ${findSrc(el.dataset.src)?.name}`, () => { const s = findSrc(el.dataset.src); s.ports = (s.ports || []).filter((r) => r !== el.dataset.ref); }),
  newSrcHere: (el) => { const ref = el.dataset.ref; commit(`New source on ${portLabel(ref)}`, () => patch().sources.push({ id: uid('s'), name: 'New source', groupId: '', mic: '', ports: [ref], person: '', cable: '', notes: '', custom: {} })); ui.tab = 'list'; render(); },
  showSrc: (el) => { ui.tab = 'rack'; const s = findSrc(el.dataset.id); const p = s?.ports?.[0] && port(s.ports[0]); if (p) revealFace(p); select({ kind: 'source', id: el.dataset.id }); },
  showOut: (el) => { ui.tab = 'rack'; const o = patch().outputs.find((x) => x.id === el.dataset.id); const p = o?.port && port(o.port); if (p) revealFace(p); select({ kind: 'output', id: el.dataset.id }); },
  addSrc: () => commit('Added a source', () => patch().sources.push({ id: uid('s'), name: '', groupId: '', mic: '', ports: [], person: '', cable: '', notes: '', custom: {} })),
  delSrc: (el) => { ui.armed = null; commit(`Deleted ${findSrc(el.dataset.id)?.name || 'a source'}`, () => { patch().sources = patch().sources.filter((s) => s.id !== el.dataset.id); }); },
  moveSrc: (el) => commit('', () => moveIn(patch().sources, el.dataset.id, +el.dataset.d)),
  stereo: (el) => commit('', () => { const s = findSrc(el.dataset.id); s.ports ||= []; if (s.ports.length > 1) s.ports = s.ports.slice(0, 1); else s.ports = [s.ports[0] || '', '']; }),
  addOut: () => commit('Added an output', () => patch().outputs.push({ id: uid('o'), name: '', mix: '', port: '', person: '', notes: '' })),
  delOut: (el) => { ui.armed = null; commit('Deleted an output', () => { patch().outputs = patch().outputs.filter((o) => o.id !== el.dataset.id); }); },
  moveOut: (el) => commit('', () => moveIn(patch().outputs, el.dataset.id, +el.dataset.d)),
  addGroup: () => commit('Added a group', (p) => p.groups.push({ id: uid('g'), name: 'New group', color: '#dde3ea' })),
  delGroup: (el) => { ui.armed = null; commit('Deleted a group', (p) => { p.groups = p.groups.filter((g) => g.id !== el.dataset.id); }); },
  addCol: () => commit('Added a column', (p) => p.columns.push({ id: uid('col'), name: 'New column' })),
  delCol: (el) => { ui.armed = null; commit('Deleted a column', (p) => { p.columns = p.columns.filter((c) => c.id !== el.dataset.id); }); },
  addCableColor: () => commit('Added a cable colour', (p) => p.cableColors.push({ id: uid('cc'), name: 'New', hex: '#55aa55', length: '' })),
  delCC: (el) => { ui.armed = null; commit('Deleted a cable colour', (p) => { p.cableColors = p.cableColors.filter((c) => c.id !== el.dataset.id); }); },
  dupPatch: () => {
    const src = patch(); const id = uid('p');
    commit(`Copied patch ${src.name}`, (p) => {
      const copy = JSON.parse(JSON.stringify(src)); copy.id = id; copy.name = src.name + ' copy';
      copy.sources.forEach((s) => { s.id = uid('s'); }); copy.outputs.forEach((o) => { o.id = uid('o'); });
      p.patches.push(copy);
      for (const c of p.connections.filter((c) => c.layer === src.id)) p.connections.push({ ...c, id: uid('c'), layer: id });
    }, { quiet: true });
    ui.patchId = id; render(); toast('Copied. You are now editing the copy.');
  },
  newPatch: () => { const np = newPatch('New patch'); commit('Created a patch', (p) => p.patches.push(np), { quiet: true }); ui.patchId = np.id; render(); },
  delPatch: () => { ui.armed = null; const id = patch().id; commit(`Deleted patch ${patch().name}`, (p) => { p.patches = p.patches.filter((x) => x.id !== id); p.connections = p.connections.filter((c) => c.layer !== id); }, { quiet: true }); ui.patchId = project.patches[0].id; render(); },
  danteEdit: (el) => { ui.danteEdit = el.dataset.ref; render(); const s = $('#dsel'); if (s) s.focus(); },
  preset: (el) => commit('', (p) => {
    const on = el.dataset.p === 'tech' ? ['source', 'mic', 'input', 'consoleCh', 'cable', 'person', 'notes'] : ['source', 'mic', 'input', 'person'];
    p.print.preset = el.dataset.p;
    const cols = printColumns();
    const ordered = [...on.map((k) => cols.find((c) => c.key === k)).filter(Boolean), ...cols.filter((c) => !on.includes(c.key))];
    p.print.columns = ordered.map((c) => ({ ...c, on: on.includes(c.key) }));
    p.print.include.outputs = el.dataset.p === 'tech'; p.print.include.pull = el.dataset.p === 'tech';
  }),
  printColMove: (el) => commit('', (p) => { const cols = printColumns(); const i = cols.findIndex((c) => c.key === el.dataset.k), j = i + +el.dataset.d; if (j < 0 || j >= cols.length) return; [cols[i], cols[j]] = [cols[j], cols[i]]; }),
  pickLogo: () => $('#file-logo').click(),
  clearLogo: () => commit('Removed logo', (p) => { p.print.logo = ''; }),
  print: () => {
    const root = $('#print-root'); root.innerHTML = paperHTML();
    let st = $('#page-style'); if (!st) { st = document.createElement('style'); st.id = 'page-style'; document.head.appendChild(st); }
    st.textContent = `@page { size: letter ${project.print.orientation}; margin: 0.25in; }`;
    try { window.print(); } catch { /* blocked */ }
    if (inFrame) toast('Printing is blocked in this preview. Open the app in its own tab or from the file on your Mac.', 5000);
  },
  csv: () => download(`${patch().name || 'patchlist'}.csv`, csvText(), 'text/csv'),
  copyCsv: () => copyText(csvText(), 'CSV copied. Paste it into Numbers, Excel or Google Sheets.'),
  // library
  libSel: (el) => { ui.libSel = el.dataset.def; render(); },
  editDef: (el) => { ui.tab = 'library'; ui.libSel = el.dataset.def; render(); },
  newDef: () => { const id = uid('def'); commit('Created a gear definition', (p) => p.library.push({ id, make: 'New', model: 'Gear', short: 'NEW', category: 'other', form: 'rack', ru: 1, width: 'full', watts: 0, verified: false, ref: '', groups: [{ id: 'in', label: 'In', count: 8, start: 1, conn: 'xlr', dir: 'in', face: 'rear', src: true }], links: [] }), { quiet: true }); ui.tab = 'library'; ui.libSel = id; render(); },
  dupDef: (el) => { const src = project.library.find((d) => d.id === el.dataset.def); const id = uid('def'); commit(`Duplicated ${src.model}`, (p) => p.library.push({ ...JSON.parse(JSON.stringify(src)), id, model: src.model + ' copy', verified: false }), { quiet: true }); ui.libSel = id; render(); },
  delDef: (el) => { ui.armed = null; commit('Deleted a gear definition', (p) => { p.library = p.library.filter((d) => d.id !== el.dataset.def); }, { quiet: true }); ui.libSel = null; render(); },
  grpAdd: () => commit('Edited gear', () => { const d = libDef(); d.groups.push({ id: uid('g'), label: 'Port', count: 1, start: 1, conn: 'xlr', dir: 'in', face: 'rear' }); }),
  grpDel: (el) => { ui.armed = null; commit('Edited gear', () => { const d = libDef(); const g = d.groups[+el.dataset.i]; d.groups.splice(+el.dataset.i, 1); d.links = (d.links || []).filter((L) => L.from !== g.id && L.to !== g.id); }); },
  grpMove: (el) => commit('', () => { const d = libDef(); const i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= d.groups.length) return; [d.groups[i], d.groups[j]] = [d.groups[j], d.groups[i]]; }),
  linkAdd: () => commit('Edited gear', () => { const d = libDef(); (d.links ||= []).push({ from: d.groups[0].id, to: d.groups[1].id }); }),
  linkDel: (el) => { ui.armed = null; commit('Edited gear', () => { libDef().links.splice(+el.dataset.i, 1); }); },
  exportLib: () => download('patchrack-library.json', JSON.stringify({ patchrackLibrary: 1, gear: project.library }, null, 2)),
  importLib: () => $('#file-lib').click(),
  goCheck: (el) => {
    const s = JSON.parse(el.dataset.sel);
    ui.tab = 'rack';
    const r = s.ref || (s.kind === 'conn' && project.connections.find((c) => c.id === s.id)?.a) || (s.kind === 'source' && findSrc(s.id)?.ports?.[0]);
    const p = r && port(r); if (p) revealFace(p);
    select(s);
  },
  // file menu
  saveFile: () => { closeMenu(); download(`${(project.name || 'project').replace(/[^\w -]/g, '')}.patchrack.json`, JSON.stringify(project, null, 2)); },
  openFile: () => { closeMenu(); $('#file-open').click(); },
  copyJson: () => { closeMenu(); copyText(JSON.stringify(project), 'Project copied as text.'); },
  pasteJson: () => { closeMenu(); openModal('Load project from text', '<textarea id="paste-area" placeholder="Paste a copied project here"></textarea><div class="toolbar"><button class="primary" data-act="loadPasted">Load project</button></div>'); },
  loadPasted: () => { try { const p = JSON.parse($('#paste-area').value); if (!p.devices || !p.library) throw 0; closeModal(); replaceProject(p, 'Project loaded'); } catch { toast("That text isn't a PatchRack project."); } },
  loadSample: () => { closeMenu(); replaceProject(buildSample(), 'Loaded the Sanctuary sample'); },
  newBlank: () => {
    closeMenu();
    const p = { schema: SCHEMA, name: 'New project', library: JSON.parse(JSON.stringify(DEFAULT_LIBRARY)), racks: [{ id: uid('r'), name: 'Rack 1', ru: 12 }], locations: [], devices: [], connections: [], patches: [newPatch('Patch 1')], groups: [], columns: [], cableColors: JSON.parse(JSON.stringify(DEFAULT_CABLE_COLORS)), print: defaultPrint(), history: [] };
    replaceProject(p, 'Started a new project (Undo brings the old one back)');
  },
  showHistory: () => { closeMenu(); openModal('Change history', `<div class="hist">${project.history.slice(0, 300).map((h) => `<div><span class="mono small muted">${esc(new Date(h.t).toLocaleString('en-CA'))}</span><span>${esc(h.msg)}${h.patch ? ` <span class="muted small">· ${esc(h.patch)}</span>` : ''}</span></div>`).join('') || '<p class="muted">No changes yet.</p>'}</div>`); },
  theme: () => { closeMenu(); const r = document.documentElement; const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); r.dataset.theme = cur === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('patchrack.theme', r.dataset.theme); } catch { } requestAnimationFrame(drawCables); },
};
function closeMenu() { $('#file-menu').open = false; const vm = $('#view-menu'); if (vm) vm.open = false; ui.viewOpen = false; }
function revealFace(p) {
  const id = p.dev.place.type === 'rack' ? p.dev.place.rackId : p.dev.place.locId;
  if ((p.g.face === 'front' || p.g.face === 'rear') && ui.faces[id] !== 'both') ui.faces[id] = p.g.face;
}

const changes = {
  projName: (el) => commit('Renamed project', (p) => { p.name = el.value; }),
  pickPatch: (el) => { ui.patchId = el.value; ui.sel = null; render(); toast(`Now editing ${patch().name}`); },
  cableMode: (el) => { project.view.cableMode = el.value; save(); render(); },
  showTies: (el) => { ui.showTies = el.checked; render(); },
  devField: (el) => { const d = idx.dev.get(ui.sel.id); commit(`Edited ${d.name}`, () => { const x = project.devices.find((y) => y.id === d.id); x[el.dataset.f] = el.value; }); },
  devLabel: (el) => commit('Edited jack labels', () => { const d = project.devices.find((y) => y.id === ui.sel.id); const L = (d.labels[el.dataset.g] ||= {}); if (el.value === '') delete L[el.dataset.f]; else L[el.dataset.f] = el.dataset.f === 'start' ? +el.value : el.value; }),
  devMove: (el) => {
    const d = project.devices.find((y) => y.id === ui.sel.id); const def = idx.def.get(d.defId);
    const [t, id] = el.value.split(':');
    if (t === 'l') { commit(`Moved ${d.name}`, () => { d.place = { type: 'loc', locId: id }; }); return; }
    if (def.form !== 'rack') { toast(`${def.model} isn't rack-mountable. Change its mounting in the Library first.`); render(); return; }
    const rack = project.racks.find((r) => r.id === id);
    for (let u = 1; u <= rack.ru; u++) for (const side of def.width === 'half' ? ['L', 'R'] : ['full']) if (canPlace(rack, u, def.ru, side, d.id)) { commit(`Moved ${d.name} to ${rack.name}`, () => { d.place = { type: 'rack', rackId: id, u, side }; }); return; }
    toast(`No room in ${rack.name} for ${def.ru}U.`); render();
  },
  devU: (el) => {
    const d = project.devices.find((y) => y.id === ui.sel.id); const u = +el.value;
    const plan = planMove(d, { ...d.place, u });
    if (!plan.ok) { toast(plan.msg, 5000); render(); return; }
    applyMoves(plan.moves, `Moved ${d.name} to U${u}`);
  },
  devSide: (el) => {
    const d = project.devices.find((y) => y.id === ui.sel.id);
    const plan = planMove(d, { ...d.place, side: el.value });
    if (!plan.ok) { toast(plan.msg, 5000); render(); return; }
    applyMoves(plan.moves, `Moved ${d.name} to the ${el.value === 'L' ? 'left' : 'right'} half`);
  },
  normal: (el) => commit('Changed normalling', () => { const d = project.devices.find((y) => y.id === ui.sel.id); (d.normalling ||= {})[el.dataset.n] = el.value; }),
  portName: (el) => { const p = port(el.dataset.ref); commit(`Renamed ${portShort(el.dataset.ref)}`, () => { const d = project.devices.find((y) => y.id === p.dev.id); const k = `${p.g.id}:${p.n}`; if (el.value.trim()) d.portNames[k] = el.value.trim(); else delete d.portNames[k]; }); },
  connType: (el) => commit('Changed a cable’s signal type', (p) => { const c = p.connections.find((x) => x.id === el.dataset.id); if (el.value) c.type = el.value; else delete c.type; }),
  connSpec: (el) => commit('Changed a cable’s spec', (p) => { const c = p.connections.find((x) => x.id === el.dataset.id); if (el.value.trim()) c.spec = el.value.trim(); else delete c.spec; }),
  rackLoc: (el) => commit('Moved a rack to a location', (p) => { const r = p.racks.find((x) => x.id === el.dataset.id); if (el.value) r.locId = el.value; else delete r.locId; }),
  devIp: (el) => {
    const d = project.devices.find((x) => x.id === el.dataset.dev); const v = el.value.trim();
    if (el.dataset.f === 'ip' && v && !IP_RE.test(v)) toast(`“${v}” doesn't look like an IP address (e.g. 192.168.1.10). Saved anyway; it shows in Checks.`, 5000);
    commit(`Set ${el.dataset.f === 'ip' ? 'IP' : 'IP note'} on ${d.name}`, () => {
      const cur = { ...(d.ips[el.dataset.k] || {}) }; if (v) cur[el.dataset.f] = v; else delete cur[el.dataset.f];
      if (cur.ip || cur.note) d.ips[el.dataset.k] = cur; else delete d.ips[el.dataset.k];
    });
  },
  viewField: (el) => { project.view[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; save(); render(); },
  typeVis: (el) => { if (el.checked) delete project.view.hideTypes[el.dataset.t]; else project.view.hideTypes[el.dataset.t] = true; save(); render(); },
  connKind: (el) => commit(el.value === 'tie' ? 'Made a cable into a tie line' : 'Made a tie line into a cable', (p) => {
    const c = p.connections.find((x) => x.id === el.dataset.id); c.kind = el.value;
    if (c.kind === 'tie') { c.layer = 'rig'; ui.showTies = true; }
  }),
  connColor: (el) => commit('Changed cable colour', (p) => { p.connections.find((c) => c.id === el.dataset.id).color = el.value; }),
  connLayer: (el) => commit('Moved a cable', (p) => { p.connections.find((c) => c.id === el.dataset.id).layer = el.value === 'rig' ? 'rig' : patch().id; }),
  rackField: (el) => {
    const r = project.racks.find((x) => x.id === el.dataset.id);
    if (el.dataset.f === 'ru') {
      const ru = Math.max(1, Math.min(60, +el.value || 1));
      const low = project.devices.filter((d) => d.place.type === 'rack' && d.place.rackId === r.id).some((d) => d.place.u + (idx.def.get(d.defId)?.ru || 1) - 1 > ru);
      if (low) { toast('Some gear sits below that height. Move it first.'); render(); return; }
      commit(`Resized ${r.name}`, () => { r.ru = ru; });
    } else commit('Renamed rack', () => { r.name = el.value; });
  },
  locField: (el) => commit('Renamed location', (p) => { p.locations.find((l) => l.id === el.dataset.id).name = el.value; }),
  src: (el) => commit(`Edited ${findSrc(el.dataset.id)?.name || 'source'}`, () => { findSrc(el.dataset.id)[el.dataset.f] = el.value; }),
  srcCustom: (el) => commit('Edited a custom column', () => { const s = findSrc(el.dataset.id); (s.custom ||= {})[el.dataset.c] = el.value; }),
  srcPort: (el) => commit(`Patched ${findSrc(el.dataset.id)?.name}`, () => { const s = findSrc(el.dataset.id); s.ports ||= []; s.ports[+el.dataset.i] = el.value; }),
  out: (el) => commit('Edited an output', () => { patch().outputs.find((o) => o.id === el.dataset.id)[el.dataset.f] = el.value; }),
  patchField: (el) => commit('Edited patch details', () => { patch()[el.dataset.f] = el.value; }),
  groupField: (el) => commit('Edited a group', (p) => { p.groups.find((g) => g.id === el.dataset.id)[el.dataset.f] = el.value; }),
  colName: (el) => commit('Renamed a column', (p) => { p.columns.find((c) => c.id === el.dataset.id).name = el.value; }),
  ccField: (el) => commit('Edited a cable colour', (p) => { p.cableColors.find((c) => c.id === el.dataset.id)[el.dataset.f] = el.value; }),
  danteSub: (el) => {
    const rx = el.dataset.ref, tx = el.value; const layer = ui.layer === 'rig' ? 'rig' : patch().id;
    ui.danteEdit = null;
    commit(tx ? `Dante: ${portShort(tx)} → ${portShort(rx)}` : `Dante: cleared ${portShort(rx)}`, (p) => {
      p.connections = p.connections.filter((c) => !(c.kind === 'dante' && c.b === rx && (c.layer === layer || c.layer === 'rig' || c.layer === patch().id)));
      if (tx) p.connections.push({ id: uid('c'), a: tx, b: rx, kind: 'dante', layer, color: '' });
    });
  },
  printField: (el) => commit('', (p) => { const f = el.dataset.f; p.print[f] = el.type === 'checkbox' ? el.checked : f === 'fontSize' ? +el.value : el.value; }),
  printInc: (el) => commit('', (p) => { p.print.include[el.dataset.k] = el.checked; }),
  printCol: (el) => commit('', () => { printColumns().find((c) => c.key === el.dataset.k).on = el.checked; }),
  defField: (el) => commit('Edited gear', () => {
    const d = libDef(); const f = el.dataset.f;
    if (f === 'verified') d.verified = el.checked;
    else if (f === 'ru' || f === 'watts') d[f] = Math.max(f === 'ru' ? 1 : 0, +el.value || 0);
    else d[f] = el.value;
  }),
  grpField: (el) => commit('Edited gear', () => {
    const g = libDef().groups[+el.dataset.i]; const f = el.dataset.f;
    if (f === 'count') g.count = Math.max(1, Math.min(256, +el.value || 1));
    else if (f === 'rows') { if (+el.value > 0) g.rows = +el.value; else delete g.rows; }
    else if (f === 'names') { const n = el.value.split(',').map((x) => x.trim()).filter(Boolean); if (n.length) g.names = n; else delete g.names; }
    else if (f === 'src') g.src = el.checked;
    else if (f === 'signal') { if (el.value) g.signal = el.value; else delete g.signal; }
    else { if (f === 'face' && g.face !== el.value) delete g.pos; g[f] = el.value; }
    layoutCache.clear();
  }),
  linkField: (el) => commit('Edited gear', () => {
    const L = libDef().links[+el.dataset.i]; const f = el.dataset.f;
    if (f === 'count') { if (+el.value > 0) L.count = +el.value; else delete L.count; }
    else if (f === 'fromStart' || f === 'toStart') L[f] = Math.max(1, +el.value || 1);
    else L[f] = el.value;
  }),
};
const inputs = {
  connQuery: (el) => { ui.connQuery = el.value; const s = $('#pt-target'); if (s) s.innerHTML = connectOptions(el.dataset.ref, el.value); },
  addQuery: (el) => {
    ui.addQuery = el.value;
    const tmp = document.createElement('div'); tmp.innerHTML = inspectorHTML();
    $('#add-list').innerHTML = $('#add-list', tmp).innerHTML;
  },
  libQuery: (el) => {
    ui.libQuery = el.value;
    const tmp = document.createElement('div'); tmp.innerHTML = libraryView();
    $('#lib-list').innerHTML = $('#lib-list', tmp).innerHTML;
  },
};

document.addEventListener('click', (e) => {
  if (ui.suppressClick) { ui.suppressClick = false; return; }
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) { const fn = actions[el.dataset.act]; if (fn) { fn(el, e); return; } }
  const hit = e.target.closest('path.hit');
  if (hit) { select({ kind: 'conn', id: hit.dataset.conn }); return; }
  if (!e.target.closest('.menu')) closeMenu();
  if (ui.armed && !el) { ui.armed = null; render(); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-chg]');
  if (el && changes[el.dataset.chg]) changes[el.dataset.chg](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-inp]');
  if (el && inputs[el.dataset.inp]) inputs[el.dataset.inp](el, e);
});
document.addEventListener('pointerdown', onPointerDown);
document.addEventListener('dblclick', (e) => {
  if (e.target.closest('#pt-target') && ui.sel?.kind === 'port') actions.connectPicked({ dataset: { ref: ui.sel.ref } });
});
document.addEventListener('toggle', (e) => {
  const d = e.target; if (d.classList?.contains('dgrp') && d.dataset.dev) (ui.danteOpen ||= {})[d.dataset.dev] = d.open;
  if (d.classList?.contains('sec') && d.dataset.sec) { secState[d.dataset.sec] = d.open; try { localStorage.setItem('patchrack.sections', JSON.stringify(secState)); } catch { /* storage unavailable */ } }
  if (d.id === 'view-menu') ui.viewOpen = d.open;
}, true);
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (ui.pick) { ui.pick = null; render(); } else if (ui.sel) select(null); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && ui.sel?.kind === 'conn') { const id = ui.sel.id; commit('Removed a cable', (p) => { p.connections = p.connections.filter((c) => c.id !== id); }); select(null); }
});
window.addEventListener('resize', () => { if (ui.tab === 'rack') drawCables(); });

function readFile(input, cb) {
  const f = input.files?.[0]; if (!f) return;
  const r = new FileReader(); r.onload = () => { cb(r.result, f); input.value = ''; }; r.readAsText(f);
}
$('#file-open').addEventListener('change', (e) => readFile(e.target, (txt) => {
  try { const p = JSON.parse(txt); if (!p.devices || !p.library) throw 0; replaceProject(p, 'Project opened'); }
  catch { toast("That file isn't a PatchRack project."); }
}));
$('#file-lib').addEventListener('change', (e) => readFile(e.target, (txt) => {
  try {
    const j = JSON.parse(txt); const gear = j.gear || j.library || (Array.isArray(j) ? j : null); if (!gear) throw 0;
    let added = 0, updated = 0;
    commit('Imported gear library', (p) => {
      for (const g of gear) {
        if (!g.id || !g.groups) continue;
        const i = p.library.findIndex((d) => d.id === g.id);
        if (i >= 0) { p.library[i] = g; updated++; } else { p.library.push(g); added++; }
      }
    });
    layoutCache.clear(); toast(`Library imported: ${added} new, ${updated} updated.`);
  } catch { toast("That file isn't a gear library."); }
}));
$('#file-photo').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; const t = ui.photoTarget; e.target.value = ''; if (!f || !t) return;
  try {
    const url = await resizeImage(f);
    const def = project.library.find((d) => d.id === t.defId);
    commit(`Added a ${t.face} photo to ${def.model}`, () => { def.images ||= {}; def.images[t.face] = url; });
    toast(`Photo added (${Math.round(url.length * 0.75 / 1024)} KB).`);
  } catch { toast("That file couldn't be read as an image. Try a JPG or PNG."); }
});
$('#file-logo').addEventListener('change', (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  if (f.size > 1.5e6) { toast('Please use a logo image under 1.5 MB.'); return; }
  const r = new FileReader(); r.onload = () => { commit('Added logo', (p) => { p.print.logo = r.result; }); e.target.value = ''; }; r.readAsDataURL(f);
});

/* start-up lives in main.js, which loads after github.js */
