# Phase 4C: final interface consistency (0.1.54)

## Current-state audit and scope

The audit covered all 22 editor tabs: Normal Overview, Locations, Inhabitants
(`encounters`), Gear & Artifacts (`loot`), Effects, Find the Path and History;
Special Overview, Locations, Inhabitants, Gear & Artifacts, Events, Images,
Find the Path and History; Settlement Overview, Projects, Inhabitants, Factions,
Events, Threads and Shop. Display labels and stored collections remain separate.

The remaining inconsistencies were presentation details rather than a need for
another component framework:

| Area | Finding | Resolution |
| --- | --- | --- |
| Collection titles | Locations, History and Special collections lacked the visible headings used elsewhere | Add consistent collection headings; keep Normal semantic icons |
| Toolbars | Explanatory text competed with controls; uneven gaps and wrapping | Shared spacing, responsive wrapping and emphasis for Add; preserve action order |
| Empty collections | Large generic padding, inconsistent wording, missing Images message | Central escaped contextual messages and compact shared styling |
| Linked Ark Projects | Empty instructions could suggest manual creation | Neutral linked-project guidance; no forbidden Add instruction |
| Inhabitants | Normal/Special used Title while Settlement used Name | Name labels without renaming persisted title fields |
| Inputs | Short quantity/status fields filled grid cells; long titles needed room | Compact quantities/selects, full-row titles, bounded paths and controls |
| Textareas | Equivalent description/notes sizing varied | Row-aware minimums and resizable bounded ordinary textareas; existing autosizing exceptions preserved |
| Reference states | Inner and outer state borders could duplicate emphasis | Keep outer state styling and existing text/icons; normalize inner link presentation |
| Images | Corners/borders and loading appearance varied | Shared radii and preview border/loading opacity; retain image dimensions and fallback behavior |
| Keyboard/status feedback | Focus and selected tab indication relied on browser/theme styling | Scoped visible focus rings, active-tab underline and native `aria-current`; consistent disabled appearance |

## Implementation and changed files

- `scripts/ui/presentation.mjs`: escaped, side-effect-free `emptyState` and
  `collectionEmpty`; shared collection vocabulary, creation permission and linked
  Ark guidance. No record normalization or persistence.
- `styles/interface.css`: app-scoped spacing/radius/color tokens; headings,
  collection controls, labels, compact form controls, textarea limits, empty
  states, focus/hover/disabled feedback and preview presentation. No global
  selectors or `!important`. Removes the need for the old inline empty padding.
- `scripts/sector-manager.mjs`: headings and contextual empty states; Inhabitant
  labels; native tab/sidebar current-item semantics. Existing shared card,
  action, reference, image and scroll helpers remain authoritative.
- `scripts/settlement-ui.mjs`: headings, empty states and existing required
  Settlement Name identified in its label and accessibility metadata.
- `scripts/settlement-shop-ui.mjs`: contextual empty inventory/group guidance,
  retaining distinct Item and Vehicle Actor drops.
- `scripts/settlement-factions-ui.mjs`: compact empty member gallery guidance.
- `scripts/ui/content.mjs`: retains its public adapter and delegates empty
  presentation to the centralized helper.
- `module.json`: prepares 0.1.54, declares the helper and stylesheet and aligns
  the ZIP URL. No tag or release is created by this change.
- `tests/ui-presentation.test.mjs`: contextual/restricted/escaped states and
  stylesheet packaging/scoping checks.
- `tests/ui-phase4c-browser.cjs`: 22-tab layout matrix, contextual empties,
  current-tab semantics, action bounds, dirty state, focus/scroll and screenshots.
- `tests/interface-browser.cjs`: loads the installed stylesheet in the browser
  fixture and supports the focused test; updates intentional empty wording.
- `tests/sector-manager.test.mjs`, `tests/ui-content.test.mjs`: fixture dependency
  and expected presentation updates.
- `README.md`, this document: usage and review/verification notes.

## Intentional exceptions and safeguards

Projects retain the native Ark layout, status/progress controls, source links,
read-only linked restrictions and specialized grid. Factions retain their member
gallery. Shop retains tables, group controls, inventory toolbar and Player Shop
separation; its resource rates wrap into two columns in a narrow editor.
Special Images retain large aspect-preserving previews and their details panel.
Overview and Find the Path retain their purpose-built forms rather than generic
collection cards. History retains Add Entry/Add Event and its own record model.

Normal Collected and Special Gear availability remain different semantics.
Project status, reference validity, save progress and unsaved changes retain their
existing text/icons and state machines; they are not merged into new statuses.
Portrait priority remains linked Actor, saved image, shared placeholder.
No schema, IDs, order, import/export, migrations, save boundaries, native Ark
writes, reference resolution/drop logic or permissions changed. No new rerender
or persistence path was introduced. Existing removal and Save/Discard/Cancel
handlers, stable entry anchors and scroll restoration remain in use.

## Validation and visual review

Run:

```sh
node --test tests/*.test.mjs
node tests/ui-phase4c-browser.cjs
# All existing browser suites: tests/*browser.cjs
node --check scripts/sector-manager.mjs
node scripts/prepare-release.mjs v0.1.54
unzip -t dist/myz-sector-manager-v0.1.54.zip
```

Browser tests use real Chromium with simulated Foundry APIs. The focused matrix
covers application widths 920, 610 and 1320 pixels (heights 730, 730 and 820),
long names/descriptions/collections, large previews, toolbar bounds, empty
collections and unchanged source records. Representative screenshots were
inspected for Normal Inhabitants at 920, Settlement Shop at 610 and Special Images
at 1320. These show readable wrapping, compact controls and retained large image
previews. The fixture intentionally lacks the full Foundry theme/icon font, so
it cannot establish final theme contrast or native Foundry window appearance.
The existing tab strip scrolls horizontally when needed; editor/toolbars do not
create new horizontal overflow.

The complete Node and browser suites cover draft-only versus collection saves,
remove cancellation, Save/Discard/Cancel, reference drops/opening, portrait
fallback, Ark projects, Shop behavior, JSON compatibility, unknown fields, stable
IDs, conversion, dirty protection, and focus/scroll. Release preparation validates
syntax, manifest and required files; archive validation checks root manifest and
all declared modules/styles. Workflow lint and both JSON-schema example suites
remain part of the final validation.

## Manual Foundry v14 checks and deferred work

Use a backup world with existing records of all three types. Review the 22 tabs
in the actual theme at ordinary, narrow and maximized sizes; keyboard through
buttons, fields and collapsible headers. Check focus rings and status contrast
in supported themes, native confirmation focus, image loading/fallback, reference
open/drop and large galleries. Edit then cancel navigation/removal, save/reopen,
and confirm editor/sidebar position and resized window dimensions persist.
Confirm linked Ark Projects cannot be manually added and native progress updates
remain correct; test Shop purchases with a player account. Verify old imported
records retain custom values, portraits and collection order.

No live Foundry installation was exercised here. Full theme/accessibility review
and any larger inline-style extraction or component cleanup are deferred; this
change does not start Phase 5. Full-tab automated layout checks are not a claim of
pixel-perfect cross-theme equivalence or a formal accessibility certification.

Final automated results: **527/527 Node tests passed; all 13 browser suites
passed**, including the 22-tab Phase 4C matrix. `node --check`, actionlint 1.7.7,
all six JSON-schema examples, `git diff --check`, release preparation and
`unzip -t` passed. ZIP root manifest, README, all declared JavaScript modules and
the new stylesheet were compared byte-for-byte with source. No release or tag was
published; live Foundry checks above remain unverified.
