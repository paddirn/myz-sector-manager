# MYZ Sector Manager v0.1.4

Foundry VTT v14 GM-only Journal-backed sector editor.

## Forge installation

1. In The Forge / Foundry Setup, install the module using this manifest URL:
   `https://github.com/paddirn/myz-sector-manager/releases/latest/download/module.json`
2. Enable the module in a Foundry v14 test world.
3. Create a Script Macro: `await game.myzSectorManager.open();`

Published versions are available through GitHub Releases; a new version becomes available only after its matching tag workflow succeeds. For later releases, use Foundry's module Update control; no manual ZIP upload is needed. If an older installation uses a raw GitHub manifest URL, reinstall it using the stable URL above. Back up the world first.

## Features
- GM-only Journal Entry sector records, searchable selector, tabbed editor.
- Overview, Locations, Encounters, Loot, Effects (weather/phenomena/special effects), Secrets, History.
- Data stored in `flags.myz-sector-manager.sector`.
- API: `game.myzSectorManager.open(journalId)` and `game.myzSectorManager.getSector(journalId)`.

## Caveats
Prototype not yet tested in a live Foundry v14 world. Back up your world first.
Native Journal windows do not automatically use the Sector Sheet. Zone integration is optional and GM-only. No import or player view is provided.

## Version 0.1.4 (prepared)

- The Ark is now a fixed coordinate, selected from existing sectors or entered manually. No token, Actor, or sector record is required. A passive gold whole-cell highlight and **⌂ Ark** label distinguish its sector on the GM overlay.
- Expedition rows include a 36px token portrait, coordinates, and estimated diagonal grid-travel distance from the Ark. The distance scale is configurable (default 1.6 km per sector).
- **Calibrate Grid** provides three clicks, an alignment preview, Confirm/Retry/Cancel, and cleanup. Manual numeric settings and the one-point origin picker remain available.
- The overlay has an editable, GM-only native keybinding with conflict-checked defaults. Portrait buttons view the Zone Scene on the GM's client and pan to the token center without selecting/moving it.
- The generic heading is now **Zone Sectors**. Existing record names, flags, Scene association, grid settings, group assignments, and legacy Ark token reference are preserved.

## Version 0.1.3

- Consumable quantity fields are 38px wide with centered decimal values. Native collected checkboxes use explicit theme-aware contrast and lighter alternate-row shading; saved quantities and states are unchanged.
- Effects now supports native Actor references (for Zone Phenomena), with drop, replace, open, and clear behavior alongside category/duration and collapse controls.
- **+ New Sector** sits immediately after **Delete Sector** in the main toolbar, including when no sector is selected. The sidebar contains search and naturally sorted sector records, restores the full list when search is cleared, and shows a no-matches message.
- Optional single-Scene Zone grid, interactive GM overlay, map-cell selection, and Ark/expedition tracking are implemented in separate helpers. Configuration and last-known positions live in a separate GM-owned Journal, not in existing sector flags.

## Zone Scene setup (optional)

You can keep using Sector Manager without configuring a map. No extra Actors, tokens, or sectors are created automatically.

1. Open Sector Manager as a GM. Expand **Zone Map / Tracking** beneath the main toolbar, then click **Configure / Tracking**.
2. Choose the one **designated Zone Scene**. Click **View selected Scene** to display it on your GM canvas; this does not activate it for players.
3. In **Reconfigure Grid**, enter a reference coordinate, for example **A1** or **B3**. Origin X/Y is that sector's **top-left corner in Scene canvas pixels**, using the same coordinate system as token documents, including the Scene's padding. For easier calibration, use **Calibrate Grid** as described below. The one-point **Pick reference corner on canvas** remains available for origin-only adjustment. Escape cancels either tool. Pan/zoom are converted back to Scene coordinates.
4. Set independent **sector width/height** in pixels or Foundry grid cells. For example, with 100px tactical cells, a 5 × 4 cell Zone sector is 500 × 400 pixels. Cell units use the selected Scene's grid pixel width/height; the saved configuration always uses fixed pixels. One Zone sector need not equal one tactical cell.
5. Set the total **Columns** and **Rows** of your Zone map (each 1–1,000). Coordinates range from A1 through those counts: A=1, Z=26, AA=27. The reference cell must be inside that range. Default orientation increases letters to the right and numbers downward. Reversing either direction or swapping lettered columns to the vertical axis is supported.
6. Optionally enable the overlay, boundaries, coordinate labels, and exploration-status icons. Visible labels are capped at 2,000 to keep very large maps responsive. The rectangular Zone grid is clipped to the Scene area; it never changes fog or exploration.
7. Set the **Fixed Ark location** by selecting an existing sector or entering a coordinate such as A1 or AA12. **Clear Ark location** removes the designation. No Ark token/Actor or sector record is needed. Set **Kilometers per sector** if your map differs from the default 1.6 km. Add expedition groups with names and existing Scene tokens (one assignment per token), plus optional dropped world/compendium Actor references. No Actor or token is created.
8. Click **Save Zone configuration**. Closing or Cancel discards unsaved configuration. The module creates a separate **MYZ Zone Map Configuration** Journal with default ownership None; do not share or delete it if you want to retain configuration/tracking. Only its ID is stored in a hidden world setting. Back up this Journal along with your world.

The compact Zone header shows the fixed Ark coordinate and expedition coordinates/distances. Group positions are **live** when the Zone Scene is displayed, or **last known** otherwise. An unassigned Ark is optional. Missing tokens/Scenes and off-map positions show a clear state while retaining the last valid coordinates. A deleted/unavailable configuration Journal is reported; existing sector records are unaffected.

### Select sectors on the map

1. View the designated Zone Scene and expand the Zone header.
2. Click **Select on map**, then click one cell. It is a one-shot tool; Escape cancels. With the overlay enabled, background squares also highlight on hover and open on left-click. Right-click, drag, modified-click and token gestures remain with Foundry; disabling removes all navigation listeners. Empty squares open +New Sector with prefilled coordinates and require confirmation.
3. If a record has the matching **Sector ID / Coordinates**, it opens in Sector Manager. Matching is case-insensitive and treats labels such as `A-07`, `a7`, and `A007` as the same cell; stored labels remain unchanged. Multi-letter coordinates work.
4. If the cell is empty, you are asked whether to create one GM-only sector record. Cancelling creates nothing; no map cells are automatically populated. If multiple existing records share a coordinate, the module warns and opens the first; the sidebar remains available to choose another.

The sidebar and all tabs work normally while viewing combat or other Scenes. Only the designated Zone Scene can show the overlay or respond to map selection. Use **Show/Hide overlay** at any time. To intentionally recalibrate, reopen **Configure / Tracking → Reconfigure Grid**; viewing another Scene never changes saved origin/dimensions. Changed Scene dimensions or tactical grid size produce a warning rather than silently rescaling. Changing the designated Scene requires confirmation and replaces the expedition token assignments while retaining the fixed Ark coordinate for review; it does not delete sector records. **Disconnect Zone map** removes integration assignments only.

### Three-click grid calibration

1. Open **Configure / Tracking** and select the designated Scene. Keep the reference coordinate (default A1), map bounds, and orientation settings you want.
2. Click **Calibrate Grid**. The GM client views the selected Scene if needed. The settings dialog temporarily hides and a small instruction panel appears. The normal overlay is hidden temporarily; its saved visibility flag does not change.
3. Click the **top-left**, **top-right**, and **bottom-left** corners of the **same reference sector**, in that order. Camera pan/zoom are accounted for. Left clicks collect points; normal wheel zoom and non-left-click canvas panning remain available between points.
4. Inspect the temporary grid preview. Use **Retry** to collect three new points, **Cancel** or Escape to discard, or **Confirm calibration** to copy the dimensions into the unsaved settings form.
5. Review the numeric origin/width/height, adjust if needed, then **Save Zone configuration** to persist. Confirm alone does not save; Cancel/closing the settings dialog discards the unsaved calibration.

The tool supports axis-aligned rectangular sectors only. Positive width/height are required. Small click imprecision (up to 1 pixel or 0.5% per axis) is tolerated; visibly rotated/skewed selections are rejected with an explanation instead of silently fitting an incorrect grid. Use an aligned map for rotated/skewed artwork. Cancel, Escape, Scene teardown, closing settings, or completing calibration removes temporary listeners/markers and restores the saved overlay visibility. Preview can temporarily show a grid even if the normal overlay is disabled.

### Fixed Ark, estimated distances, and portraits

The Ark coordinate persists in the same GM-owned Zone configuration Journal, separately from sector records. Any previous `ark` token reference remains intact for compatibility. On upgrade, its last-known coordinate (or current token center if no valid coordinate was saved) seeds a new fixed `arkCoordinate` once. That token is no longer followed. An explicitly cleared coordinate stays cleared and never falls back to the old token. If no legacy position is available, designate the Ark manually. A valid coordinate can be stored without a sector record; if it is outside the configured map bounds, the header warns and the overlay cannot highlight it until bounds are adjusted.

For each group, estimated travel distance is `max(abs(column difference), abs(row difference))`: any of the eight adjacent sectors is one step. Kilometers are that count multiplied by the configured **Kilometers per sector** (default 1.6). A1 → D4 is `3 sectors (4.8 km)`; A1 → D8 is `7 sectors (11.2 km)`; the same sector is `0 sectors (0 km)`. Distances refresh when a group crosses sectors, the Ark changes, or the scale is saved. This is not pathfinding: terrain, roads, obstacles, and inaccessible cells are ignored. Off-Scene estimates are labeled last known. Missing/off-map/unavailable positions or an undesignated Ark show **Distance unavailable** rather than an invented current distance.

Portraits use token texture images first, then the optional associated Actor portrait, then the token Actor portrait, and finally a generic icon. Videos or failed image loads fall back to static portraits/icons. Images preserve their aspect ratio. Click a portrait or focus its button and press Enter/Space to view the Zone Scene **on your GM client only** and center on the token midpoint. This does not activate the Scene for players, select/control the token, move it, or change permissions. Missing tokens/Scenes produce a notification.

### Overlay shortcut

The native **Toggle Zone sector overlay** action appears under **Configure Controls → MYZ Sector Manager** and is editable per Foundry's keybinding settings. After init registrations and before bindings initialize, the module checks existing default/immutable bindings, reserved modifiers, and saved overrides. It chooses:

1. **Ctrl + Shift + Z**, if available.
2. Otherwise **Ctrl + Alt + Shift + Z**.
3. Otherwise **Ctrl + Alt + Shift + M**.
4. If all are occupied, the action is unbound until you choose a key.

Late registrations/custom conflicts are warned about at ready; existing user choices are never silently overwritten. OS/browser shortcuts and all keyboard layouts cannot be exhaustively checked here, so use Foundry's Configure Controls conflict UI if needed. The action is GM-only, ignores key-repeat, persists the same overlay flag as the header button, and never renders on another Scene. Toggling while viewing another Scene changes the visibility used when you return to the Zone Scene. It is inactive during calibration so the previous visibility can be restored cleanly.

### Tracking rules and persistence

- Scene-specific token IDs and the designated Scene ID are stored for expedition groups. The Ark uses a fixed coordinate. Token **centers**, calculated from source token documents and that Scene's grid metrics, determine coordinates; screen zoom and token render animations do not.
- The active GM client listens to token updates and v14 movement completion/pause hooks even with Sector Manager closed. Crossings/missing/outside status changes persist; movement within the same cell does not repeatedly write configuration. Multiple GM clients do not each write the same movement update.
- Keep at least one GM online for movement persistence. When a GM reconnects/reloads, current token documents are reconciled with the saved last-known values. No tracking is written by player clients.
- Switching to another Scene shows last-known Zone coordinates. Tokens on other Scenes (even with the same token IDs) are ignored. Returning to the Zone Scene refreshes live positions and restores the overlay if enabled. Deleted tokens keep their last-known coordinates until reassigned or cleared in configuration.
- Tracking does **not** mark sectors explored, roll encounters, trigger events, consume resources, or advance travel time. It never creates automatic travel consequences.
- Exactly one Zone Scene is designated at a time. Grid math, persistence, overlay, configuration UI, and lifecycle hooks are separate modules for future development; multiple simultaneous Zone maps are not implemented.

