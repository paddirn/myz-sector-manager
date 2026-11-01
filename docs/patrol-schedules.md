# Patrol scheduling, hostile stops and Wandering priority — 0.1.60

## What changed

The existing patrol service, native token positioning, private Configuration
Journal, active-GM election and write queue remain in use. Start replaces Resume
in the route list; the existing `resume(id)` service method remains compatible.
Save leaves a new or edited route stopped. Start preserves the current waypoint,
direction and partial progress and establishes a fresh game-time baseline. Pause
preserves those values; time spent paused is never caught up. An enabled route
shows Pause even when waiting for its next departure or operating window.

Pattern, min/sector and Assigned token share three equal columns, stacking in a
narrow window. Starting/current waypoint and Pick Waypoints on Map are adjacent
and wrap on narrow screens. The existing map picker, token visibility and editor
validation are retained. A Wandering-enabled assignment displays an informational
message; it is allowed and its saved Wandering flag is not modified.

## Private data and backward compatibility

No sector record, portable JSON schema or import/export format changes. Private
route flag version remains 1. Existing routes missing `schedule` behave as Always
Active without resetting position, running state, speed, visibility or progress.
Normal route saves include these fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `schedule.mode` | `always` | `always`, `hours`, or `departure` |
| `schedule.startMinute` | 360 | Operating start, default 06:00 on the standard calendar |
| `schedule.stopMinute` | 1080 | Operating stop, default 18:00 |
| `schedule.departureMinute` | 360 | Daily departure, default 06:00 |
| `schedule.restrictHours` | false | Limit a scheduled trip to operating hours |
| `scheduleState.homeIndex` | current waypoint | Home established when departure scheduling is configured/reconciled |
| `scheduleState.homeDirection` | current direction | Home phase of the route |
| `scheduleState.remainingSteps` | null | Null means waiting; otherwise transitions left in this trip |
| `scheduleState.nextDepartureMs` | next departure | Absolute world-clock timestamp while waiting; null during a trip |
| `encounter` | absent | Acknowledged sector and hostile token IDs; no encounter data is sent to players |

Scheduling state is optional outside departure mode. Before/after movement
checkpoints include trip state, so a genuine token failure restores the original
schedule progress as well as waypoint, direction and time baseline. A verified
move with an uncertain Journal acknowledgment reconciles without moving twice.
Older pending intents remain readable. A trip stopped precisely on its final
transition can temporarily have zero remaining steps; its next active tick
normalizes it to waiting without another token move.

Changing schedule configuration or route geometry/current waypoint establishes a
new departure home at the current waypoint. Geometry/current-waypoint edits retain
the existing reset-of-progress policy. Speed-only edits retain the completed
fraction and remaining trip transitions. Manual on-route repositioning establishes
a new home and resets partial progress; off-route movement still pauses safely.
Assignment waits for any existing native movement to finish. No token is created.

## World-calendar calculations

Only `game.time.worldTime` and its normal `updateWorldTime` hook drive movement.
The module does not advance the clock. `game.time.calendar.days` supplies hours
per day, minutes per hour and seconds per minute; `timeToComponents` aligns daily
boundaries to the calendar's time of day. No computer time, local timezone, Date
object, timer or calendar plugin is used. Simulated environments without a calendar
use a documented 24-hour/60-minute/60-second fallback; live v14 supplies a calendar.
Configured times are validated against that calendar and displayed as HH:MM.
The existing min/sector speed remains measured in elapsed world seconds (60 seconds
per existing speed minute); changing a calendar does not silently change speed.

Operating intervals include the start and exclude the stop. Start equal to stop
is rejected; choose Always Active for unrestricted travel. A window such as
22:00–04:00 is split at midnight. A prefix integral counts whole active days plus
the partial first/last day, using integer milliseconds/BigInt. It never loops
through minutes or days. For example, 17:30–18:00 earns 30 minutes; the same partial
sector remains overnight and completes at 06:30 the next morning at 60 min/sector.

A departure starts one full route cycle: a loop wraps to its starting waypoint;
a back-and-forth route reaches the opposite end and returns home. If home is an
interior waypoint, a full direction cycle visits both endpoints and returns to
that same waypoint/direction. A trip continues across midnight and skips scheduled
departures while underway. After completion, the next departure is strictly after
the completion timestamp, including completion exactly at departure time.
An idle Start chooses the next departure at or after the new baseline. Start
exactly at departure permits that departure. Starting later never catches up a
missed departure. Pausing an active journey retains its remaining transitions.

