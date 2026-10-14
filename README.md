# MYZ Sector Manager v0.1.3

Foundry VTT v14 GM-only Journal-backed sector editor.

## Forge installation

1. In The Forge / Foundry Setup, install the module using this manifest URL:
   `https://github.com/paddirn/myz-sector-manager/releases/latest/download/module.json`
2. Enable the module in a Foundry v14 test world.
3. Create a Script Macro: `await game.myzSectorManager.open();`

Version 0.1.2 is already released; version 0.1.3 will become available only after its tag is authorized and the workflow succeeds. For later releases, use Foundry's module Update control; no manual ZIP upload is needed. If an older installation uses a raw GitHub manifest URL, reinstall it using the stable URL above. Back up the world first.

## Features
- GM-only Journal Entry sector records, searchable selector, tabbed editor.
- Overview, Locations, Encounters, Loot, Effects (weather/phenomena/special effects), Secrets, History.
- Data stored in `flags.myz-sector-manager.sector`.
- API: `game.myzSectorManager.open(journalId)` and `game.myzSectorManager.getSector(journalId)`.

## Caveats
Prototype not yet tested in a live Foundry v14 world. Back up your world first.
Native Journal windows do not automatically use the Sector Sheet. Zone integration is optional and GM-only. No import or player view is provided.

## Version 0.1.3 (prepared)

- Consumable quantity fields are 38px wide with centered decimal values. Native collected checkboxes use explicit theme-aware contrast and lighter alternate-row shading; saved quantities and states are unchanged.
- Effects now supports native Actor references (for Zone Phenomena), with drop, replace, open, and clear behavior alongside category/duration and collapse controls.
- **+ New Sector** sits immediately after **Delete Sector** in the main toolbar, including when no sector is selected. The sidebar contains search and naturally sorted sector records, restores the full list when search is cleared, and shows a no-matches message.
- Optional single-Scene Zone grid, passive GM overlay, map-cell selection, and Ark/expedition tracking are implemented in separate helpers. Configuration and last-known positions live in a separate GM-owned Journal, not in existing sector flags.

## Zone Scene setup (optional)

You can keep using Sector Manager without configuring a map. No extra Actors, tokens, or sectors are created automatically.

1. Open Sector Manager as a GM. Expand **Zone Map / Tracking** beneath the main toolbar, then click **Configure / Tracking**.
2. Choose the one **designated Zone Scene**. Click **View selected Scene** to display it on your GM canvas; this does not activate it for players.
3. In **Reconfigure Grid**, enter a reference coordinate, for example **A1** or **B3**. Origin X/Y is that sector's **top-left corner in Scene canvas pixels**, using the same coordinate system as token documents, including the Scene's padding. For easier calibration, click **Pick reference corner on canvas**, move the dialog aside if necessary, then click once on the map. Escape cancels the tool. Pan/zoom are converted back to Scene coordinates.
4. Set independent **sector width/height** in pixels or Foundry grid cells. For example, with 100px tactical cells, a 5 × 4 cell Zone sector is 500 × 400 pixels. Cell units use the selected Scene's grid pixel width/height; the saved configuration always uses fixed pixels. One Zone sector need not equal one tactical cell.
5. Set the total **Columns** and **Rows** of your Zone map (each 1–1,000). Coordinates range from A1 through those counts: A=1, Z=26, AA=27. The reference cell must be inside that range. Default orientation increases letters to the right and numbers downward. Reversing either direction or swapping lettered columns to the vertical axis is supported.
6. Optionally enable the overlay, boundaries, coordinate labels, and subtle exploration-status colors. Labels are capped at 2,000 to keep very large maps responsive. The rectangular Zone grid is clipped to the Scene area; it never changes fog or exploration.
7. Choose an existing **Ark token** from that Scene, if desired. Add one or more **expedition groups**, supply display names, and choose their existing Scene tokens. Each token can be assigned once. Drop an optional world/compendium Actor onto a group's Actor area if useful. No duplicate Actor or token is created.
8. Click **Save Zone configuration**. Closing or Cancel discards unsaved configuration. The module creates a separate **MYZ Zone Map Configuration** Journal with default ownership None; do not share or delete it if you want to retain configuration/tracking. Only its ID is stored in a hidden world setting. Back up this Journal along with your world.