GM-only helper APIs are available at `game.myzSectorManager.zone`: `configure()`, `positionToSector({x,y})`, `sectorBounds("AA1")`, and `tracking()`. Position/bounds helpers use only the designated Scene's saved grid and return null when unavailable/outside; tracking returns copied rows. They do not mutate sectors.

## Version 0.1.2

- Two-line sidebar entries show bold coordinates and exploration status together, then the wrapping sector name. Natural coordinate sorting (A2 before A10) is unchanged.
- Tab contents and the sector list scroll independently. Tab navigation and Save remain visible when the window is resized.
- **Consumables** is a compact panel, half-width when the content area is wide and full-width in narrow windows. Decimal quantities and collected checkboxes still use the original `supplies` fields; no data migration is needed.
- Drop a Scene into Locations, an Actor into Encounters, or an Item into Loot. Secrets and History accept other document types. References display enriched Foundry links with the resolved document name and native icon; click or press Enter to open them through Foundry's document-link handler. Use the × button to remove a reference or drop another document to replace it. Missing documents are indicated without clearing their saved UUID. Existing UUID references display automatically; there is no separate UUID text field or Open button.
- Each repeatable entry has a keyboard-accessible chevron/title button. **Expand All** and **Collapse All** affect the current tab only. Delete never toggles the entry. New entries start expanded.
- Collapse state stays in local memory for this Foundry session, including tab switches and reopening the manager. It is not written into Journal flags and resets on a page reload. Session-generated identities survive current-draft edits, deletions, and reordering; saved records reconnect by their content on reopen. Externally edited or completely identical records may not retain distinct collapse preferences across a reload of their data because legacy records have no persistent entry IDs. No entry IDs are added to saved records for this UI feature.
- Existing sector records, custom entry fields, old loot, quantities, and collected states are preserved. Click **Save Sector** to persist edits and reference changes. Checkboxes only track collection and do not transfer resources to actors.

## Development checks

Requires Node.js; no package installation is needed:

```sh
node --check scripts/sector-manager.mjs
node --test tests/*.test.mjs
```

The Node tests also cover fixed-Ark compatibility/clear behavior, multi-group Chebyshev distances, calibration math and lifecycle cleanup, shortcut conflicts, portrait fallbacks, and GM-local centering. They cover coordinate normalization and grid boundaries, reversed/swapped axes, multi-letter coordinates, token centers/crossings, last-known persistence, Scene isolation, missing references, GM authority, overlay/picker cleanup, and the earlier sorting, reference, consumable, and collapse regressions. Foundry APIs are simulated.

An optional Chromium layout/interaction test is available with a separately installed Playwright package and Chromium (no application dependency):

```sh
node tests/interface-browser.cjs
```

It uses the system `/usr/bin/chromium` when available; otherwise Playwright's installed Chromium, or an executable specified by `MYZ_CHROMIUM_PATH`. It models ApplicationV2's frame and content slot and mocks Foundry's document APIs. It checks mouse-wheel scrolling, independent sidebar search/restoration, resizing, 38px Consumables, Effects references, collapse interactions, Zone configuration/unit conversion, token assignments, origin picking under zoom, map creation confirmation, overlay isolation, tracking with the window closed, and missing Scenes/tokens. The usability checks include fixed Ark designation, distance rows, portrait mouse/keyboard centering, shortcut synchronization, and calibration preview/retry/confirm/Escape. PIXI rendering and Foundry APIs are mocked. It does not establish live Foundry v14 behavior and is not included in the dependency-free release job.

Live Foundry v14 validation is performed by the user in a backup world. Verify:

1. Resize the manager wide and narrow; use the mouse wheel through every tab and a long sector list. Confirm tabs and Save remain visible and long names wrap.
2. Check old decimal quantities and collected states in Consumables, change values, save, and reopen.
3. Drop world and compendium documents into the appropriate reference areas; use mouse and Enter to open native links. Replace/remove references and verify missing documents are indicated without losing their UUIDs.
4. Edit a card, collapse/reopen it, switch tabs, save, close/reopen the manager, and confirm data is retained. Check independent/bulk collapse and deletion without accidental toggling. New entries must start expanded.
5. Confirm pre-update sectors, loot, references, and unknown/custom fields remain intact, and player access remains restricted.

### Zone integration test checklist in a backup Foundry v14 world

1. Calibrate the Zone grid with a known reference, multi-cell dimensions, nonzero origin, and A2/A10/AA1 labels. Pan/zoom and verify boundaries, token-center coordinates, and map selection remain aligned. Confirm only the armed one-shot tool handles a map click.
2. Designate a fixed Ark coordinate and assign two expedition tokens. Verify same-sector zero distance, diagonal travel distance, independent group estimates, and a changed km scale. Cross one boundary, move within a cell, and move outside the configured range. Close Sector Manager, move again, reopen, then reload Foundry; verify live/last-known values and that no travel consequences or sector flags changed.
3. View a combat Scene and move similarly named tokens. Confirm Zone coordinates and saved grid do not change; return to the Zone Scene and verify overlay restoration. Test deletion/replacement/clearing of a tracked token and missing/unavailable Scenes.
4. Open existing sectors by map click, decline then accept creating one empty cell, and verify no duplicate/bulk sector creation. Confirm legacy coordinate labels and custom sector fields remain intact.
5. Verify players cannot see the overlay, configuration controls, or GM information. Test with two GM clients to verify active-GM persistence and native canvas compatibility. Check light/dark checkbox contrast, Effects Actor/compendium links, and all prior UI checks above.

Also test the three-click wizard under pan/zoom (including retry, cancellation and overlay restoration), the real native keybinding/conflict UI, and portrait navigation while another Scene is viewed. Live Foundry canvas/PIXI behavior, actual v14 movement hooks (including your token shapes/grid type), native permissions, theme rendering, keyboard layouts, and multi-client synchronization cannot be proven by local mocks and need this check before publishing.

## Publish a release (no manual ZIPs)

### One-time setup

1. Open the release-automation pull request on GitHub, review it, then click **Merge pull request** and confirm. This adds automation; merging alone does not publish anything.
2. Open **Settings → Actions → General**. Ensure GitHub Actions is enabled and GitHub-authored actions are allowed. This workflow uses `actions/checkout` and `actions/setup-node`.
3. The release job explicitly requests only `contents: write`. You normally do not need to change the repository-wide default workflow permission from read-only. If an organization policy blocks write permissions, an administrator must permit this workflow to write repository contents. No personal access token or paid service is needed: GitHub supplies the workflow token automatically.

### Publish this update: v0.1.4

1. Merge the Zone usability pull request into **main**. The current `module.json` already declares `0.1.4`, its stable manifest URL, and the matching ZIP download URL.
2. Test in your backup Foundry v14 world before publishing. Local tests cannot verify the live Foundry interface.
3. Ask Codex: **“Verify main contains the release automation and module version 0.1.4, run the checks, then create and push tag v0.1.4 at that main commit. Do not manually create a release; let GitHub Actions do it.”** This is a separate publishing authorization. Do not draft or publish a release through GitHub's Releases form first.
4. Open the repository's **Actions** tab and select **Release Module**. Wait for a green checkmark.
5. Open **Releases**. The `v0.1.4` release should contain **module.json** and **myz-sector-manager-v0.1.4.zip**. GitHub's additional source-code archives are not the installable module ZIP.
6. In The Forge / Foundry Setup, install or update through the stable manifest URL above. Test in your backup world and check that old sectors and loot remain intact.

If you prefer to push the tag yourself from a local clone with the merged main checked out:

```sh
git switch main
git pull --ff-only origin main
# Verify module.json says 0.1.4 and the automation is present first.
git tag v0.1.4
git push origin v0.1.4
```

### Every later release

1. Ask Codex to implement the changes on a feature branch, update `module.json` to the next version (for example `0.1.5`), set its `download` URL to `https://github.com/paddirn/myz-sector-manager/releases/download/v0.1.5/myz-sector-manager-v0.1.5.zip`, update version-specific documentation, run checks, and create a pull request. Keep `id` and the stable `manifest` URL unchanged.
2. Review and merge the pull request. Test the changes in your backup world.
3. Authorize Codex to push the matching version tag at the tested main commit, as above. Publish versions in increasing order: the workflow marks the new release as latest.
4. Watch Actions, check both release assets, then use Foundry's Update control.

### What the workflow checks

Only pushed tags matching `v*.*.*` trigger publication. The validator further requires an exact numeric `vX.Y.Z` tag matching `module.json`, the unchanged module ID and v14 compatibility, correct manifest/download URLs, present declared files, and valid JavaScript. All Node tests must pass. The ZIP contains `module.json` at its root, README.md, and the runtime files declared by the manifest. Development tests and release tooling are excluded. There is no build or dependency installation step.

For a local package check, run from the repository root (replace the tag with the actual manifest version):

```sh
node scripts/prepare-release.mjs v0.1.4
unzip -t dist/myz-sector-manager-v0.1.4.zip
unzip -p dist/myz-sector-manager-v0.1.4.zip module.json | cmp - module.json
```

`dist/` is ignored by Git. Packaging refuses to overwrite an existing ZIP: inspect and remove only the generated output before rebuilding.

### If something fails

Open the failed Actions run and read the first failing step, or send its log to Codex. A tag/version mismatch or missing file must be fixed in a new reviewed commit before publishing a new version. Do not move an existing release tag.

A repeated run for an existing release stops without changing that release or its assets. Concurrent runs for the same tag are serialized. If publishing creates a release but an upload fails, it may leave a partial release: inspect it before taking any action. The workflow never deletes releases or overwrites assets automatically. Ask for help recovering it, or publish a corrected new version. No release has been published by merely adding this workflow.

### Sector navigation and exploration tracking (0.1.5)

- Click the **house button beside the Ark coordinate** to view the Zone Scene and center on the Ark sector. No Ark token or sector record is needed. The button appears only for a coordinate within the configured grid.
- **Double-click a sector card in the left sidebar** to select it and center the Zone Scene on its cell midpoint. Single-click still selects the record; pointer selection waits briefly to distinguish double-clicks. Keyboard selection remains immediate. Set up the Zone Scene/grid first; records with missing or out-of-bounds coordinates show a notification. These actions view the Scene only on your GM client.
- **Find the Path** contains the main success benefit, seven standard stunts (Core Rulebook p. 56), and Rot Finder (p. 64) in a shared **Find the Path Stunts** section. Checkboxes save automatically per sector, including when switching records or closing the application. **Reset Stunts** asks for confirmation and clears this sector's defined checkboxes. Other unsaved edits still use **Save Sector**. These are records for the current visit/exploration: p. 56 limits each stunt to once per roll; p. 160 also limits repeat-search stunts to once per sector. The GM controls resets; checkboxes do not enforce these rules. Leaving a sector never resets them. Checking them awards no resources or Rot changes; the Half-Time and Rush Through stunts update the reference calculator without advancing world time.
- **Terrain** offers the 61 verified names supplied from Core Rulebook pp. 156–158 in one alphabetically sorted suggestion list. Type to search suggestions, or enter any custom text. Existing values remain editable, including entries outside the list. Use the browser's native keyboard suggestion controls (typically Down/Up and Enter); presentation varies by browser.
- **Rot Level** offers levels 0–3 with their exposure descriptions (Core Rulebook p. 158). The numeric level remains in the existing `rot` field. Unrecognized legacy values appear as a selected **Existing value** option and remain unchanged until you select a standard level. Level 3 denotes a localized hotspot; no exposure damage or time tracking is automated.

Existing sector records keep schema version 1. The additive `pathStunts` map uses stable IDs; unknown/future keys and other sector fields are retained. Definitions include source, description, and visibility metadata for future extensions; the manager remains GM-only.

Before releasing 0.1.5, test in a backed-up Foundry v14 world using the official MYZ system:

1. From another Scene, use the Ark house and double-click a sector; verify the correct cell center and that another connected client stays on its current Scene. Also check an undesignated Ark, missing Scene, and blank/out-of-grid coordinates.
2. Single-click and keyboard-select sectors; check sidebar search/scroll and unsaved-change confirmation. Double-click another sector and verify its normal selection behavior.
3. On an older sector, check several standard and talent stunts, switch records, close/reopen, and restart Foundry. Confirm independent state, no automatic resource changes, cancellation of Reset Stunts, and a confirmed reset that persists.
4. Choose suggested terrain (including **Glasified Field**), save custom terrain, and reopen a record with an older custom value. Test keyboard suggestions and checkboxes in light and dark themes.
5. Select each Rot level; confirm its exposure text and saved numeric value. Reopen older records with nonstandard Rot values and confirm they are retained until explicitly changed.
6. Confirm Scene configuration, fixed Ark position, expedition distances, overlays/shortcut, calibration, loot, references, and GM-only access still work.