For a large jump, bounded binary search locates trip completion in active time;
identical daily departure cycles are skipped arithmetically. Fractional progress,
rewind high-water protection and duplicate-clock-event protection remain intact.
After a rewind, time below the saved high-water baseline is not processed again.
If the world's calendar configuration itself is changed, pause and review/edit the
schedule before continuing; arbitrary mid-trip calendar reconfiguration is not a
new supported migration mechanism.

The v14 API shape was checked against the pinned public type declarations
([GameTime](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/helpers/time.d.mts),
[CalendarData](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/data/calendar.d.mts)).
This is source/API verification, not live Foundry testing.

## Hostile collision and acknowledgment policy

Use native `CONST.TOKEN_DISPOSITIONS.FRIENDLY` and `HOSTILE` (standard +1/-1).
Only opposite dispositions collide. Neutral, secret/other disposition values,
same-side tokens, the patrol itself and tokens on other Scenes are excluded.
Any other native token centered in a calibrated Zone sector is eligible, including
hidden tokens and player-controlled tokens: disposition, not ownership, determines
hostility. Coordinates are derived from persisted token data, including dimensions.
No Actor faction heuristics or "not friendly means hostile" rule is added.

Each tick snapshots hostile occupied sectors and inspects the logical waypoint
sequence up to one complete cycle. Later cycles repeat the same occupancy, so even
very large jumps inspect at most 2(n−1) route transitions. The elapsed-time
calculation is capped at the first hostile transition. The token moves directly
to that first hostile sector through the existing verified durable movement API;
with no collision it retains the existing single final native movement behavior.
The destination is checked again after the native move completes, including for
hostiles that arrived while it was pending. Full-cycle returns that need no native
position change still receive the collision check.

After verified arrival, the route pauses at that waypoint with zero partial
progress for its next transition. Time after the encounter within the large jump
is discarded, not banked for automatic travel after Start. The trip's remaining
transitions are retained. The processed baseline is the current world timestamp.
If movement itself fails, none of the proposed waypoint/progress/trip checkpoint is
committed and no successful-encounter warning is emitted.

Only the active GM warns, after state is persisted, with route name, sector and
hostile names. Update/stop hook duplication does not repeat it. Start acknowledges
the current collision and permits departure without another immediate warning.
Leaving and reentering a sector can stop the route again. A different hostile
arriving in the occupied sector can also stop it. Acknowledged hostiles that leave
are removed from the acknowledgment, so their return is a new collision.

Native completed update/stop hooks detect a hostile moving into an enabled/waiting
patrol, including movement from Random Wandering or another patrol. They do not
write token positions or recurse. Paused routes stay paused without repeated
warnings. This is sector occupancy detection, not interpolated simulation of all
actors' historical paths during a large clock jump. No combat, random encounter,
Campaign Log entry, inventory or economic action is created.

## Random Wandering ownership

The existing `store.patrolTokens` index is refreshed from all private assignments,
regardless of running/schedule/encounter state. Wandering's existing `baseEligible`
check excludes that index both during candidate selection and immediately before
movement. Flags and Wandering settings are preserved. Saving an unassignment or
deleting the route rebuilds the index and restores normal Wandering eligibility.
Reload builds ownership before the normal movement listeners are used.

Patrol hooks also distinguish `myzWandering` updates. If an obsolete/external call
still moves an assigned token, the route pauses with an explicit conflict status;
it does not accept that movement as legitimate waypoint progress. Normal Wandering
cannot initiate such a movement while the assignment exists. This is not a global
manual-movement veto and adds no hook restriction bypass.

## Files

- `scripts/patrols/schedule.mjs`: pure schedule validation, calendar integration,
  interval arithmetic, trip state, cycle skipping and transition limits.
- `scripts/patrols/hostility.mjs`: shared opposing-disposition/occupancy and bounded
  intermediate-waypoint inspection.
- `scripts/patrols/model.mjs`: validates optional private schedule/acknowledgment state.
- `scripts/patrols/movement.mjs`: includes trip state in recoverable progress checkpoints.
- `scripts/patrols/service.mjs`: schedule integration, collisions, authority,
  acknowledgment and defensive Wandering distinction.
