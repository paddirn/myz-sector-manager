# Travel Events in blank Zone squares and GM diagnostics — 0.1.62

## Confirmed cause and requested change

The user confirmed event enablement and Party assignment, then found no Normal
sector choices in GM Testing. The final clarification identifies the cause: the
Party was travelling through **blank grid squares with no saved sector records**.
The previous implementation required a saved Normal Journal record before rolling.
Blank destinations therefore stopped at eligibility, before chance or table
selection. This was an eligibility/data mismatch, not a Patrol or dice regression.

The user explicitly requested **Allow events in blank grid squares too**. This PR
now implements that behavior, in addition to the diagnostics from the original
investigation. Blank checks are enabled by default with a separate world setting,
**Trigger on Blank Zone Sector Entry**. The existing **Trigger on Normal Sector
Entry** remains independent. Turning blank checks off restores the previous
saved-Normal-only eligibility. No existing probability is changed.

A blank square means no sector record at that coordinate on the designated Scene.
Special, Settlement, pending-save and unsupported-version records are **not** blank
and cannot use this path to bypass their exclusions. No sector Journal, terrain,
exploration record, loot or Macro state is created to perform a blank check.

## Pipeline and probability rules

1. The designated Party/Expedition Scene TokenDocument finishes movement into a
   different in-bounds Zone sector. Startup, same-sector/duplicate hooks, passed-
   through waypoints, unrelated tokens and Macro recursion do not create entries.
2. The active GM queues the check. Eligible destinations are saved version-1 Normal
   records, or truly blank grid squares when their separate toggle is enabled.
   Special/Settlement and initially unsaved records remain excluded.
3. Blank entries use a minimal **in-memory** context: coordinates, empty terrain
   and unknown/unexplored status for probability purposes. Their encounter chance
   is the existing standard `encounterChance` (default 1-in-12). No stored status
   is inferred or written. Saved Explored/Cleared records retain their configured
   reduced chance (default 1-in-20); weather remains independent (default 1-in-12).
4. Initial global weather is established silently. Later weather changes use the
   configured chance; encounters use their own private chance. Success remains
   exactly 1 on a uniform dN. Table formulas/weights and Phenomena exclusion remain.
5. A weather change, encounter, or both produces one persistent active-GM-only
   dialog when reporting is enabled. Initial/unchanged weather, failed chances and
   error-only results are silent. Reports are awaited until Close or X, preserving
   Travel → Wandering → sector Macro order. Blank squares have no sector Macros.
6. Blank reports/history identify the coordinates and **Unrecorded sector**. Private
   events use `blank:true` and `sectorId:null`; saved-sector references remain intact.
   No sector portability/schema change is needed. Pending reports and recorded
   offline blank entries recover through the existing queues without rerolling.

Travel duration remains a reference calculator, not a trigger prerequisite. Travel
Events does not advance the clock. No active Campaign Log session is required;
existing optional logging/visit association supports a missing Journal reference.
Patrols and Wandering retain their own movement/clock behavior.

## Separate code finding: movement origin guards

The old `updateToken` handler excluded patrol/wandering flags, but `moveToken`
discarded operation options. Both now pass origin flags to the same dispatcher.
Suppressed automated moves synchronize the baseline at completion, so a later
same-sector native update cannot retroactively look like Party entry. This closes
an unintended-event gap for a mistakenly automated Party token; it was **not** the
cause of the reported blank-square skips. Assigned NPCs remain excluded by Party
classification. No validation or movement restriction is globally disabled.

## GM testing when no sectors are implemented

1. Open Travel Events → **GM Testing**.
2. Choose the Party/Expedition.
3. Under **Normal / blank sector**, choose **Current blank sector [coordinate]
   ([expedition])**. The token must be inside the configured Zone grid, with no
   sector record at that coordinate. If it moved or a record was added, use
   **Refresh Sector List**; an obsolete blank choice is rejected safely.
