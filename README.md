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
- Optional single-Scene Zone grid, passive GM overlay, map-cell selection, and Ark/expedition tracking are implemented in separate helpers. Configuration and last-known positions live in a separate GM-owned Journal, not in existing sector flags.

## Zone Scene setup (optional)

You can keep using Sector Manager without configuring a map. No extra Actors, tokens, or sectors are created automatically.

1. Open Sector Manager as a GM. Expand **Zone Map / Tracking** beneath the main toolbar, then click **Configure / Tracking**.
2. Choose the one **designated Zone Scene**. Click **View selected Scene** to display it on your GM canvas; this does not activate it for players.
3. In **Reconfigure Grid**, enter a reference coordinate, for example **A1** or **B3**. Origin X/Y is that sector's **top-left corner in Scene canvas pixels**, using the same coordinate system as token documents, including the Scene's padding. For easier calibration, use **Calibrate Grid** as described below. The one-point **Pick reference corner on canvas** remains available for origin-only adjustment. Escape cancels either tool. Pan/zoom are converted back to Scene coordinates.
4. Set independent **sector width/height** in pixels or Foundry grid cells. For example, with 100px tactical cells, a 5 × 4 cell Zone sector is 500 × 400 pixels. Cell units use the selected Scene's grid pixel width/height; the saved configuration always uses fixed pixels. One Zone sector need not equal one tactical cell.
5. Set the total **Columns** and **Rows** of your Zone map (each 1–1,000). Coordinates range from A1 through those counts: A=1, Z=26, AA=27. The reference cell must be inside that range. Default orientation increases letters to the right and numbers downward. Reversing either direction or swapping lettered columns to the vertical axis is supported.
6. Optionally enable the overlay, boundaries, coordinate labels, and subtle exploration-status colors. Labels are capped at 2,000 to keep very large maps responsive. The rectangular Zone grid is clipped to the Scene area; it never changes fog or exploration.
7. Set the **Fixed Ark location** by selecting an existing sector or entering a coordinate such as A1 or AA12. **Clear Ark location** removes the designation. No Ark token/Actor or sector record is needed. Set **Kilometers per sector** if your map differs from the default 1.6 km. Add expedition groups with names and existing Scene tokens (one assignment per token), plus optional dropped world/compendium Actor references. No Actor or token is created.
8. Click **Save Zone configuration**. Closing or Cancel discards unsaved configuration. The module creates a separate **MYZ Zone Map Configuration** Journal with default ownership None; do not share or delete it if you want to retain configuration/tracking. Only its ID is stored in a hidden world setting. Back up this Journal along with your world.

The compact Zone header shows the fixed Ark coordinate and expedition coordinates/distances. Group positions are **live** when the Zone Scene is displayed, or **last known** otherwise. An unassigned Ark is optional. Missing tokens/Scenes and off-map positions show a clear state while retaining the last valid coordinates. A deleted/unavailable configuration Journal is reported; existing sector records are unaffected.

### Select sectors on the map

1. View the designated Zone Scene and expand the Zone header.
2. Click **Select on map**, then click one cell. It is a one-shot tool; Escape cancels. The overlay itself never intercepts token selection, dragging, or panning.
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
- **Find the Path** contains the main success benefit, seven standard stunts (Core Rulebook p. 56), and a separate **Talent Stunts** section starting with Rot Finder (p. 64). Checkboxes save automatically per sector, including when switching records or closing the application. **Reset Stunts** asks for confirmation and clears this sector's defined checkboxes. Other unsaved edits still use **Save Sector**. These are records for the current visit/exploration: p. 56 limits each stunt to once per roll; p. 160 also limits repeat-search stunts to once per sector. The GM controls resets; checkboxes do not enforce these rules. Leaving a sector never resets them. Checking them awards no resources and changes neither Rot nor travel time.
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

Generated Normal and Industrial ruins preserve existing Journal Entry and Journal Entry Page UUIDs, including world/compendium references. Locations now accepts these document types alongside existing Scene references, using the same native document links and drag/drop/open/clear controls. Text-only ruin results search for an exact, unique Journal Entry name in accessible world journals and Journal compendium indexes; matching documents are referenced, never imported. Ambiguous matches, incomplete searches, or missing references keep the ruin title with a visible nonblocking warning in the preview and Locations entry. A broken explicit reference is not replaced by an unrelated same-name journal. Table provenance retains its original UUID. Other randomizer tables keep their existing strict error handling.

