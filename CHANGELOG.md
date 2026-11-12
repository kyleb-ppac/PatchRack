# Changelog

The app file in `dist/` is named for its version, e.g. `PatchRack-v0.0.2.html`.
The version also shows next to the PatchRack name in the app's top bar.

## v0.0.11 (2026-11-12)
- **Line drawing tool: paint out areas.** In step 3, choose *Paint out* and brush over handles, knobs, cables, reflections or anything else you don't want drawn, on either the squared-up photo or the drawing. Painted areas come out empty, and they're ignored when the tool works out what a strong line is, so the rest of the panel can keep more detail.
  - *Erase* wipes painting away; *Undo stroke* (Ctrl/Cmd+Z) and *Clear all painting* are there too. Brush size slider, or `[` and `]`.
  - Shortcuts: P paint, E erase, Esc stop painting.
  - Painting stays in place if you move the corners or change the faceplate size. Choosing a new photo starts fresh.

## v0.0.10 (2026-11-12)
- **Line drawing tool opens far more photos:** iPhone HEIC/HEIF (even when named .jpg), TIFF, WebP, AVIF, GIF, BMP and SVG, as well as JPG and PNG. The tool now works out a file's real format from its contents instead of trusting its name or the type the computer reports, which fixes photos being refused when dragged in or downloaded. Phone photos that were taken sideways come in the right way up.
- HEIC and TIFF are converted inside the tool, with no internet needed.
- Dragging an image straight from a web page works when the site allows it; otherwise the tool says to save it first.
- When a file still won't open, a message stays on screen with what the file looks like and what to try, instead of a quick pop-up.

## v0.0.9 (2026-11-12)
- **Line drawing tool** (`dist/Line-Drawing-Tool.html`, a separate page): turns a gear photo into a clean line drawing for a gear definition's front or rear photo.
  - **Square it up:** drag four corners onto the faceplate's corners and the photo is straightened out, so a picture taken at an angle comes out flat and square. A magnifier shows the corner while dragging; arrow keys nudge; guides follow the perspective so you can check rows of jacks are straight.
  - **Exact size:** choose 1U–8U, full or half width (or a custom size in mm). The drawing comes out exactly the faceplate's shape at the same resolution the app stores, so Add photo → Fill lines up with nothing stretched.
  - **Line drawing controls:** detail, smoothing, line weight, speck removal, a faint copy of the photo underneath if you want more to recognise it by, and three styles (light on dark like the rack, dark on white, see-through).
  - Download as PNG (named from make/model) or copy it. Open a photo by choosing, dropping or pasting it. Nothing leaves your computer.
- The Photos section of each gear definition links to the tool.

## v0.0.8 (2026-11-10)
- **Rig sheet tab:** every location and rack written out top to bottom: what's in each space (and which spaces are empty), IP addresses, details and notes, every cable and tie line, and Dante routes. Matching runs of connections are grouped (e.g. "In 1–6 ← Pocket MS-SR · Tie 1–6"). Show the whole rig, one location or one rack; choose what to include; print/PDF or copy as text.
- **Details & notes on every unit:** free-form detail fields (firmware, serial, settings…) and a notes box in the unit's panel (rig mode). Shown on the Rig sheet.
- **Photo editor:** choosing a photo opens a window shaped exactly like that unit's faceplate. Drag to move, zoom, rotate 90°, straighten ±15°, with the jacks outlined to line up against. Nothing is stretched. "Adjust" reopens it with the same framing.
- **IP addresses per gear definition:** Library → IP addresses sets how many each model has and what each is for (Dante primary, Control…), optionally tied to a jack. Units only show those. Addresses already entered carry over.
- **Dante outputs in the patchlist:** "Leaves on" now includes Dante Tx channels; a new "Dante to" column picks the receiving channel and creates the route. "Goes to" follows the whole path (e.g. TIO Dante Rx 1 → PSM9 A In L).

## v0.0.7 (2026-11-10)
- Fix: tie lines are drawn only from the jacks they're really connected to. Before, when a tie's own jack was on the hidden side, the line was drawn from the matching front jack instead, so floor-pocket ties looked like they came out of the jacks you plug into. View the Rear or Front + Rear to see tie lines. Signal tracing is unchanged.