After testing, merge the feature PR into `main`. Then ask Codex to verify `main` and push `v0.1.5`, or follow the existing tag instructions above. GitHub Actions will publish the assets; this change does not create a tag or release itself.

### Selected-sector distances and generation (0.1.6)

The tracking summary adds a selected-sector coordinate button and distance beside the Ark and each expedition. Distances use the existing eight-direction sector count and configured kilometers per sector. The original Ark-to-expedition distance appears only on the Ark row (named per expedition when multiple groups are configured). Expedition navigation/portraits are unchanged. Selected-sector buttons center the GM's Zone Scene; unavailable coordinates show an empty/unavailable state. Off-Scene expedition estimates use the labeled last-known coordinate; deleted/out-of-grid tokens do not produce a current-distance estimate. The columns stack on narrow windows.

Empty content tabs are slightly muted but remain usable; the active tab retains its outline. Coordinates, default zero Rot, Unexplored status, blank entries, and zero supplies do not count as content. Indicators refresh while typing, checking stunts, adding/removing entries, and generating information. Randomize is an action, so it is never muted as an empty tab.

**Randomize** opens a method selector and replacement warning, then a generated-content preview. Canceling either dialog makes no sector changes. The Core method resolves all thirteen supplied world RollTables by UUID before rolling, and builds the entire result in memory. It does not mark results drawn or send rolls to chat. Missing/inaccessible tables, unusable results, invalid dice/options, or unmapped categories abort without writing a partial sector. A final confirmation saves all generated fields in one Journal update. Changes to the selected sector or edits made while generating invalidate the preview; other GMs' intervening changes are checked before saving.

Generation replaces terrain, Rot, mood, and entries previously marked as generated by this method. Manually created locations, encounters, effects, loot, notes, description, coordinates, exploration status, collected checkboxes, stunts, and custom fields remain. Consumable quantities are replaced by the new roll. Generated rows remain editable and show their quantities. Grub, water, bullets, booze, and components populate the existing Consumables quantity fields; only artifacts and scrap create new separate loot entries. Historical resource entries are retained. Generated table provenance is retained with entries and the sector. A new editable Mood field appears in Overview.

#### Core Rulebook generation (4th printing, pp. 156–160)

The generator now follows one shared Threat Roll. It reads Ruin, Threat, and Artifact as separate environment eligibility values, using the rulebook metadata when the Environment table returns only a recognized name. Wilderness environments (including Thick Woods) permit threats but not ruins or artifacts. Overgrown, Crumbling, Decayed, and Unscathed Ruins permit all three and use the **normal ruins** table (`RollTable.QxY3EmhqXMdKa3sC`). Derelict Industries uses the **industrial ruins** table (`RollTable.n1CEYKphbiBZLDUb`). Settlement is a special case requiring GM-authored details, so normal random generation aborts clearly without saving it. Explicit result flags are authoritative, including deliberate departures from the name-only rulebook defaults.

The rulebook instructs the GM to choose a numeric Threat Level. An explicit numeric table result (including zero) takes precedence. When the configured table returns only a category/range, this module selects **Fringe uniformly from 1–4** and **Central uniformly from 5–8** using 1d4 (plus 4 for Central). These category-to-number rolls are a documented module selection policy, not a rulebook dice table. The open-ended **Unusually Dangerous (9+)** category uses the GM setting **Sector generation: Unusually Dangerous level**, default **9**; there is no invented upper-bound random range. Numeric values must be whole numbers 0–1000 (a technical input limit). The rulebook's optional nighttime +3 is not applied automatically: generation is not a timed entry into the sector, and the GM can supply an adjusted numeric result when appropriate.

Exactly one `Nd6` Base Dice pool is evaluated per generation, where N is the numeric Threat Level. The complete faces are stored with the sector. If Threat is allowed, one or more 1s generate a threat; the number of 1s is recorded as its severity. If Artifact is allowed, **each 6 generates one artifact**, with a separate Artifact RollTable call for each. The same pool determines both outcomes, with no separate chance roll or reroll for artifacts. No relevant symbols means no corresponding generated threats/artifacts.

The default **Sector generation: threat identities** setting uses **Core Rulebook: one threat with severity**. Its identity comes from the existing Threat Type and matching Humanoid/D66 Encounters/Monster/Phenomena tables; severity is visible in the entry's editable details and metadata. The optional **House rule: 1d3 individual threats** preserves the earlier request for separate independently generated threat identities; the sector's original severity remains the number of 1s and is not replaced by that count. Threat type routing remains Encounters for Humanoids, Monsters, and D66 Encounters, and Effects for phenomena. The preview displays the numeric level and its selection policy, all eligibility flags, the Base Dice faces, severity, artifact count, and core/house-rule mode before saving.

There are **no fallback threat or artifact percentages** and no artifact-configuration prerequisite. The draft probability setting has been removed; any stored value from the draft is left untouched and ignored. Existing generated records and all unrelated world settings remain intact.

Resource probabilities are the user's explicit house-rule additions, separate from the official Threat Roll: grub, water, bullets, and ordinary scrap each independently have a 50% presence chance, with 1d6 quantity when present. Grub and water each use one presence roll, followed by 25% clean versus 75% Rot classification. Booze and Components each independently have a 25% chance and 1d3 quantity. All seven Consumables fields are reset to the newly generated quantities (zero when absent); opposite Clean/Rot quantities stay zero. Scrap remains an individual Loot entry from its configured table; there is no scrap-to-Components substitution. No resources are automatically awarded to Actors.

#### RollTable formats and live verification

The actual world-local RollTables cannot be read from this cloud checkout. Rolls use the supplied UUIDs, not bundled result tables; only the environment eligibility metadata comes from the reference book. The adapter supports v14-style `description`/`documentUuid`, legacy `text`/collection-ID references, inline `@UUID` references, rich HTML converted to inert plain text with table-cell boundaries, and nested tables (with cycle/depth protection). Displayed text is escaped; original table names, UUIDs, and references are retained as provenance.

Environment results directly support the world's combined plain-text format, for example `Thick Woods, Ruin:No, Threat:Yes, Artifact:No` or `Unscathed Ruins, Ruin:Yes, Threat:Yes, Artifact:Yes`. The first comma-separated value becomes Terrain without the metadata. All three labeled flags are required, case-insensitive, independent, and authoritative; whitespace and comma spacing may vary, and label order may vary. This also supports custom environment names without guessing their eligibility. Ruin:Yes chooses industrial ruins for Derelict Industries and normal ruins otherwise; Ruin:No generates none. Missing/duplicate/unknown labels, blank names/values, or values other than Yes/No abort before saving. Name-only rulebook results, existing structured mappings, and legacy positional columns remain supported; only name-only results infer eligibility from the rulebook. Rot recognizes 0–3 and the existing labels; level 3 retains its existing localized-hotspot meaning, not sector-wide exposure. Threat Level accepts a numeric value, category name, or category range; Threat Type accepts Humanoid, D66 Encounters, Monster, or Phenomenon/Phenomena, or references to their configured category tables. These classifiers also accept compound labeled text such as `Weak Rot, Rot Level:1, Exposure:1 Rot Point per day`, `Central Zone, Threat Level:7`, and `Monster, Threat Type:Monster`; original details remain in table provenance/entry text where applicable. Duplicate or conflicting classification labels fail clearly. Descriptive tables (ruins, threats, artifacts, mood, scrap) keep their full text and references rather than discarding comma-separated descriptions. Unrecognized or ambiguous text aborts the complete generation without writing sector fields.

For translated/custom tables, result flags under `flags.myz-sector-manager.randomization` can supply `rot` (0–3), `threatLevel` (numeric or `fringe`/`central`/`dangerous`), `threatType` (`humanoid`/`monster`/`phenomenon`), or `environment: {ruins: null | "normal" | "industrial", threats: boolean, artifacts: boolean}`. Structured eligibility is explicit and is not overwritten by name-based defaults. If both structured eligibility and combined text supply conflicting explicit flags, generation aborts rather than silently choosing one. The old chance overrides are ignored. Verify your world tables' UUIDs and normal/industrial assignments before use.

Manual testing in a backed-up Foundry v14 world with the official MYZ system remains required:

1. Confirm the thirteen UUIDs resolve to your intended tables; inspect Environment, Rot, Threat Level, and Threat Type result formats, including separate environment eligibility and the normal/industrial table assignment.
2. Change selected sector, fixed Ark coordinate, party position, and kilometer scale; confirm both new distances, original distance only on the Ark row, narrow-window layout, and local-only navigation. Test no selection and missing coordinates/tokens/Scene.
3. On an existing sector, cancel both Randomize dialogs. Then confirm generation; check terrain/Rot/mood, normal versus industrial ruins, numeric Threat Level and one shared dice pool, threat severity, multiple artifacts, and resource quantities/classifications. Verify Thick Woods never generates artifacts, Settlement requests manual design, and the 1d3 threat option is clearly labeled as a house rule. Reopen/restart and confirm persistence and preservation of manual notes/entries, supplies, stunts, settings, and custom data.
4. Remove a required table or return an invalid category; verify a helpful error and an unchanged sector. Test players cannot generate and a second GM's edits invalidate a pending preview.
5. Edit/delete/add blank and meaningful entries, toggle stunts, and confirm tab muting updates without disabling tabs or muting Randomize. Recheck scrolling, references, overlays, and tracking.

### Parser and dialog follow-up (0.1.7)

This patch integrates the previously unmerged `9108f11` parser fix onto the latest main branch. The exact combined Environment results `Thick Woods, Ruin:No, Threat:Yes, Artifact:No` and `Unscathed Ruins, Ruin:Yes, Threat:Yes, Artifact:Yes` are accepted without changing world RollTables. Explicit eligibility remains authoritative, and malformed results still abort without partial writes.

Tracking now labels the original distance **Party is N sectors (K km) from the Ark**, the selected-sector distance **N sectors (K km) from the Ark**, and its party distance **N sectors (K km) from the Party**. One sector uses the singular. Values still use the configured kilometer scale and existing calculations, refresh with selection/position changes, and retain the coordinate buttons. Multiple expedition groups use their names on the Ark row; unavailable positions remain clearly labeled.

Previously, both randomization dialogs inherited Foundry's default width. They now target half the runtime numeric default, with a 320px minimum target; an automatic/unspecified default uses 320px. Viewport caps allow narrower screens, and long text wraps with vertical scrolling. Both the method dropdown and preview/confirmation controls remain available. Randomization rules and save behavior are unchanged.

Cloud checks simulate Foundry's frame/APIs. After updating in a backed-up v14 world, check live labels and singular/plural wording, both randomization dialogs at narrow widths with long results, and generation using your exact combined Environment strings. The patch preserves existing sector records, settings, and the stable update manifest URL.

### Nested threat tables and document references (0.1.8)

Threat Type is rolled with `recursive:false`, and its selected category is retained before resolving the final threat. The configured categories are:

| D6 | Category | Table UUID | Destination/reference |
| --- | --- | --- | --- |
| 1 | Humanoids | `RollTable.5ZVTmWwi5wyi52rd` | Encounters / Actor |
| 2 | D66 Encounters | `RollTable.Sh3Srm3KHyGgR7uh` | Encounters / Journal Entry |
| 3–5 | Monsters | `RollTable.tsNy12fCcREgIDLk` | Encounters / Actor |
| 6 | Phenomena | `RollTable.jIRwumcfuFBGU8Zp` | Effects / Journal Entry |

The main table remains `RollTable.Kk8jRbrOk3NejHUB`. A category table reference is identified by UUID, not by the final document's name. Nested tables are resolved once, with cycle/depth protection. If a Foundry API/module has already recursively resolved the result, the originating TableResult's parent identifies the category and the final result is reused without another roll. A final document lacking category provenance fails clearly rather than guessing from its name. `Wanderers` is a valid final encounter, not a category label.

Actor and Journal Entry results use the existing document's name for the entry Title and retain the actual resolved UUID, including compendium UUIDs. No Actor/Journal is imported or duplicated. Multiple final documents remain separate editable entries. Plain-text category results and plain-text final threat results remain supported, but a plain-text name alone is never converted into an invented document UUID. Missing references and wrong final document types abort the whole generation before saving.

