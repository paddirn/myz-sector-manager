# Campaign Log (Foundry VTT v14)

Open Sector Manager → **Log** (between New Sector and Settings), or use
`await game.myzSectorManager.openCampaignLog()` in a GM Script Macro.
The separate resizable window can stay open alongside Sector Manager. Reopening
focuses the same window. It is available only to GMs.

## Record a session

1. Configure the Zone Scene, grid, and Party/Expedition token in the existing
   **Settings → Zone Map / Tracking → Configure / Tracking** controls.
2. Open Log, choose the existing Party/Expedition group, choose a duration, and
   click **Start Session**. A session binds to that group's Scene and Token IDs.
   If several groups exist, explicitly choose the one whose journey this log
   should record. This selector does not change tracking configuration.
3. The initial visit is recorded immediately. Only final token destinations are
   recorded; moving inside a square or repeating a hook adds no visit. A direct
   jump from F5 to J5 records J5, without inventing intervening stops. Returning
   to F5 creates a separate visit.
4. Close Log and continue playing if desired. The toolbar's **● Log** indicator
   remains visible while recording. **End Session** closes the current visit.
   **+30 minutes** and **+60 minutes** extend the saved expiration.
5. Expand sessions and select visits to review notes. **+ Entry** always uses the
   selected visit, including historical visits. The sector button in the details
   opens its existing Sector Manager record; it does not create or modify one.

Configure Settings → Module Settings → MYZ Sector Manager → **Default Campaign
Session Duration** offers 30–360 minutes in 30-minute increments; default 150
minutes (2h 30m). The Log window can override this for a new session. Changing the
setting never changes a running session.

All timestamps use the real-world clock (`Date.now()`), stored as UTC ISO 8601
strings. Display uses the viewing user's browser locale and timezone. Foundry's
world time, pause state, dice, resources, travel events, and entry Macros are not
changed or awaited. Keep GM computers' real-world clocks synchronized.

## Corrections and safety

Session titles can be edited at any time. End recording before correcting session
or visit timestamps, changing a visit's sector, or deleting a visit. Timestamp
editors accept ISO timestamps with timezone; the saved value is normalized to UTC.
Use the session timestamp editor first when extending its historical boundaries.
Invalid dates, departures before arrivals, visits outside session boundaries,
chronological overlaps, and multiple open visits are rejected with clear errors;
the saved record is retained. This deliberately prevents saving an inconsistent
timeline instead of silently repairing it. Gaps between historical visits are
allowed. Deleting an intermediate visit leaves the other records and timestamps
unchanged. A session must retain at least one visit. Destructive deletions require
confirmation. Note edits preserve their creation timestamps and set `modifiedAt`.

An unresolved/outside-Zone destination generates a GM warning, creates no visit,
and leaves the last valid visit open. Reentering a different valid sector closes
that visit then; returning to the same last valid sector keeps it open. Time
outside the Zone is consequently included in that last visit. This is an explicit
limitation: no unknown or fabricated sector is inserted. Correct the history after
ending the session if needed. A missing/reassigned Party group, missing token, or
missing Zone Scene cannot produce invented locations; restore the original
configuration or end the session and start another. Binding is not silently moved
to another expedition token. The designated Scene documents are used even when
the GM views a different Scene.

A historical reference first resolves its saved Journal ID (so renamed or moved
sector records still work), then an unambiguous matching coordinate on the saved
Scene. Deleted or ambiguous records show an error. Notes and selected-visit state
remain available; viewing never creates a sector. No offline movement is inferred.

## Persistence and recovery

Storage is separate from sector-definition flags:

- World setting `myz-sector-manager.campaignLogJournalId`: ID only.
- GM-only Journal **MYZ: Sector Manager / Campaign Log**, default ownership NONE.
- Journal flag `flags.myz-sector-manager.campaignLog`, schema version **1**.
- Temporary embedded Journal Entry Pages hold authenticated GM commands under
  `flags.myz-sector-manager.campaignLogCommand`. They are deleted after processing.

The world setting does not contain notes or history. No player sockets or public
User flags carry Campaign Log information. Foundry's server-side Journal access
checks prevent players from creating/editing its private command pages or state.
The service and UI also reject non-GMs. Do not grant players ownership of this
Journal or expose it through another module.

Only `game.users.activeGM` reduces commands and writes log state. Each GM creates
an independent private command page rather than rewriting a snapshot. The active
GM processes commands serially and saves receipts with state in a single flag
update. Duplicate/recovered commands are idempotent, including interrupted command
page cleanup. Up to 256 receipts for already-removed commands are kept, plus all
receipts whose command pages still exist. Secondary GM windows observe Journal
updates. GM handover scans queued pages and checks expiration. A command timeout
leaves its page queued: check the log before retrying. As with existing module
tracking, authority uses Foundry's active-GM election; this is not a server-side
transaction lock across network partitions. Normal multi-GM execution and handover
are simulated in tests; live multi-client checks remain necessary.

