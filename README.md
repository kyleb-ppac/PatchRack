# PatchRack

Rack elevations and a printable patchlist that stay in sync. Install gear in 19" racks
(or in locations like floor pockets and FOH), patch it by dragging cables, and get an
input/output list you can print for volunteers or export as CSV.

Built first for the Peace Portal Church sanctuary rig.

## Using it

Open `dist/PatchRack.html` in a web browser (double-click it on a Mac). Nothing to install.

- Your work saves automatically in that browser.
- **File → Save project file** writes a `.patchrack.json` backup you can open on another computer.
- **Print → Print / Save as PDF** makes the patchlist PDF.

## How the code is organised

| File | What it holds |
|---|---|
| `src/index.html` | Page layout: top bar, tabs, menus |
| `src/styles.css` | All styling, including the print layout |
| `src/library.js` | Starter gear library and the Sanctuary sample project |
| `src/app.js` | Everything else: signal tracing, checks, rack view, patchlist, Dante, print, library editor |
| `build.py` | Bundles `src/` into the single files in `dist/` |

After changing anything in `src/`, rebuild with:

```bash
python3 build.py
```

## Key ideas

- **Gear definitions** describe one model of gear: size, half/full width, and every port
  (connector, direction, front/rear/Dante/virtual) plus internal routing such as
  "Input 5 feeds Dante Tx 5". Definitions marked *unverified* still need checking against the real unit.
- **The rig** holds permanent cables, tie lines and Dante routes. **Patches** (e.g. "Sunday Service")
  hold that week's sources and any extra cables. Copy a patch to use it as a template.
- **Console Ch** and **signal paths** are worked out by tracing cables, internal routing and Dante routes,
  never typed in by hand.
- Saved projects carry a `schema` number; `migrate()` in `app.js` upgrades older files so they keep opening.

## Roadmap

1. Core rack view, patchlist sync, signal tracing, checks (first version done)
2. Print/export polish
3. Templates, history, read-only share link for volunteers
4. Dante Controller preset import/export, with a preview of every change before export
5. Lighting (fixtures, universes, DMX/Art-Net/sACN), video, power circuits and load warnings
