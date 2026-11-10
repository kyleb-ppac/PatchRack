# PatchRack

Rack elevations and a printable patchlist that stay in sync. Install gear in 19" racks
(or in locations like floor pockets and FOH), patch it by dragging cables, and get an
input/output list you can print for volunteers or export as CSV.

Built first for the Peace Portal Church sanctuary rig.

## Using it

Open the newest `dist/PatchRack-v….html` in a web browser (double-click it on a Mac). Nothing to install. See `CHANGELOG.md` for what changed in each version.

- Your work saves automatically in that browser.
- **Save to GitHub** (the button in the top bar, or Cmd+S) stores the project in the `projects/`
  folder of this repo. Each save is a new version; GitHub keeps them all.
- **File → Open from GitHub** opens any saved project, from any computer.
- **File → GitHub settings** is where the access token goes (instructions are in that window).
  The token is stored only in that browser.
- **File → Save project file** still writes a local `.patchrack.json` backup if you want one.
- **Print → Print / Save as PDF** makes the patchlist PDF.

## What's where

| Folder | What it holds |
|---|---|
| `dist/` | The app, ready to open (`PatchRack-v<version>.html`) |
| `projects/` | Saved projects (one `.patchrack.json` per rig/venue) |
| `src/` | Source code |

## How the code is organised

| File | What it holds |
|---|---|
| `src/index.html` | Page layout: top bar, tabs, menus |
| `src/styles.css` | All styling, including the print layout |
| `src/library.js` | Starter gear library and the Sanctuary sample project |
| `src/app.js` | Signal tracing, checks, rack view, patchlist, Dante, print, library editor |
| `src/github.js` | Saving to and opening from GitHub |
| `src/main.js` | Start-up |
| `build.py` | Bundles `src/` into the single files in `dist/`; the version number comes from `VERSION` |

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
4. Dante Controller preset import (done in v0.0.14); export, with a preview of every change before export
5. Lighting (fixtures, universes, DMX/Art-Net/sACN), video, power circuits and load warnings