Closing the window does not remove service hooks or its lightweight one-second
expiration timer. Countdown ticks update text only and never write history. Real
movement hooks are event-driven. Reopening restores the current visit. World/GM
reload restores the existing session, with no new visit. If it expired offline,
the next active GM finalizes it using its original expiration for BOTH session end
and visit departure, then displays **Campaign Log: Session recording finished.**
Movements after expiration are ignored. No recording can be persisted while no GM
is connected; unseen offline stops cannot be reconstructed. A clock change affects
real-world timing. Browser timer throttling may delay the notification, but the
saved expiration remains exact and every movement/command checks expiration.

An unknown schema or invalid log fails clearly without overwriting saved data. A
missing Journal with a configured ID is an error, never an automatic replacement.
Back up this Journal with the world. Initial creation is performed by the active
GM; the existing sector/settlement schema and records remain unchanged.

## JSON export format 1

**Export Log** downloads `myz-campaign-log-YYYY-MM-DD.json` at any time, including
when no session is running. The filename's date is UTC. No import is provided.
The exported structure is:

```json
{
  "format": "myz-campaign-log",
  "version": 1,
  "exportedAt": "2026-10-30T21:30:00.000Z",
  "world": {"id": "world-id", "title": "Campaign name"},
  "sessions": [{
    "id": "session-id",
    "number": 1,
    "title": "Optional custom title",
    "startAt": "2026-10-30T19:00:00.000Z",
    "endAt": "2026-10-30T21:30:00.000Z",
    "durationMinutes": 150,
    "expiresAt": "2026-10-30T21:30:00.000Z",
    "status": "completed",
    "party": {"groupId": "configured-group-id", "sceneId": "scene-id", "tokenId": "token-id"},
    "visits": [{
      "id": "visit-id",
      "sessionId": "session-id",
      "coordinate": "F5",
      "sceneId": "scene-id",
      "journalId": "sector-journal-id",
      "arrivalAt": "2026-10-30T19:00:00.000Z",
      "departureAt": "2026-10-30T21:30:00.000Z",
      "notes": [{
        "id": "note-id",
        "visitId": "visit-id",
        "createdAt": "2026-10-30T19:10:00.000Z",
        "modifiedAt": null,
        "text": "The party found shelter."
      }]
    }]
  }]
}
```

An active session has `status: "active"`, `endAt: null`, and one final open visit
with `departureAt: null`. `journalId` can be null for an unrecorded sector square.
Notes are plain text, limited to 20,000 characters; titles to 200. IDs remain stable; the separate session number is editable by the GM. Visits and notes retain their
stored chronological order; the window presents sessions newest first. The
persisted envelope additionally has `nextSessionNumber` and transport `receipts`;
the internal envelope is `{version: 1, nextSessionNumber: 2, sessions: [...],
receipts: [{id: "command-page-id", ok: true}]}` (failed receipts contain `error`
instead of `ok`). These transport fields are excluded from exports. No Actor data, sector definitions, unrelated
settings, or private records from other features are exported.

## Verification in a backup Foundry v14 world

Automated tests use Foundry-shaped mocks; they do not load a licensed Foundry
server. Perform these live checks before releasing:

1. Log appears between New Sector and Settings on empty and selected-sector views.
   Open it twice; one separate window remains and both applications remain usable.
2. Assign the existing Party token, start at F5, check the initial visit, live
   countdown, and toolbar dot. Check the 150-minute default and per-session override.
3. Move inside F5, directly to J5, and back to F5. Confirm three visits, matching
   transition timestamps, and no transient intermediate stops. Repeat while viewing
   another Scene. Existing travel/entry Macros must continue normally.
4. Close Log, move, reopen, then refresh the GM browser. No duplicate session or
   visit should appear. Verify saved expiration is unchanged. Test +30/+60 and
   setting changes. End manually and inspect exact last-visit/session end equality.
5. Let a 30-minute session expire; both timestamps must equal the saved expiration.
   For offline recovery, disconnect GMs until after expiration and reconnect. Verify
   one completion notification and no fictitious offline movements.
6. Connect two GMs. Start simultaneously (only one succeeds), add different notes
   simultaneously, and move the token. Both notes and one transition must survive.
   Disconnect the active GM and repeat using the newly elected GM. Test reconnect.
7. Select the first F5 visit, add/edit/delete notes after returning to F5, and confirm
   they stay on the selected visit. Creation timestamps survive edits. Check titles,
   corrections, invalid times, deletion confirmation, preserved gaps, and stable IDs.
