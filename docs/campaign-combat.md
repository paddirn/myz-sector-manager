# Automatic combat summaries — implementation and verification (0.1.56)

## Architecture inspected

Campaign Log is part of MYZ Sector Manager, not a separate module.
`sector-manager.mjs` creates `CampaignLogService`, registers it and starts it at
ready. `campaign/service.mjs` already owns the elected `game.users.activeGM`,
private GM Journal, authoritative state validation, command receipts and shared
write queue. `campaign/model.mjs` owns active/expired session state and visits.
`campaign/ui.mjs` renders escaped plain-text notes with existing edit/delete
commands. Travel Event notes use visit-bound provenance and persisted processed
identities. There was no session-level note collection or combat completion hook.

The feature reuses these components. It does not create another Journal, transport,
settings screen, public socket, Actor flag, combat analytics service or recording
session. The two necessary optional additions are private saved combat snapshots
and session-level notes when a visit cannot be associated safely. Both are
compatible extensions to Campaign Log model version 1; existing records remain
valid. Sector content and portable schemas are untouched.

## Lifecycle evidence and hook choices

Public Foundry API HTML access returned HTTP 403 in this environment, including
a retry. The API audit used published community API types
**14.369.0** at commit
[`e613e06e85f6fcded8a9621ad23337f20d0bff70`](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/tree/e613e06e85f6fcded8a9621ad23337f20d0bff70).
Relevant files are
[`client/documents/combat.d.mts`](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/documents/combat.d.mts)
and [`client/hooks.d.mts`](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/hooks.d.mts).
These are API declarations, not an inspected licensed Foundry runtime.

The declarations identify `Combat.started`, `startCombat` advancing to round 1,
`endCombat` prompting to end/empty the tracker, the Combat document deletion
lifecycle, and a `combatStart` hook on the initiating client **before** database
update. No standalone `combatEnd` hook is declared. The integration uses committed
Document hooks instead of inventing a completion hook or wrapping core methods.
The actual v14 End Combat UI → deletion path and exact runtime callback ordering
must still be checked in the live test below; they were not observed here.

| Hook | Purpose / safety |
| --- | --- |
| `createCombat` | Remember whether a newly created encounter is started; start tracking if created already started and a session is eligible. |
| `updateCombat` | Detect the first observed committed unstarted → started transition on every client, including when another GM initiated start. Capture original session/context; refresh changed combat name. Round/turn reset, inactive/view changes and encounter switching never finalize. |
| `createCombatant` | Merge a late participant into an eligible saved snapshot. |
| `updateCombatant` | Refresh name, Actor/token identity and defeated changes; ignore unrelated initiative updates. |
| `preDeleteCombatant` | Capture the removed participant's last known state on the initiating client. |
| `deleteCombatant` | Retain that participant on the authoritative client too; removal is never inferred as defeat. |
| `preDeleteCombat` | Copy current roster before destruction when the active GM receives this initiating-client hook. Does not finalize, await or veto. Cancellation leaves tracking eligible but creates no note. |
| `deleteCombat` | Confirm completion for normal End Combat/direct document deletion; copy remaining data synchronously and queue one finalization. Never treat individual Combatant deletion as encounter completion. |

An in-memory ever-started map is seeded from existing Combat documents at startup.
A round reset does not erase it. Reloads retain persisted eligible bindings and
removed participants. A running encounter without a saved eligible binding is
not retroactively adopted. Tracking begins only after a committed start: a
cancelled/failed pre-update start intent cannot create a record.

No chat/dice/Actor/token listener is added for this feature. Ordinary round/turn
updates perform only a start-state check, not a roster scan or Journal write.
Roster scans occur at start, relevant name changes and encounter deletion;
Combatant hooks merge only their individual snapshot.

## Participant and context persistence

`campaign/combat.mjs` builds JSON-only snapshots and plain-text summaries. It
preserves Combat UUID/ID/name, captured Scene identity/name, original session ID,
optional visit/coordinate/sector name, start/completion time, participants and
tracking/completed/discarded state. Participants retain distinct Combatant IDs,
last known name, Actor UUID and boolean defeated state. Missing live references
do not replace known names or synthetic Actor UUIDs with empty/fallback values.

`campaign/combat-service.mjs` stores these in optional `combatEncounters` in the
existing GM Journal flag. No live Documents or native system data are stored.
Removed participants stay in the snapshot. A source name/reference can be stale
if no relevant hook was observed before its source was destroyed; no fabricated
history or offline reconstruction is attempted.

Binding is captured at start and rechecked against the authoritative active
session before persistence and finalization. The party must match the actual open
visit's Scene and coordinate for a visit association; combat on another Scene
uses session scope. Moving the Party never changes the binding. A missing visit
falls back to session-level notes, not to the latest unrelated visit. The original
session ending/expiring/deleting or another one starting discards finalization.
A never-started encounter or a combat begun without a session creates no pending
record or note. No session is automatically started.