Encounters and Effects both accept Actor or Journal Entry references through their existing drop/open/replace/clear controls. Previously saved Actor references remain valid. Routing comes from the selected category: D66 Encounters stays in Encounters, and Phenomena stays in Effects. Core severity, optional 1d3 threat identities, environment eligibility, and unrelated sector data remain unchanged.

Before using this patch in a live Foundry v14 backup world, verify all thirteen table UUIDs (including D66 Encounters), roll each of the four category references, open the generated Actor/Journal links, and close/reopen the manager to confirm references persist. Check world and compendium results and missing/deleted references. Cloud tests simulate Foundry APIs; actual world tables and licensed Foundry behavior are not live-tested here.


### Consumables and tracking spacing (0.1.9)

The Loot Consumables table adds **Components** immediately after Booze, with the same decimal Quantity field and collected checkbox. Older sectors default to zero Components without a schema migration. The existing `supplies.components` value saves/reopens through the normal sector flag, and any positive Consumables quantity makes the Loot tab populated.

Randomization previews and then replaces quantities in all seven existing Consumables fields. Grub/water each roll once for presence and once for classification; bullets use 50%/1d6, Booze and Components independently use 25%/1d3. Absent quantities and the opposite Clean/Rot classification become zero. Collected checkboxes and extra supply metadata are preserved. New randomizations create no separate Grub, Water, Bullets, Booze, or `COMPONENTS` loot entries. Manual loot and historical generated resource/Components records remain; there is no automatic migration or deletion. Current generated artifacts and ordinary scrap continue to refresh as separate Loot entries.

Tracking keeps its existing controls and calculations but narrows the coordinate/name area and reduces gaps, giving the middle and selected-sector columns more room. Desktop distance labels stay on one line. At narrow content widths the rows stack/wrap with aligned controls rather than forcing horizontal scrolling.

Cloud verification covers all probability boundaries, both classifications, zero/reset quantities, independent Booze/Components rolls, repeat generation, historical/manual loot preservation, positive-quantity tab indicators, saving/reopening Components decimals, and desktop/narrow layout geometry. In a backed-up Foundry v14 world, check the seven rows, cancel/confirm randomization, verify the preview and saved quantities, and resize the tracking area. Actual live Foundry behavior is not tested in the cloud.


### Ruin links and Consumables panel (0.1.10)

Generated Normal and Industrial ruins preserve existing Journal Entry and Journal Entry Page UUIDs, including world/compendium references. Locations now accepts these document types alongside existing Scene references, using the same native document links and drag/drop/open/clear controls. As of v0.1.18, text-only ruin results remain unlinked with a diagnostic warning; journals are never searched by name. Broken explicit references abort generation without modifying sector data. Table provenance retains its original UUID.

Consumables now spans its available area with two balanced columns: Clean/Rot Grub and Clean/Rot Water on the left; Bullets, Booze, and Components on the right. The columns stack on narrow content widths. Quantities, collected flags, their storage fields, and all resource probabilities remain unchanged.

A subtle rust-colored highlight marks an entire row while quantity is positive and uncollected. Editing quantity/collected state updates the highlight immediately. The keyboard-accessible Consumables header collapses only this panel, leaving regular Loot entries visible. The initial state collapses when everything is zero or collected; transitioning from outstanding resources to none also collapses, and newly outstanding resources expand it. A manual toggle persists as per-sector client-session UI state until the availability condition changes. Manually opening an all-zero/all-collected panel does not immediately close it again. Confirmed randomization re-evaluates the default state so new uncollected supplies are visible. No collapse state is stored in sector data.

After updating in a backed-up Foundry v14 world, verify world/compendium ruin journals and pages open from Locations and survive reopening; test an unresolved journal error without modifying saved sector data. Check both panel columns and narrow stacking, highlights, collecting the last outstanding resource, manual reopening, and expansion after new randomization. Actual licensed Foundry and world tables are not live-tested in the cloud.

### Threat options and Journal organization (0.1.11)

The Randomize options dialog now has two separate selectors: **Randomization Method** (Core Rulebook Tables) and **Threat Generation**. Threat Generation defaults to **Core Rulebook (Default)**: a qualifying shared Base Dice pool produces exactly one threat identity and stores the number of 1s as severity. **Multiple Threats (House Rule)** instead rolls 1d3 separate identities after that same qualifying pool, independently selecting Threat Type and subtype for each. Both honor Threat eligibility and generate artifacts only from eligible 6s in the original pool. Neither produces threats without an eligible 1. An identity roll yielding several ambiguous final documents aborts rather than silently creating extra Core threats. The selector reuses the existing persistent world `threatGenerationMode` preference, so the last choice is shared by GMs; the initial setting is Core. Canceling the options dialog does not change the preference.

On startup, the **active GM only** creates/reuses JournalEntry folders named **MYZ: Sector Manager** and its child **Sectors**. Existing module configuration/non-sector Journals go directly inside the root; a newly created configuration Journal is named **Configuration**, not placed in a Configuration subfolder. Existing configuration titles are preserved. Sector Journals go in **Sectors** and use **Coordinates - Terrain**, such as `A3 - Overgrown Ruins`. Missing coordinates use `-#`; missing terrain uses `Unknown Terrain`. Coordinates use the existing canonical formatter; stored coordinate values and document IDs are not rewritten.

One shared formatter drives Journal names, the editable Overview name, and sidebar labels. Automatic names update with coordinates or terrain; custom overrides persist until Reset to Default. Flagged imported/updated sectors are organized by the active GM, preserving existing custom titles and adding naming state. Journal IDs/UUIDs, content/pages, ownership, references, and other sector data are retained. Back up the world before applying this organization change.

The migration is repeatable: only incorrect names/folders are updated; already organized documents cause no writes. Ownership is established by the sector flag, configuration flag/setting ID, or another flag in this module's namespace. Unsupported sector versions are left untouched with a warning. Unrelated or unflagged Journals are never moved based on their title. The API `await game.myzSectorManager.migrateJournals()` lets the active GM rerun it and returns update counts, warnings, and IDs of untouched unowned Journals; another GM/player receives a skipped result. Folder creation is serialized within the active client and other GMs reuse existing folders. No Journal is deleted/recreated and no sector schema migration is required.

Cloud tests simulate creation/reuse, configuration placement, sector placement/naming, imports, active-GM gating, preserved UUIDs/content/flags/ownership, unrelated Journals, and an idempotent second pass. They do not migrate a real Foundry world. After updating in a backup world, confirm the folder tree and Journal/sidebar names, stable links, name changes after editing/randomizing, and both threat modes with unchanged artifact counts. Actual world migration and licensed Foundry v14 APIs remain unverified live here.

### Editable names and travel planning (v0.1.12)

Sector names default to `Coordinates - Terrain`. Edit Sector name in Overview to keep a custom name across saves and randomization; **Reset to Default** restores automatic naming. Existing Journal titles are preserved: titles matching the current generated name remain automatic, while other titles become custom overrides. The active GM migrates only these additive naming fields.

Find the Path includes **Exploration & Travel Time**. On foot, exploration takes 4 hours and passing through an explored sector takes 1 hour; vehicles use 2 hours and 30 minutes. Selected exploration modifiers multiply together and never change passing-through time. Open and Difficult Terrain exclude each other; the GM may increase the Difficult Terrain multiplier above 2. Save Sector stores the options for that sector. The Half-Time and Rush Through stunts synchronize bidirectionally with the corresponding exploration modifiers; each multiplier applies once. These linked selections autosave using the existing stunt fields. This is a planning reference and never advances the clock, moves tokens, consumes supplies or rolls skills. Find the Path stunts appear in two columns and stack in narrow windows.

For live Foundry v14 testing in a backup world: verify old/custom Journal names, edit/reset names and randomize, then reopen sectors to confirm names and calculator options persist. Check both wide and narrow Find the Path layouts. Automated tests use simulated Foundry APIs.

### Linked Find the Path stunts (v0.1.13)

Find the Path Stunts now appears above Exploration & Travel Time. All nine existing stunts, including Rot Finder as the final entry, use two columns (five left, four right); the exploration modifiers also use two columns. Both layouts stack in narrow windows.

Half-Time ↔ Stalker / Find the Path and Rush Through ↔ Rushed Exploration share the existing stunt flags as their source of truth. Checking or unchecking either control updates both immediately and autosaves once. The two modifiers stack once each and never change passing-through time. Existing stunt selections take priority over conflicting older calculator flags; redundant flags are removed on save. Rot Finder and all other stunts keep their existing identifiers and behavior. Reset Stunts clears the linked modifiers too. Other calculator options still require Save Sector.

In a backup Foundry v14 world, verify both directions of each linked pair, immediate time changes, Reset Stunts, Rot Finder, close/reopen and randomization persistence, plus wide/narrow layouts. Automated coverage simulates Foundry APIs; live Foundry behavior remains unverified.

### Interactive overlay and shared sector icons (v0.1.14)

Enable **Show overlay** while viewing the designated Zone Scene. Hover over a background square for a translucent green highlight and current tooltips; left-click to open its sector in Overview in the existing manager window. Empty squares immediately open **+New Sector** with coordinates prefilled. Cancel creates nothing; confirmation rechecks for existing coordinates. The normal +New Sector button now uses this same confirmation dialog. Right-clicks, right-drag, ordinary drag gestures, wheel zoom, modifier-key gestures and token hits are not cancelled by the module. Disabling, switching scenes and calibration remove or suspend normal overlay navigation. The overlay remains GM-only and grants no Journal permissions.

Saved sectors show terrain, explicitly recorded Rot (including 0), Encounter entry counts, Phenomenon counts, available-loot and exploration-status icons. Ordinary Weather/Hazard/Special Effect notes do not count as Phenomena. Older generated phenomenon entries without a category use their generation metadata. Available loot includes uncollected regular loot and positive, uncollected known Consumables; Legacy Collected/Depleted statuses initialize the Collected checkbox; an explicit checkbox value controls availability thereafter. Collected and zero-quantity loot are excluded. Empty squares show muted coordinates only. Existing coordinate, boundary and status-icon toggles remain available. Cell masks contain long text, labels follow the canvas transform, and changed saved sector data refreshes only affected cell labels. Viewport culling keeps panning over large maps responsive; the existing 2,000-label budget remains for very dense views. Zoom in when necessary.

One centralized set of bundled vector definitions supplies both SVG icons in Overview and section headings and PIXI icons on the map. Colors, shapes and current singular/plural tooltips are shared, with readable labels and icon accessibility text. No external icon service, font or runtime dependency is required.

Optional actual-renderer check: obtain the pinned PIXI browser bundle in a temporary directory (not in the module), then run:

```sh
mkdir -p /tmp/myz-pixi
npm pack pixi.js@7.4.3 --pack-destination /tmp/myz-pixi --cache /tmp/myz-npm-cache --ignore-scripts
tar -xzf /tmp/myz-pixi/pixi.js-7.4.3.tgz -C /tmp/myz-pixi
MYZ_PIXI_PATH=/tmp/myz-pixi/package/dist/pixi.min.js node tests/overlay-browser.cjs
```

This check requires the existing optional Playwright/Chromium tooling. It exercises real PIXI/WebGL masks, geometry, highlight pixels, zoom/pan pointer transforms, tooltips, token/UI/right-click/drag safeguards, native event delivery, live updates and cleanup. The separate interface browser suite exercises confirmed/cancelled creation, duplicate prevention and manager reuse. Neither loads licensed Foundry itself. In a backup Foundry v14 world, test native token selection/movement, background clicks, right-drag panning, wheel zoom, canvas tool layers, your UI modules, calibration, light/dark themes, two GM clients and player privacy before relying on the navigation mode.

### Randomize safeguard and Loot entries (v0.1.15)

New Sector still reserves its private Journal record immediately, but marks it as awaiting its first explicit **Save Sector**. **Randomize** stays disabled (including programmatic attempts) until that save succeeds. A failed save leaves it disabled; existing saved sectors need no extra save. Names/coordinates alone never establish eligibility.

