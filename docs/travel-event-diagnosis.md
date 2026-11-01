# Diagnose missing Travel Events — 0.1.62

## Findings and limits of this investigation

The user confirmed Automatic Travel Events and Normal Sector Entry are enabled
and the Party token is assigned. There is no live Foundry connection in this
workspace, so actual saved world references, destination records, rolls, active-GM
selection and report state could not be inspected. **The cause of the reported
missing events in that world remains unverified.** This update does not invent a
Patrol regression or claim that a successful simulated test diagnoses that world.

The deterministic integration test exercises installed `ZoneRuntime.start` hooks,
completed Party movement, the existing dispatcher, the real private chance method,
configured Threat Type/encounter tables, the native report adapter and persisted
history, while Patrol listeners are also installed. It succeeds. Failed rolls are
silent as designed. There was no evidence of a broad Patrol-induced suppression
of ordinary Party entries in the code inspected.

Two concrete code findings were addressed:

1. Eligibility exits in the dispatcher/service were silent, preventing the GM from
   distinguishing a skipped entry from failed chances or disabled reporting. Add
   opt-in, GM-local stage/reason traces and a read-only setup inspection. Existing
   generation errors retain their current warnings/private Diagnostics behavior.
2. `updateToken` excluded patrol/wandering origins, but the `moveToken` callback
   discarded operation options. Unify origin handling across both hooks and stop
   reconciliation. This closes an **unintended-event** gap for a mistakenly
   automated Party move, not a confirmed cause of missing ordinary Party events.
   Assigned NPC patrols were already excluded by Party classification.

## Intended pipeline — unchanged game behavior

1. The designated Scene TokenDocument finishes movement from one Zone sector to
   another. Position uses existing source/token-center/calibrated-grid math.
2. Only registered Party/Expedition assignments qualify; another placed token of
   the same Actor does not. Startup, duplicate/same-sector updates, pass-through
   waypoints and Macro-induced recursive movement do not create entries.
3. The destination must have an existing, saved version-1 **Normal** sector record
   on that Scene. Empty squares, Special/Settlement records and pending initial
   saves do not roll. Exploration does not need to be Unexplored.
4. The elected active GM queues the check before Wandering and sector Macros.
   Macro once/repeat settings do not enable/disable Travel Events.
5. Initial global weather is rolled silently if not yet established. Subsequent
   weather-change checks use the configured 1-in-N denominator (default 12).
   Encounters roll independently, default 1-in-12, or 1-in-20 for Explored/Cleared
   when reduction is enabled. Success is exactly 1 on a uniform dN. Probabilities
   and table weighting are unchanged.
6. Weather uses the configured Weather Conditions table. Encounters use Threat
   Type and its Humanoid/Monster/D66 Encounter table, excluding Phenomena. Missing
   table references are errors, not permission to invent a result.
7. A weather **change**, encounter, or both produce one persistent active-GM-only
   dialog if reporting is enabled. Initial/unchanged weather, failed rolls and
   error-only checks produce no event dialog. Private history follows the saved
   reporting/retention settings.
8. The report is awaited until Close or X; later entries and Macros wait in order.
   An already-open report behind other windows can therefore hold later checks.

Travel duration is an existing reference calculator, **not a trigger prerequisite**.
The Travel Events subsystem does not advance Foundry's clock. Patrols observe that
clock independently. No active Campaign Log session is required for checks; session
recording only affects whether a generated result also gets a Campaign Log note.

## Enable diagnostics in the affected world

1. Install this update in a backup world. On the **active GM** client, open Module
   Settings → MYZ Sector Manager → Travel Events.
2. Enable **Enable GM Debug Logging (browser console)** and Save Configuration.
   It defaults to false for old/new configurations. It changes no probabilities.
3. Open the browser developer console and filter for `MYZ Travel Events` (enable
   Debug/Verbose console messages if your browser hides them).
4. Move the designated Party from one sector into a different, saved Normal sector.
   Let native movement finish. Look for stages:

| Stage | Meaning / what to inspect |
| --- | --- |
| `movement-detected` | Hook saw a registered Party move and its native state/origin |
| `movement-waiting` | Native path is pending/paused; wait for completion |
| `movement-skipped` | Reason includes unassigned token, automated origin, same sector, duplicate, missing origin, out-of-grid, non-active GM or Macro recursion |
| `entry-detected` | From/to sector transition was recognized and queued |
| `check-skipped` | No saved Normal destination, initial save pending, disabled option, stale assignment/grid/authority or duplicate processing ID |
| `check-started` | Actual effective encounter/weather denominators and report/history configuration |
| `chance` | Check kind, denominator, private numeric result and success boolean |
| `initial-weather` | First weather establishment; intentionally no weather-only report |
| `configuration-error` | Required result source/resolution failed; inspect existing private Diagnostics |
| `event-selected` | Whether an encounter/weather change exists and error count |
| `report-open` | A persistent report is being awaited; close it to release later checks |
| `report-delivered` | Report adapter returned; `shown` records successful handling |
| `report-skipped` | No meaningful event, dialogs disabled or active GM changed |
| `processing-failed` | Queue error; the ordinary GM warning/console error is retained |

5. Turn Debug Logging off and Save Configuration after reproducing. No trace is
   broadcast, put in public chat or persisted. Other GM clients can inspect their
   own eligibility traces; player clients cannot log GM event payloads. Debugging
   enabled can be verbose during active movement; normal play defaults to silent.

