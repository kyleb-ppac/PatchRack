# Changelog

The app file in `dist/` is named for its version, e.g. `PatchRack-v0.0.2.html`.
The version also shows next to the PatchRack name in the app's top bar.

## v0.0.9 (2026-11-10)
- **Line jacks up with photos (Library → Panel layout):** switch Drag to **Single jacks** to move any one jack, or keep **Port groups** to move whole blocks. Click a jack or block and nudge it with the arrow keys (1px, Shift for 10px). Hold Alt while dragging a block to place it off the grid. Each group now has **Space across** and **Space down** settings, and "Put back" returns moved jacks to their rows.
- **Custom-size gear:** for gear that isn't rack-mounted, choose Size → **Custom size** and enter width and height in inches. It's drawn at real scale (1U = 1.75″). New mounting **Sits on a rack shelf**: the gear goes in a rack on a shelf of however many U you set, drawn at its real size.
- **Mixer flag:** tick **Mixer / console** on a gear definition (the Avantis is ticked already). Mixers drive the two patchlist changes below.
- **Patchlist, Console Ch:** for sources that reach the network over Dante, Console Ch is now a picker of the mixer's channels (showing what's already on each). Picking one makes the Dante route for you. Channels fed by local inputs can't be picked; they're still worked out from the cables.
- **Patchlist, stereo:** pick the first input and the second fills in with the next one (In 7 → In 8). You can still change it.
- **Patchlist, outputs:** choose a **Type** first (Analog, Dante, AES…), then "Leaves on" lists only the mixer's outputs of that type. Only gear marked as a mixer appears.
- **Print:** choose which columns the output list shows (Type, Mix, Leaves on, Goes to, Person, Notes). "Leaves on" and "Goes to" are off by default; the Technical preset turns them on.
- **Dante & IP tab reorganised:** a short "How Dante works here" explainer, a clear **New routes go in: The rig / this patch** switch, and four sections: **Routes** (make a whole block at once, e.g. Rio A Tx 1–32 → Avantis Rx 17–48, and see every route grouped into blocks with what it lands on), **Receivers**, **Transmitters** and **IP addresses**.
- **Patches no longer change the rig's Dante routes:** replacing a permanent route while editing a patch now switches it off for that patch only. Turn it back on from Dante & IP → Routes.

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
