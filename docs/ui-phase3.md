# Phase 3: Shared actions and unsaved-change protection (0.1.51)

## Implementation and baseline audit

Inspected the current Phase 1 card/header/collapse helpers, Phase 2 portrait and scroll controllers, Sector Manager handlers, and Settlement/Faction/Shop/Project modules on main `6177644` (0.1.50). The baseline Node suite passed 489/489 with no preexisting failures.

The original gaps were behavioral: Normal/Special removal was immediate; Settlement removal had a generic unnamed confirmation; Faction member removal was immediate; Shop confirmations did not name the selected reference/group; only Settlement intercepted a dirty close. Navigation had a two-choice discard dialog, and full-sector Save swallowed failures, preventing a reliable Save-and-Continue result. Add/bulk markup was repeated in four renderers. The existing sorted-entry identities and collection persistence services were retained.

| Sector / collection | Add route retained | Removal before Phase 3 | Bulk boundary / ordering | Save boundary retained |
| --- | --- | --- | --- | --- |
| Normal `locations` | Context generation, including eligible ruins | Immediate | Entry bodies; insertion order | Draft / Save Sector |
| Normal `encounters` (Inhabitants) | Context generation, Actor drops | Immediate | Entry bodies; alphabetical presentation | Manual edits/removal draft; blank-area Actor creation autosaves collection |
| Normal `loot` (Gear & Artifacts) | Context generation | Immediate | Entry bodies; existing order | Manual draft; Collected autosaves Loot only |
| Normal `effects` | Context generation, Macro controls | Immediate | Entry bodies; existing order | Draft; trigger/history services unchanged |
| Normal `history` | Add Entry and generated Add Event | Immediate | Entry bodies; existing order | Draft |
| Special `special.locations` | Blank authored Location | Immediate | Entry bodies; existing order | Draft |
| Special `special.inhabitants` | Blank authored Inhabitant, Actor drops | Immediate | Entry bodies; alphabetical presentation | Manual draft; blank-area Actor creation autosaves collection |
| Special `special.gear` | Blank Item, Item drops | Immediate | Entry bodies; existing order | Manual draft; blank-area Item drops autosave collection |
| Special `special.events` | Blank Event | Immediate | Entry bodies; existing order | Draft |
| Special `special.images` | Blank Image, image Journal page drops | Immediate | Bulk affects whole image entry **and metadata**; individual levels retained | Manual draft; blank-area page drops autosave collection |
| Special `history` | Add Entry / generated Add Event | Immediate | Entry bodies | Draft |
| Settlement `projects` | Blank Project, MYZ Project Item drops | Generic confirmation; linked Ark rows protected | Entry bodies inside status groups; existing progress/name presentation | Draft metadata/progress; eligible native status writes immediately update source Ark |
| Settlement `inhabitants` | Blank Inhabitant, Actor drops | Generic confirmation | Entry bodies; alphabetical presentation | Manual draft; blank-area Actor creation autosaves collection |
| Settlement `factions` | Blank Faction | Generic confirmation | Faction bodies; member galleries retain independent expansion | Draft; faction IDs on Inhabitants remain as missing associations after deletion |
| Settlement Faction `members` | Actor gallery drops, deduplication | Immediate reference removal | Gallery has its own fold boundary; member order retained | Draft; no Actor deletion |
| Settlement `events` / `threads` | Blank Event / Thread | Generic confirmation | Entry bodies; existing order | Draft; specialized fields retained |
| Settlement Shop groups | Add Group / existing Item drop routing | Empty groups only, generic confirmation | Shop bulk affects group headers/body tables only; group/row manual ordering retained | Manual group edits/removal draft |
| Settlement Shop inventory rows | Item drops, replacement, move/reorder | Generic reference confirmation | Table rows are not collapsible cards | Drops autosave the current Shop collection (including pending Shop edits); manual removal/reorder alone remains draft |

Project status groups are view-only containers, not removable persisted entries. Ordinary collection bulk controls affect cards and leave status-group visibility and Faction gallery expansion alone. Existing Special Images bulk behavior deliberately includes metadata. Shop now has explicit Expand All / Collapse All group controls. Collapse/scroll state remains client-only, isolated by the existing sector/collection state stores.

