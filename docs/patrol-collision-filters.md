# Patrol collision filters and GM-only chat — 0.1.61

## Investigation and changed behavior

The previous `opposingDisposition` implementation derived the target disposition
from the **patrol** token: Friendly patrols matched Hostile tokens and Hostile
patrols matched Friendly tokens. That explains a Friendly-token stop when a
Hostile-only interpretation was intended. Neutral/Secret patrols matched nothing.
The old code strictly excluded Neutral target values; the reported Neutral
false positive could not be reproduced from that predicate. No live-world token
values were available, and this update does not claim a verified runtime cause
for that part of the report. Current tests explicitly cover Neutral, Secret,
unknown values and adjacent sectors as nonmatches under Hostile-only settings.

The new predicate considers only the **other** token's native disposition and the
route's selected filter. Patrol disposition, visibility, ownership and Actor type
have no bearing on the match. No numeric fallback or "not friendly means hostile"
rule remains in production code.

## Configuration and persistence

The editor adds **Stop for Token Dispositions**, near Schedule, with four
independent, horizontally arranged checkboxes that wrap on narrow windows:

| Option | Default | Runtime source |
| --- | --- | --- |
| Neutral | unchecked | `CONST.TOKEN_DISPOSITIONS.NEUTRAL` |
| Friendly | unchecked | `CONST.TOKEN_DISPOSITIONS.FRIENDLY` |
| Secret | unchecked | `CONST.TOKEN_DISPOSITIONS.SECRET` |
| Hostile | checked | `CONST.TOKEN_DISPOSITIONS.HOSTILE` |

Each private route stores `stopDispositions`, an array of symbolic keys, such as
`["NEUTRAL", "HOSTILE"]`. Runtime constants resolve the numeric values; tests also
use nonstandard numbers to prove the implementation does not assume a mapping.
Missing settings normalize to `["HOSTILE"]` on read and persist on the next normal
write/save. An explicit empty array remains empty and disables disposition stops.
Invalid/duplicate/unknown keys fail validation without replacing saved records.
Existing customized selections survive capture, rerender, save, editing and reload.

Private route flag version remains 1. No sector record or portable JSON schema
changes. Existing schedules, speed, direction, waypoints, partial progress,
visibility, assignment, paused state and Wandering ownership remain intact.
The existing three-column editor and Start/Pause controls are preserved.

## Movement, intermediate sectors and restart

Self, other Scenes and adjacent sectors do not match. Sector occupancy uses the
same persisted TokenDocument center and calibrated Zone-grid conversion as before.
A candidate's native disposition must strictly equal one selected runtime constant;
unknown, missing and textual values are not guessed to be Hostile.

The existing one-cycle waypoint inspection now uses this same predicate everywhere:
large-jump planning, destination verification, completed token update/stop hooks,
and acknowledgment reconciliation. It stops at the first matching intermediate
sector and consolidates all matching occupants there. It does not skip earlier
matches to reach the nominal final position. Movement failure handling and before/
after checkpoints are unchanged. On verified collision, progress for the next
transition is zero, the trip's remaining transitions are retained, and elapsed
time after that collision in the large jump is not banked for catch-up.

A paused route and its sector/token-ID acknowledgment are saved **before** chat.
Start acknowledges occupants already encountered and allows departure. Later
sector entries and newly arriving matching tokens can stop it again. Acknowledged
occupants that leave are removed so returning can be a new collision. Routine
collision handling does not create a combat, random encounter or Campaign Log entry.
Unchecking every disposition still allows manual Pause, missing-token stops and
native movement failures to stop automation normally.

## Persistent GM-only chat

Only the authoritative GM calls `ChatMessage.create`. It uses
`ChatMessage.getWhisperRecipients("GM")`, filters for active GM users, deduplicates
their IDs and sets an explicit **nonempty** `whisper` array. Player IDs and offline
GM recipients are excluded. There is no public-chat fallback. Normal Foundry chat
persistence retains the message after the route window is closed or the world
reloads, subject to ordinary chat deletion/permissions.

Each message has the title **Patrol Stopped**, route name, sector, and a single list
of encountered names with their current disposition labels, followed by the Start
instruction. Route/token names are HTML-escaped. Missing names display **Unnamed
token**, never a token ID. Actor/Token UUIDs and route/internal IDs are not rendered.

Serial route writes, saved paused state and existing encounter acknowledgments
prevent duplicate creation from overlapping update/stop/clock hooks. A GM taking
over observes that paused state, so it does not recreate the report. Stale queued
hook tasks which lose authority remain rejected and are logged without spurious
permission toasts, even if the active writer changes again before the rejection
handler runs. Explicit unauthorized commands still reject normally.