Consumables now spans its available area with two balanced columns: Clean/Rot Grub and Clean/Rot Water on the left; Bullets, Booze, and Components on the right. The columns stack on narrow content widths. Quantities, collected flags, their storage fields, and all resource probabilities remain unchanged.

A subtle rust-colored highlight marks an entire row while quantity is positive and uncollected. Editing quantity/collected state updates the highlight immediately. The keyboard-accessible Consumables header collapses only this panel, leaving regular Loot entries visible. The initial state collapses when everything is zero or collected; transitioning from outstanding resources to none also collapses, and newly outstanding resources expand it. A manual toggle persists as per-sector client-session UI state until the availability condition changes. Manually opening an all-zero/all-collected panel does not immediately close it again. Confirmed randomization re-evaluates the default state so new uncollected supplies are visible. No collapse state is stored in sector data.

After updating in a backed-up Foundry v14 world, verify world/compendium ruin journals and pages open from Locations and survive reopening; test an unresolved/ambiguous journal warning without losing generated data. Check both panel columns and narrow stacking, highlights, collecting the last outstanding resource, manual reopening, and expansion after new randomization. Actual licensed Foundry and world tables are not live-tested in the cloud.

### Threat options and Journal organization (0.1.11)

The Randomize options dialog now has two separate selectors: **Randomization Method** (Core Rulebook Tables) and **Threat Generation**. Threat Generation defaults to **Core Rulebook (Default)**: a qualifying shared Base Dice pool produces exactly one threat identity and stores the number of 1s as severity. **Multiple Threats (House Rule)** instead rolls 1d3 separate identities after that same qualifying pool, independently selecting Threat Type and subtype for each. Both honor Threat eligibility and generate artifacts only from eligible 6s in the original pool. Neither produces threats without an eligible 1. An identity roll yielding several ambiguous final documents aborts rather than silently creating extra Core threats. The selector reuses the existing persistent world `threatGenerationMode` preference, so the last choice is shared by GMs; the initial setting is Core. Canceling the options dialog does not change the preference.

On startup, the **active GM only** creates/reuses JournalEntry folders named **MYZ: Sector Manager** and its child **Sectors**. Existing module configuration/non-sector Journals go directly inside the root; a newly created configuration Journal is named **Configuration**, not placed in a Configuration subfolder. Existing configuration titles are preserved. Sector Journals go in **Sectors** and use **Coordinates - Terrain**, such as `A3 - Overgrown Ruins`. Missing coordinates use `-#`; missing terrain uses `Unknown Terrain`. Coordinates use the existing canonical formatter; stored coordinate values and document IDs are not rewritten.

One shared formatter drives new Journal names, save/randomization names, and sidebar labels. The sidebar and read-only name preview update while coordinates or terrain are edited; saving commits the standardized Journal name. Flagged imported/updated sectors are also organized by the active GM. Custom Journal display names are replaced by the requested standardized name, but Journal IDs/UUIDs, content/pages, flags, ownership, references, and other sector data are retained. Back up the world before applying this organization change.

The migration is repeatable: only incorrect names/folders are updated; already organized documents cause no writes. Ownership is established by the sector flag, configuration flag/setting ID, or another flag in this module's namespace. Unsupported sector versions are left untouched with a warning. Unrelated or unflagged Journals are never moved based on their title. The API `await game.myzSectorManager.migrateJournals()` lets the active GM rerun it and returns update counts, warnings, and IDs of untouched unowned Journals; another GM/player receives a skipped result. Folder creation is serialized within the active client and other GMs reuse existing folders. No Journal is deleted/recreated and no sector schema migration is required.

Cloud tests simulate creation/reuse, configuration placement, sector placement/naming, imports, active-GM gating, preserved UUIDs/content/flags/ownership, unrelated Journals, and an idempotent second pass. They do not migrate a real Foundry world. After updating in a backup world, confirm the folder tree and Journal/sidebar names, stable links, name changes after editing/randomizing, and both threat modes with unchanged artifact counts. Actual world migration and licensed Foundry v14 APIs remain unverified live here.