8. Rename/delete a referenced sector. Navigation should find the original Journal
   or warn without creating a record. Test outside-grid movement and reentry.
9. As a player, verify no Log UI or private Journal access, and direct
   `game.myzSectorManager.openCampaignLog()` is rejected. Verify another GM sees
   updated notes but a player receives no campaign contents.
10. Export idle and active history; parse JSON and compare IDs/timestamps/notes.
    Resize to a narrow window, scroll long notes/history, and collapse sessions.
    Confirm old sector records, loot, settings, shops, and macros are unchanged.

## Session numbering, compact display, and toggle macro (0.1.47)

**Edit Session Number** works for active and completed sessions. Enter a positive
whole number; duplicates are rejected. Numbers remain display metadata: session,
visit, and note IDs and relationships are unchanged. No timestamps, notes, or
saved expiration are changed by renumbering. A new session always uses the highest
existing session number plus one. Lowering a number never renumbers other records.
The persisted `nextSessionNumber` is kept in sync after number changes and starts,
but new starts calculate from actual records rather than trusting an old cache.
Version-1 log data and existing numbers load unchanged, without migration. Whole
numbers are bounded by JavaScript's safe-integer range; excessively large numbers
are rejected rather than rounded.

The session list uses approximately 40% of the window, leaving 60% for notes.
Session, selected-visit, and note action buttons are grouped into horizontal rows
with wrapping at narrow widths. Small-window layout switches to stacked panels.
Both panels use the same session-label formatter, including the optional title.
Table arrival/departure cells show local times; hover for full date/time. A visit
on a different local calendar day shows `(+1 day)`, `(+2 days)`, etc. Calendar-day
offsets handle daylight-saving changes; they are not elapsed 24-hour periods. Full
ISO timestamps, timestamp editors, exports, and visit details are unchanged. Note
counts show a small document icon only when nonzero; zero remains visible in muted
text. Counts and titles refresh on persistent updates from either GM.

Create a Foundry **Script Macro**, give it a name such as **Toggle Campaign Session**,
and paste this complete script. Run it as GM:

```js
await game.myzSectorManager.toggleCampaignSession();
```

The stable API is **`game.myzSectorManager.toggleCampaignSession()`**, added to the
existing module API on every world load. It returns a Promise of the updated log,
reports failures through a clear notification, and rejects on failure. No Actor
UUIDs, coordinates, custom arguments, or separate timer are needed. Players are
rejected. The window never opens automatically.

When idle, the API reads **Default Campaign Session Duration**, resolves the Party
using existing Zone Map / Tracking configuration, and submits a start through the
same persistent command queue used by the window. It immediately creates the
initial visit. When recording, it submits an end, closing the current visit with
the session end timestamp. Notifications use the current editable number, e.g.:

- `Campaign Log: Session 21 started. Recording for 2 hours 30 minutes.`
- `Campaign Log: Session 21 ended. Recording stopped.`

A single configured group is selected automatically. With multiple groups, reuse
the last session's group if its Scene/Token assignment still matches. Otherwise a
uniquely named **Party** group is selected. If still ambiguous, recording is not
started: choose the existing group by starting a session in Log once. Missing
or outside-Zone positions fail without an incomplete session. Ending does not
require the Party token still to be available.

Repeated overlapping calls in one GM client share one pending Promise. Across GM
clients, each toggle carries the expected active session ID (or null). The single
authoritative queue checks that expectation before applying the existing start/end
logic. A stale simultaneous toggle is rejected instead of undoing the first GM's
action. After an operation finishes, a later deliberate call toggles normally.
Expiration still uses the original saved timestamp: an already expired session
is finalized before a new start; its end is never rewritten to the macro time.
No changes are made to Foundry pause or world time.

### Additional live checks for 0.1.47

1. In a backup world with existing logs, renumber Session 1 to 20. Reload and check
   that titles, notes, IDs, timestamps, and expiration are preserved. End it and
   start again; expect Session 21. Check duplicate/zero/fractional rejection.
2. At normal and narrow widths, inspect horizontal button rows, 40/60 panels, long
   titles, wrapping, notes, and scrolling. Change title/number with an older visit
   selected; both headings must update without losing that selection.
3. Hover compact timestamps. Check a session spanning local midnight and a
   daylight-saving transition; verify day markers and unchanged ISO exports.
4. Add/delete notes and check nonzero icons and muted zero counts immediately in
   both GM clients.
5. Close Log and run the macro twice: start, then stop. Check notifications, the
   toolbar dot, exactly one initial visit, and no new window. Change the default
   duration and repeat. Refresh and run the same macro again.