The compact Zone header shows Ark/group coordinates and whether they are **live** (the Zone Scene is currently displayed) or **last known**. An unassigned Ark is optional. Missing tokens/Scenes and off-map positions show a clear state while retaining the last valid coordinates. A deleted/unavailable configuration Journal is reported; existing sector records are unaffected.

### Select sectors on the map

1. View the designated Zone Scene and expand the Zone header.
2. Click **Select on map**, then click one cell. It is a one-shot tool; Escape cancels. The overlay itself never intercepts token selection, dragging, or panning.
3. If a record has the matching **Sector ID / Coordinates**, it opens in Sector Manager. Matching is case-insensitive and treats labels such as `A-07`, `a7`, and `A007` as the same cell; stored labels remain unchanged. Multi-letter coordinates work.
4. If the cell is empty, you are asked whether to create one GM-only sector record. Cancelling creates nothing; no map cells are automatically populated. If multiple existing records share a coordinate, the module warns and opens the first; the sidebar remains available to choose another.

The sidebar and all tabs work normally while viewing combat or other Scenes. Only the designated Zone Scene can show the overlay or respond to map selection. Use **Show/Hide overlay** at any time. To intentionally recalibrate, reopen **Configure / Tracking → Reconfigure Grid**; viewing another Scene never changes saved origin/dimensions. Changed Scene dimensions or tactical grid size produce a warning rather than silently rescaling. Changing the designated Scene requires confirmation and replaces the old token assignments; it does not delete sector records. **Disconnect Zone map** removes integration assignments only.

### Tracking rules and persistence

- Scene-specific token IDs and the designated Scene ID are stored for Ark and expedition groups. Token **centers**, calculated from source token documents and that Scene's grid metrics, determine coordinates; screen zoom and token render animations do not.
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

The Node tests cover coordinate normalization and grid boundaries, reversed/swapped axes, multi-letter coordinates, token centers/crossings, last-known persistence, Scene isolation, missing references, GM authority, overlay/picker cleanup, and the earlier sorting, reference, consumable, and collapse regressions. Foundry APIs are simulated.

An optional Chromium layout/interaction test is available with a separately installed Playwright package and Chromium (no application dependency):

```sh
node tests/interface-browser.cjs
```

It uses the system `/usr/bin/chromium` when available; otherwise Playwright's installed Chromium, or an executable specified by `MYZ_CHROMIUM_PATH`. It models ApplicationV2's frame and content slot and mocks Foundry's document APIs. It checks mouse-wheel scrolling, independent sidebar search/restoration, resizing, 38px Consumables, Effects references, collapse interactions, Zone configuration/unit conversion, token assignments, origin picking under zoom, map creation confirmation, overlay isolation, tracking with the window closed, and missing Scenes/tokens. PIXI rendering and Foundry APIs are mocked. It does not establish live Foundry v14 behavior and is not included in the dependency-free release job.

Live Foundry v14 validation is performed by the user in a backup world. Verify:

1. Resize the manager wide and narrow; use the mouse wheel through every tab and a long sector list. Confirm tabs and Save remain visible and long names wrap.
2. Check old decimal quantities and collected states in Consumables, change values, save, and reopen.
3. Drop world and compendium documents into the appropriate reference areas; use mouse and Enter to open native links. Replace/remove references and verify missing documents are indicated without losing their UUIDs.
4. Edit a card, collapse/reopen it, switch tabs, save, close/reopen the manager, and confirm data is retained. Check independent/bulk collapse and deletion without accidental toggling. New entries must start expanded.
5. Confirm pre-update sectors, loot, references, and unknown/custom fields remain intact, and player access remains restricted.

### Zone integration test checklist in a backup Foundry v14 world

1. Calibrate the Zone grid with a known reference, multi-cell dimensions, nonzero origin, and A2/A10/AA1 labels. Pan/zoom and verify boundaries, token-center coordinates, and map selection remain aligned. Confirm only the armed one-shot tool handles a map click.
2. Assign Ark and two expedition tokens. Cross one boundary, move within a cell, and move outside the configured range. Close Sector Manager, move again, reopen, then reload Foundry; verify live/last-known values and that no travel consequences or sector flags changed.
3. View a combat Scene and move similarly named tokens. Confirm Zone coordinates and saved grid do not change; return to the Zone Scene and verify overlay restoration. Test deletion/replacement/clearing of a tracked token and missing/unavailable Scenes.
4. Open existing sectors by map click, decline then accept creating one empty cell, and verify no duplicate/bulk sector creation. Confirm legacy coordinate labels and custom sector fields remain intact.
5. Verify players cannot see the overlay, configuration controls, or GM information. Test with two GM clients to verify active-GM persistence and native canvas compatibility. Check light/dark checkbox contrast, Effects Actor/compendium links, and all prior UI checks above.

