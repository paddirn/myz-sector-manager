# Sector list, Travel Event notes, session deletion, and grid fading (0.1.48)

## Sector list

Each sidebar entry has separate block elements for the sector name and metadata.
Long names wrap naturally; metadata always starts below the name. Metadata is
`Exploration Status • Normal`, `Exploration Status • Special`, or
`Exploration Status • Settlement`. The former separator before status is removed.
The existing font sizes and colors are retained. Settlement now uses a single
4px solid left border, like Special, retaining its configured green accent. No
sector classifications or saved sector fields change.

## Travel Events in Campaign Log

The existing sector-entry endpoint workflow now captures a Campaign Log visit
binding before its queued Travel Event work begins. The binding contains stable
`sessionId` and `visitId`, not a coordinate lookup that could select an older visit.
It runs through the SAME Campaign Log position reducer used by its existing token
hooks. It shares existing Zone configuration and coordinate detection. Duplicate
movement hooks do not create duplicate visits.

After a non-test, persisted Travel Event actually generates changed weather and/or
an encounter, Travel Events calls the Campaign Log integration BEFORE opening its
existing persistent report. The note goes to the captured destination visit even
if later movements have already occurred or a prior report delayed generation.
It does not depend on the selected visit in the Log window.

The recording session must still be active and unexpired, and its group, Scene,
Token, visit, and destination coordinates must match. No active recording means no
note, session, or invented visit. Preview/test runs, initial/unchanged weather,
failed chance rolls, and configuration errors alone do not create notes. Unresolved
or mismatched destinations fail safely without attaching to another visit. Offline
Travel recovery without an observed Campaign Log visit cannot reconstruct missing
history: it warns rather than fabricating a visit. A delayed result from a prior
recording session is not attached to a new one.

Notes begin with **Travel Event** and preserve destination/title, weather changes,
encounter narrative and reference, Find the Path/Stalker details and suggestions,
and relevant diagnostics. Creation time is the event's real-world timestamp in
UTC ISO format. They use the ordinary note controls for editing and deletion.
Descriptions exceeding the existing 20,000-character note limit are split into
multiple ordinary notes without truncating content; Unicode surrogate pairs are
kept together. Existing report dialogs, chat behavior, history, chance mechanics,
and entry Macro ordering are retained. Campaign write failures produce a warning
without suppressing the Travel Event report/history; check history if a note could
not be saved.

### Persistent duplicate protection and data compatibility

Campaign Log stays at schema version 1. Existing records are accepted unchanged.
Only visits receiving generated events gain optional `travelEventIds: [id, ...]`;
new generated notes additionally have optional `travelEventId: id`. All normal
note fields (`id`, `visitId`, `createdAt`, `modifiedAt`, `text`) are unchanged.
The visit's processed IDs survive note edits and deletion, so a replay cannot
recreate a deleted event note. State and duplicate identifiers are saved together
by the active GM's existing serial queue. Other GMs observe the Journal update.
GM handover recovery can retry a saved event with its binding; the same event ID
still produces at most one set of notes. Reviewing/rerendering reports does not
request a new note. These optional Campaign Log fields are included in its scoped
JSON export; sector-definition data and schemas are unchanged.

## Delete Session

**Delete Session** sits next to Start Session in the recording toolbar (or next
to the active recording controls). Select a visit or click a session heading to
select its session. The button is disabled when there is no selection.

The first confirmation names the session number/title and warns that all visits
and notes are permanently deleted. Cancel is the default. For a recording session,
a SECOND confirmation explicitly requires stopping recording and deleting it.
The authoritative command also requires `stopRecording: true` while it is active,
so direct calls cannot bypass that safeguard.

Deletion removes only the selected session's nested records. Active state is
derived from persisted sessions, so deletion immediately clears active recording,
countdown, toolbar indicator, and pending movement state. Already queued movement
or event work retains the old session ID and cannot write into another session.
The remaining sessions retain their IDs, numbers, notes, and timestamps. Future
numbering uses the highest remaining number plus one (or 1 for empty history).
Deleted numbers may consequently be reused; new sessions always get fresh random
internal IDs. Deleting the last session leaves a valid empty history and export.
This operation does not delete the Campaign Log storage Journal or other settings.

## Overlay fading

Saved version-1 sector Journal records on the managed Scene are distance sources,
including Unexplored records. Unsaved draft coordinates do not move the saved
source. Empty coordinate labels retain their existing color at alpha 0.5; recorded
coordinates remain alpha 1. Other text, markers, icons, tokens, and the map image
are unaffected. Calibration preview remains fully legible.

The square grid uses shortest Chebyshev distance to any saved coordinate:

| Cell distance | Relative grid alpha |
| --- | --- |
| 0 or 1 | 1.00 |
| 2 | 0.75 |
| 3 | 0.55 |
| 4 or farther | 0.35 |

These factors multiply the existing grid alpha (0.7), retaining its color. For
shared edges the brighter adjoining cell wins. Half-cell segments interpolate
along the edge to soften changes between distance bands. Every physical grid edge
is emitted once; adjacent cells never draw overlapping borders. No recorded
sectors produces a uniform factor of 0.35, so creating the first sector remains
possible.

`scripts/zone/fading.mjs` builds a sparse capped distance field using eight-neighbor
breadth-first expansion only through distance 3. It does not allocate a matrix for
the entire Zone. One record needs at most 49 stored cells, even on a 1000×1000 map.
The fade field/edge segments are cached by Scene, grid geometry, and the sorted
set of saved coordinates. Creation, deletion, coordinate changes, reconfiguration,
and reopening refresh appropriately. Token movement and note/status edits do not
recompute distance information. Line segments are indexed by grid line and clipped
to the padded viewport before drawing. Existing 2,000-label culling and pointer
interaction safeguards remain in place. No per-frame distance calculation or
external rendering dependency was added.

## Backup-world Foundry v14 checks

Automated tests simulate Foundry APIs; PIXI tests use real WebGL but do not load
Foundry itself. Before release, verify:

1. Normal, Special, and Settlement sidebar entries have names above metadata at
   normal/narrow widths. Long names wrap. Special and Settlement bars match in
   width/placement with only their colors differing.
2. Start Campaign Log, move to a new Normal sector, and trigger weather-only,
   encounter-only, and combined events. Check a normal note appears on the exact
   destination visit before closing the unchanged Travel report. Check generated
   details and real timestamp; edit/delete it with ordinary note controls.
3. Move rapidly/revisit a sector while a report remains open, then close queued
   reports. Each event must target its own visit. Review/reopen reports and refresh
   GMs: no duplicate notes. Test no recording, preview/no-event, mismatched Party,
   expiration, and a deleted destination visit/session.
4. Connect two GMs and test event persistence/handover. Existing Travel history and
   reports must remain available if the Campaign Log write fails. Verify players
   cannot read or modify private notes or delete sessions.
5. Select a historical session, Cancel deletion, then confirm. Other sessions must
   remain unchanged. On an active session, Cancel the second confirmation first;
   then explicitly stop/delete. Check the dot/countdown, movements after deletion,
   fresh session IDs, numbering, and valid export after deleting the last session.
6. Compare saved Unexplored and empty labels. Add/delete/move saved sector records
   and check fading updates. Pan/zoom a large map; distant grid lines stay visible,
   saved neighborhoods remain clear, and there are no dark shared-edge seams.
   Confirm calibration, map colors, tokens, marker images, hover tooltips, left
   clicks, drags, and right clicks retain their behavior.