## v0.0.6 (2026-11-10)
- **IP addresses:** every network jack (Dante primary/secondary, control port, switch management) gets its own IP and note, so gear like the Avantis and AHM can have several. Edit them in the gear panel (rig mode), on the jack itself, or in the new list on the **Dante & IP** tab. Checks flag duplicate and mistyped addresses. Copy the list as CSV or add it to the printout.
- **Cable signal types:** analog audio, AES, speaker, network, fiber, power, SDI, HDMI, DMX, antenna/RF, USB, Thunderbolt, control. Worked out from the jacks, changeable per cable, with a Spec field (3G, Cat6, 14 AWG…). Cables are coloured by type; show or hide each type from **View**. Library port groups have a Signal column to override the automatic choice.
- **Photos on gear:** add front/rear photos to a gear definition from the gear panel or the Library. They show behind the jacks in the rack and in the panel layout editor (so you can line the jacks up). Toggle in View.
- **Racks inside locations:** locations (Stage, Backstage, FOH…) now hold racks as well as loose gear. Set a rack's location in its panel or add a rack straight into a location. Groundwork for a signal-flow diagram export.
- **Tidier screen:** view settings moved into a **View ▾** menu; side panel, patchlist settings, print options and the library editor use fold-open sections that remember whether they're open.
- More connector types: RCA, 3.5 mm, USB-C, Thunderbolt, DisplayPort, fiber LC, opticalCON, TOSLINK.
- The Avantis definition gains its control network jack; the GigaCore gets a single management IP instead of one per port.

## v0.0.5 (2026-11-09)
- **Front + Rear view:** the Front/Rear button now cycles Front → Rear → Front + Rear, showing both sides of a rack (or location) side by side so you can patch front to back directly.
- **Shift-click to connect:** select a jack, hold Shift and click another jack. The first jack stays selected. Works across a flip too.
- **Connect to list:** a selected jack's panel lists every jack it can connect to (right direction only), with search and notes for "in use" and "needs adapter". Double-click or press Connect.
- **Pick on the rack:** a button that waits for your next jack click instead of using Shift. Esc cancels.
- **Tie lines:** in rig mode, choose whether new connections are Cables or Tie lines; change an existing connection's type from its panel.

## v0.0.4 (2026-11-09)
- **Resize racks** in rig mode: drag the amber handle on a rack's bottom edge, or use the − 1U / + 1U buttons under it. A rack can't shrink past the lowest piece of gear.
- **Arrange gear inside locations** (floor pockets, FOH…): drag units anywhere on a 10px grid. Drop below the area to make it bigger. Overlapping spots are refused.
- **Panel layout editor** in the Library: drag blocks of ports (inputs, outputs, network…) around the front and rear panels on a 4px grid. "Reset to automatic" undoes it.
- **Per-unit cables:** each unit has a CABLES switch. The Cables menu chooses All units (switch units off), Only units I pick (switch units on), or Hidden.

## v0.0.3 (2026-11-09)
- **Editing mode switch:** "Editing: Patch" (gear locked, cables belong to this patch) or "Editing: The rig" (permanent setup; the workspace turns amber).
- **Drag gear** by its name strip to a new spot, another rack, or a location (rig mode).
- **Gear slides out of the way:** move a unit onto other gear and that gear slides into the space you left. Half-rack units trade places with a same-size half-rack unit.
- **Reorder racks** with the ◀ ▶ buttons by each rack name, and locations with ▲ ▼.
- Typing a new Top U in the gear panel uses the same slide-over behaviour.

## v0.0.2 (2026-11-09)
- Save projects to GitHub (top-bar button or Cmd+S) and open them from any computer (File → Open from GitHub).
- Warns before overwriting a project that was changed on GitHub from another computer.
- Sanctuary sample project added to `projects/`.
- Version number shown in the top bar; app file now named by version.

## v0.0.1 (2026-11-09)
- First version: rack view with drag-to-patch cables, front/rear flip and half-rack slots.
- Floor pockets and FOH as locations; signal tracing to console channels.
- Patchlist with groups, stereo pairs, custom columns, cable colours and outputs.
- Dante routing tab, print layouts (volunteer/technical), CSV export, gear library editor.
- Checks, undo/redo and change history. Sample built from the Sunday Nov 8 2026 patchlist.