Routine collision toasts are removed. Actual chat/configuration errors may still
warn the GM. If ChatMessage creation fails or returns no confirmed document, the
patrol stays stopped and an error is reported; it never posts publicly or retries
uncertain delivery automatically. Check chat before manually reporting/retrying.
The private stop and chat are separate database operations: a disconnect/authority
handoff after the stop is saved but before chat creation can leave a saved stop
without a chat report. This update favors avoiding duplicate/public messages and
does not add a general message-outbox subsystem.

The v14 API was checked against pinned public
[ChatMessage declarations](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/documents/chat-message.d.mts).
Source/API checks and simulated clients do not establish live Foundry behavior.

## Changed files

- `scripts/patrols/dispositions.mjs`: centralized symbolic options, defaults,
  validation and resolution of all four runtime constants.
- `scripts/patrols/hostility.mjs`: route-filtered matching and intermediate search;
  the historical filename is retained to avoid unrelated file changes.
- `scripts/patrols/collision-report.mjs`: safe consolidated HTML and fail-closed,
  persistent native GM-whisper creation.
- `scripts/patrols/model.mjs`: validates optional route filter settings.
- `scripts/patrols/service.mjs`: normalization/save, shared matching predicate,
  post-persistence chat and stale-authority hook reporting.
- `scripts/patrols/ui.mjs`: responsive checkbox controls and draft capture.
- `tests/patrol-dispositions.test.mjs`, `tests/patrol-service.test.mjs`,
  `tests/patrol-browser.cjs`: matching, persistence, chat privacy, consolidation,
  duplicate hooks/handoff/failures and actual form interactions. Prior tests of
  opposing dispositions were updated to assert the intentionally changed rule;
  existing movement/scheduling assertions remain.
- `module.json`: declares new packaged modules and prepares 0.1.61 download URL.
- `README.md`, `docs/patrol-routes.md`, `docs/patrol-schedules.md`, this document:
  current behavior, historical-policy clarification and manual checks.

## Manual Foundry v14 checklist — not performed here

Use a backup official MYZ world with the configured Zone grid, two GM clients and
at least one player client connected.

1. Create a route. Verify only Hostile is checked. Open an older route without
   settings and verify the same default, preserving its existing movement state.
2. Place Friendly, Neutral and Secret tokens in upcoming sectors, followed by a
   Hostile token. Start and advance the world clock through several sectors.
   Verify it passes nonmatches and stops in the Hostile token's sector.
3. Repeat with different patrol-token dispositions. Its own disposition must not
   change which targets match. Check adjacent-sector and same-token exclusions.
4. Inspect the single **Patrol Stopped** chat: route, sector, names, dispositions
   and Start instruction. It must have a GM-whisper indicator. Check both active
   GM clients receive it and the player client does not. Reload/close the route
   window and confirm normal chat-history persistence.
5. Select Neutral and Secret in addition to Hostile, or Friendly alone. Verify
   each selection changes actual stops, not just notifications. Place multiple
   matching tokens together and verify one consolidated chat, with no toast.
6. Use names containing `<`, `>`, quotes or ampersands. Confirm literal safe text
   and no raw identifiers or executable markup in the card.
7. Uncheck all four and save. Verify movement continues through those occupants;
   manual Pause and actual missing-token/native update failures still work.
8. Start after a collision. It must leave without instantly repeating that stop;
   a later return/new matching arrival must still stop it. Include a Wandering
   token entering its occupied sector and duplicate update/stop hook scenarios.
9. Edit/reload the route. Verify custom selections and an empty selection persist.
   Resize the window: the checkbox row wraps and the existing movement/schedule
   fields, waypoint picker and Start/Pause remain usable.
10. Check operating hours, scheduled departure, partial progress, a multi-day jump,
    token visibility, Wandering suppression and movement-recovery behavior remain.
11. With both GMs connected, test a clock update and a writer handoff; confirm no
    duplicate chat. In a disposable world, deny chat creation and verify the route
    stays stopped with an error and no public fallback or automatic duplicate retry.
12. Confirm ordinary Party travel, combat logging, Campaign Log and sector
    import/export are unchanged.

No version tag or release is created by this PR. Real v14 chat visibility,
persistence, hook timing and multi-client behavior require these live checks.

## Automated validation results

- **638/638 Node tests passed**, including 14 added disposition/chat/service tests.
  Existing scheduling, native movement/failure recovery, Zone, Party, Wandering,
  Travel, Campaign Log and portable JSON regressions remain passing.
- **All 16 browser suites passed.** The expanded patrol suite verifies defaults,
  horizontal/wrapping controls, capture across rerenders, edited/empty selections,
  consolidated GM-whisper payload, restart acknowledgment and no collision toast.
  The editor screenshot was inspected.
- Main entry and all declared module syntax, release preparation for v0.1.61,
  ZIP integrity, root manifest and packaged source-byte comparisons passed.
- actionlint 1.7.7 and `git diff --check` passed.
- Portable schema/example validation: **28 valid and 10 invalid checks passed**.
  Scheduling/movement helpers, Wandering, Zone, Travel, Campaign Log and portable
  implementation files have no changes.
