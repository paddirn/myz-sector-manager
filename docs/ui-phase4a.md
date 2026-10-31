# Phase 4A: shared references, drop feedback and image previews (0.1.53)

Baseline: main `7c00fad`, version 0.1.52; **515/515 Node tests passed**, with no preexisting failures. The current Phase 1 cards, Phase 2 portraits/ScrollKeeper, Phase 3 actions/guard/save queue and Phase 4B content fields remain the foundations.

## Behavior matrix and audit

| Reference / storage | Allowed documents and presentation | Attach/import and save boundary | Opening / native writes |
| --- | --- | --- | --- |
| Normal Locations `locations[].uuid`; Special `special.locations[].uuid` | Scene, JournalEntry, JournalEntryPage; named native-style link, typed warnings | Existing reference attachment is draft-only; generated descriptions remain snapshots | Native Journal/Page view; Scene uses GM-local `view()` where available; no source write |
| Normal `encounters[].uuid` | Actor or Journal/Page; saved encounter title/details remain even if missing | Explicit Actor link imports eligible empty fields through the existing importer; duplicate selection retained; blank-area Actor creation autosaves only Encounters | Actor sheet / native Journal/Page link; no source write |
| Special / Settlement `inhabitants[].uuid` | Actor; shared link plus existing compact/larger portraits | Explicit linking preserves custom names/descriptions; blank-area drops autosave only that collection; manual edits use Save Sector | Actor sheet; no Actor image/description writes |
| Normal `loot[].uuid`; Special `special.gear[].uuid` | Item, including world/Compendium; manual title/type retained under existing override rules | Reference attachment/manual edits are draft-only; Special blank-area drops save that collection; Normal Collected saves Loot only | Native Item link; no Item write |
| Normal `effects[].uuid` | Actor or Journal/Page | Existing draft reference workflow; no new execution | Native document view |
| `effects[].macroUuid` | Macro | Existing trigger ID and checkbox/reset behavior retained; reference change is draft-only | **Editor only**, never Macro execution |
| Normal/Special `history[].uuid` | Existing unrestricted document slot | Draft-only attachment; History generation remains independent | Native supported document view; other editor-bearing types, including RollTables, use their sheet rather than executing a click action |
| `special.sceneUuid` | Scene | Draft-only | GM-local Scene view; never `activate()` |
| `special.events[].uuid` | JournalEntry / JournalEntryPage | Draft-only; authored title/details preserved | Correct native Journal/Page link |
| `special.images[].uuid` | Image-type JournalEntryPage with valid `page.src` | Reference edits are draft-only; existing blank-area page creation autosaves Special Images; metadata/preview collapse remains separate | Native Page link and shared safe preview; no page/path migration |
| `settlement.arkUuid` | Official MYZ Ark Actor | Existing typed UUID field, explicit drop validation and draft save workflow; source population/coordinates remain read-only | Existing Ark sheet; native source synchronization remains specialized |
| `settlement.projects[].uuid` and `arkSource` | Official MYZ Project Items, including embedded Ark Items | Existing Project assignment/import, status grouping, stable IDs and restrictions | Existing native sheet opening; **only the existing native status workflow** may write the Ark's embedded Project |
| `settlement.factions[].members[].uuid` | Actor, including native `fromDropData` support | Draft-only associations; duplicates rejected within a Faction but allowed across Factions; removal remains confirmed | Shared link/preview in the existing gallery; no Actor deletion/write |
| `settlement.shop.groups[].entries[].uuid` | Item; Vehicle Actor in Vehicle groups; existing legacy Vehicle Item display retained | Existing native drop resolver, group restrictions, cross-group moves, deduplication and whole-Shop drop save scope; manual edits/removals remain draft-only | Shared link in specialized inventory tables; no source Item/Actor writes |
| Document References world settings | Existing configured RollTables | Configuration/migration schema and validation/status contracts unchanged; shared permission-safe reads now precede reading a name | Existing sheet opening; never rolling during validation |
| Zone / Tracking `groups[].actorUuid` | Optional Actor | Existing configuration-only Actor association; Scene/token selectors stay specialized | Shared safe link/open behavior; portrait resolution uses the shared reader; movement/navigation services are unchanged |

Before this phase, standard fields repeated UUID validation, link enrichment and opening; Factions, Shop, Ark and Project views repeated resolution and warning/image logic. Stored references were not consistently checked against expected types on hydration. Standard fields had no explicit Attach/Replace action, and a slow standard reference could delay the whole content render. Gallery errors replaced images separately; permission checks could occur after reading a settings document's name.

## Shared architecture

