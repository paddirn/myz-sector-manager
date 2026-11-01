# Encounter reference opening and main-window minimize — 0.1.63

**Minimize follow-up:** The original frame callback was not registered as an
ApplicationV2 action. The corrected dispatcher, Restore button and lifecycle
behavior are documented in [0.1.64 minimize fix](minimize-fix.md). The previous
browser fixture invoked frame metadata callbacks directly and masked that defect.
Encounter reference behavior below is unchanged.

Implemented in the requested order: encounter references first, main window second.

## Encounter reference investigation and fix

Generation already resolves terminal RollTable references to full UUID strings and
stores `event.encounter.uuid` with `documentType`. World and compendium Actor,
JournalEntry and JournalEntryPage references are supported, including legacy UUID
strings that Foundry's `fromUuid` accepts. No storage format or old history is rewritten.

The Travel report resolved the UUID, then called `_onClickDocumentLink(new Event('click'))`.
That event was never dispatched on a link: `currentTarget` was null and no dataset
existed. It also was not the MouseEvent required by the native document-link
contract. Journal overrides can inspect link data, unlike the generic Actor path.
The confirmed code defect is this synthetic link-event invocation, not Actor-only
resolution or a new reference format. A simulated Journal handler reproduces the
missing-target failure; no licensed Foundry instance/live exception trace was
available to identify a specific native implementation line.

`openEncounterReference` now uses shared `requireDocument`/`checkDocument` access
checks and explicit sheet APIs. Native ApplicationV2 sheets receive
`render({force:true})`; Journal pages render their parent with
`{force:true,pageId:page.id}`. Existing ApplicationV1/custom sheets retain the
supported `render(true, options)` signature. A page never opens its editor instead
of the Journal. Parent permissions are checked separately. If page navigation
throws/rejects, the same permitted parent sheet is opened without the page option
and the GM receives a concise explanation. Custom sheets which ignore pageId may
open only the parent; verify their behavior live.

No document is imported, duplicated, updated, shown to players or added to combat.
The report stays open. GM access is rechecked after asynchronous resolution; denied,
missing, invalid, wrong-type and unavailable-sheet cases are caught. Warnings are
concise and console diagnostics include UUID/type/stage/error. No success toast is
emitted. Missing/syntactically invalid references leave a disabled, explained button.

## Main-window implementation

`SectorManager` extends Foundry `ApplicationV2`. Only that class uses the new
`mainFrameButtons`/`positionMainMinimize` helpers:

- Preserve inherited `_getFrameButtons` controls; reuse an existing native minimize
  control rather than adding a duplicate.
- Add a `fa-solid fa-minus` frame control with Minimize tooltip/accessible label.
  It inherits native `header-control` styling, size and hover behavior.
- Place the control immediately before the native three-dot controls button, using
  its native frame reference after rendering to enforce exact placement.
- Invoke **`ApplicationV2.minimize()` only**. No save, capture, close, cancellation,
  DOM hiding, DOM replacement or editor-state reset is added by product code.
- Explicitly retain `window.minimizable:true`. Native title-bar double-click and
  **`ApplicationV2.maximize()`** provide restoration and remembered geometry.

There is no custom restore button. Current form DOM, draft, selected sector, tab,
scroll state and unsaved edits remain in the same application instance. Secondary
apps/editors/dialogs/Patrol windows do not call these helpers or receive the button.
Native dragging, resizing, close/menu callbacks and their order are retained.

The API choices were checked against pinned public v14.369 declarations:
[ApplicationV2](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/applications/api/application.d.mts),
[JournalEntrySheet](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/applications/sheets/journal/journal-entry-sheet.d.mts),
[JournalEntry](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/documents/journal-entry.d.mts).
These are API/source checks, not live testing.

## Changed files

- `scripts/travel/reference.mjs`: permission-aware Actor/Journal/page opening and
  fallback/error handling, scoped to Travel reports.
- `scripts/travel/report.mjs`: binds actual reference actions without synthetic
  events, and disables unavailable-reference buttons.
- `scripts/ui/main-window.mjs`: native frame-button definitions, reuse/placement
  and accessibility; no editor state manipulation.
- `scripts/sector-manager.mjs`: main-only frame override, native minimizable option
  and placement after frame rendering.
- `tests/travel-reference.test.mjs`, `tests/travel-browser.cjs`: full UUID variants,
  native/legacy sheet signatures, page fallback, access/errors and real dialog clicks.
- `tests/main-window.test.mjs`, `tests/main-window-browser.cjs`: native frame action,
  control ordering/reuse, minimize/restore and unsaved state/geometry/scroll checks.
- `tests/interface-browser.cjs`, `tests/sector-manager.test.mjs`: expose the documented
  native frame APIs in the simulated application fixture and import shared helpers.
- `module.json`, `README.md`, this guide: declared packaged files, prepared 0.1.63
  version and manual instructions.

Travel chance/generation/service, Party/Patrol movement, source tables, Campaign Log,
sector persistence/JSON schema and existing document contents have no changes.

## Manual Foundry v14 checklist — not performed here

Use a backup official MYZ world.

1. Trigger/test an Actor encounter, click Open Encounter Reference and confirm its
   existing native Actor sheet opens while the Travel report stays open.
2. Repeat for a world JournalEntry and a multi-page Journal. Confirm the actual
   configured sheet opens locally and no duplicate Journal/player broadcast occurs.
3. Test world and compendium JournalEntryPage UUIDs; confirm the parent opens at
   that page. Test a custom sheet without page navigation: parent fallback must
   remain permitted and usable. Test compendium Journal and Actor references.
4. Test missing/deleted references, wrong document type, denied access and sheet
   errors. Expect a concise GM warning/console context, not an uncaught error.
5. Open the main Sector Manager, choose a sector/tab, edit text without saving and
   scroll an entry/list. Resize and reposition the window.
6. Verify one minus button immediately left of the three-dot menu, with Minimize
   tooltip/accessible name, normal native hover/focus and keyboard activation.
7. Click once: only the title bar should remain, with the application still open.
   Double-click the title bar to restore. Confirm identical position/size, text,
   dirty state, sector/tab and scroll positions; no save/discard/close prompt occurs.
8. Rerender/navigate and repeat. Check no duplicate button, preserved native menu,
   dragging, resizing and close/unsaved-change prompts. Check secondary windows
   have no module-added minimize button.
9. Check a Foundry/native-theme configuration that already supplies minimize: the
   existing control should be reused. Verify native animation/restore behavior on
   the installed v14 build and any custom window theme.

Real Foundry frame rendering/animations, custom sheets, compendium permissions and
native page navigation require this checklist. Browser tests simulate those native
APIs; product code never implements custom content hiding. No tag/release is created.

## Automated validation

- **662/662 Node tests passed**, including 8 new reference/frame-control tests.
  Focused cases also cover rejected rendering and were rerun successfully.
- **All 17 browser suites passed**: the 16 existing suites plus the new main-window
  interaction suite. The Travel suite exercises actual report reference clicks;
  main-window checks preserve exact geometry, dirty input node/value, sector, tab,
  scroll and existing controls. The restored-window screenshot was inspected.
- Main entry/all declared modules syntax, release preparation for v0.1.63, ZIP
  integrity/root manifest/README/source-byte comparisons passed.
- actionlint 1.7.7 and `git diff --check` passed.
- Portable JSON/schema validation: **28 valid and 10 invalid checks passed**.
  No sector data or schema migration was introduced.

The browser fixture models native ApplicationV2 controls/minimize/maximize; its
content-hiding simulation is test-only. Product code delegates to Foundry's APIs.
