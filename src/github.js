/* =====================================================================
   GitHub sync
   Saves the open project to projects/<name>.patchrack.json in the
   GitHub repository, and opens projects from there. Every save is a
   commit, so GitHub keeps every version.
   The token is kept only in this browser on this computer.
   ===================================================================== */

const GH_KEY = 'patchrack.github';
const GH_FILE_KEY = 'patchrack.ghfile';
const gh = {
  cfg: { owner: 'kyleb-ppac', repo: 'patchrack', branch: 'main', token: '' },
  file: null,      // { path, sha, dirty } for the project that is open
  busy: false,
};
try { Object.assign(gh.cfg, JSON.parse(localStorage.getItem(GH_KEY) || '{}')); } catch { /* none saved */ }
try { gh.file = JSON.parse(localStorage.getItem(GH_FILE_KEY) || 'null'); } catch { gh.file = null; }

function ghStoreCfg() { try { localStorage.setItem(GH_KEY, JSON.stringify(gh.cfg)); } catch { /* storage unavailable */ } }
function ghStoreFile() { try { localStorage.setItem(GH_FILE_KEY, JSON.stringify(gh.file)); } catch { /* storage unavailable */ } }
function ghMarkDirty() { if (gh.file) { gh.file.dirty = true; ghStoreFile(); } renderGh(); }