Loot headings now display `Name x Quantity (type)`; quantities of 1 or less omit the quantity suffix. Names are stored without decorations. Missing/invalid quantities default to 1, while existing zero/decimal quantities remain valid. Type choices are Scrap (default), Armor, Artifact, Chassis, Gear and Weapon. An explicit supported world/compendium Item drop or reference edit can infer its classification. Opening or rendering a reference does not refresh stored classifications. Unsupported Item/document types do not replace the current classification. Manual Type changes persist and are not continuously overridden. Generated plaintext artifacts default to Artifact, ordinary scrap to Scrap; supported referenced Item types take precedence.

Loot **Collected** replaces the Status dropdown. Checking it autosaves this sector's Loot list (including current Loot edits), collapses the entry and strikes through its title. It never deletes the entry or reference. Expand it with the mouse or keyboard to edit it or uncheck Collected; unchecking keeps it expanded. Other unsaved sector fields still require Save Sector. Loot and stunt autosaves share a queue to avoid overwriting one another. Conflicting external Loot changes fail without writing and report an error; reopen to review the current saved data before retrying.

Backward compatibility: old Collected and Depleted statuses initialize `collected: true`; Active, Hidden, Discovered, Resolved and Inactive initialize false. The original `status` remains stored, with a small Previous status note for non-Active values. Once present, the checkbox is authoritative, so unchecking an originally Collected/Depleted entry makes it available again without erasing its history. Existing UUIDs, names, quantities, notes, generation metadata and custom fields remain. Unsupported older type values are retained as `legacyType` while the editable classification defaults to Scrap. Existing confirmed randomization replacement rules remain unchanged.

In a backup Foundry v14 world, create a sector and try Randomize before/after Save Sector, then verify world/compendium Item detection, a manual Type override, collection/expansion/reversal and persistence after restarting Foundry. The automated API fixtures and browser checks do not constitute live licensed Foundry testing.

### Overview refinements and Threat Level tracking (v0.1.16)

Overview now uses two desktop rows: Sector Name / Coordinates / Terrain, then Exploration Status / Rot Level / Threat Level. It wraps to two or one column in narrow windows. Coordinates uses a compact input without shortening the coordinate format. Rot choices keep their existing names/values in `# - Descriptor` form; the mechanical helper text remains below. Terrain, status and Rot controls are compact; other tabs retain their layouts.

**Threat Level** defaults to 1 and accepts whole numbers **0 or greater**, as clarified by the user. Use its minus/plus buttons or enter a number; the helper shows Fringe Zone (0–4), Central Zone (5–8), or Unusually Dangerous Area (9+). The root sector flag `threatLevel` is the canonical numeric value. Older `randomization.numericThreatLevel` values migrate as a fallback and are removed on save using Foundry's deletion syntax. Randomization writes the actual numeric dice-pool level to the same field, including 0; no RollTable mappings, eligibility, probability rules or zero-level behavior changed. Editing the level afterward never rerolls existing threats/artifacts. Historical Base Dice and generation provenance remain.

Mood and Description use independent collapsible sections. Empty/whitespace/empty rich-text markup starts collapsed; meaningful content starts expanded. You can open empty sections or close populated ones, and session-only per-sector choices survive ordinary rerenders/navigation. Text is never cleared by toggling; GM Notes remains unchanged.

The first Find the Path option is the **basic effect**, not a stunt that consumes another success. Other stunts (including Rot Finder) and the linked Half-Time/Rush calculator controls use real disabled inputs until it is checked. Unchecking clears known dependent selections and saves them through the existing stunt autosave; other calculator conditions remain available. To preserve older selected stunts safely, loading inconsistent older records infers the basic effect as checked. Unknown future fields remain intact.

Newly generated Loot rows initially collapse; manual rows keep their current behavior, and ordinary rerenders do not override manual expansion. Each confirmed new randomization starts the new generated rows collapsed again. Collected collapse, keyboard expansion and reversal continue to work. No expansion state is stored in sector records.

Backup-world checks in Foundry v14: verify legacy numeric Threat Level migration (including 0), manual edits/save/reopen and matching randomization dice counts; test dependent stunt disabling/clearing and linked calculator controls; then check independent accordions, generated Loot expansion, custom names, Rot helper text and the responsive layout. Automated browser/PIXI checks do not establish live licensed Foundry behavior.

### Context-sensitive Add Entry generation (v0.1.17)

**+Add Entry** now uses the selected tab. Encounters rolls the configured Threat Type table and its selected Humanoid, Monster or D66 Encounter table. Manual Encounters discard Phenomena before rolling a subtype, preserving the remaining relative probabilities; the full Sector Randomizer still includes Phenomena. Actor/Journal names and UUIDs come from the actual world or compendium document. Nested results retain their source category and are never deliberately rolled twice.

Encounter Status choices are Active, Resolved, Defeated and Hidden. Type choices are Humanoid, Monster and Encounter, editable independently of Status/Reference. New entries default to Active; older entries infer Type from known generation provenance, otherwise Encounter. Recognized statuses normalize capitalization; older Discovered/other unsupported statuses use Active, with their original values retained as `legacyStatus` and displayed for review. Unsupported old Types are retained as `legacyType`. No entry is removed by normalization. The main randomizer assigns the same category-based Types.

Loot adds a Scrap-table result, with quantity 1 unless a numeric result quantity, structured `flags.myz-sector-manager.randomization.quantity` / `.loot.quantity`, or a trailing `, Quantity:N` is explicitly supplied. Text-only results never receive invented UUIDs. Item references retain their actual UUID and supported classification; plaintext Scrap defaults to Scrap. Existing Collected/title behavior remains. Effects adds a Journal-backed Phenomenon.

History keeps blank **+Add Entry** and adds **+Add Event**, using `RollTable.24wtBybpf1ObKbcG` for the Zone or `RollTable.c5Saikp36mQWGqL1` when the selected coordinates match the currently designated Ark (including canonical coordinate variants). Without an Ark designation, events use the Zone table.

Locations uses the same terrain eligibility as full generation: ordinary ruin environments select Normal Ruins and Derelict Industries selects Industrial Ruins. Explicit saved eligibility is used only while its environment still matches the current terrain; explicit `Ruin:Yes/No` text is also supported. Missing, unknown, or non-ruin terrain produces a blank editable Location without rolling a table. A name containing “ruins” alone is not an eligibility rule. Required Actor/Journal results must resolve. Actor text results retain exact unique name lookup; journal results require document metadata and never use name lookup.

All newly added rows start collapsed, including blank Secrets/History/Locations. New full-randomizer rows also start collapsed. Expand a header to edit; ordinary rerenders preserve your choice and existing entries are not reset. Actions append to the current draft and use **Save Sector** for normal persistence; existing Loot collection autosave behavior still applies. Repeated clicks during generation are guarded. Changes to the draft/selection or a closed window abort a pending result without adding it.

Artifact generation now rejects D666 values **643–666**, rerolling the same Artifact table until eligible. It reads the actual Roll total or selected TableResult range before resolving excluded references. Names containing numbers do not affect selection. Ambiguous/missing range information fails instead of guessing. Rerolls are bounded at 30 attempts, both for manual Phenomena exclusion and artifact filtering; exhaustion aborts without partial sector writes. All other full-sector probabilities/mappings are unchanged.

Automated tests cover all categories, world/compendium UUIDs, classification/legacy values, Scrap quantities, Ark identification, ruin eligibility, every excluded artifact value, bounded failures, append safety and collapsed UI behavior. Browser checks exercise the buttons, native links and save/reopen persistence. In a backup Foundry v14 world, confirm the actual table ranges/roll totals and recursive-table behavior, compendium permissions, Ark/Zone events and native link opening. No live licensed Foundry instance was available here.

### Journal page references (v0.1.18)

Effects, History events, D66 Encounters, and Locations accept both Journal Entries and their individual pages, including compendium pages. Generated titles use the referenced page name and references retain the full page UUID. Clicking a reference uses Foundry's native document-link handler to open that specific page. Pages can also be dropped into journal-compatible reference fields.

Journal results are never matched by name: duplicate names cannot redirect a reference. Add Entry actions that require a journal report missing metadata or unresolved references before changing the sector. Full generation retains genuinely plain-text results without inventing UUIDs, with diagnostic warnings. Actor and Item reference behavior is preserved.

Before updating a live world, back it up and check MAGNETIC FIELD / ACID RAIN Effects, A HARD CHOICE Ark and Zone events, page drag-and-drop, save/reload, and page-link navigation with world and compendium journals. Automated browser checks simulate Foundry APIs; they do not replace live Foundry v14 testing.

### Normal and Special Zone Sectors (v0.1.19)

Click **+ New Sector**, choose **Normal Zone Sector** (the default) or **Special Zone Sector**, enter coordinates, and confirm. Cancel creates nothing. New sectors keep the existing first-save safeguard: save a Normal sector successfully before Randomize becomes available. No type is randomized on creation.

Normal sectors keep Overview, Locations, Encounters, Loot, Effects, Find the Path, and History. The former Secrets tab is hidden; existing Secrets records remain stored.

Special sectors are manually authored and have Overview, Locations, Inhabitants, Gear & Artifacts, Events, Images, Find the Path, and History. Their rows have a purple border and a textual Special indicator. Overview keeps the shared name, coordinates, terrain, exploration status, Rot and Threat controls, plus a Scene reference, free-text Source, and a separate multiline Overview. The Situation has a multiline editor directly below the Overview description. GM Notes remain shared. Scene links open through Foundry's native document-link action; selecting a sector never activates its referenced Scene. No Scenes, Actors or Items are imported or duplicated.

Use **+ Add Inhabitant**, **+ Add Item**, and **+ Add Event** to create collapsed editable entries. Drag world or accessible compendium Actors, Items, Journals or individual Journal Pages into their reference fields. Scene references accept Scenes only; Inhabitants accept Actors; Gear accepts Items; Events accept Journals and Pages. Links retain the full document UUID and support opening, clearing and replacement. Missing references remain visible without preventing loading. Inhabitants and Gear use the assigned document name unless you have entered a custom title. Gear reuses the Normal Loot item types, supports manual type overrides, and uses positive integer quantities (default 1). Its heading formats quantity and type without changing the saved title; it has no Collected checkbox. Special Events are independent of History and never roll event tables.

Use **Change Sector Type**, review the destination and preservation explanation, confirm, and **Save Sector**. Inactive content is hidden, never deleted or copied into the other type. Convert back to restore it. Shared fields, Find the Path and History keep the same data throughout. History's existing **+ Add Event** continues to choose the Ark or Zone table for either sector type. Special Randomize is hidden and blocked in generation and generated-save APIs. Normal randomization preserves all Special fields.

Names remain editable for both types. The sidebar and main heading combine canonical coordinates and the current sector name, update as you type, and use the existing coordinate/terrain fallback for blank names. Coordinate normalization follows the existing conventions (`B07` displays as `B7`). Saving, switching sectors, and reopening preserve authored text and references.

Compatibility: the Journal sector flag remains schema version 1 with additive `sectorType` (`normal` by default) and `special` fields (`sceneUuid`, `source`, `overview`, `situation`, `inhabitants`, `gear`, `events`). Existing records need no manual migration; their type is persisted on save. Unknown properties, old Secrets and inactive content remain serialized. No separate database or copies of shared travel/history data are introduced.

Before updating a live world, back it up. Create each type, cancel creation/conversion once, author a Special sector with your actual compendium references, save and reopen it, test page-specific links, convert both ways repeatedly, and verify shared stunts/History, Ark/Party distances and map selection. Check GM-only access and missing-reference handling. Automated tests use simulated Foundry APIs plus Chromium and PIXI/WebGL; a licensed Foundry v14 world is not live-tested in the cloud.

### Special overlay images, drop creation, and Images gallery (v0.1.20)

Special sectors have a subtle purple cell fill/outline in the existing GM overlay. **Overview → Overlay Image** opens Foundry v14's standard FilePicker; choose an existing image from your available file sources, replace it, or clear it. Nothing is imported into the module directory. The image fits the cell's upper third without changing its aspect ratio, while Terrain is centered near the bottom when labels are enabled. Coordinates, Ark markers, hover/selection, and ordinary map interactions remain available. Image and Terrain edits preview immediately on the GM's overlay; **Save Sector** keeps them, and discarding edits restores the saved appearance. Broken image assets are omitted on the map and shown as a helpful placeholder in the form. The texture cache is bounded and reused during redraws/zoom; pending loads cannot add stale sprites after a cell is changed or destroyed.