- `scripts/patrols/ui.mjs`: Start/Pause, responsive controls, schedule form and ownership info.
- `tests/patrol-schedule.test.mjs`, `tests/patrol-service.test.mjs`,
  `tests/patrol-browser.cjs`: arithmetic, integration, recovery and actual browser controls.
- `module.json`, `README.md`, `docs/patrol-routes.md`, this guide: packaged module
  declarations, prepared 0.1.60 version and usage/testing documentation.

## Manual Foundry v14 checklist — not performed here

Use a backup official MYZ world, with two GM accounts and a player where possible.

1. Create/save a route. Confirm Start, stopped state and correct native centering.
2. Start it. Confirm Pause. Pause with partial progress, advance days and Start;
   verify waypoint/direction/progress retained and no catch-up movement.
3. Check the three equal columns and adjacent waypoint/map-pick controls. Resize
   to a narrow window; verify stacking, scrolling, readable labels and no overflow.
4. Configure 06:00–18:00 operating hours at 60 min/sector. Start at 17:30, advance
   through 18:00, overnight and 06:30; expect exactly one completed sector.
5. Test a 22:00–04:00 window, exact boundaries and a multi-day jump.
6. Set a 06:00 daily departure. Before 06:00 it waits with Pause visible; at 06:00
   it begins. Complete a loop; confirm it waits home for the next departure.
7. Repeat for Back and Forth. Test a long journey lasting several days and optional
   daylight restrictions; verify departures while underway do not restart it.
8. Pause while waiting and while traveling; Start later, checking partial progress,
   skipped missed departures, reload persistence and clock rewind protection.
9. Put a Hostile native token two waypoints ahead of a Friendly patrol. Advance
   enough time for many cycles. Verify it stops in that intermediate sector and
   only the active GM gets one warning containing the hostile name.
10. Reverse the dispositions. Check neutral/same-side/self/other-Scene exclusions.
11. Start after a hostile stop. Confirm it can leave without another warning;
    return later and verify it can stop again. Move a new hostile into a waiting
    patrol, including using Wandering; verify update/stop hooks do not duplicate it.
12. Enable Wandering on the patrol token before assignment. Verify the editor info
    and that Wander Now/Party-entry Wandering cannot move it while running,
    waiting, manually paused or hostile-paused. Its saved enabled flag must remain.
13. Remove assignment and test Wandering again. Reassign and delete the route;
    verify ownership is released and the native token/configuration are retained.
14. Manually reposition on/off route. Check safe reconciliation and a new departure
    home when appropriate. Verify no clock changes or Party travel effects.
15. Reload partway through a scheduled trip, including while viewing another Scene.
    Check elected-GM handoff, private Journal permissions, player denial and no
    duplicate clock processing or encounter warning.
16. Test rejected native movement and Journal acknowledgment failure. Check safe
    checkpoint recovery and no false encounter warning before verified arrival.
17. Verify sector import/export, map interactions, ordinary Wandering, Travel,
    combat logging and Campaign Log remain unchanged.

No version tag or release is created by this update. Live hook timing, movement
restrictions/animation, custom calendar configuration and multi-client behavior
still require this checklist; API simulations do not establish live compatibility.

## Automated validation results

- **624/624 Node tests passed**, including 31 added schedule/service regression
  tests. Existing patrol, movement-failure recovery, Zone, Party, Wandering,
  portable JSON, Travel and Campaign tests remain passing.
- **All 16 browser suites passed.** The patrol suite checks exact Start/Pause
  labels, stopped saves, equal-height/width editor controls, window-responsive
  stacking/no overflow, waypoint/picker alignment, schedule field preservation,
  waiting departure state and Wandering information. Editor screenshot inspected.
- Main entry and all manifest-declared module syntax, release preparation for
  v0.1.60, ZIP integrity, root manifest and packaged source-byte comparisons passed.
- actionlint 1.7.7 and `git diff --check` passed.
- Portable JSON validation: **28 valid and 10 invalid document/schema checks
  passed**. Portable schemas and implementation have no changes.

Browser and native-API simulations are not a substitute for the manual live-world
checklist above. No live Foundry session was used for these results.