- **`scripts/ui/documents.mjs`**: `requireDocument`, `resolveDocument`, `checkDocument`, native drag parsing, safe opening and view-lifecycle checks. Known fields enforce their existing document roles. Invalid/missing/inaccessible/unavailable states retain the original UUID. UUID screening rejects unsafe control/markup values without assuming a fixed number of UUID segments; actual world/embedded/Compendium resolution remains Foundry's responsibility.
- Only concurrent reads of one UUID share a Promise. Settled requests are removed, failures are not retained, and permission checks run for each consumer. No permanent cache of names, images or inaccessible documents is introduced.
- **`scripts/ui/reference.mjs`**: compact field markup, document-type icons, loading/empty/error states, safe DOM-built native-style links, keyboard/drag payload support, Attach/Replace UUID dialog and scoped update hooks. Source names are read only after access checks. Macros and other editor-bearing nonstandard types open their editor; Scenes use `view()` rather than global activation. Standard links re-resolve before opening.
- Attach/Replace uses the **existing domain drop operation** after a Cancel-default UUID dialog, including Actor import, Item inference and Ark/Project checks. Clear remains draft-only. Invalid replacements do not replace the previous stored UUID. The existing editable Ark UUID input is retained.
- Standard references hydrate asynchronously after markup construction, showing loading state while ordinary entry editing remains available. Specialized Settlement hydration and Ark synchronization retain their existing render lifecycle. Draft/root/request/UUID guards prevent late results from changing newer or destroyed views.
- Actor/Item/Journal/Page/Scene/Macro create/update/delete hooks refresh only matching standard fields or active Faction/Shop views; permission changes revalidate current standard fields. Existing native Ark/Project hooks remain specialized. Sector Manager uses the common Actor hook path instead of registering overlapping portrait hooks; standalone portrait consumers retain their own hooks. All new hooks/listeners are removed on close or replaced on rerender.

## Drops

**`scripts/ui/drop.mjs`** supplies local idle/candidate/valid/invalid/pending/completed/failed feedback, native payload parsing and role checks. Solid/dashed/dotted outlines, drop cursor feedback, accessible descriptions and busy state communicate outcomes without a new mutation system. If a browser hides drag payload metadata during hover, the target honestly says to drop for validation. Actual handlers always re-resolve and validate before mutation.

Standard fields, blank Inhabitants/Special content/Projects, Faction galleries and Shop groups retain their specialized handlers. Source Item/Actor class `fromDropData` contracts, importer eligibility, duplicate/move policies, save queues and scope guards are not replaced by a generic writer. Existing legitimate repeated references remain allowed. Feedback is ephemeral DOM state, not a sector edit. Drag cancellation clears hover state; completion does not force scrolling. Closing/navigating invalidates pending work. Clearing/replacing a field invalidates an earlier assignment, including an in-flight Actor Info import.

## Images and paths

**`scripts/ui/images.mjs`** supplies safe image creation, loading/ready/error states, generation guards and FilePicker validation. Settlement/overlay previews, Project images, Special Images, Faction galleries and both Inhabitant portrait sizes use it. Image errors from an older request cannot replace a newer preview.

The Inhabitant controller still owns the Phase 2 policy: readable non-placeholder Actor image → saved portrait → the same inline silhouette. Header/expanded preview agree, preserve their fixed sizes/aspect ratio and update immediately for manual edits or Actor changes. Saved portrait paths and narrative snapshots are not overwritten by display updates. Gallery layout, 100px thumbnail dimensions and member controls remain separate from card presentation.

`safeImageSource` remains display validation; `imagePath` remains persistence validation, excluding embedded data/blob paths. Image-type Journal Pages use the native `src`, not caption metadata. Display DOM URLs are never copied back to persisted fields. FilePicker callbacks retain draft/entry/lifecycle checks. Initial natural-size Special Images can still change content height as they load; existing browser anchoring and ScrollKeeper remain responsible for preserving visual context, with no timeout-based scrolling.

## Compatibility and save boundaries

No schema migration, generic reference record, rewritten UUID, image-path migration, new dependencies or Phase 4C/5 work. All collection paths, stable IDs, unknown fields, portable schemas, type conversion, custom names/descriptions, generated snapshots, Phase 4B quantity rules, Collected state/consumables, Faction associations, native Ark Projects, Player Shop permissions, Campaign Log and Travel Events are preserved.

Reference hydration/opening, permission warnings, image loading and hover feedback do not mark dirty or save. Explicit reference edits use existing dirty tracking. Eligible blank-area drops, Shop drops and Normal Collected retain their existing collection save scopes; completed source Ark writes remain non-reversible by Discard. Save/Discard/Cancel and optimistic conflict checks remain unchanged. Snapshot text is never silently refreshed from a document. Native source Project synchronization remains an intentional specialized exception to ordinary authored snapshots.

## Changed files

