# Changelog

The app file in `dist/` is named for its version, e.g. `PatchRack-v0.0.2.html`.
The version also shows next to the PatchRack name in the app's top bar.

## v0.0.17 (2026-11-13)
- **Library: collapse categories.** Each group in the Library list folds open and shut by clicking its heading, with a count of what's inside. **Expand all / Collapse all** buttons sit above the list. The app remembers which groups you closed. While you search, every group with a match opens.
- **Library: group and sort.** *Group by* Category, Make, Height (U), Mounting (rack, shelf, desk, floor pocket), In use, or no groups. *Sort by* Make & model, Model, Height (U), Most used or Newest first. Your choice is remembered in this browser. Search also matches category names (e.g. "amplifiers").
- **Version numbers fixed.** The line drawing tool was built on a side branch that also used v0.0.9–v0.0.13, clashing with the main app's numbers. From v0.0.17 both live together: `dist/Line-Drawing-Tool.html` ships next to the app, and its own history is listed at the bottom of this file.
- Fold arrows are drawn with CSS so they point the right way in every font.

## v0.0.16 (2026-11-10)
- **Pick the console channel first:** a new source with no input yet now shows a Console Ch picker. Choose the channel and the input that feeds it is filled in from the routing (a floor pocket jack rather than the stage box input behind it). Works for stereo too (the next channel fills the right side). If nothing is routed to that channel yet, it says so.
- **Inputs don't have to be on stage:** "Stage input" is now just **Input**, and the picker also lists the mixer's own inputs (local XLR, USB…), Dante channels that start on a device (playback computer, processor) and wireless channels, after the usual stage jacks.
- **Stereo or mono outputs:** each output has an **ST** button. In stereo, pick the left output and the right fills in as the next one (Aux 1 → Aux 2). For Dante, setting the left “Dante to” also routes the right side to the next receive channel. Both sides show in Goes to, the trace and the printout (e.g. "Dante Tx 7/8").

## v0.0.15 (2026-11-10)
- **Dante gear missing from the matrix now explains itself.** The matrix lists any unit that can't appear and why, with a fix:
  - it has Dante network jacks but no Dante channels → **Add Dante channels…** (enter how many Tx and Rx);
  - its Dante channels are set to "Two-way" → link to fix it in the Library (they must be Output = Tx or Input = Rx);
  - gear you made in the Library hasn't been put in a rack or location yet.
- Library: a **+ Dante channels** button next to + Port group. Choosing the "Dante channel" connector now sets the group's side to Dante and a real direction automatically; "Console channel" sets Virtual / Input.
- **Move gear into another rack even where the space is taken:** drag it there (Editing: The rig) and the gear at that spot and below slides down to make room, if the rack has empty space further down. The drop preview says how many items will slide. If there isn't room, it says how many U are missing. Cables, tie lines, Dante routes, names and notes all stay with the unit; one Undo puts everything back.

## v0.0.14 (2026-11-10)
- **Print column in the patchlist:** untick a source (or output) to leave it off the printout and CSV. It stays in the patch, still traces to the console and still shows in Checks; it's just greyed in the list. The Inputs heading says how many are on the printout.
- **Import a Dante Controller preset** (Dante & IP → Import Dante Controller preset…). In Dante Controller choose File → Save Preset, then pick that file. Every device in it is matched to a unit in PatchRack (by name, then model; you can change any match, skip it, or add it as new Dante-only gear in a "Dante network" location). Brings in, as you choose:
  - every route (subscription), into the rig, optionally clearing the matched receivers' old rig routes first so they match the preset exactly;
  - transmit and receive channel names (plain numbers like "01" or "CH 5" are left out);
  - IP addresses, where the preset has them.
  A summary lists anything left out. One Undo takes the whole import back.

## v0.0.13 (2026-11-10)
- **Dante routing matrix** (Dante & IP → Matrix, now the first view): transmitters across the top, receivers down the left, like Dante Controller.
  - Click a unit's name to open or close its channels. Closed units take one row or column and show a count (or dot) wherever routes exist; click one to open both units. Expand all / Collapse all for each side. Open/closed is remembered.
  - Click a square to route that Tx to that Rx; click again to remove. Drag across squares to make or remove many at once. Shift-click a second square to fill the diagonal from the last one (e.g. Tx 1–16 → Rx 17–32 in two clicks).
  - The row and column under the pointer light up, and the headers stay put while you scroll.
  - Green dots are rig routes, pink are this patch only. In a patch, replacing a rig route switches it off for that patch only, as elsewhere. Every change is one Undo step.

## v0.0.12 (2026-11-10)
- **Fix: console channels greyed out in the patchlist.** If a mixer's Internal routing ran from its network jacks (e.g. "Dante card → Ch") instead of its Dante receive channels, no channel could be picked. Projects are repaired automatically when opened (it becomes "Dante Rx → Ch").
- Internal routing in the Library no longer offers network jacks or power as a From/To, since they don't carry audio. A Dante card's audio is its Dante Rx / Tx groups.
- If a mixer's channels still can't be reached from Dante, the patchlist shows a note with a one-click fix ("Set Dante Rx 1–64 → Ch 1–64").
- Greyed-out channels now say "no Dante Rx feeds it" instead of "local input".

## v0.0.11 (2026-11-10)
- **Fix: rack proportions.** 19″ is the panel's width across its ears, which is also the outside of the rails. Before, the rails were drawn outside the 19″ panel, as if 19″ were the space between them. Now the rails sit under the ears, the opening between them is 17¾″, and the mounting holes follow the real 3-per-U pattern on 18⅓″ centres. The screws on each unit's ears line up with the centre hole. Gear and photo sizes are unchanged (they were already 19″ ear to ear).