### Read-only setup check

Open Travel Events → **GM Testing** → **Check Travel Setup (no rolls)**. No test
selection is required; selecting a sector/expedition adds selection details.
It reports actual saved enablement, probabilities and output settings, designated
Scene/grid/Party availability, each Party's current coordinate/native movement
state and destination record types/save status, count of saved Normal sectors,
source availability and pending/open/incomplete processing state. Missing subtype
sources are marked as needed **if selected** by Threat Type, not unconditional
requirements for every possible result.

A GM Script Macro or console call can obtain the same read-only report:

```js
console.log(JSON.stringify(await game.myzSectorManager.travel.diagnostics(), null, 2));
```

This is GM-guarded. It does not roll, move tokens, change settings, write history
or alter incomplete entries. It identifies missing references before relying on a
successful random check. Read it together with a single movement trace to diagnose
the live-world stop point; the tool cannot infer outcomes that happened before
logging was enabled.

## Deterministic tests without changing gameplay chances

**In Foundry:** use existing GM Testing → select a registered expedition and saved
Normal sector → **Test Encounter Roll**, with Persist test weather/history off.
This bypasses only the encounter *chance* for that explicit TEST run, uses the
configured tables and opens the existing private TEST dialog. Close or X resolves
it. Configuration, exploration, Macro state and ordinary event probabilities stay
unchanged. Missing/invalid tables fail visibly. Test Weather Roll separately checks
the weather source. These existing manual tests verify generation/delivery, not
that a real movement hook was received; pair them with the movement trace above.

**Automated full pipeline:**

```sh
node --test tests/travel-pipeline.test.mjs
```

The test injects a core Roll result of 1 **only in its isolated simulated environment**.
It exercises actual runtime hooks and dispatcher through configured result tables,
private dialog content and acknowledged persisted history. Patrol listeners remain
installed. A failed-roll case, pending intermediate waypoints, duplicate hooks,
reinitialization, source errors, inactive/report settings and origin exclusions
are tested without permanently forcing events or changing world configuration.
No licensed Foundry installation is loaded by these tests.

## Files and compatibility

- `scripts/travel/debug.mjs`: opt-in GM-local trace helper, no state writes.
- `scripts/travel/diagnostics.mjs`: read-only saved-setup/table inspection.
- `scripts/travel/model.mjs`, `scripts/travel/settings.mjs`: backward-compatible
  `debug:false` option, GM checkbox and Check Travel Setup action.
- `scripts/travel/service.mjs`: stage/chance/delivery traces and inspection API;
  all eligibility rules, denominators, rolls, persistence and dialogs retained.
- `scripts/zone/entry-triggers.mjs`, `scripts/zone/runtime.mjs`: entry/skip reasons
  and consistent origin exclusion with baseline synchronization. Stop still commits
  only the endpoint; startup and same-sector updates remain nonentries.
- `scripts/sector-manager.mjs`: GM-guarded `.travel.diagnostics()` API.
- `tests/travel-pipeline.test.mjs`, `tests/travel-browser.cjs`: deterministic real
  runtime integration and actual diagnostic UI/configuration interactions.
- `module.json`, `README.md`, `docs/travel-events.md`, this document: packaged
  helpers, prepared 0.1.62 version and diagnostic/manual instructions.

No sector JSON schema, sector records, Patrol implementation, Wandering movement,
Campaign Log, travel calculator or clock advancement code is changed. Private
Travel Events state stays version 1; old settings default to debug false. No release
or tag is created by this PR.

## Manual verification still required

In a backup official MYZ v14 world, run the setup report and capture one completed
Party move with Debug Logging enabled. Verify native hook timing and assignments,
saved Normal destination/Scene scope, actual configured tables and result formats,
GM election, effective chance roll and private report delivery. Check all four
report outcomes (weather-only, encounter-only, combined, none), Close/X and pending
history. Repeat with a player-originated movement, two GM clients and reload.
Verify patrol/wandering movement does not generate Party events and the clock is
not advanced a second time. Check normal Macro ordering and existing sector data.

Until that live trace is available, the reported world's actual root cause cannot
honestly be classified as code-related or configuration-related. The confirmed
silent-observability and inconsistent-origin issues are code-related; neither is
presented as proof that the world-specific missing-events problem is fixed.

## Automated validation results

- **647/647 Node tests passed**, including 9 new full-runtime/diagnostic tests.
  Existing Travel, Macro, Zone, Patrol scheduling/collisions, Wandering, Party,
  Campaign Log and portable JSON regressions remain passing.
- **All 16 browser suites passed**. The focused Travel/Roster suite was rerun after
  the final asynchronous GM-access guard and passed, including debug setting
  save, no-roll setup checks, existing deterministic test controls and persistent
  Close/X/queued-report behavior.
- Main entry/all declared module syntax, release preparation for v0.1.62, ZIP
  integrity/root manifest/README/declared source-byte comparisons passed.
- actionlint 1.7.7 and `git diff --check` passed.
- Portable JSON validation: **28 valid and 10 invalid document/schema checks passed**.
  No portable schema or serializer changes.

These results establish simulated pipeline behavior and diagnostic privacy guards;
they do not establish what occurred in the user's running Foundry world.