## Shared controls

`scripts/ui/actions.mjs` owns context labels, collection-action markup, shared bulk-button markup, named removal consent and the unsaved guard. Rendering helpers never mutate records. Existing `data-action`, `data-collection`, `data-remove` and collapse attributes continue routing to existing domain handlers; no second delegated action system was added.

Add Location/Inhabitant/Item/Effect/Event/Image/Project/Faction/Thread labels share styling and spacing. History retains both Add Entry and Add Event. Shop retains its specialized toolbar, source document permissions, ordering and empty-group restriction. Entry card remove controls reuse the Phase 1 header slot and shared styling; gallery/Shop controls retain readable labels.

Removal consent uses Foundry v14 `DialogV2.confirm` with named, escaped content, **Remove** / **Cancel**, `defaultYes: false`, and close-as-cancel. One pending removal per manager prevents duplicate dialogs. Confirmed mutations revalidate the draft and stable record identity; ordinary entries also validate the displayed name. Cancel does not remove records or persist anything. Referenced Actors/Items/Journals are never deleted by entry removal. Protected linked Ark rows cannot be removed. Removing a Shop row cannot remove its parent group.

Ordinary removals still require Save Sector. Named confirmation does not introduce autosaving. Faction member deletion returns keyboard focus to its gallery; ordinary card deletion returns it to a neighboring header (or Add when empty), without forced scrolling. Persistent action buttons regain focus through the existing ScrollKeeper; a disabled Shop Remove returns focus to the inventory.

## Save / Discard / Cancel

Normal, Special and Settlement use the same guard before closing, navigating, creating another sector and the existing import replacement path. **Cancel** is the default, including closing the dialog with X. The guard waits for already queued collection/native writes, then checks the existing `dirty` flag. Clean drafts do not prompt. Repeated close/navigation attempts do not open duplicate dialogs or perform several transitions.

- **Save Changes:** calls the existing Save Sector route and continues only after success. Validation, persistence or conflict failure keeps the current draft open. Edits made during a pending save remain dirty and prevent navigation.
- **Discard Changes:** continues close/navigation/replacement; only the unsaved draft is abandoned. Already persisted collection changes and completed source Ark writes remain.
- **Cancel/X:** keeps the draft, focus and scroll position. No new storage fields are written.

Type conversion retains all draft and inactive content and therefore does not need a discard guard; its existing type/confirmation dialogs remain. Randomization retains its existing explicit generated-content preview/save confirmation and preservation rules. Deleting the whole sector retains its separate explicit permanent Journal deletion confirmation. These domain actions were not replaced with generic entry deletion.

`save-state.mjs` formats the existing dirty/progress feedback and supports optimistic baseline comparisons. The footer is an accessible, wrapping live status. Whole-sector saves show progress, success or failure without routine success toasts. Scoped saves name the collection and state that other edits still use Save Sector. A completed native Ark status write explicitly says Discard cannot undo it.

Full-sector Save joins the **existing** autosave queue: it waits for prior operations; subsequent collection writes queue behind it. It returns success/failure to the guard and preserves newer edits using an edit revision of the existing dirty tracking. There is no competing dirty flag or replacement persistence service.

## Conflict and compatibility safeguards

The loaded raw sector record is the baseline for full saves. Before writing, Save refuses a detected external record change and retains the local draft for review. Successful own partial writes advance **only their written paths** in that baseline; they cannot acknowledge or hide an unrelated remote edit. Existing collection-specific conflict checks are unchanged. Full saves reset the baseline only after a successful write.

This is optimistic client-side conflict checking, matching the module's existing Foundry persistence model; Foundry does not provide a record compare-and-swap operation here. Two remote clients writing at exactly the same time still require live multi-GM verification. A detected conflict requires reopening/reconciling the latest record; the guard does not offer a force overwrite.

