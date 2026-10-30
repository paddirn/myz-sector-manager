# Phase 2: Inhabitant portraits and scroll preservation (0.1.50)

## What changed

Normal Encounters, Special Inhabitants and Settlement Inhabitants use one avatar controller, header slot, silhouette and portrait editor. Headers use a compact 36px frame; expanded entries show a 144px preview. Both use `object-fit: contain` so portraits keep their proportions. Collapse controls, names, status/type fields and Settlement relationships remain independent.

The effective image is a readable linked Actor's safe, non-placeholder image, then the saved `portrait`, then a local inline silhouette. Known Foundry defaults (`mystery-man.svg`, `unknown.svg`, and `CONST.DEFAULT_TOKEN`) do not hide saved portraits. An image-loading error tries the next candidate. Header and preview always share that choice. World and Compendium Actor references use the existing resolver; Journal-backed Normal encounters use the saved image or silhouette.

**Saved Portrait (fallback)** accepts a path or **Choose Portrait**. Editing changes the draft immediately and uses Save Sector. It never changes an Actor. A live Actor image can remain visible while a different saved fallback is edited. Existing explicit Actor imports still fill eligible empty fields using the existing importer; merely displaying/updating an avatar does not import anything. Names and narrative snapshots are never refreshed by portrait hooks.

`updateActor` and `deleteActor` refresh only matching cards. Generation guards reject stale image errors; newer Actor updates supersede older reference resolutions. FilePicker callbacks are ignored after navigation, replacement or closing. Hooks/listeners are removed when the application closes. UUIDs remain saved even when their documents disappear.

## Why the sidebar jumped

`SectorManager._replaceHTML` called `content.replaceChildren(result)` for the whole `.sm-root`. That destroys `.sm-list` along with the editor. Its replacement starts at scrollTop zero. This full-root replacement predates Phase 1; Phase 1 did not introduce it. A baseline browser reproduction selected a visible sector halfway down the list and failed with actual `0`, expected `2206`.

`ScrollKeeper` now snapshots immediately before replacement, rather than before asynchronous reference hydration. A user who scrolls while hydration is pending therefore keeps their latest position. Positions remain client-only, never in Journal flags or settings. The sidebar and tab strip have global semantic keys; editor/nested panels are scoped by sector/tab and stable entry or Shop group identities. Field keys exclude changing entry indices. The main editor and Shop inventory can retain the first visible stable entry as an anchor when entries above it change.

Restoration runs after insertion, clamps both axes, and restores field focus/caret without scrolling. Hidden or image-constrained panels retain a pending position until layout/load/toggle/ResizeObserver events make it reachable. Wheel, touch, pointer, navigation-key or newer scroll activity cancels pending restoration. There are no restoration timers. Fixed portrait frames prevent asynchronous images from changing card heights. In-place alphabetical sorting uses the same capture/restore mechanism. Existing explicit duplicate-entry and Shop selection navigation releases pending restoration before moving the viewport. Ordinary Shop additions preserve position; duplicate selection remains explicit navigation.

Tracked areas include the sidebar, tab strip, main editor, settings menu, Shop inventory/group bodies, faction galleries, description/image previews and textareas. Main scroll can be restored per sector/tab; navigating to unseen content starts normally. Native clamping handles shorter content and resizing. Collapse/expand updates existing DOM and preserves normal browser positioning without rebuilding cards.

## Compatibility

No collection, schema version, entry ID, UUID, saved portrait format, import/export format, Actor data or Journal storage layout changes. Normal encounter status/type, Special authored content, Settlement role/disposition/faction/notes, collection autosaves, Save Sector, native Ark Projects, Shop stock, Campaign Log and Travel Events retain their existing behavior. Portrait display does not create a second Actor importer or refresh descriptions.

## Validation and manual checks

Automated checks include all Node suites, the existing application/browser suites and a focused real-DOM Phase 2 suite. The latter covers all three portrait modes, Actor/saved/default priority, inaccessible/Journal/unsafe sources, image failures, stale errors/pickers, update/delete hooks, focus, hook cleanup and no Actor writes; scroll tests exercise both axes, nested textareas, hidden panels, shorter-content clamping and newer user intent. The full application suite checks middle/bottom sidebar positions, tabs, replacement during delayed reference hydration, editor saving/rerendering, existing collapse/drop/dedup/sorting/Shop/Project workflows, and draft-only portrait edits with retained narrative snapshots.

These tests simulate Foundry APIs; they are not a live Foundry v14 session. Before release, verify in a backup world:

1. Scroll a long sidebar to its middle and bottom; select Normal/Special/Settlement sectors and tabs. Confirm selection styling and unchanged sidebar position.
2. In long collections, expand/collapse, edit/save, add/remove and drop Actors while scrolled down. Confirm approximate location, alphabetical sorting, duplicate navigation, valid clamping after removals and preserved focus.
3. Test long image descriptions, nested previews/textareas, Faction galleries, Project status changes, Shop edits/drops/group collapse and narrow/resized windows. Check horizontal as well as vertical positions.
4. Test world and Compendium Actors, default/missing images, inaccessible/deleted Actors, manual path edits and FilePicker. Both avatar sizes should agree; images must retain proportions.
5. Save/reopen/import older records with custom portraits, names, narrative snapshots and unknown fields. Check specialized fields and Journal-backed Normal references. Verify no Actor updates were written.
6. Change a linked Actor image in another sheet while editing a text field. Only the matching portraits should refresh; focus and scroll must remain. Close/reopen several times to check hook cleanup.
7. Check the native Foundry window lifecycle, scrollbar dragging, asynchronous remote images and resize behavior under the world's active modules/theme. Confirm Ark, player Shop, Campaign Log and Travel Events remain functional.

No release or version tag is created by this implementation task.

### Implementation map and executed results

- `scripts/ui/inhabitant-portraits.mjs`: shared markup, source policy, image-error chain, delegated editor/FilePicker behavior, targeted Actor hooks and lifecycle guards.
- `scripts/ui/scroll.mjs`: semantic keys, client-only snapshots, visible-entry anchors, focus/caret restoration, clamping and lifecycle/user-intent handling.
- `scripts/sector-manager.mjs`: capture/restore at root replacement, shared Normal/Special rendering, reference hydration and controller lifecycle; shared portrait sizing.
- `scripts/settlement-ui.mjs`: Settlement header and expanded portrait integration.
- `scripts/inhabitants-ui.mjs`: reuse shared portrait hydration, retain existing import workflow and explicit duplicate navigation.
- `scripts/entry-order.mjs`: preserve view state around in-place Inhabitant/Project sorting.
- `scripts/settlement-shop-ui.mjs`: coordinate existing Shop state with current generic snapshots; preserve explicit duplicate/selection navigation.
- `scripts/ui/entry.mjs`: collapse focus uses `preventScroll`.
- `tests/ui-phase2.test.mjs`, `tests/ui-phase2-browser.cjs`, `tests/sector-manager.test.mjs`, `tests/interface-browser.cjs`: policy, identity, component and complete application regressions.
- `module.json`, `README.md`, this document: prepare 0.1.50, package both modules and document behavior/manual checks.

Executed locally: **489/489 Node tests**, all **nine browser scripts** (interface, ui-phase2, overlay with real PIXI/WebGL, party-skills, player-shop, campaign-log, travel, document-reference and wandering), release packaging/syntax checks, `actionlint`, both JSON Schemas and their examples, ZIP integrity and byte-for-byte ZIP-root manifest/current-module checks. All passed. Baseline Node suite was 486/486 before implementation; the sidebar regression was reproduced failing before the fix. No live Foundry testing or release publication was performed.