**The Situation** starts at seven visible lines and grows or shrinks with its text. Returning to Overview, reopening a sector, or changing window width recalculates the height. The content pane scrolls; the window does not automatically resize.

On a saved Special sector, drop an Actor onto the blank **Inhabitants** area or an Item onto the blank **Gear & Artifacts** area to create a collapsed entry with its actual UUID/name and detected Item type (quantity 1). World and accessible compendium documents work. Drops on existing Reference fields still replace that reference and do not add rows. Hovering a compatible/candidate document shows a dashed drop indication; actual document types are checked on drop. A first-save notification protects unsaved sectors. Dropped entries save their collection immediately, including edits already made in that collection; unrelated draft fields still need **Save Sector**. Autosaves share the existing serialized write queue and reject changed saved collections rather than silently overwriting another GM's work. A failed save keeps the draft for review.

The Special **Images** tab follows Events. Drop an **Image-type Journal Entry Page** onto its blank area to add and save an illustration, or click **+ Add Image** and assign a page reference manually. Both world and compendium page UUIDs are retained. Previews stay visible in a vertical gallery; **Edit image details** contains the editable title, reference, and multiline notes. Previews load lazily and preserve aspect ratio without horizontal overflow. Text-type pages are rejected as image sources, missing pages/files show placeholders, and references can be opened, replaced, cleared or removed. Ordinary title/notes edits retain the existing image DOM instead of reloading all assets. Manual image entries and reference changes use **Save Sector**.

Schema version 1 is unchanged. `special.overlayImage` defaults to an empty path and `special.images` to an empty list. Only references and paths are stored, never image bytes. These fields remain hidden/preserved through Normal/Special conversion, Normal randomization and saves in other tabs. All existing shared stunts, History and map tracking remain shared.

API reference checked against the [v14 JournalEntryPage schema](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/documents/journal-entry-page.d.mts) (`type: "image"`, media URI in `page.src`; `page.image` contains caption metadata) and [v14 FilePicker definitions](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/applications/apps/file-picker.d.mts) (`foundry.applications.apps.FilePicker.implementation`, image type/current/callback options). The definitions inspected identify version 14.366.0; they are development references, not runtime dependencies.

Before updating a live world, back it up and check your actual FilePicker sources, image-page/compendium permissions, image loading and page-specific navigation. Verify overlay placement/contrast at your map zoom, drop creation versus reference replacement, Situation resizing, save/reload, and conversion in both directions. Automated Chromium and PIXI/WebGL tests simulate Foundry APIs; a licensed Foundry v14 world was not live-tested here.

### Special-sector UI refinements (v0.1.21)

The overlay image's contain-fit region now covers the **full cell width and upper one-third height**, starting at the cell top. The former coordinate-height and padding deductions made this region too small. The complete image stays visible with its aspect ratio intact; portrait images can still have space on either side. Per-cell clipping prevents overflow, coordinate text remains above the image, and purple highlighting/Terrain placement are retained through zoom and grid resizing.

The complete **Overlay Image** section is now at the bottom of Special Overview, after **GM Notes**. Its saved path and FilePicker/clear behavior are unchanged.

**Inhabitants** headings show a 36px square Actor portrait from the referenced world or compendium Actor's `img`, with a neutral offline fallback when the Actor or image is unavailable. Portraits update when references change or clear. Clicking a portrait only toggles the row; document opening stays on the Reference link. Inhabitants and Events use left-aligned titles with the expand arrow at the right of the heading toggle; long titles wrap.

**Images** has **Expand All**, **Collapse All**, and **+ Add Image**, in that order. Bulk controls open/close entire entries, including previews and metadata. Each heading also toggles its whole entry, while **Edit image details** remains available independently. Bulk toggles hide/show existing DOM in place without changing notes, UUIDs, or saved flags and without recreating images. Expansion state is local to each sector in the current client session. New Images entries still start with their preview visible and metadata closed; a fresh Foundry reload restores those defaults. No sector schema or stored data migration is introduced.

In a backed-up Foundry v14 world, check wide/portrait images at several grid sizes and zoom levels, Overview order after reopening, world/compendium Actor portraits and missing-file fallbacks, portrait clicks versus Reference opening, theme alignment and long titles, and Images bulk/individual controls across sector switching. Licensed Foundry v14 itself was not live-tested here; automated Chromium and actual PIXI/WebGL checks cover the available simulated integration.

### Tab consistency, overlay layout and Location snapshots (v0.1.22)

Normal **Encounters** is now labeled **Inhabitants**, and Normal **Loot** is labeled **Gear & Artifacts**. These are display changes: the `Encounters`/`Loot` tab IDs, `encounters`/`loot` storage, Normal entry fields, classifications, collection tracking, generators and references remain intact. Normal and Special content remain separate. Headings and shared icon tooltips use the updated wording. All collapsible entry headings now share the left-aligned title/right-side arrow layout; existing Special Actor portraits and delete/reference controls remain available.

Special overlay images use contain fitting within the **upper-right ninth** of a cell: the rightmost one-third width and top one-third height. The image is centered inside that corner region, without distortion or overflow. Purple highlighting, coordinate text and the centered bottom Terrain label remain. In Special Overview, the **Overlay Image** section stays below GM Notes and uses about half the content width, expanding to full width in narrow windows. This form layout does not determine the map image dimensions. FilePicker, clearing, saved paths and conversion behavior are unchanged.

Generated Normal **Locations** now snapshot the referenced journal's descriptive text into **Details / Rules / Notes**. Both full Randomize and the shared **+ Add Entry** Location action use this extraction. A Journal Page result uses only that exact page; a Journal Entry combines Text-type pages in document sort order. World and compendium UUIDs and existing titles are preserved. Image pages, embedded pictures/video/audio/iframes, scripts/styles and media attributes are excluded. Foundry's inert HTML template parsing decodes entities and retains paragraph/line separation as plain text; no new editor or HTML execution is introduced. No image files or image bytes are stored in the description.

Empty/non-text journals leave Details empty. Missing/inaccessible Location journal results keep their reference with a warning and empty Details, so generation can continue; unrelated generation tables retain their existing validation. Invalid document types still fail clearly. No journal is guessed by name. Snapshot text is independently editable and is never refreshed just by loading/reopening a sector or by later edits to the source journal. No schema migration, terrain-description library or terrain-list customization is included.

In a backed-up Foundry v14 world, check your actual world/compendium ruins tables with both whole journals and specific pages, multiple Text pages, image-only/empty/missing documents, generated text saving and subsequent GM edits. Check Normal classifications/collection controls, long headings and portrait clicks, map zoom/grid scales, and narrow/wide Overview controls. Automated Node, Chromium and actual PIXI/WebGL checks passed; licensed Foundry v14 itself was not live-tested here.

### Special Locations, terrain descriptions and sector-entry Macros (v0.1.23)

Special tabs are now **Overview, Locations, Inhabitants, Gear & Artifacts, Events, Images, Find the Path, History**. The Situation editor is directly below the Overview description, using the same saved `special.situation` field. These two sections start expanded and collapse independently; expansion is session-only and preserves unsaved text. Situation retains its seven-line minimum and automatic growth. GM Notes and Overlay Image follow them.

Special **Locations → + Add Entry** creates a blank, collapsed, manually authored Location. Add titles, Details / Rules / Notes and world/accessible compendium Journal, individual Journal Page, or Scene references; links can be opened, cleared and replaced. No Ruins or description tables run here. The additive `special.locations` list is separate from Normal `locations`, and both survive conversion. Schema version 1, document IDs, existing Situation text, hidden Normal records and all other content remain intact; no destructive migration runs.

Normal Randomize rolls once on the matching table in `scripts/terrain-descriptions.mjs` after resolving the Environment. Its text becomes an editable Description snapshot, preserving paragraph breaks and appearing in the confirmation preview. The 13 mappings now live in `scripts/document-references.mjs`, with original world UUIDs retained only as migration candidates. Missing, denied, empty, invalid or failed description results warn and retain the existing Description. Opening a sector never rerolls. Names, eligibility flags and separate Location generation are unchanged. Settlement remains the existing GM-authored/manual environment safeguard; its mapping is available without removing that safeguard.

To configure an optional entry Macro:

1. Register the Party/Expedition Scene token in **Zone Map configuration → Expedition groups**. Only these designated tokens qualify; an Actor association alone does not register other tokens.
2. In a Normal sector's **Effects** entry, drag an actual world/accessible compendium Macro to **Macro Reference**, choose **Run Once (First Entry Only)**, and **Save Sector**. Existing Journal references and notes remain independent. Assigning the Macro never runs it; clicking its link opens its editor rather than Foundry's executable native Macro link.
3. Move the registered token so its final center enters another sector. The active GM executes referenced Macros in Effects-entry order, awaiting each returned Promise. Ordinary completed position updates and teleports qualify; v14 pending/paused movement waits for stop. Intermediate animation frames, passed-through sectors, same-sector moves, unregistered tokens, startup, refresh and reconnect do not fire triggers.
4. Reopen Effects to inspect each trigger's token-specific outcome. **Reset this trigger** or **Reset all sector Macros**, with confirmation, allows subsequent valid entry to fire again. Resets affect only execution state and require the active GM. Save references/enable changes separately with Save Sector.

Execution history is separate in the sector Journal's `flags.myz-sector-manager.entryTriggers.records` array. Each record stores stable Effect trigger ID, full Scene-token UUID, Macro UUID, timestamp and running/completed/failed outcome; the Journal's stable identity scopes the history. Renaming or moving sector coordinates retains it. A new Effects trigger receives a new random identity. Changing a Macro on an existing trigger retains its history; reset it if it should run again. Empty references or separately disabled triggers never execute. Missing/denied Macros or rejected/thrown execution errors are recorded and reported, then execution continues. Foundry's normal permission checks remain in effect; errors swallowed internally by Foundry cannot reliably be distinguished from a Macro returning no value, so inspect Foundry's own notifications/console too.

The service persists a **running** record before execution to prevent accidental replay after reconnect or interruption. In Run Once mode a running/failed record also blocks retries until a GM reset; a crash does not claim completion. There is no distributed rollback or automatic retry of arbitrary Macro side effects. Only `game.users.activeGM` executes; with no eligible GM nothing is marked successful. Moves induced by a running Macro for the same token are suppressed to prevent reentrant execution. No Effect description is evaluated as JavaScript. Special Sectors have no Effects tab; the independent entry service can accept a future Special trigger source without changing movement detection.

**Sequential dialogs:** a Macro must explicitly return/await a Promise that resolves when its interaction finishes. Simply opening a dialog does not keep Macro execution pending, and the module does not try to detect arbitrary open dialogs. Script Macros receive `token` and `sector` (the sector Journal) in the execution scope.

Validation uses automated Node tests, Chromium interaction tests and actual PIXI/WebGL rendering, with simulated Foundry APIs. v14 movement states/hooks and Macro editor/execution behavior were checked against the [Token definitions](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/documents/token.d.mts), [hooks](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/hooks.d.mts) and [Macro definitions](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/main/src/foundry/client/documents/macro.d.mts). No licensed Foundry instance was available. In a backup v14 world, verify real drag payloads/compendium permissions, native Macro editor opening without execution, Party and multiple Expedition groups, player-originated movement, animated multi-waypoint paths/teleports, two connected GMs and GM handover, async dialogs/failures/resets, then save/reload and convert older Normal/Special sectors. Confirm all 13 description tables exist in your world and compare their text with the saved Description.

### Document References and Macro repeat mode (v0.1.24)

Open **Configure Settings → Module Settings → MYZ Sector Manager → Document References** as a GM. This world-scoped window lists all **28 module-level RollTable dependencies**, grouped into searchable, collapsible categories. Sector-specific Journal/Page, Actor, Item, Scene and Macro references stay with their sector entries; Party/Expedition tracking remains unchanged.