No schema migration, collection merge, persisted UI state, document-reference refactor, or Phase 4 work. Module ID, public macro behavior, source permissions, stable IDs, stored array order, portrait source policy, narrative snapshots, unknown dropdown values, JSON import/export, Campaign Log and Travel Events remain unchanged. Alphabetical Inhabitant and grouped Project ordering still moves presentation DOM rather than persisted arrays. Deletion uses stable UI/content identities; neighboring display position is used only to choose a focus target after deletion.

## Files

- `scripts/ui/actions.mjs` — shared collection/bulk rendering, labels and consent/unsaved helpers.
- `scripts/ui/save-state.mjs` — footer formatting, canonical comparison and scoped baseline acknowledgment.
- `scripts/ui/entry.mjs` — shared header Remove styling hook.
- `scripts/ui/scroll.mjs` — restore stable action-button focus without scrolling.
- `scripts/sector-manager.mjs` — integrate controls, guard all sector types, validate removal identities, serialize full saves, return save outcomes, preserve conflicts/newer edits and report scoped status.
- `scripts/settlement-ui.mjs` — shared collection controls; native Ark write feedback.
- `scripts/settlement-projects.mjs` — return a success indicator only when a native write actually occurred.
- `scripts/settlement-factions-ui.mjs` — named member consent, stable membership checks, gallery focus and shared Remove styling.
- `scripts/settlement-shop-ui.mjs` — shared bulk buttons, named row/group consent and focus handling while retaining specialized mutation/persistence.
- `tests/sector-manager.test.mjs`, `tests/ui-phase3.test.mjs` — action/guard/persistence/identity/concurrency regressions.
- `tests/interface-browser.cjs`, `tests/ui-phase3-browser.cjs` — real application DOM and interactive dialog tests using simulated Foundry APIs.
- `module.json`, `README.md`, this document — prepare 0.1.51, package the two new modules and document controls/manual checks.

## Verification

Run:

```sh
node --check scripts/sector-manager.mjs
node --test tests/*.test.mjs
node tests/ui-phase3-browser.cjs
node tests/interface-browser.cjs
node tests/ui-phase2-browser.cjs
node tests/overlay-browser.cjs
node tests/party-skills-browser.cjs
node tests/player-shop-browser.cjs
node tests/campaign-log-browser.cjs
node tests/travel-browser.cjs
node tests/document-reference-browser.cjs
node tests/wandering-browser.cjs
node scripts/prepare-release.mjs v0.1.51
unzip -t dist/myz-sector-manager-v0.1.51.zip
```

Browser scripts require the existing development Playwright/Chromium setup; overlay additionally uses the trusted PIXI bundle. Workflow lint and both JSON Schema/example validations are also checked. **Executed results:** 507/507 Node tests and all ten browser scripts passed. Runtime syntax, packaging, ZIP integrity, the ZIP-root manifest and all declared module byte comparisons, actionlint, and both JSON Schemas/examples passed. No preexisting failures were found. Browser APIs simulate Foundry; none of these checks is a live Foundry v14 world.

### Required backup-world checks

1. On each sector type, edit a field and close using Foundry's window X; verify Save, Discard, Cancel and dialog X. Repeat with sector selection, New Sector and import replacement. Force a save failure and confirm the draft stays open.
2. Delete a named, alphabetically displayed Inhabitant; cancel first, then confirm. Verify the correct record, stored order, neighboring focus and scroll. Repeat for Locations, Gear, Effects, History, Special Events/Images, Settlement Events/Threads/Factions and nested Faction members.
3. Confirm a deleted Faction leaves Inhabitant faction IDs intact. Confirm native Ark Projects have no Remove control. Cancel/confirm Shop row removal and empty-group removal; verify source documents and other groups survive.
4. Test collection bulk controls halfway down long lists with unsaved text. Check keyboard activation, main/sidebar positions, Project group boundaries, Faction gallery independence, Images metadata and Shop groups at narrow widths.
5. Check collection drops, Loot Collected and native Ark writes with other unsaved fields. Verify scope-specific footer feedback and that Discard does not undo completed writes. Check errors, source permissions, and genuine simultaneous-GM edits in a backup world.
6. Save/reopen older and imported records with unknown fields, custom portraits, references and native Ark links. Verify IDs, Player Shop/trading, Campaign Log and Travel Events. No release/tag is created by this implementation task.