## Note integration and deduplication

The only active GM writes, through the existing Campaign queue. Each eligible
Combat UUID has one durable tracking record for its lifetime; restarting/resetting
the same document does not produce another automatic note. A completed record is
a receipt even if its note or session has been deleted. Before append, existing
note `combatUuid` provenance across sessions is also checked, covering recovery
states where a note exists but a snapshot still says tracking. The final note and
completed marker share one atomic Journal flag update. Local duplicate hooks are
serialized; ordinary multiple-GM operation uses the same elected writer.

One note uses the existing ID/createdAt/modifiedAt/text model plus category
`Combat Encounter` and `combatUuid`. Visit notes stay in `visit.notes`; unmatched
notes use optional `session.notes` with `visitId: null`. Both use the same escaped
renderer and edit/delete commands. Session notes are clearly labeled beneath the
selected visit without implying that they belong to it. Header counts distinguish
session notes from visit counts. Renaming uses the first line of the editable
text; the category remains meaningful after edits. GM edits and deletion are not
overwritten or undone by lifecycle replay.

A combat note may contain up to 1,000,000 characters to keep a large roster in one
note; existing regular note limits remain unchanged. Oversized/invalid summaries
fail before persistence. On failure, the prior log is retained; diagnostic console
output includes the captured snapshot. Hooks return immediately and cannot stop
combat completion. No empty failure note or background retry loop is added.
An uncertain successful write is recognized by the durable marker/note provenance
on the next explicit event; a failed write can be retried by a repeated confirmed
delete event without duplicate notes. No automatic recovery GUI is introduced.

## Files changed

- `scripts/campaign/combat.mjs`: identities, snapshot/merge, summary text and saved
  combat-record validation; no mechanics or document writes.
- `scripts/campaign/combat-service.mjs`: lifecycle tracking, eligibility/context,
  persisted snapshots, authoritative queued finalization and safe errors.
- `scripts/campaign/service.mjs`: owns/starts/stops the tracker using existing state,
  permissions, lifecycle and queue.
- `scripts/campaign/model.mjs`: optional tracking/session-note validation; existing
  note edit/delete now supports session scope and combat-specific text limits.
- `scripts/campaign/ui.mjs`: shared escaped note renderer, Combat Encounter label,
  session-level notes/counts and existing editing controls.
- `module.json`: declares both new modules and prepares aligned 0.1.56 assets.
- `tests/campaign-combat.test.mjs`: completion, eligibility, participants, visits,
  reload/handoff, duplicate/edit/delete, failed/uncertain writes and large rosters.
- `tests/campaign-combat-browser.cjs`, `tests/campaign-log-browser.cjs`: focused real
  browser DOM route using the existing Foundry simulation, plus retained original
  regression path.
- `README.md`, `docs/campaign-log.md`, this document: operation, limits and testing.

## Automated validation

- `node --test tests/*.test.mjs`: 552 tests passed, including all existing Campaign
  and Sector Manager tests and 17 new focused combat tests.
- `node tests/campaign-combat-browser.cjs`: passed hook-driven summaries,
  persisted removed participant/reload, escaped malicious-looking names,
  visit/session scope, edit/delete/replay/export, note size controls and narrow
  layout. A 580px browser screenshot was inspected; full Foundry theme is absent.
- Each `node tests/*browser.cjs` suite: all 15 passed. This includes Campaign Log,
  party rolls, Travel Events, wandering, Player Shop, overlay and UI Phases 2–5.
- Final checks passed: `node --check scripts/sector-manager.mjs`, manifest/module
  syntax and file validation through `node scripts/prepare-release.mjs v0.1.56`,
  `unzip -t` integrity, byte comparisons of root manifest/README/all declared
  modules/styles, actionlint 1.7.7 and `git diff --check`.
- `python tests/validate-portable-schema.py`: 28 valid and 10 invalid document/Schema
  checks passed; sector portability implementation and Schema files have no diff.

Tests simulate Foundry documents/hooks; they do not invoke the installed native
Combat Tracker or prove the actual callback order of a licensed v14 runtime.
Existing test expectations were not weakened or removed. No release/tag is
created by the implementation PR.

## Practical manual Foundry v14 checklist — unverified

Use a backed-up official MYZ world. These checks require a live Foundry install.

1. Start recording a Campaign session with a configured Party in a known sector.
   Start a new Combat in that Zone Scene with several combatants. Verify no note
   appears during start, turns, initiative reset, active encounter switch or a
   cancelled End Combat confirmation.
2. Add someone during the fight. Mark one defeated. Remove a different participant
   before completion, including one marked defeated. Rename another participant.
   Include two combatants with the same display name.
