/* =====================================================================
   Starter gear library + sample project
   ---------------------------------------------------------------------
   A "gear definition" describes one model of gear: its size and every
   port it has. Ports are described in groups (e.g. "32 XLR inputs on the
   front"). Port faces:
     front / rear  -> drawn on the panel
     dante         -> Dante channels (shown in the Dante tab)
     virtual       -> things like wireless channels and console channels
   "links" describe what happens inside the box: input 5 feeds Dante Tx 5.
   Everything marked verified:false is a best guess - check it against
   the real unit or its manual, then tick "Verified" in the Library tab.
   ===================================================================== */

const G = (id, label, count, conn, dir, face, extra = {}) =>
  ({ id, label, count, conn, dir, face, start: 1, ...extra });

const DEFAULT_LIBRARY = [
  // ---------------- stage boxes / IO ----------------
  {
    id: 'yamaha-rio3224-d2', make: 'Yamaha', model: 'Rio3224-D2', short: 'RIO', category: 'stagebox',
    form: 'rack', ru: 5, width: 'full', watts: 120, verified: false,
    ref: 'Yamaha spec sheet: 5U, 32 analog in, 16 analog out, AES/EBU out 1-8, 120 W. Connector positions approximate.',
    groups: [
      G('in', 'In', 32, 'xlr', 'in', 'front', { rows: 4, src: true }),
      G('out', 'Out', 16, 'xlr', 'out', 'front', { rows: 2 }),
      G('aes', 'AES Out', 4, 'xlr', 'out', 'front', { rows: 1, names: ['1/2', '3/4', '5/6', '7/8'] }),
      G('net', 'Dante', 2, 'ethercon', 'io', 'front', { names: ['Pri', 'Sec'] }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
      G('dtx', 'Dante Tx', 32, 'dante', 'out', 'dante'),
      G('drx', 'Dante Rx', 24, 'dante', 'in', 'dante'),
    ],
    links: [{ from: 'in', to: 'dtx' }, { from: 'drx', to: 'out', count: 16 }],
  },
  {
    id: 'yamaha-tio1608-d', make: 'Yamaha', model: 'Tio1608-D', short: 'TIO', category: 'stagebox',
    form: 'rack', ru: 2, width: 'full', watts: 75, verified: false,
    ref: 'Yamaha datasheet: 480x88x364 mm (2U), 16 mic/line combo in, 8 XLR line out, Dante pri/sec etherCON.',
    groups: [
      G('in', 'In', 16, 'combo', 'in', 'front', { rows: 2, src: true }),
      G('out', 'Out', 8, 'xlr', 'out', 'front', { rows: 1 }),
      G('net', 'Dante', 2, 'ethercon', 'io', 'front', { names: ['Pri', 'Sec'] }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
      G('dtx', 'Dante Tx', 16, 'dante', 'out', 'dante'),
      G('drx', 'Dante Rx', 8, 'dante', 'in', 'dante'),
    ],
    links: [{ from: 'in', to: 'dtx' }, { from: 'drx', to: 'out' }],
  },

  // ---------------- wireless ----------------
  {
    id: 'shure-ulxd4q', make: 'Shure', model: 'ULX-D4Q', short: 'ULXD', category: 'wireless',
    form: 'rack', ru: 1, width: 'full', watts: 30, verified: false,
    ref: 'Quad receiver. 4 XLR outs, antenna in/cascade, Dante. Rear layout approximate.',
    groups: [
      G('rf', 'RF Ch', 4, 'rf', 'in', 'virtual', { src: true }),
      G('out', 'Out', 4, 'xlr', 'out', 'rear'),
      G('ant', 'Ant In', 2, 'bnc', 'in', 'rear', { names: ['A', 'B'] }),
      G('cas', 'Cascade', 2, 'bnc', 'out', 'rear', { names: ['A', 'B'] }),
      G('net', 'Network', 4, 'rj45', 'io', 'rear', { names: ['Dante P', 'Dante S', 'Ctl 1', 'Ctl 2'] }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
      G('dtx', 'Dante Tx', 4, 'dante', 'out', 'dante'),
    ],
    links: [{ from: 'rf', to: 'out' }, { from: 'rf', to: 'dtx' }],
  },
  {
    id: 'shure-psm900-p9t', make: 'Shure', model: 'PSM900 P9T', short: 'PSM9', category: 'iem',
    form: 'rack', ru: 1, width: 'half', watts: 15, verified: false,
    ref: 'Half-rack IEM transmitter. Line inputs only (L/R), loop outs, antenna out. Layout approximate.',
    groups: [
      G('in', 'In', 2, 'combo', 'in', 'rear', { names: ['L', 'R'] }),
      G('loop', 'Loop', 2, 'trs', 'out', 'rear', { names: ['L', 'R'] }),
      G('ant', 'RF', 1, 'bnc', 'out', 'rear'),
      G('pwr', 'DC', 1, 'dc', 'in', 'rear'),
    ],
    links: [{ from: 'in', to: 'loop' }],
  },
  {
    id: 'shure-psm300-p3t', make: 'Shure', model: 'PSM300 P3T', short: 'PSM3', category: 'iem',
    form: 'rack', ru: 1, width: 'half', watts: 10, verified: false,
    ref: 'Half-rack IEM transmitter. Line inputs only (L/R), loop outs, antenna out. Layout approximate.',
    groups: [
      G('in', 'In', 2, 'combo', 'in', 'rear', { names: ['L', 'R'] }),
      G('loop', 'Loop', 2, 'trs', 'out', 'rear', { names: ['L', 'R'] }),
      G('ant', 'RF', 1, 'bnc', 'out', 'rear'),
      G('pwr', 'DC', 1, 'dc', 'in', 'rear'),
    ],
    links: [{ from: 'in', to: 'loop' }],
  },

  // ---------------- console & processing ----------------
  {
    id: 'ah-avantis', make: 'Allen & Heath', model: 'Avantis', short: 'AVANTIS', category: 'console',
    form: 'desk', ru: 3, width: 'full', watts: 300, verified: false,
    ref: 'Desk console. Rear I/O shown approximately. Assumes one 64x64 Dante card; Dante Rx n feeds input channel n.',
    groups: [
      G('in', 'Local In', 12, 'xlr', 'in', 'rear', { rows: 2, src: true }),
      G('out', 'Local Out', 12, 'xlr', 'out', 'rear', { rows: 2 }),
      G('aesi', 'AES In', 1, 'xlr', 'in', 'rear'),
      G('aeso', 'AES Out', 1, 'xlr', 'out', 'rear'),
      G('net', 'Dante card', 2, 'rj45', 'io', 'rear', { names: ['Pri', 'Sec'] }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
      G('drx', 'Dante Rx', 64, 'dante', 'in', 'dante'),
      G('dtx', 'Dante Tx', 64, 'dante', 'out', 'dante'),
      G('ch', 'Ch', 64, 'channel', 'in', 'virtual'),
    ],
    links: [{ from: 'drx', to: 'ch' }],
  },
  {
    id: 'ah-ahm32', make: 'Allen & Heath', model: 'AHM-32', short: 'AHM', category: 'processor',
    form: 'rack', ru: 1, width: 'full', watts: 70, verified: false,
    ref: '1U matrix processor, 12 in / 12 out on Phoenix. Dante via option card (32 ch shown).',
    groups: [
      G('in', 'In', 12, 'phoenix', 'in', 'rear', { rows: 1 }),
      G('out', 'Out', 12, 'phoenix', 'out', 'rear', { rows: 1 }),
      G('net', 'Network', 1, 'rj45', 'io', 'rear'),
      G('card', 'Dante card', 2, 'rj45', 'io', 'rear', { names: ['Pri', 'Sec'] }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
      G('drx', 'Dante Rx', 32, 'dante', 'in', 'dante'),
      G('dtx', 'Dante Tx', 32, 'dante', 'out', 'dante'),
    ],
    links: [],
  },
  {
    id: 'generic-amp-2ch', make: 'Generic', model: '2-ch power amp (2U)', short: 'AMP', category: 'amp',
    form: 'rack', ru: 2, width: 'full', watts: 600, verified: false,
    ref: 'Stand-in for amps you have not identified yet. Duplicate it in the Library and adjust.',
    groups: [
      G('in', 'In', 2, 'xlr', 'in', 'rear', { names: ['A', 'B'] }),
      G('spk', 'Speaker', 2, 'speakon', 'out', 'rear', { names: ['A', 'B'] }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
    ],
    links: [{ from: 'in', to: 'spk' }],
  },
  {
    id: 'art-headamp6', make: 'ART', model: 'HeadAmp6', short: 'HA6', category: 'utility',
    form: 'rack', ru: 1, width: 'full', watts: 10, verified: false,
    ref: '6-channel headphone amp. Layout approximate.',
    groups: [
      G('hp', 'Phones', 6, 'headphone', 'out', 'front'),
      G('in', 'In', 2, 'trs', 'in', 'rear', { names: ['L', 'R'] }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
    ],
    links: [],
  },

  // ---------------- network / computer ----------------
  {
    id: 'luminex-gigacore30i', make: 'Luminex', model: 'GigaCore 30i', short: 'GC30', category: 'network',
    form: 'rack', ru: 1, width: 'full', watts: 60, verified: false,
    ref: 'Network switch. Port count/type approximate (24 RJ45 + 6 SFP shown).',
    groups: [
      G('eth', 'Port', 24, 'rj45', 'io', 'front', { rows: 2 }),
      G('sfp', 'SFP', 6, 'sfp', 'io', 'front', { rows: 2 }),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
    ],
    links: [],
  },
  {
    id: 'sonnet-rackmac-mini', make: 'Sonnet', model: 'RackMac mini', short: 'MAC', category: 'computer',
    form: 'rack', ru: 1, width: 'full', watts: 60, verified: false,
    ref: 'Mac mini in a rack shelf. Dante channels assume Dante Virtual Soundcard (16x16 shown).',
    groups: [
      G('eth', 'Ethernet', 1, 'rj45', 'io', 'rear'),
      G('pwr', 'AC', 1, 'iec', 'in', 'rear'),
      G('dtx', 'Dante Tx', 16, 'dante', 'out', 'dante', { src: true }),
      G('drx', 'Dante Rx', 16, 'dante', 'in', 'dante'),
    ],
    links: [],
  },

  // ---------------- power ----------------
  {
    id: 'cyberpower-or500lcdrm1u', make: 'CyberPower', model: 'OR500LCDRM1U', short: 'UPS', category: 'power',
    form: 'rack', ru: 1, width: 'full', watts: 300, verified: false,
    ref: '1U UPS. Outlet count approximate.',
    groups: [
      G('out', 'Outlet', 6, 'nema', 'out', 'rear', { rows: 1 }),
      G('ac', 'AC In', 1, 'nema', 'in', 'rear'),
    ],
    links: [],
  },

  // ---------------- patch bay ----------------
  {
    id: 'generic-patchbay-48', make: 'Generic', model: 'TRS patch bay 48-pt', short: 'PB', category: 'patchbay',
    form: 'rack', ru: 1, width: 'full', watts: 0, verified: true,
    ref: '24 pairs. Rear top = from a device output, rear bottom = to a device input. Normalling set per point in the gear inspector.',
    groups: [
      G('ft', 'Front Top', 24, 'trs', 'out', 'front', { rows: 1, nolabel: true }),
      G('fb', 'Front Bottom', 24, 'trs', 'in', 'front', { rows: 1, nolabel: true }),
      G('rt', 'Rear Top', 24, 'trs', 'in', 'rear', { rows: 1, nolabel: true }),
      G('rb', 'Rear Bottom', 24, 'trs', 'out', 'rear', { rows: 1, nolabel: true }),
    ],
    links: [],
    patchbay: { rt: 'rt', rb: 'rb', ft: 'ft', fb: 'fb', mode: 'half' },
  },

  // ---------------- hardware ----------------
  { id: 'blank-1u', make: 'Generic', model: 'Blank panel 1U', short: 'BLANK', category: 'hardware', form: 'rack', ru: 1, width: 'full', style: 'blank', verified: true, groups: [], links: [] },
  { id: 'blank-2u', make: 'Generic', model: 'Blank panel 2U', short: 'BLANK', category: 'hardware', form: 'rack', ru: 2, width: 'full', style: 'blank', verified: true, groups: [], links: [] },
  { id: 'blank-half-1u', make: 'Generic', model: 'Half-rack blank 1U', short: 'BLANK', category: 'hardware', form: 'rack', ru: 1, width: 'half', style: 'blank', verified: true, groups: [], links: [] },
  { id: 'vent-1u', make: 'Generic', model: 'Vent panel 1U', short: 'VENT', category: 'hardware', form: 'rack', ru: 1, width: 'full', style: 'vent', verified: true, groups: [], links: [] },
  { id: 'vent-2u', make: 'Generic', model: 'Vent panel 2U', short: 'VENT', category: 'hardware', form: 'rack', ru: 2, width: 'full', style: 'vent', verified: true, groups: [], links: [] },
  { id: 'drawer-2u', make: 'Generic', model: 'Rack drawer 2U', short: 'DRAWER', category: 'hardware', form: 'rack', ru: 2, width: 'full', style: 'drawer', verified: true, groups: [], links: [] },
  { id: 'drawer-3u', make: 'Generic', model: 'Rack drawer 3U', short: 'DRAWER', category: 'hardware', form: 'rack', ru: 3, width: 'full', style: 'drawer', verified: true, groups: [], links: [] },
  { id: 'drawer-4u', make: 'Generic', model: 'Rack drawer 4U', short: 'DRAWER', category: 'hardware', form: 'rack', ru: 4, width: 'full', style: 'drawer', verified: true, groups: [], links: [] },

  // ---------------- off-rack locations ----------------
  {
    id: 'floor-pocket-6', make: 'Venue', model: 'Floor pocket (6 XLR)', short: 'FP', category: 'pocket',
    form: 'pocket', ru: 1, width: 'half', verified: true,
    ref: 'Six XLR inputs. The rear "Tie" jacks stand for the in-wall lines that run to a stage box.',
    groups: [
      G('in', 'In', 6, 'xlr', 'in', 'front', { src: true }),
      G('tie', 'Tie', 6, 'xlr', 'out', 'rear'),
    ],
    links: [{ from: 'in', to: 'tie' }],
  },
];

const CATEGORY_NAMES = {
  stagebox: 'Stage boxes & I/O', wireless: 'Wireless', iem: 'In-ear monitors', console: 'Consoles',
  processor: 'Processing', amp: 'Amplifiers', utility: 'Utility', network: 'Network', computer: 'Computers',
  power: 'Power', patchbay: 'Patch bays', hardware: 'Panels, vents & drawers', pocket: 'Floor pockets & wall plates',
  video: 'Video', lighting: 'Lighting', other: 'Other',
};

const CONN_NAMES = {
  xlr: 'XLR', combo: 'XLR/TRS combo', trs: '1/4" TRS', headphone: 'Headphone', ethercon: 'etherCON', rj45: 'RJ45',
  bnc: 'BNC', sfp: 'SFP', phoenix: 'Phoenix', speakon: 'speakON', iec: 'IEC', nema: 'NEMA 5-15', dc: 'DC',
  powercon: 'powerCON', usb: 'USB', hdmi: 'HDMI', dmx5: 'DMX 5-pin', dmx3: 'DMX 3-pin',
  dante: 'Dante channel', rf: 'Wireless channel', channel: 'Console channel',
};

const DEFAULT_CABLE_COLORS = [
  { id: 'white', name: 'White', hex: '#f2f2f2', length: "3'" },
  { id: 'yellow', name: 'Yellow', hex: '#f4d03f', length: "5'" },
  { id: 'orange', name: 'Orange', hex: '#f08a24', length: "15'" },
  { id: 'red', name: 'Red', hex: '#d64541', length: "25'" },
  { id: 'purple', name: 'Purple', hex: '#8e5bd0', length: "50'" },
];

/* ------------------------------------------------------------------ */
/* Sample project, built from the Sunday Nov 8 2026 patchlist          */
/* ------------------------------------------------------------------ */
function buildSample() {
  const now = new Date().toISOString();
  const p = {
    schema: SCHEMA, name: 'Sanctuary', created: now, modified: now, sample: true,
    library: JSON.parse(JSON.stringify(DEFAULT_LIBRARY)),
    racks: [], locations: [], devices: [], connections: [], patches: [],
    groups: [], columns: [{ id: 'col_stand', name: 'Stand' }],
    cableColors: JSON.parse(JSON.stringify(DEFAULT_CABLE_COLORS)),
    print: defaultPrint(), history: [],
  };
  const rack = (name, ru) => { const r = { id: uid('r'), name, ru }; p.racks.push(r); return r; };
  const loc = (name) => { const l = { id: uid('l'), name }; p.locations.push(l); return l; };
  const dev = (defId, name, short, place, extra = {}) => {
    const d = { id: uid('d'), defId, name, short, place, portNames: {}, labels: {}, ...extra };
    p.devices.push(d); return d;
  };
  const R = (r, u, side = 'full') => ({ type: 'rack', rackId: r.id, u, side });
  const L = (l) => ({ type: 'loc', locId: l.id });
  const con = (a, b, kind = 'cable', layer = 'rig', color = '') =>
    p.connections.push({ id: uid('c'), a, b, kind, layer, color });
  const ref = (d, g, n) => `${d.id}.${g}:${n}`;

  // Racks (layouts are placeholders - move things to match the real racks)
  const stA = rack('Stage Rack A', 8);
  const stB = rack('Stage Rack B', 6);
  const back = rack('Backstage', 4);
  const rf = rack('RF / IEM', 8);
  const amp = rack('Amp Rack', 7);

  const rioA = dev('yamaha-rio3224-d2', 'Rio A', 'RIO A', R(stA, 1));
  dev('luminex-gigacore30i', 'GigaCore 30i', 'GC30', R(stA, 6));
  dev('vent-1u', 'Vent', 'VENT', R(stA, 7));
  dev('cyberpower-or500lcdrm1u', 'UPS A', 'UPS A', R(stA, 8));

  const rioB = dev('yamaha-rio3224-d2', 'Rio B', 'RIO B', R(stB, 1));
  dev('blank-1u', 'Blank', 'BLANK', R(stB, 6));

  const tio = dev('yamaha-tio1608-d', 'Tio', 'TIO', R(back, 1), {
    labels: { in: { prefix: 'TIO', start: 1 } }, zone: 'Backstage', position: 'Tio',
  });
  dev('drawer-2u', 'Drawer', 'DRAWER', R(back, 3));

  const ulx1 = dev('shure-ulxd4q', 'ULX-D4Q 1', 'ULXD1', R(rf, 1));
  const ulx2 = dev('shure-ulxd4q', 'ULX-D4Q 2', 'ULXD2', R(rf, 2));
  const psmA = dev('shure-psm900-p9t', 'PSM900 A', 'PSM9 A', R(rf, 3, 'L'));
  const psmB = dev('shure-psm900-p9t', 'PSM900 B', 'PSM9 B', R(rf, 3, 'R'));
  const psm3 = dev('shure-psm300-p3t', 'PSM300', 'PSM3', R(rf, 4, 'L'));
  dev('blank-half-1u', 'Half blank', 'BLANK', R(rf, 4, 'R'));
  const mac = dev('sonnet-rackmac-mini', 'Playback Mac', 'MAC', R(rf, 5));
  dev('vent-1u', 'Vent', 'VENT', R(rf, 6));
  dev('cyberpower-or500lcdrm1u', 'UPS RF', 'UPS RF', R(rf, 7));

  const ahm = dev('ah-ahm32', 'AHM-32', 'AHM', R(amp, 1));
  const amp1 = dev('generic-amp-2ch', 'Mains amp', 'AMP 1', R(amp, 2));
  const amp2 = dev('generic-amp-2ch', 'Sub amp', 'AMP 2', R(amp, 4));
  dev('cyberpower-or500lcdrm1u', 'UPS Amp', 'UPS AMP', R(amp, 6));

  // Locations
  const pockets = loc('Stage floor pockets');
  const foh = loc('FOH');
  const avantis = dev('ah-avantis', 'Avantis', 'AVANTIS', L(foh));

  const pocketDefs = [
    ['Down-stage', 'Stage Right', 7], ['Down-stage', 'Stage Center', 13], ['Down-stage', 'Stage Left', 19],
    ['Mid-stage', 'Stage Right', 1], ['Mid-stage', 'Stage Left', 25],
    ['Up-stage', 'Stage Right', 31], ['Up-stage', 'Stage Left', 37],
  ];
  const zoneShort = { 'Down-stage': 'DS', 'Mid-stage': 'MS', 'Up-stage': 'US' };
  const posShort = { 'Stage Right': 'SR', 'Stage Center': 'SC', 'Stage Left': 'SL' };
  const pocket = {};
  for (const [zone, pos, start] of pocketDefs) {
    const tag = `${zoneShort[zone]}-${posShort[pos]}`;
    const d = dev('floor-pocket-6', `Pocket ${tag}`, `FP ${tag}`, L(pockets), {
      zone, position: pos, labels: { in: { prefix: 'RIO', start }, tie: { prefix: 'Line', start } },
    });
    pocket[tag] = d;
    // in-wall tie lines: line 1-32 -> Rio A in 1-32, line 33+ -> Rio B in 1+
    for (let i = 1; i <= 6; i++) {
      const line = start + i - 1;
      con(ref(d, 'tie', i), line <= 32 ? ref(rioA, 'in', line) : ref(rioB, 'in', line - 32), 'tie');
    }
  }

  // Wireless channel names
  ['VOX 1', 'VOX 2', 'VOX 3', 'PRAYER MIC'].forEach((n, i) => { ulx1.portNames[`rf:${i + 1}`] = n; ulx1.portNames[`dtx:${i + 1}`] = n; });
  ['PREACH MIC', 'HOST MIC'].forEach((n, i) => { ulx2.portNames[`rf:${i + 1}`] = n; ulx2.portNames[`dtx:${i + 1}`] = n; });
  mac.portNames['dtx:1'] = 'PLAYBACK CLICK';
  mac.portNames['dtx:2'] = 'PLAYBACK TRACKS';
  avantis.portNames['dtx:1'] = 'MAIN L'; avantis.portNames['dtx:2'] = 'MAIN R'; avantis.portNames['dtx:3'] = 'SUB';

  // Dante subscriptions (placeholder numbering - edit in the Dante tab)
  const sub = (txDev, txN, rxDev, rxN) => con(ref(txDev, 'dtx', txN), ref(rxDev, 'drx', rxN), 'dante');
  for (let i = 1; i <= 16; i++) sub(tio, i, avantis, i);
  for (let i = 1; i <= 32; i++) sub(rioA, i, avantis, 16 + i);
  for (let i = 1; i <= 8; i++) sub(rioB, i, avantis, 48 + i);
  for (let i = 1; i <= 4; i++) sub(ulx1, i, avantis, 56 + i);
  for (let i = 1; i <= 2; i++) sub(ulx2, i, avantis, 60 + i);
  sub(mac, 1, avantis, 63); sub(mac, 2, avantis, 64);
  for (let i = 1; i <= 3; i++) sub(avantis, i, ahm, i);

  // Permanent cables
  con(ref(ahm, 'out', 1), ref(amp1, 'in', 1), 'cable', 'rig', 'white');
  con(ref(ahm, 'out', 2), ref(amp1, 'in', 2), 'cable', 'rig', 'white');
  con(ref(ahm, 'out', 3), ref(amp2, 'in', 1), 'cable', 'rig', 'white');
  con(ref(avantis, 'out', 1), ref(psmA, 'in', 1), 'cable', 'rig', 'purple');
  con(ref(avantis, 'out', 2), ref(psmA, 'in', 2), 'cable', 'rig', 'purple');
  con(ref(avantis, 'out', 3), ref(psmB, 'in', 1), 'cable', 'rig', 'purple');
  con(ref(avantis, 'out', 4), ref(psm3, 'in', 1), 'cable', 'rig', 'purple');

  // Instrument groups (row colours from the PDF)
  const grp = (name, color) => { const g = { id: uid('g'), name, color }; p.groups.push(g); return g.id; };
  const gDr = grp('Drums', '#cfdcff'), gBs = grp('Bass', '#e6d6fb'), gEl = grp('Electric', '#fbd1f1'),
    gKy = grp('Keys', '#fdf3c2'), gAc = grp('Acoustic', '#fde6c8'), gVx = grp('Vocals', '#d3f6da'),
    gPb = grp('Playback', '#e8e8e8'), gSp = grp('Spoken', '#fbdde1');

  const src = (name, groupId, mic, ports, person, extra = {}) =>
    ({ id: uid('s'), name, groupId, mic, ports, person, cable: '', notes: '', custom: {}, ...extra });
  const fp = (tag, i) => ref(pocket[tag], 'in', i);

  const patch = {
    id: uid('p'), name: 'Sunday Service', event: 'Sunday Service', date: '2026-11-08',
    sources: [
      src('Kick Out', gDr, 'Beta 52', [ref(tio, 'in', 5)], 'Tyler'),
      src('Kick In', gDr, 'Beta 91a', [ref(tio, 'in', 1)], 'Tyler'),
      src('Snare Top', gDr, 'Beta 57a', [ref(tio, 'in', 2)], 'Tyler'),
      src('Snare Bottom', gDr, 'SM 57', [ref(tio, 'in', 6)], 'Tyler'),
      src('Tom 1', gDr, 'vBeat', [ref(tio, 'in', 3)], 'Tyler'),
      src('Tom 2', gDr, 'vBeat', [ref(tio, 'in', 4)], 'Tyler'),
      src('Overheads L+R', gDr, '451B', [ref(tio, 'in', 7), ref(tio, 'in', 8)], 'Tyler'),
      src('Bass', gBs, 'SANSAMP', [fp('US-SR', 6)], 'Jacob'),
      src('Electric 1', gEl, 'ProD2', [fp('US-SL', 1), fp('US-SL', 2)], 'Lori'),
      src('Keys', gKy, 'Stereo JDI', [fp('DS-SL', 5), fp('DS-SL', 6)], 'Ramona'),
      src('Acoustic 1', gAc, 'W/less + Session DI', [fp('DS-SR', 6)], 'Katie'),
      src('Vox 1', gVx, 'ULX-D KSM11', [ref(ulx1, 'rf', 1)], 'Katie'),
      src('Vox 2', gVx, 'ULX-D KSM11', [ref(ulx1, 'rf', 2)], 'Brian'),
      src('Vox 3', gVx, 'ULX-D KSM11', [ref(ulx1, 'rf', 3)], 'Katya'),
      src('Vox 4', gVx, 'ULX-D V7', [ref(ulx1, 'rf', 4)], 'Ramona'),
      src('Click', gPb, 'Dante Direct', [ref(mac, 'dtx', 1)], 'Tyler'),
      src('Tracks', gPb, 'Dante Direct', [ref(mac, 'dtx', 2)], 'Tyler'),
      src('Preacher', gSp, 'ULX-D1 w/Headset', [ref(ulx2, 'rf', 1)], 'Phil'),
      src('Service Host 1', gSp, 'ULX-D2 sE V7', [ref(ulx2, 'rf', 2)], 'Dave M'),
    ],
    outputs: [
      { id: uid('o'), name: 'IEM - Drums', mix: 'Aux 1', port: ref(avantis, 'out', 1), person: 'Tyler', notes: '' },
      { id: uid('o'), name: 'IEM - Bass', mix: 'Aux 2', port: ref(avantis, 'out', 2), person: 'Jacob', notes: '' },
      { id: uid('o'), name: 'IEM - Vocals', mix: 'Aux 3', port: ref(avantis, 'out', 3), person: 'Katie', notes: '' },
      { id: uid('o'), name: 'IEM - Keys', mix: 'Aux 4', port: ref(avantis, 'out', 4), person: 'Ramona', notes: '' },
    ],
  };
  p.patches.push(patch);
  return p;
}

function defaultPrint() {
  return {
    org: 'Peace Portal Church', logo: '', headerColor: '#3a5068', title: 'Sanctuary Patchlist',
    preset: 'volunteer', fontSize: 11, orientation: 'portrait', colorMode: 'cells', mergePerson: true,
    columns: [
      { key: 'source', on: true }, { key: 'mic', on: true }, { key: 'input', on: true }, { key: 'person', on: true },
      { key: 'consoleCh', on: false }, { key: 'cable', on: false }, { key: 'group', on: false },
      { key: 'path', on: false }, { key: 'notes', on: false },
    ],
    include: { inputs: true, outputs: false, stageMap: true, pull: false },
  };
}