4. Leave **Persist test weather/history** unchecked.
5. Click **Test Encounter Roll**. This explicit TEST bypasses only encounter chance,
   uses the configured result tables and opens the private TEST report. It does
   not change configured probabilities, create a sector, write history or trigger
   sector Macros. Close or X resolves it.
6. Use **Test Weather Roll** independently for the weather table. Missing references
   fail clearly. Ordinary automatic movement continues using the saved chances.

The selector also retains all saved Normal choices. An empty Normal inventory now
shows counts of Special, Settlement, pending-save Normal and unsupported records
instead of only the unhelpful context error. Do not convert a Special sector merely
to run a test; choose a genuinely blank square or a saved Normal record.

## Opt-in debug trace

Enable **Enable GM Debug Logging (browser console)** in Travel Events and Save
Configuration. It defaults to false. On the active GM's browser, filter the developer
console for `MYZ Travel Events` and enable Debug/Verbose messages if hidden. Move
into a different saved Normal or blank square and let native movement finish.

| Stage | Meaning |
| --- | --- |
| `movement-detected` / `movement-waiting` | Registered Party movement and native pending/paused state |
| `movement-skipped` | Reason: unrelated/automated token, duplicate/same sector, missing origin, outside grid, non-active GM or Macro recursion |
| `entry-detected` | Origin/destination transition was recognized and queued |
| `check-skipped` | Disabled option, excluded record, nonblank/outside destination, stale assignment/grid/authority or duplicate processing ID |
| `check-started` | Effective weather/encounter denominators and reporting configuration |
| `chance` | Check kind, denominator, private result and success boolean |
| `initial-weather` | Silent first weather establishment |
| `configuration-error` | Missing/invalid source or result, also in existing private Diagnostics |
| `event-selected` | Encounter/weather-change selection and error count |
| `report-open` / `report-delivered` | Persistent report is awaited, then resolved with shown status |
| `report-skipped` / `processing-failed` | No meaningful event, disabled reporting, authority change or actual queue error |

Disable debugging after reproduction. Traces are GM-local, not broadcast or stored,
and player clients cannot emit GM trace payloads. No chance is permanently forced.
An already-open report can hold later queued checks until explicitly closed.

## Read-only setup inspection

Use GM Testing → **Check Travel Setup (no rolls)**, with or without test selection.
It reports saved toggles/probabilities, active GM, Zone Scene/grid/Party availability,
current coordinates/movement state/blank status, destination records, sector inventory
and exclusion reasons, table references and open/pending/incomplete report state.
Subtype tables are marked as needed **if selected** by Threat Type. Weather and
encounters still use their existing sources; missing sources are not invented.

The same GM-guarded read-only report is available from a Script Macro/console:

```js
console.log(JSON.stringify(await game.myzSectorManager.travel.diagnostics(), null, 2));
```

Inspection performs no rolls, token moves, settings changes or state writes and
rechecks GM access after asynchronous document resolution. Inventory previews are
capped at 200 records; counts include the full inventory. A configured-world report
remains necessary to verify actual table availability and native runtime state.

## Deterministic automated coverage

```sh
node --test tests/travel-pipeline.test.mjs
```

Isolated fixtures inject a successful core Roll and deterministic table results
only for tests. The full real `ZoneRuntime.start` hook/dispatcher/service/report
adapter/history path is exercised with Patrol listeners installed, including a
blank destination without creating any sector Journal. Failed rolls, disabled
blank checks, saved-Normal checks, standard versus reduced denominators, authored/
pending/unsupported records, native pending paths, duplicate hooks, reloads,
GM privacy/access loss, source errors, origin exclusion, offline recovery and dry-
run blank tests are covered. This is not a licensed live Foundry installation.

## Changed files

- `scripts/travel/eligibility.mjs`: shared in-bounds/no-record blank predicate.
- `scripts/travel/debug.mjs`, `scripts/travel/diagnostics.mjs`: GM-local traces,
  read-only setup checks and sector inventory reasons.