**New-world setup:** no compendium content is bundled yet. The repository contains UUID mappings but no redistributable table source assets. Manual Normal/Special sector editing works immediately. To use generation, assign your own authorized tables; installing the module does not include proprietary MYZ rulebook content. The 13 core generation tables are marked Required, while Events and terrain descriptions are optional for their respective features. See the [complete resource inventory and migration design](https://github.com/paddirn/myz-sector-manager/blob/main/docs/document-reference-audit.md).

Each row accepts a full world or compendium UUID, or a dragged RollTable. Use **Open document**, **Validate**, **Clear / Disable**, or **Restore Default**. The three modes are distinct: **World override** uses your UUID; **Default** uses a bundled resource if supplied (currently unavailable); **Disabled** never falls back. Status text identifies Valid, Missing, Wrong Document Type, Inaccessible, Disabled, Default in Use, or Unconfigured. **Validate All** refreshes health without changing settings. Search includes category, label, UUID and resolved/imported name. Changes, reset-to-defaults and imports are drafts until **Save**; Cancel/window close asks before discarding unsaved changes. Concurrent setting edits are detected before Save. Changing a reference takes effect on the next operation without a restart.

**Existing worlds:** the active GM performs a one-time migration. Valid known legacy IDs with recognizable table names and structures become world overrides; existing explicit overrides are preserved. Terrain-description candidates additionally need six equally weighted 1d6 results. Missing, wrong-type, inaccessible or ambiguous candidates are listed for review, not silently assigned. If your original tables have custom names, use the row's **Review/assign legacy candidate** after verifying its identity. A failed migration leaves settings unchanged and exposes a retry control. No sector data, original documents, Party assignments, trigger identities or execution history are rewritten. The inventory documents the exact legacy IDs and name/structure checks.

**Moving configuration between worlds:** click **Export Configuration** to download `myz-sector-manager-document-references.json`. This exports the current draft's configuration, not table/document contents. In another world, **Import Configuration**, choose **Merge** (only imported keys change) or **Replace** (omitted keys return to default), inspect the proposed UUID/name/status changes, confirm, then Save. World UUIDs may not exist elsewhere; missing references retain their original UUID/name until you assign a replacement. Compendium UUIDs require the same accessible pack. Invalid JSON, unsupported versions, unknown properties/keys and unsafe or oversized inputs are rejected before changes apply.

**Troubleshooting:** Missing means the exact document is absent; assign the correct replacement. Wrong Document Type requires a RollTable rather than an Actor/Journal. Inaccessible may require pack/document permissions. Unconfigured means no default or override exists. Restoring defaults cannot supply content that is not bundled. Check the health panel and **Copy Diagnostics** for module/Foundry/configuration versions, reference statuses and errors. Diagnostics exclude unrelated world data. Required generation failures leave sector data untouched; missing optional descriptions retain the existing Description and deduplicate repeated warnings. If you replace category tables, also update your Threat Type table's nested references to those configured tables.

To supply future portable defaults, provide the authored terrain-table source exports and redistribution permission. The module will not fabricate descriptions or bundle commercial rulebook content without permission. The registry-driven settings layout can accommodate future resources without building a custom terrain editor.

**Macro mode:** the Effects checkbox is now **Run Once (First Entry Only)**. Checked means once per registered Party/Expedition token until reset. Unchecked means every eligible sector reentry; it does **not** disable the Macro and ignores old fired history. Use the separate **Disable automatic trigger** checkbox to stop execution without removing the reference. Its `macroDisabled` state is independent of Run Once. Changing the checkbox does not execute anything by itself. Registered-token, completed destination, active-GM, sequential-await, duplicate-hook and reentrancy rules remain in force.

The additive `macroRunOnce` boolean takes precedence over the legacy checkbox `macroEnabled`. Existing checked records retain once-only behavior; existing unchecked/missing values become repeatable as requested, without rewriting saved sectors on load. Saving the Effects form stores the explicit mode. Repeatable executions update the latest per-token outcome rather than accumulating permanent consumption records. **Switching back to Run Once considers any recorded attempt (including repeatable, failed or interrupted attempts) consumed until a GM reset.** Repeatable mode ignores those outcomes and can run on the next valid entry without reset. This policy preserves existing history and avoids a surprise extra once-only execution after mode changes. Reset remains token-history-only, leaving Macro references and Effects notes intact.

Automated Node, Chromium settings/interface and real PIXI/WebGL tests exercise the available integration. No licensed Foundry v14 instance was available. In a backed-up world, check settings-menu registration and restricted writes, actual directory/compendium drag payloads, legacy identity review, Save/Cancel/import/export, all configured generation paths, multiple GM clients and real animated Party movement. For Macros test unchecked return visits, checked once-only behavior, reload, mode changes, separate expedition tokens and returned async dialog Promises.

### Automatic Zone Travel Events (v0.1.25)

1. Configure the Zone and designate Party/Expedition tokens as before.
2. In **Module Settings → MYZ Sector Manager → Party Roster**, drop participating world/compendium Actors, assign their expedition, and optionally choose a lead Stalker. Only referenced, enabled roster members are considered; shared defaults apply only to a single expedition.
3. In **Document References → Travel Events → Weather Conditions**, assign your own text-result RollTable. This is the new optional `travelEvents.weatherTable` slot: **29 total configurable resources**, no hardcoded Weather UUID and no bundled content. Travel encounters reuse configured Threat Type and Humanoid/Monster/D66 Encounter tables, excluding Phenomena as in manual Encounters generation.
4. Open **Travel Events** and Save Configuration. Defaults enable independent 1-in-12 weather-change and encounter checks, reduced to 1-in-20 encounters for Explored/Cleared sectors. All denominators are editable, including 6/12/20/36; d36 is a uniform 1–36 check, not d66.

Only completed movement into a different existing Normal sector qualifies. Special sectors, same-sector moves, passed-through squares, initialization and unrelated tokens do not. Initial weather is established silently; unchanged weather plus no encounter stays entirely silent. An actual weather change, generated encounter, or both produces one private active-GM report. Weather is global across expeditions and survives reloads. No combat, enemy tokens, exploration changes or mechanical weather effects are applied.

Automatic Find the Path uses verified official MYZ **14.0.4** embedded `FINDTHEPATH` skill data and current prepared attribute/skill/gear pools. Rolls are hidden and never pushed or sent to chat. All eligible roster Stalkers roll once; the highest individual result is reported. Lead-only mode falls back to all eligible members with a private explanation. Missing skills/APIs leave detection unresolved rather than inventing a roll. The awareness recommendation is a labeled **house rule**; zero successes do not force an ambush.

Travel reports finish before existing sector Macros run. Macro Run Once/repeat/disabled behavior remains independent. Reports close normally or time out after five minutes and remain available for later review. Travel Event History, dice and weather are stored in the existing GM-owned configuration Journal, separate from sector History and Macro history. Delivered history defaults to 200 events; pending reports are retained with a 1000-report processing limit. The GM can inspect/refresh history, set/reroll/reset weather, and run clearly labeled tests with persistence off by default.

See the [complete setup, verified system-source references, private storage/recovery limits and backup-world checklist](https://github.com/paddirn/myz-sector-manager/blob/main/docs/travel-events.md). No licensed Foundry world was available for live testing. Offline recovery uses a bounded Token-owner flag buffer and native permissions; denied writes or unsaved disconnected-client results cannot be guaranteed recoverable.


### Travel Events compatibility fixes (v0.1.26)

Weather and encounter RollTables now accept Name-only results and retain optional multiline Descriptions. Weather shares nested world/compendium table resolution with sector generation, with cycle/depth checks and contextual errors. V14 results use `documentUuid` for linked targets without reading deprecated TableResult properties. The browser environment wrapper that caused “Illegal invocation” has been removed.

Successful Travel Events use a persistent GM-only dialog. Close or X releases the next queued report and sector Macros; there is no automatic dismissal. Weather and encounters combine into one scrollable report, no-event checks stay silent, and closed reports remain in private Travel Event History. Use Name for a short weather identity and Description for narrative text. See [Travel Events setup and result formats](docs/travel-events.md) for linked-weather policy, diagnostics and backup-world checks.

### Wandering Tokens (v0.1.27)

NPCs can now wander one calibrated Zone sector North, South, East or West after the Party enters a new sector. Automatic checks default to at most two NPCs, but every placed token remains stationary until explicitly enabled. Player-owned Actors/tokens and Party/Expedition tokens are always excluded. Hidden NPCs keep their visibility; Special destinations are excluded by default, and uncreated sectors are allowed without creating records.

Enable an NPC through **Token Configuration → Identity → Sector Manager → Allow Random Wandering**, or the GM token HUD lock/footprints button. In **Zone Map / Tracking**, use the selected-token bulk controls, **Wander Now**, or **Wandering Tokens** settings. Options include maximum 1–6 tokens, every entry/25% chance/manual frequency and Special destinations. Wander Now works even when automatic wandering is off. Travel reports finish first, then wandering runs, then sector Macros continue; NPC moves do not trigger Party entry actions.

See [Wandering Tokens setup, storage, movement protections and manual checks](docs/wandering-tokens.md). Native Foundry v14 animation, Token Configuration submission and compatibility with your installed modules require backup-world verification.

### Restore original wandering behavior (unreleased v0.1.30)

The abandoned Last Known Position feature has been removed. Wandering again uses the stable v0.1.27 implementation: NPCs move one Zone sector and preserve their current visibility, without creating Tiles, processing artwork or hiding tokens. The original eligibility, HUD toggle, bulk controls, Wander Now, frequency and Party-entry protections remain.

Existing hidden tokens are **not** revealed automatically. Existing marker Tiles are **not** deleted on startup. GMs can use the [confirmed one-time legacy cleanup macro](https://github.com/paddirn/myz-sector-manager/blob/main/docs/legacy-marker-cleanup.md) on each affected Scene to remove only known module-owned markers and obsolete state, without moving or revealing tokens. Unknown/remaining legacy data is inert.

## Settlement sectors

Choose **Settlement** when creating a sector to track an inhabited community through **Overview, Projects, Inhabitants, Factions, Events, Threads, Shop**. It uses the existing editor window and GM-only Journal storage, with Scene-specific Settlement coordinates. Official MYZ Ark Project Items are linked, with independent progress per Settlement; the Shop uses a single categorized inventory of live Foundry Item references. No source Items, Ark statistics or character resources are modified.

Settlements have a configurable map border and skip Normal sector Travel/weather/Macro entry checks. Wandering uses the shared Special/Settlement destination option. Normal and Special records remain intact; confirmed type changes preserve inactive content.

See [Settlement instructions, data model and manual Foundry checks](https://github.com/paddirn/myz-sector-manager/blob/main/docs/settlement-sectors.md). All edits use **Save Sector**; no release is published by creating the feature PR.

### Shop inventory and Actor Info imports (0.1.32)

The Settlement Shop has custom groups and type-specific columns; General uses **Item, Cost, Req., Weight, Comment**. Drop Foundry Items of any type into groups; values come from their source documents. Use the group controls to reorder, move, replace or remove references, and **Refresh Items** to see source updates. Old merchant inventories become groups, with complete previous records retained in a downloadable recovery backup.

All three Inhabitants interfaces accept world/Compendium Actors on their blank area. Imports copy the Actor name, portrait and the actual MYZ Info-tab narrative into an editable, safely formatted snapshot. Existing descriptions and unrelated campaign fields are retained; duplicate Actors select their existing entry. Source changes never overwrite campaign edits. Actor/Shop drops save their collection; other edits use Save Sector. See the [mapping, migration and manual-check details](https://github.com/paddirn/myz-sector-manager/blob/main/docs/settlement-sectors.md).

### Shop group types and scrolling (0.1.33)

Shop groups now support **General, Weapons, Armor, Vehicles, Services** layouts and accept any Item type. Choose a type independently of the group name; missing source fields remain blank. Vehicles track **Land/Water** per Shop entry without changing the Item. Existing groups default safely to General.

Group headings are compact and inline editable. The heading and column labels stick together while the inventory scrolls; one bottom **Selection / Move / Replace / Remove** toolbar stays visible across every group. Delete appears only for empty groups. Item reorder arrows move existing rows in place, preserving selection, scroll position and collapsed groups. Smaller windows use a responsive toolbar. See the [field mapping and manual v14 checks](https://github.com/paddirn/myz-sector-manager/blob/main/docs/settlement-sectors.md).

### Settlement Shop drop/header fixes

Shop column headings use white text against their dark backgrounds. Drops use the configured Foundry v14 Item document resolver, supporting world, Compendium and embedded Item sources and supported native payloads without a direct UUID. Missing/inaccessible references and save failures have separate messages. Repeated drops retain group targeting through rerenders; all Item types remain accepted.

Before releasing, test in a backup Foundry v14 world: drop several world and Compendium Items into empty and populated groups, change group type, collapse/expand, close/reopen, and repeat. Check sticky white headings, fixed toolbar, source links and persistence. Automated tests simulate Foundry APIs; they do not constitute live Foundry testing.

### Settlement purchases, sorting and Factions (0.1.35)

Shop **Buy** announces an informational purchase to public Chat, using the existing Party Roster and source Item statistics/Cost. Integer price ranges roll once on confirmation; missing or barter-only prices prevent Buy. No resources or stock change. The default drop-group selector remains available without its redundant visible label.

Projects and Inhabitants display alphabetically without rearranging stored records; the Project Reference link remains as the sheet-opening control. Factions now have editable headings, a linked Actor portrait gallery and multiline Faction Info. Legacy faction fields are consolidated once and retained for recovery. Save Sector persists faction changes. See [Settlement documentation](docs/settlement-sectors.md) for migration details and manual Foundry v14 checks.

### Settings gear and portable sectors (0.1.36)

The **Sector Manager Settings** gear beside **+ New Sector** replaces the collapsible Zone tools section and keeps all its actions. Use **Export Sector** for a saved Normal, Special or Settlement record, or **Import Sector** to preview a local versioned JSON file at the currently selected Zone square. Occupied squares require explicit replacement confirmation; missing UUIDs are warned about and retained, and safe unknown fields are preserved separately. Only one sector is transferred at a time. No Actors/Items are created, resources changed, tokens moved or Macros executed.

Configure / Tracking now labels **Columns** as horizontal squares and **Rows** as vertical squares, including maps with vertically lettered coordinates; existing stored grid values and coordinate math are preserved. See [portable format, examples, migration behavior and manual Foundry checklist](docs/sector-portability.md) and the [JSON Schema](docs/sector-portable.schema.json).

### Generate sector JSON with external AI tools

Use the [authoritative field guide](docs/sector-json/SECTOR-JSON-GUIDE.md), [standalone Draft 2020-12 Schema](docs/sector-json/sector.schema.json), and [AI conversion instructions](docs/sector-json/AI-SECTOR-CONVERSION-INSTRUCTIONS.md). Complete fictional, document-free examples are available for [Normal](docs/sector-json/example-normal-sector.json), [Special](docs/sector-json/example-special-sector.json), and [Settlement](docs/sector-json/example-settlement-sector.json). The guide distinguishes validation from visible UI behavior, documents defaults and missing references, and explains why live Shop stock/Faction galleries need actual UUIDs. This documentation does not change the importer or module version.


### Player Roster and linked Ark fixes (0.1.39)

Player Shops now select only owned official MYZ characters in the existing **Party Roster**, checked again by the GM for each purchase/trade. Quantity controls are compact and centered. A Buy request posts only the selected character's request and Item name/exact listed price.

Linked Ark Overview shows current development values, live read-only population, and read-only Ark coordinates with grid/occupancy warnings. Existing manual population and Zone placement are preserved. Automatic placement uses the requested safe fallback: coordinates are displayed/validated, but no records are silently moved or replaced.

Embedded Ark Projects synchronize idempotently into read-only draft entries with native source opening and portable source metadata. Deleted/unavailable sources retain snapshots, manual Projects remain editable, and **Save Sector** persists changes. Source updates do not automatically write Journals. See the [data mappings, limitations and manual checks](docs/settlement-player-shop.md#ark-coordinates-and-projects-0139).


### Gear and Services, decimal trade requests and Projects (0.1.40)

The standalone player window is now named for its Settlement and shows portrait-based roster selection, Resource Trading first, the supplied Gear and Services introduction, and all shared GM Shop informational columns. Buy continues requesting exactly one Item. Positive decimal relative values and Booze (Dose) support all twelve exchange directions with exact rational arithmetic and visible minimum whole Give quantities. **Trade now posts a request for GM resolution only; it never changes character resources, stock, Items or Actor flags.** Old three-resource values are preserved, with Booze defaulting to 1.

Projects display in two columns, with highlighted Not completed entries first in stable order and Completed entries alphabetically afterward. Stored order/source data remain unchanged. Overview shows one Coordinates field, retaining the linked Ark's live read-only display and the existing safe placement fallback. See [configuration, limits and manual checks](docs/settlement-player-shop.md).

Settlement Shop UI refinements in 0.1.41: wider responsive Player Shop with portrait/resource selection beside the introduction, compact three-column trade requests, non-wrapping table headings, exact decimal GM rate steppers, and Shop-specific Vehicle Passengers text. See [Player Shop documentation](docs/settlement-player-shop.md). Trading and purchases remain chat requests only.

Version 0.1.42 adds Vehicle Actor Shop references/native statistics, enriched purchase-request links, system-computed character weight, and grouped Ark Projects with Work Points and checked completion synchronization. See [verified mappings, compatibility and manual testing](docs/shop-ark-projects.md).

Version 0.1.43 fixes Work Points parsing/editing, shows Ready to Complete without automatic completion, adds Not started Project grouping, and refines the four-column Player Shop trade layout and availability limits. See [current behavior and manual checks](docs/shop-ark-projects.md).

Version 0.1.44 labels purchase-request Weight/Comment and adds GM-requested blind party basic skill rolls. GM Script Macro: `await game.myzSectorManager.requestPartySkillRoll();`. See [verified mappings, security/lifecycle and manual Foundry checks](docs/blind-party-skills.md).

Version 0.1.45 fixes blind-party result presentation and live completion tracking: formatted GM-only MYZ dice cards, Completed rows, supported v14 application events, and one reusable management window. See [root causes and manual regression checks](docs/blind-party-skills.md#v0145-bug-causes-and-fixes).

### Campaign Log

GMs can open **Log**, immediately after **New Sector**, to record real-world
sessions and Party-token sector visits in a separate window. Choose an existing
Zone Map / Tracking group and click **Start Session**. The default recording lasts
150 minutes; override it per session or configure **Default Campaign Session
Duration** in Module Settings. Closing the window keeps recording active.
Use **+ Entry** for notes on the selected visit, review/correct completed history,
and **Export Log** for a JSON download. Campaign data lives in a separate GM-only
Journal and does not alter sector records or Foundry game time.
See [Campaign Log storage, recovery, export format, and live testing](https://github.com/paddirn/myz-sector-manager/blob/main/docs/campaign-log.md).

Campaign session numbers are editable: use **Edit Session Number** (for example,
change Session 1 to Session 20). New sessions use the highest existing number plus
one. The compact visit table shows local times with full timestamp tooltips and
calendar-day offsets; the wider notes panel shares the session title/number.

To start/stop recording without opening Log, create a **Script Macro**, usable by
the GM, containing:

```js
await game.myzSectorManager.toggleCampaignSession();
```

It uses the existing default duration and Party/Expedition configuration, and
updates any open Log window and toolbar indicator. With multiple groups, it reuses
the last session's still-configured group, or a uniquely named Party group. If
ambiguous, start one session from Log to choose the group before using the macro.

Campaign Log also records actually triggered Travel Events as editable notes on
their exact destination visit while recording is active. Processed event IDs
prevent replay duplicates, including after note edits/deletion. **Delete Session**
removes the selected session after confirmation; active recording requires a
second explicit stop/delete confirmation. The sector sidebar now separates names
from metadata and uses matching solid bars for Special and Settlement sectors.
The Zone overlay dims empty coordinates and distant grid edges while preserving
recorded neighborhoods and map interactions.
See [Travel notes, session deletion, fading, and manual checks](https://github.com/paddirn/myz-sector-manager/blob/main/docs/travel-log-overlay.md).

### Shared entry UI foundation (0.1.49)

Normal, Special, and Settlement cards share header/body rendering and accessible
collapse handling, while Factions, Projects, Images, and Shop retain their special
controls and existing save policies. Inhabitant indicators now use the active
sector type's collection; Special gear indicates presence without introducing a
Collected state. Saved custom dropdown choices remain selected and are labeled
Legacy/custom value until explicitly replaced. Avatar standardization is deferred.
See [Phase 0/1 compatibility, extension points, and manual checks](https://github.com/paddirn/myz-sector-manager/blob/main/docs/ui-standardization.md).

### Unified Inhabitant portraits and scroll preservation (0.1.50)

Normal, Special and Settlement Inhabitants now share compact header avatars and larger previews. Linked Actor portraits take precedence over the editable **Saved Portrait (fallback)**, followed by a shared silhouette. Use **Choose Portrait** or type an image path, then **Save Sector**. Actor image updates refresh portraits without changing saved narrative snapshots or Actor documents.

Sector Manager preserves sidebar and editor/nested-panel scroll positions during ordinary rerenders, including saving and reference hydration. Positions are local to the current window; nothing is added to sector records. See [Phase 2 architecture, safeguards and manual Foundry checks](docs/ui-phase2.md). The focused browser check is `node tests/ui-phase2-browser.cjs` (requires the same Playwright/Chromium setup as the other browser checks).

### Shared entry actions and unsaved-change protection (0.1.51)

Collection headers now use context-specific Add controls and shared Expand All / Collapse All buttons. Entry removal identifies the record and offers **Remove** or **Cancel**, defaulting to Cancel. Removal retains its existing Save Sector requirement; linked Ark Projects remain protected.

Closing or leaving a dirty Normal, Special or Settlement sector offers **Save Changes**, **Discard Changes**, or **Cancel**. A failed save keeps the draft open. Discard cannot undo completed collection autosaves or native Ark writes. Footer messages distinguish whole-sector saving from collection-only saves, and detected remote edits block a full save for review. See [Phase 3 audit, architecture, persistence boundaries and manual checks](docs/ui-phase3.md). Run `node tests/ui-phase3-browser.cjs` for the focused interactive dialog checks using the existing browser-test setup.

### Gear & Artifacts and Events presentation (0.1.52)

Normal Loot and Special Gear now share Item fields, card layout, labels and empty states. Normal quantities support zero and decimals (`step="any"`); Special Gear keeps positive whole quantities. Collected/consumables remain Normal-only. Nonempty custom Item types stay selected as legacy/custom choices. Reference hydration leaves stored Item classifications unchanged; explicit assignment keeps the existing inference behavior.

Special and Settlement Events share Event Title and Description controls while keeping their own reference/status/trigger/outcome/related/GM-note fields. Existing saves, collection drops, removal confirmations, scroll/focus and unsaved-change protection remain. See [Phase 4B details, changed files and backup-world checks](docs/ui-phase4b.md). The focused check is `node tests/ui-phase4b-browser.cjs`, using the existing browser-test setup.

### Shared references, drop feedback and image previews (0.1.53)

Reference fields now share typed links, loading/missing/inaccessible/invalid states and **Attach or replace reference** controls. Attach accepts a Foundry UUID or you can keep dragging documents onto fields. Existing UUIDs and authored snapshots stay intact when a source is unavailable. Macro links open the editor; Scene links use GM-local viewing. Ordinary reference hydration does not block entry editing or save data.

Document drops show local validation/progress feedback while retaining existing import, duplicate and collection-save rules. Image previews and FilePickers share safe loading/error handling, with the same Actor → saved portrait → silhouette policy for Inhabitants. See the [behavior matrix, architecture, changed files and live Foundry checklist](docs/ui-phase4a.md). Run `node tests/ui-phase4a-browser.cjs` using the existing browser-test setup for focused reference interactions.

### Final interface consistency pass (0.1.54)

Collection headings, empty messages, toolbar spacing, field sizing, reference
buttons and image presentation now share scoped styling across sector types.
Inhabitant name labels align, keyboard focus is visible, and narrow toolbars wrap
while specialized Projects, Factions, Shop and Images retain their controls.
Existing records and save behavior are unchanged. See [Phase 4C audit, changed
files, intentional exceptions and manual checks](docs/ui-phase4c.md). Run
`node tests/ui-phase4c-browser.cjs` for the 22-tab responsive browser check.

### Final regression and portable JSON compatibility (0.1.55)

Portable format/schema **1** is retained. Empty Settlement imports now use
deterministic defaults, colliding Shop IDs fail before writes, and incomplete
extension records produce clear validation errors. Reference previews use the
same permission checks as the editor. Missing Faction links and existing Special
Gear quantity normalization are reported without changing gameplay rules.
See the [Phase 5 field coverage, fixes, regression results and live Foundry
checklist](docs/ui-phase5.md). The focused editor check is
`node tests/ui-phase5-browser.cjs`.