3. Use native **End Combat**. Verify the v14 `deleteCombat` callback occurs and
   exactly one Combat Encounter note includes all observed participants grouped
   by name/status, correct individual counts, readable local header time and the
   original visit. UUIDs/Scene/sector context stay internal. No HP/rounds/
   victory/dice transcript should appear. If this v14 build ends without deleting
   the Combat document, stop release testing and report its actual lifecycle;
   deactivation must not be guessed as completion.
4. Edit the title/roster/commentary via Edit Note, then test any later/replayed
   deletion notification; the edits must remain and no second note appear. Delete
   the note and verify replay does not recreate it.
5. Repeat with a **direct Combat document deletion**. Confirm cancelling deletion
   does not log. Deleting a never-started prepared encounter should not log a fight.
6. Start combat in a separate battle Scene, or without a matching active visit.
   Confirm a session-level note appears, clearly separated from visit notes; edit,
   delete and Export Log it normally. No extra visit should be invented.
7. Move the Party to another sector during an eligible fight. End it while the
   same session is active: its note must retain the original visit/context.
8. Start combat without recording, then begin a session mid-fight; completing it
   must create no note. Also end/expire/delete the original session during combat,
   optionally start another: the fight must not leak into that other session.
9. Reload during combat after adding/removing/defeating participants. Complete
   after reload; the original session binding and removed roster must survive.
   A running combat without a previously saved eligible binding must not be adopted.
10. Connect two GMs. Start from the non-active GM's client, complete/delete there,
    and verify the elected active GM creates just one note. Test a controlled
    handoff after tracking has saved. Disconnect all GMs only to confirm that
    missed offline history is not reconstructed.
11. Make an Actor or Scene unavailable after the start. Verify saved names,
    reference strings and participants remain. Check GM-only Journal access and
    no player notification or player view of encounter details.
12. In a disposable world, simulate denied Campaign Log persistence. Confirm combat
    still ends, prior notes remain, a concise GM error and console snapshot exist,
    and no empty note is created. Check the saved log before an explicit retry.

## Remaining limits

- Live v14 End Combat/deletion ordering, native dialogs/reload, user permissions
  and actual multiple-client behavior are unverified until the checklist runs.
- Foundry has no server-side uniqueness/CAS transaction for the existing shared
  flag. Ordinary one-active-GM operation is serialized, but a GM change during an
  in-flight write or external edits to the same flag remains a race risk.
- Offline or missed hooks cannot reconstruct unseen participants or states.
  Saved snapshots protect observed history, not unobserved events.
- Separate battle Scenes are not guessed to represent a Zone coordinate; they
  use session notes unless the existing visit/Scene relationship actually matches.
- Terminal source-Combat receipts are deliberately retained even after note/session
  deletion to preserve idempotency. No automatic archival/pruning is introduced.

## Concise presentation update (0.1.57)

Only `combatNoteText` and note presentation change. New stored/exported note text
starts with **Combat Encounter**, then Defeated and Other Participants groups.
Grouping is exact-name and status-specific, preserving first-observed order within
each section. Counts include every individual even when rows collapse to ×N.
Defeated singletons show ×1; other singletons show just their name. Empty sections
are omitted; a zero-participant encounter retains the existing explanatory text.

No source encounter name, Scene/location, UUID or completion timestamp is appended
to the new body. The existing category header supplies the visible title once;
its date uses the viewer's locale/timezone with long date and short time. The
saved `createdAt` remains unchanged for ordering, persistence and export. An
explicit America/New_York test checks that 23:30:48.253Z displays as 7:30 PM rather
than UTC, seconds or milliseconds. Native note text remains escaped plain text.

No lifecycle, eligibility, snapshot/identity, visit, persistence, schema or
deduplication logic changes. Existing bodies, including GM edits and older
technical content, are not rewritten. The UI only avoids repeating the exact
new constant-title prefix; editing/export still sees the full original text.

Validation: 556 Node tests pass, including four new presentation/legacy/timezone
tests and existing Campaign Log regressions. Both Campaign Log and combat browser
suites pass; syntax, workflow lint, packaging and ZIP checks are also run for
0.1.57. Modified files: `scripts/campaign/combat.mjs`, `scripts/campaign/ui.mjs`,
`tests/campaign-combat.test.mjs`, `tests/campaign-combat-browser.cjs`, `module.json`,
`README.md`, `docs/campaign-log.md` and this document.

Manual check in a backup Foundry v14 world: finish a fight with duplicate names
across both defeated states, inspect correct group counts and a single local
header timestamp, verify the original visit, edit/export the note, and replay
completion without duplication. Reopen an old edited note to verify its body is
unchanged. Live Foundry/theme verification remains outstanding; local tests use
simulated APIs. Viewer locale determines exact date punctuation and 12/24-hour
clock. No tag or release is published by this update.