function ghApi(path, opts = {}) {
  const base = `https://api.github.com/repos/${encodeURIComponent(gh.cfg.owner)}/${encodeURIComponent(gh.cfg.repo)}`;
  return fetch(base + (path ? '/' + path : ''), {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${gh.cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
}
const ghContents = (path) => `contents/${path.split('/').map(encodeURIComponent).join('/')}`;
const ghRef = () => `?ref=${encodeURIComponent(gh.cfg.branch)}`;
function b64encode(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
const ghSlug = (s) => (s || 'project').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'project';
function ghExplain(res) {
  if (res.status === 401) return 'GitHub rejected the token. It may have expired or been pasted incorrectly. Open File → GitHub settings and paste a new one.';
  if (res.status === 403) return 'The token is missing permission. It needs “Contents: Read and write” for this repository.';
  if (res.status === 404) return 'GitHub could not find the repository. Check the owner and name in GitHub settings, and that the token includes this repository.';
  return `GitHub returned an error (${res.status}). Try again in a minute.`;
}
function ghReady() {
  if (inFrame) { toast('GitHub saving works in the PatchRack.html file on your Mac, not in this preview.', 5000); return false; }
  if (!gh.cfg.token) { actions.ghSettings(); return false; }
  return true;
}

function renderGh(text) {
  const b = $('#gh-status'); if (!b) return;
  b.hidden = inFrame;
  if (text) { b.textContent = text; b.className = 'gh-status'; return; }
  if (!gh.cfg.token) { b.textContent = 'Connect GitHub'; b.className = 'gh-status'; b.title = 'Set up saving to GitHub'; return; }
  if (!gh.file) { b.textContent = 'Not on GitHub yet'; b.className = 'gh-status dirty'; b.title = 'Save this project to GitHub (Cmd+S)'; return; }
  const name = gh.file.path.split('/').pop();
  if (gh.file.dirty) { b.textContent = 'Unsaved changes'; b.className = 'gh-status dirty'; b.title = `Save to GitHub as ${name} (Cmd+S)`; }
  else { b.textContent = 'Saved to GitHub'; b.className = 'gh-status clean'; b.title = name; }
}

async function ghSave({ force = false, path = null } = {}) {
  if (!ghReady() || gh.busy) return;
  path = path || gh.file?.path || `projects/${ghSlug(project.name)}.patchrack.json`;
  gh.busy = true; renderGh('Saving…');
  try {
    let sha = gh.file?.path === path ? gh.file.sha : null;
    if (!sha || force) {
      const cur = await ghApi(ghContents(path) + ghRef());
      if (cur.ok) {
        const j = await cur.json();
        if (!force) { gh.busy = false; renderGh(); ghConflict(path, 'exists'); return; }
        sha = j.sha;
      } else if (cur.status !== 404) throw cur;
    }
    const last = project.history[0]?.msg;
    const res = await ghApi(ghContents(path), {
      method: 'PUT',
      body: JSON.stringify({
        message: `Save ${project.name || 'project'}${last ? ': ' + last : ''}`,
        content: b64encode(JSON.stringify(project, null, 1)),
        branch: gh.cfg.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (res.status === 409 || res.status === 422) { gh.busy = false; renderGh(); ghConflict(path, 'changed'); return; }
    if (!res.ok) throw res;
    const j = await res.json();
    gh.file = { path, sha: j.content.sha, dirty: false }; ghStoreFile();
    toast(`Saved to GitHub: ${path}`);
  } catch (e) {
    toast(e instanceof Response ? ghExplain(e) : 'Could not reach GitHub. Check the internet connection.', 6000);
  }
  gh.busy = false; renderGh();
}

function ghConflict(path, why) {
  openModal('GitHub has a different version', `
    <p style="margin:0">${why === 'exists'
      ? `A project called <b>${esc(path)}</b> is already on GitHub.`
      : `<b>${esc(path)}</b> was changed on GitHub since you opened it, possibly from another computer.`}</p>
    <div class="toolbar">
      <button class="primary" data-act="ghOpenPath" data-path="${esc(path)}">Open the GitHub version</button>
      <button class="danger" data-act="ghOverwrite" data-path="${esc(path)}">Replace it with mine</button>
      <button data-act="ghSaveAs">Save mine under a new name</button>
    </div>
    <p class="small muted" style="margin:0">Opening the GitHub version keeps your current work in Undo. Replacing is safe too: GitHub keeps every earlier version.</p>`);
}

async function ghOpen(path) {
  if (!ghReady()) return;
  try {
    const meta = await ghApi(ghContents(path) + ghRef());
    if (!meta.ok) throw meta;
    const j = await meta.json();
    let text;
    if (j.content && j.encoding === 'base64') text = b64decode(j.content);
    else {
      const raw = await ghApi(ghContents(path) + ghRef(), { headers: { Accept: 'application/vnd.github.raw+json' } });
      if (!raw.ok) throw raw;
      text = await raw.text();
    }
    const p = JSON.parse(text);
    if (!p.devices || !p.library) { toast("That file isn't a PatchRack project."); return; }
    closeModal();
    replaceProject(p, `Opened ${path.split('/').pop()} from GitHub`);
    gh.file = { path, sha: j.sha, dirty: false }; ghStoreFile(); renderGh();
  } catch (e) {
    toast(e instanceof Response ? ghExplain(e) : "Could not open that project. Check the internet connection.", 6000);
  }
}

async function ghList() {
  if (!ghReady()) return;
  openModal('Open from GitHub', '<p class="muted" style="margin:0">Loading projects…</p>');
  let files = [];
  try {
    const res = await ghApi(ghContents('projects') + ghRef());
    if (res.status !== 404) {
      if (!res.ok) throw res;
      files = (await res.json()).filter((f) => f.type === 'file' && f.name.endsWith('.json'));
    }
  } catch (e) {
    closeModal(); toast(e instanceof Response ? ghExplain(e) : 'Could not reach GitHub.', 6000); return;
  }
  openModal('Open from GitHub', files.length
    ? `<div class="list">${files.map((f) => `<button data-act="ghOpenPath" data-path="${esc(f.path)}"><span>${esc(f.name.replace(/\.patchrack\.json$|\.json$/, ''))}</span><small>${Math.ceil(f.size / 1024)} KB${gh.file?.path === f.path ? ' · open now' : ''}</small></button>`).join('')}</div>
       <p class="small muted" style="margin:0">To see older versions of a project, open the file on github.com and click History.</p>`
    : '<p style="margin:0">No projects on GitHub yet. Use “Save to GitHub” to add this one.</p>');
}

function ghSettingsHTML() {
  return `
    <p class="small" style="margin:0">PatchRack saves projects into the <b>projects</b> folder of your GitHub repository. It needs a token, which works like a password that only opens this one repository.</p>
    <details><summary class="small" style="cursor:pointer"><b>How to make a token</b></summary>
      <ol class="small" style="display:grid;gap:4px;padding-left:18px">
        <li>On github.com, click your profile picture → <b>Settings</b>.</li>
        <li>At the bottom of the left menu: <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b>.</li>
        <li><b>Generate new token</b>. Name it “PatchRack”. Pick an expiration (up to a year).</li>
        <li><b>Repository access</b>: Only select repositories → <b>${esc(gh.cfg.owner)}/${esc(gh.cfg.repo)}</b>.</li>
        <li><b>Permissions</b> → Repository permissions → <b>Contents: Read and write</b>.</li>
        <li><b>Generate token</b>, copy it, and paste it below.</li>
      </ol></details>
    <div class="inline-fields">
      <label class="field"><span>Owner</span><input id="gh-owner" value="${esc(gh.cfg.owner)}"></label>
      <label class="field"><span>Repository</span><input id="gh-repo" value="${esc(gh.cfg.repo)}"></label>
      <label class="field"><span>Branch</span><input id="gh-branch" value="${esc(gh.cfg.branch)}" style="width:100px"></label>
    </div>
    <label class="field"><span>Token ${gh.cfg.token ? '(one is saved; paste a new one to replace it)' : ''}</span><input id="gh-token" type="password" autocomplete="off" placeholder="${gh.cfg.token ? '••••••••••••' : 'github_pat_…'}"></label>
    <div class="toolbar"><button class="primary" data-act="ghSaveSettings">Save &amp; test</button>${gh.cfg.token ? '<button class="danger" data-act="ghForget">Forget token on this computer</button>' : ''}</div>
    <p class="small muted" style="margin:0">The token stays in this browser on this computer and is only sent to GitHub. On a new computer, paste it again (or make a new one).</p>`;
}

Object.assign(actions, {
  ghSave: () => { closeMenu(); ghSave(); },
  ghList: () => { closeMenu(); ghList(); },
  ghOpenPath: (el) => ghOpen(el.dataset.path),
  ghOverwrite: (el) => { closeModal(); ghSave({ force: true, path: el.dataset.path }); },
  ghSaveAs: () => openModal('Save under a new name', `
    <label class="field"><span>Project file name</span><input id="gh-newname" value="${esc(ghSlug(project.name) + '-copy')}"></label>
    <div class="toolbar"><button class="primary" data-act="ghSaveAsGo">Save to GitHub</button></div>`),
  ghSaveAsGo: () => {
    const name = ghSlug($('#gh-newname').value); closeModal();
    ghSave({ path: `projects/${name}.patchrack.json` });
  },
  ghSettings: () => { closeMenu(); openModal('GitHub settings', ghSettingsHTML()); },
  ghForget: () => { gh.cfg.token = ''; ghStoreCfg(); closeModal(); renderGh(); toast('Token removed from this computer.'); },
  ghSaveSettings: async () => {
    gh.cfg.owner = $('#gh-owner').value.trim(); gh.cfg.repo = $('#gh-repo').value.trim();
    gh.cfg.branch = $('#gh-branch').value.trim() || 'main';
    const t = $('#gh-token').value.trim(); if (t) gh.cfg.token = t;
    ghStoreCfg(); renderGh();
    if (!gh.cfg.token) { toast('Paste a token first.'); return; }
    try {
      const res = await ghApi('');
      if (!res.ok) throw res;
      closeModal(); toast(`Connected to ${gh.cfg.owner}/${gh.cfg.repo}.`);
    } catch (e) { toast(e instanceof Response ? ghExplain(e) : 'Could not reach GitHub.', 6000); }
  },
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); ghSave(); }
});