- `scripts/ui/documents.mjs`, `reference.mjs`, `drop.mjs`, `images.mjs`: four shared, read/view-only infrastructure helpers.
- `scripts/sector-manager.mjs`: standard fields, Attach/Replace, nonblocking hydration, lifecycle/assignment guards, shared images, hooks and local feedback.
- `scripts/inhabitants-ui.mjs`: shared parsing/resolution/feedback plus importer cancellation; existing creation/link policy retained.
- `scripts/ui/inhabitant-portraits.mjs`: common preview/picker primitives; unchanged priority and snapshot rules; avoid overlapping Actor hooks.
- `scripts/settlement-factions.mjs`, `settlement-factions-ui.mjs`: safe Actor resolution and specialized gallery/link/feedback adapters.
- `scripts/settlement-shop.mjs`, `settlement-shop-ui.mjs`: safe native drop resolution, specialized live tables/shared links and feedback. Inaccessible source cells are cleared rather than retaining previously displayed private values.
- `scripts/settlement-ui.mjs`, `settlement-ark.mjs`: safe Project/Ark reads and opening, shared preview/picker and lifecycle checks; domain source writes remain in their original service.
- `scripts/document-references.mjs`: permission-safe settings validation without reading restricted names.
- `scripts/zone/config.mjs`, `zone/runtime.mjs`: safe tracking Actor links/reads; configuration and movement behavior retained.
- `tests/document-ui.test.mjs`, `tests/ui-phase4a-browser.cjs`: focused read/state/permission/cache/open/drop/image/stale-result checks.
- `tests/sector-manager.test.mjs`, `tests/interface-browser.cjs`: adapted shared-link mocks, intentional warning/icon expectations, safe stale assignment regression and browser fixture reuse.
- `module.json`, `README.md`, this report: prepare 0.1.53, package all four helpers and document behavior.

## Validation and live verification

Baseline: **515 Node tests, no failures**. **Final results: 523/523 Node tests and all twelve browser scripts passed.** Syntax, release packaging, actionlint, both JSON Schemas/examples, ZIP integrity, root manifest and all declared runtime-file comparisons passed. No preexisting failures were found. Commands include:

```sh
node --check scripts/sector-manager.mjs
node --test tests/*.test.mjs
node tests/ui-phase4a-browser.cjs
node tests/interface-browser.cjs
# All existing ui-phase2/ui-phase3/ui-phase4b, overlay, party-skills,
# player-shop, campaign-log, travel, document-reference and wandering suites.
node scripts/prepare-release.mjs v0.1.53
unzip -t dist/myz-sector-manager-v0.1.53.zip
```

Workflow lint, both JSON Schemas/examples, ZIP-root manifest and byte comparisons for every declared runtime module are also checked. Browser tests model Foundry APIs; they are not live Foundry v14 testing. The new focused checks cover permission-safe states and settings names, live updates/deletion, native mouse/keyboard and Macro safety, nonblocking/changed/cleared references, local drag feedback, Attach/Cancel/Clear, snapshot/draft scope and stale image generations. Existing suites cover the specialized collection/drop/dedup/portrait/native Ark/Shop/import/export behavior.

In a backup official MYZ v14 world:

1. For each matrix row, test valid world/Compendium/embedded documents, invalid/wrong-type/missing references and revoked permissions. Confirm warnings retain UUIDs and snapshots, restricted source names/images disappear and unrelated editing remains usable.
2. Open Actor, Item, Journal, specific Page, Scene and Macro references with mouse and keyboard. Confirm Macro editor only and GM-local Scene view. Test Attach/Replace/Cancel/Clear, including clearing or changing a slow reference and closing the manager during resolution.
3. Test local valid/invalid/unknown-payload drag feedback, failed-drop retry, Inhabitant imports/dedup, Faction gallery drops and Shop moves/Vehicle restrictions. Verify the exact existing collection autosave scopes and Save/Discard/Cancel with unrelated dirty notes.
4. Test Actor/saved/silhouette portraits, failed images, FilePicker callbacks after navigation, Special Images metadata, overlay/Settlement/Project previews and gallery recovery after a source becomes available. Check focus, sidebar/main scroll, window resizing, native themes and long descriptions.
5. Test native Ark status writes, multiple connected GMs, Player Shop permissions and legacy JSON round trips. Confirm zero unintended Actor/Item/Scene/Journal writes, no Campaign/Travel event generation and no duplicated listeners after repeated open/close.

## Deferred work / limits

Phase 4C/5 and unrelated content redesign are not implemented. Settings, Zone token/Scene selectors, source Project statistics and Shop inventory remain specialized adapters. Native `fromUuid` cannot be aborted by these helpers: closed/superseded views ignore the result, and in-flight deduplication is cleared when it settles. Read-only expected-type validation now reports old wrong-type references rather than deleting them. A future explicit narrative refresh policy, if desired, needs its own feature decision; this phase adds no universal Refresh Info action. Native document-click/page behavior, Compendium visibility and theme/accessibility require the live checks above.

No tag or release is published by this implementation task.