## v0.0.10 (2026-11-10)
- **Fix: the gear photo now shows behind the jacks in Library → Panel layout**, where you line them up. Before, it was shrunk to a tiny speck in the corner.
- In the panel layout editor the photo always shows (whatever View → Show gear photos is set to), with a **Photo** tickbox to hide it. Jacks are drawn as hollow rings over it so you can see the real connectors through them, and the name strip is hidden so it doesn't cover the top row.
- **Zoom 1× / 2× / 3×** in the panel layout editor for fine alignment. Dragging and arrow-key nudges still move in real panel pixels.
- **Add / Adjust photo** buttons right beside each panel in the editor.

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

## Line drawing tool history
These updates were made on a side branch, where they were numbered v0.0.9–v0.0.13 (the same numbers the main app used). They're renumbered here; from v0.0.17 the tool ships with the app.

### Update 5 (2026-11-13)
- **Line drawing tool: Clean shapes (CAD style)**, now the default drawing style. Instead of tracing every wobble in the photo, the tool recognises jacks, knobs, LEDs, screw holes, buttons, screens, switches, slots and dividers and redraws them as perfect circles, rounded rectangles and straight lines. Near-identical parts get identical sizes, and rows and columns line up exactly. Lettering stays solid.
- **Edit the drawing:**
  - Click to select (Shift-click or drag a box for several). Drag to move; shapes snap into line with each other. Drag the handles to resize. Arrow keys nudge.
  - Draw rectangles, circles, lines and text labels.
  - Delete, Duplicate, Align tops/middles/centres, Space across/down, Same size, Repeat (copies every N mm), Undo/Redo.
  - **Find more like this:** select one part (say a channel's SEL button) and the tool finds every other place the photo has the same part and adds it there.
  - The selected shape's position and size are shown and edited in **mm on the real faceplate**.
  - Shapes follow the photo until you start editing; *Detect shapes again* starts over (undoable). A faint copy of the photo shows behind while editing (screen only).
- **Download SVG**, so the shapes stay sharp at any size. PNG works as before.
- **Zoom** (2×–4×) for working on thin 1U strips.
- **Sizes up to 16U** (plus half width and custom sizes in mm). Tall gear is processed at 1× to stay quick.
- *Traced* is still there for the old look.

### Update 4 (2026-11-12)
- **Line drawing tool looks more like a manufacturer's drawing:**
  - **Text & markings:** printed labels, logos, LEDs and arrows are drawn solid instead of as fuzzy outlines. Works on dark panels (light lettering) and light ones (dark lettering), worked out automatically or chosen.
  - Outlines are found from colour as well as brightness, so dark-grey buttons on a black panel and coloured LEDs get their edges.
  - Outlines hugging the lettering are dropped, so text stays crisp.
  - New defaults: more outline detail, faceplate outline on.
- **"The picture is: Already a drawing":** for front-panel diagrams from user guides, spec sheets and websites. It squares the drawing up and keeps its own lines (cleaned, thickened if you like) instead of tracing around them.

### Update 3 (2026-11-12)
- **Line drawing tool: paint out areas.** In step 3, choose *Paint out* and brush over handles, knobs, cables, reflections or anything else you don't want drawn, on either the squared-up photo or the drawing. Painted areas come out empty, and they're ignored when the tool works out what a strong line is, so the rest of the panel can keep more detail.
  - *Erase* wipes painting away; *Undo stroke* (Ctrl/Cmd+Z) and *Clear all painting* are there too. Brush size slider, or `[` and `]`.
  - Shortcuts: P paint, E erase, Esc stop painting.
  - Painting stays in place if you move the corners or change the faceplate size. Choosing a new photo starts fresh.

### Update 2 (2026-11-12)
- **Line drawing tool opens far more photos:** iPhone HEIC/HEIF (even when named .jpg), TIFF, WebP, AVIF, GIF, BMP and SVG, as well as JPG and PNG. The tool now works out a file's real format from its contents instead of trusting its name or the type the computer reports, which fixes photos being refused when dragged in or downloaded. Phone photos that were taken sideways come in the right way up.
- HEIC and TIFF are converted inside the tool, with no internet needed.
- Dragging an image straight from a web page works when the site allows it; otherwise the tool says to save it first.
- When a file still won't open, a message stays on screen with what the file looks like and what to try, instead of a quick pop-up.

### Update 1 (2026-11-12)
- **Line drawing tool** (`dist/Line-Drawing-Tool.html`, a separate page): turns a gear photo into a clean line drawing for a gear definition's front or rear photo.
  - **Square it up:** drag four corners onto the faceplate's corners and the photo is straightened out, so a picture taken at an angle comes out flat and square. A magnifier shows the corner while dragging; arrow keys nudge; guides follow the perspective so you can check rows of jacks are straight.
  - **Exact size:** choose 1U–8U, full or half width (or a custom size in mm). The drawing comes out exactly the faceplate's shape at the same resolution the app stores, so Add photo → Fill lines up with nothing stretched.
  - **Line drawing controls:** detail, smoothing, line weight, speck removal, a faint copy of the photo underneath if you want more to recognise it by, and three styles (light on dark like the rack, dark on white, see-through).
  - Download as PNG (named from make/model) or copy it. Open a photo by choosing, dropping or pasting it. Nothing leaves your computer.
- The Photos section of each gear definition links to the tool.

