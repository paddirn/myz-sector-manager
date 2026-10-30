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
Notes are plain text, limited to 20,000 characters; titles to 200. IDs and the
separate sequential session number remain stable. Visits and notes retain their
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