Live Foundry canvas/PIXI behavior, actual v14 movement hooks (including your token shapes/grid type), native permissions, theme rendering, and multi-client synchronization cannot be proven by these local mocks and need this check before publishing.

## Publish a release (no manual ZIPs)

### One-time setup

1. Open the release-automation pull request on GitHub, review it, then click **Merge pull request** and confirm. This adds automation; merging alone does not publish anything.
2. Open **Settings → Actions → General**. Ensure GitHub Actions is enabled and GitHub-authored actions are allowed. This workflow uses `actions/checkout` and `actions/setup-node`.
3. The release job explicitly requests only `contents: write`. You normally do not need to change the repository-wide default workflow permission from read-only. If an organization policy blocks write permissions, an administrator must permit this workflow to write repository contents. No personal access token or paid service is needed: GitHub supplies the workflow token automatically.

### Publish this update: v0.1.3

1. Merge the Zone integration pull request into **main**. The current `module.json` already declares `0.1.3`, its stable manifest URL, and the matching ZIP download URL.
2. Test in your backup Foundry v14 world before publishing. Local tests cannot verify the live Foundry interface.
3. Ask Codex: **“Verify main contains the release automation and module version 0.1.3, run the checks, then create and push tag v0.1.3 at that main commit. Do not manually create a release; let GitHub Actions do it.”** This is a separate publishing authorization. Do not draft or publish a release through GitHub's Releases form first.
4. Open the repository's **Actions** tab and select **Release Module**. Wait for a green checkmark.
5. Open **Releases**. The `v0.1.3` release should contain **module.json** and **myz-sector-manager-v0.1.3.zip**. GitHub's additional source-code archives are not the installable module ZIP.
6. In The Forge / Foundry Setup, install or update through the stable manifest URL above. Test in your backup world and check that old sectors and loot remain intact.

If you prefer to push the tag yourself from a local clone with the merged main checked out:

```sh
git switch main
git pull --ff-only origin main
# Verify module.json says 0.1.3 and the automation is present first.
git tag v0.1.3
git push origin v0.1.3
```

### Every later release

1. Ask Codex to implement the changes on a feature branch, update `module.json` to the next version (for example `0.1.4`), set its `download` URL to `https://github.com/paddirn/myz-sector-manager/releases/download/v0.1.4/myz-sector-manager-v0.1.4.zip`, update version-specific documentation, run checks, and create a pull request. Keep `id` and the stable `manifest` URL unchanged.
2. Review and merge the pull request. Test the changes in your backup world.
3. Authorize Codex to push the matching version tag at the tested main commit, as above. Publish versions in increasing order: the workflow marks the new release as latest.
4. Watch Actions, check both release assets, then use Foundry's Update control.

### What the workflow checks

Only pushed tags matching `v*.*.*` trigger publication. The validator further requires an exact numeric `vX.Y.Z` tag matching `module.json`, the unchanged module ID and v14 compatibility, correct manifest/download URLs, present declared files, and valid JavaScript. All Node tests must pass. The ZIP contains `module.json` at its root, README.md, and the runtime files declared by the manifest. Development tests and release tooling are excluded. There is no build or dependency installation step.

For a local package check, run from the repository root (replace the tag with the actual manifest version):

```sh
node scripts/prepare-release.mjs v0.1.3
unzip -t dist/myz-sector-manager-v0.1.3.zip
unzip -p dist/myz-sector-manager-v0.1.3.zip module.json | cmp - module.json
```

`dist/` is ignored by Git. Packaging refuses to overwrite an existing ZIP: inspect and remove only the generated output before rebuilding.

### If something fails

Open the failed Actions run and read the first failing step, or send its log to Codex. A tag/version mismatch or missing file must be fixed in a new reviewed commit before publishing a new version. Do not move an existing release tag.

A repeated run for an existing release stops without changing that release or its assets. Concurrent runs for the same tag are serialized. If publishing creates a release but an upload fails, it may leave a partial release: inspect it before taking any action. The workflow never deletes releases or overwrites assets automatically. Ask for help recovering it, or publish a corrected new version. No release has been published by merely adding this workflow.