6. Repeat while Log is open, double-click the macro, and trigger it simultaneously
   from two GMs. There must be one transition; a stale competing command should
   warn without undoing it. Test automatic expiration and offline recovery again.
7. Check missing/outside-Zone Party handling and multiple-group selection. As a
   player, verify API rejection and no access to private campaign data.

## Automatic Combat Encounter notes (0.1.56)

A combat that **starts while a Campaign Log session is recording** is eligible for
one automatic **Combat Encounter** note. Finish using the Combat Tracker's normal
**End Combat** action or delete the Combat document directly. The integration
finalizes on the confirmed deletion, not on round/turn changes, initiative reset,
deactivation or switching encounters. Cancelling End Combat does not create a
note. Deleting an encounter that never started does not log a completed fight.

The original session must still be active and unexpired when the note is saved.
Combat begun outside a session is not adopted if recording starts midway through
it. Ending/deleting/replacing its original session prevents logging to another
session. Reload restores saved tracking; already-running combats without a saved
binding are deliberately not adopted. Start a new Combat document for a new
encounter; resetting the same document does not create another automatic record.

Participants are tracked by Combatant identity, not display name. The initial
roster, later additions and last known changes persist in the existing private
Campaign Log Journal. Removed combatants remain, with their last observed names,
Actor UUIDs and defeated state. **Defeated** means Foundry's Combatant `defeated`
flag, not dead, zero Strength or zero HP. No damage, initiative, dice, round count,
loot, XP or victory assessment is recorded. Names/reference strings remain even
if an Actor or Scene is unavailable. No replacement documents are created.

At combat start, a matching open Sector Visit is captured only if its Scene and
coordinate match the session's configured Party position and the combat Scene.
That binding stays fixed if the party moves during the fight. No visit is inferred
from the newest history entry or the GM's viewed Scene. A separate battle Scene,
globally unlinked combat, unavailable Party position, or otherwise unmatched combat
uses a **session-level note**. If its captured visit disappears, it also falls back
to session scope. No visit is fabricated. The existing visit detail panel displays
session-level notes beneath a clearly labeled **Session Notes (not associated with
a sector visit)** section; the session header shows their count separately.

New notes use the fixed title **Combat Encounter**. Participants are grouped by
exact display name within **Defeated (N)** and **Other Participants (N)** sections;
counts represent individuals, not grouped rows. Empty sections are omitted.
Defeated rows show quantities (including ×1); other rows show ×N for duplicates.
The body contains no encounter name, Scene/location/sector information, UUIDs or
technical timestamp. The existing header shows the completion time once in the
viewer's local long-date/short-time format, without seconds or milliseconds.
The original ISO creation time, individual identities, source references and visit
context remain internal. Existing generated or GM-edited bodies are not rewritten.
The saved/exported text retains its constant title; the display reuses the category
header rather than repeating that title in the body. Rename it by editing the
first line using **Edit Note**, add commentary or correct
the roster in the same editor, or **Delete Note** normally. This does not change
combat documents. Export Log includes both visit notes and session notes. Combat
notes allow up to 1,000,000 characters so larger rosters remain one note; ordinary
manual notes keep their existing 20,000-character limit. Oversized summaries fail
with a GM warning rather than creating an incomplete or split encounter note.

The existing elected active GM and serialized Campaign Log queue perform writes.
The note and its completed source-Combat marker are saved in the **same Journal
flag update**. Replayed hooks, normal completion followed by another deletion
notification, reloads and ordinary multiple-GM connections cannot normally create
a second note. Completed markers remain even after the GM edits/deletes a note or
deletes its session, so replay cannot overwrite edits or recreate deleted notes.
Players neither record nor see these entries.

Tracking is an additive optional `combatEncounters` array in the existing
`campaignLog` flag (model version 1); unmatched notes use optional `session.notes`.
Notes reuse the established text/timestamp/ID model, with `category` and
`combatUuid` provenance. Existing sessions need no migration. Sector portable
JSON, sector schemas, Travel Events, native Ark documents and combat mechanics
are unchanged. Internal tracking is excluded from Export Log; the normal notes
and their source UUID provenance are exported.

Logging never awaits, cancels or vetoes a combat hook. Failed writes leave the
previous saved log intact and do not create empty placeholder notes. GMs receive
a brief error; the console includes diagnostic details and the captured snapshot.
There is no background retry loop. A repeated confirmed deletion can safely retry
because persisted markers and existing note provenance are checked first. As
with other Campaign Log writes, Foundry supplies no server-side compare-and-swap:
a GM handoff during an already-in-flight server write remains a concurrency risk.
Keep one stable active GM during recording and back up the world. Events occurring
while all GM clients are offline cannot be reconstructed.

See [combat lifecycle, implementation, validation and manual checklist](campaign-combat.md).