- `scripts/travel/model.mjs`, `scripts/travel/settings.mjs`: `debug:false`,
  `blankEntry:true`, independent toggles, blank test choices, refresh and empty state.
- `scripts/travel/service.mjs`: transient blank context, null sector reference,
  existing chance/generation/report pipeline, diagnostics and offline replay.
- `scripts/travel/recovery.mjs`: retains offline moves when either eligible entry
  mode is enabled; original ownership/authority/buffer safeguards remain.
- `scripts/travel/report.mjs`: marks blank terrain as not recorded.
- `scripts/zone/entry-triggers.mjs`, `scripts/zone/runtime.mjs`: blank entry dispatch,
  origin guards, endpoint reconciliation and trace reasons.
- `scripts/sector-manager.mjs`: GM-guarded `.travel.diagnostics()` API.
- `tests/travel-pipeline.test.mjs`, `tests/travel-browser.cjs`,
  `tests/wandering.test.mjs`: full pipeline/blank tests and expected new Travel →
  Wandering ordering for blank destinations; existing movement assertions retained.
- `module.json`, `README.md`, `docs/travel-events.md`, this guide: packaged helpers,
  prepared 0.1.62 version, confirmed diagnosis and current instructions.

Private Travel state stays version 1. Existing settings gain debug false and blank
entry true through defaults; configured denominators remain unchanged. Existing
sector records, portable JSON, Patrol implementation and Wandering movement logic
are unchanged. No version tag or release is created by this PR.

## Manual Foundry v14 checklist — not performed here

1. In a backup world, confirm both Normal and Blank entry toggles and existing
   probabilities. Move the designated Party through truly blank grid squares.
2. Enable debug. Confirm exactly one check per completed crossing and no rolls for
   passed-through waypoints, duplicate hooks, same-sector updates or startup.
3. Select the Party's Current blank sector in GM Testing; run Test Encounter Roll
   with persistence off. Confirm the TEST report and no new Journal/history/weather.
4. Check actual configured Weather/Threat Type/subtype table availability. Test
   weather-only, encounter-only, combined and failed-chance results.
5. Confirm a successful blank report/history uses coordinates, Unrecorded sector,
   no Journal reference and no fabricated terrain. Verify Close/X and queued reports.
6. Disable blank checks and confirm blank crossings stop rolling while saved Normal
   entries still work. Disable Normal checks and verify enabled blank checks work.
7. Check saved Explored/Cleared probabilities, Special/Settlement exclusions and
   pending-save records. No excluded or unknown-version record may become blank.
8. Reload, test a player-originated Party move and two GM clients/handoff; confirm
   GM-only visibility, no duplicate checks and normal offline pending-entry recovery.
9. Verify no extra clock advancement, Patrol/Wandering-origin Party events, sector
   creation, Macro recursion or changes to existing Campaign Log/sector records.

Actual native hooks, chat/dialog privacy, table contents, offline owner permissions
and multi-client timing remain live checks. The previous blank-square eligibility
block is identified; the new behavior follows the user's explicit request.

## Final automated results

- **654/654 Node tests passed**, including 16 new pipeline/diagnostic/blank-entry
  tests relative to main. Existing saved-Normal, Macro, Party, Patrol, Wandering,
  Campaign Log and portable JSON regressions remain passing.
- **All 16 browser suites passed again** with blank support enabled. The Travel
  suite checks the blank checkbox/defaults, empty-selector explanation, refresh,
  current-blank test selection, private TEST dialog and no dry-run state writes,
  as well as existing Close/X, queueing, roster and reference behavior.
- Main entry/all declared module syntax, release preparation for v0.1.62, ZIP
  integrity/root manifest/README/declared source-byte checks passed.
- actionlint 1.7.7 and `git diff --check` passed.
- Portable JSON validation: **28 valid and 10 invalid checks passed**. No portable
  format/schema/serializer changes were made.

Native v14 behavior was not live-tested. Use the checklist above after installation.
