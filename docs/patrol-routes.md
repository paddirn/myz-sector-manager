# Zone Patrols / Trade Routes

Current scheduling and collision behavior: [0.1.60 guide](patrol-schedules.md).

## Architecture and integration decisions

The existing Zone uses **native Scene TokenDocuments**, a calibrated rectangular
grid (`zone/grid.mjs`), a passive GM PIXI overlay/map picker, and a private
Configuration Journal referenced by the `zoneConfigurationId` world setting.
The existing active-GM authority and `ZoneStore` write queue are reused.

Party travel durations in `travel-time.mjs` are a **reference calculator**. Neither
Party tracking nor the current Travel Events implementation advances game time.
Routes therefore observe Foundry's authoritative `game.time.worldTime` via
`updateWorldTime`; they never advance time or count Party movement events.
If a calendar/travel tool advances that same clock, it drives routes normally.
Otherwise the GM advances Foundry world time explicitly. No wall-clock timer,
competing calendar, economy, inventory, random encounter, combat, loot, Campaign Log or
sector-exploration automation is added.

Waypoint validation reuses the existing coordinate conversion and Zone distance
semantics: a neighbor has sector distance 1, including diagonals. Random Wandering
has its own explicitly cardinal-only behavior and is unchanged apart from
excluding route-assigned tokens, preventing competing movement controllers.
No pathfinding or invented intermediate sectors are used.

## GM workflow

1. Configure the Zone Scene and grid as usual. Open Sector Manager Settings →
   **Patrols / Trade Routes**. A GM Script Macro may also call:
   `await game.myzSectorManager.zone.patrols()`.
2. Choose **Create Route**, name it, choose **Back and Forth** or **Loop**, and set
   **min/sector** (default **60**). This is the route's configured movement
   rate, not a terrain/vehicle rule.
3. Choose **Pick Waypoints on Map**, then click each adjacent sector in order.
   Picking is deliberately armed: ordinary selection resumes after **Stop Picking**
   or Escape. Pan/right-drag and zoom remain available. No sector records are
   created and no exploration status changes. Distant/repeated consecutive points
   are rejected; select all intervening neighbors. Loop closure is automatic, so
   do not add the first waypoint again at the end.
4. Use Up/Down/Remove to change the draft order. The selected path shows numbered
   waypoints and direction arrows in the existing Foundry PIXI stage; other saved
   paths use subdued lines. Repeated nonconsecutive sectors display their waypoint
   ordinals together. Route graphics never receive pointer events.
5. Choose an existing Zone token and a **Starting / current waypoint**. Assignment
   is optional while authoring; Start requires a valid token. Only GM-controlled,
   non-player-owned tokens are eligible. Party/Expedition and Ark tokens are
   protected. Each token can belong to only one route, including paused routes.
6. Set **Visible to Players**, then **Save Route**. Saving explicitly centers the
   assigned token on the chosen waypoint and applies native visibility. It leaves
   the route paused. Review the result and click **Start**.
7. Advance the authoritative clock. At 60 minutes/sector, 20+20+20 minutes completes
   one transition. A 150-minute advance completes two and keeps 30 minutes. Partial
   progress leaves the token centered in its current sector. Large jumps compute
   the final safe position directly after checking intermediate waypoints for hostile occupancy, with no intermediate token animations.
8. **Pause** preserves the waypoint, direction and partial progress. **Start**
   establishes a fresh baseline and does not catch up paused time. **Show Path**
   views the configured Zone locally and centers on the route; it does not activate
   the Scene for players.

Only the elected active GM edits/resumes/advances routes. Other GMs may inspect
private route information and paths through a read-only window. Players cannot
open the manager, read routes through the module API, select route geometry or
submit route commands. No public route-state transport is introduced.

### Example: two settlements

If settlements occupy A1 and C1, select **A1 → B1 → C1**, choose **Back and Forth**,
assign the caravan token and use 60 minutes/sector. After two game hours it arrives
at C1; after another hour it returns to B1. Endpoints are not duplicated during
reversal. A two-waypoint route A1 ↔ B1 is also valid. A three-point straight Loop
A1 → B1 → C1 is invalid because C1 cannot close directly to A1; choose Back and
Forth or select a genuine closed path such as A1 → B1 → B2 → A2.
No settlement transactions or Campaign Log entries occur.

Without a calendar tool, a GM Script Macro can advance the native clock directly:

```js
await game.time.advance(60 * 60); // one in-game hour (seconds)
```

Use `30 * 60` for 30 minutes or `24 * 60 * 60` for one day. These are explicit GM
clock changes, not a second patrol clock. The route manager observes the resulting
normal world-time hook.


## Editing, manual movement and deletion

Opening an existing route for editing pauses it immediately. Cancel/close discards
the draft but **leaves it paused**; Start is explicit. Editing one route does not
require stopping other routes. Per-route stale-state checks reject concurrent
changes to that route while allowing other routes' clock progress.

Geometry or a chosen starting-waypoint change resets partial progress. Changing
speed alone preserves the completed fraction, rounded down to an integer
millisecond. Ordinary pauses preserve exact progress. If old geometry no longer
contains the current sector, choose a valid starting waypoint explicitly; no
silent reset to the beginning occurs. Scene/grid changes pause old routes. Reopen
and review their geometry against the current grid and choose a starting sector;
changing the Zone Scene also clears the draft token assignment to prevent linking
to an unrelated token with the same ID.

A completed manual drag to another on-route sector synchronizes the nearest
matching waypoint index (ties choose the lower index), resets partial progress
and establishes a new clock baseline. Pingpong endpoints face inward. Dragging
inside the same sector retains progress and returns the token to the sector
center. Repeated sectors keep separate route positions; manual synchronization is
deterministic. An off-route drag pauses automation and leaves the token where the
GM placed it. Return it to a waypoint and Start, or edit the route. Token updates
must finish before resuming; a pending/paused native movement pauses the route.
Visibility follows the route setting, so edit the route to change its visibility.

A deleted/unavailable token pauses the route and preserves its definition and
assignment for replacement. Edit to select another existing token. To reassign a
token to a different route, clear its old assignment first. Deleting a route asks
for confirmation and never deletes the token. The token retains its last position
and visibility; the route controller and its Wandering exclusion are removed.

## Clock and recovery policy

Foundry world time is measured in seconds; the module converts absolute timestamps
to integer milliseconds. Positive speed values must also be representable to a
millisecond. State math uses integer/BigInt division and modulo, not repeated
floating-point minute additions. Loop and back-and-forth movement run in constant
time per route even when many cycles elapse. No intermediate animated steps or
side effects are generated.

Each route stores its last processed timestamp. Duplicate hooks at the same time
cannot claim the interval again. After a **rewind**, the previous timestamp remains
a high-water mark: there is no reverse movement or negative progress. Advancement
waits until the clock exceeds that mark. Pause/Resume also preserve that high-water
mark if the clock is still behind it. This intentionally prevents recounting time
that was already processed.

Zero world time is valid. Missing/nonfinite/unrepresentable world time pauses
running routes with a useful status; no real-time fallback is used. Restore the
clock and Start. Reload/reconnect processes elapsed game time for routes that
were saved running; saved paused routes do not catch up. Changing the viewed Scene
never changes a route's Scene or coordinate system. Native tokens can update on
the configured Scene even when the GM views another Scene.

## Persistence, idempotency and permissions

Definitions and movement state are in
`flags.myz-sector-manager.patrolRoutes` on the existing **GM-private Configuration
Journal**, separate from `zoneConfiguration` and all sector flags. The world setting
contains only that Journal's ID. The manager refuses writes if that Journal grants
player/default ownership. Do not grant players access to the Configuration Journal.
Sector portable JSON, its format/schema versions and existing records are unchanged.

The flag is `{version:1, revision, routes:[]}`. Each route has a stable ID/name,
Scene ID, calibrated-grid fingerprint, ordered waypoints, pattern, minutes/sector,
`assignments` array (currently at most one Scene/token pair), index, direction,
integer partial progress, last timestamp, running/visibility status and issue text.
The assignment array permits future multiple assignments without changing how a
route owns speed/position. Optional `pending` movement contains only a target and
observed native token baseline. It is private, not a token flag or public socket.

Before moving a token, the service durably saves an intent with the before/after
waypoint, progress and timestamp checkpoints. Public progress remains at the
before checkpoint until movement is verified. It then moves only native `x`, `y`
and `hidden`, with animation disabled, verifies persisted Scene token source data
and commits the after checkpoint while acknowledging the intent. On recovery:

- If the token is already at the target, acknowledge without moving it again.
- If it is still at the saved baseline, complete the already-claimed movement.
- If someone moved it elsewhere, pause and require review rather than teleport
  over that change.
- A failed token update retains the pending intent and pauses the route. Resume
  explicitly retries/reconciles it and establishes a fresh baseline.
- A failed intent write causes no token movement. A failed acknowledgement leaves
  the intent for safe reconciliation after reload or the next clock event.

Route and native Token documents cannot share a Foundry transaction. This durable
intent protocol avoids replaying elapsed time across their normal failure boundary.
The elected active GM and existing Zone queue serialize ordinary commands and
clock events. Foundry offers no server compare-and-swap/unique-writer transaction;
a GM handoff during an in-flight write or two clients logged in as the same active
GM remains a concurrency limitation. Keep one stable active GM when managing routes.
Malformed route state is retained and reported, not overwritten with defaults;
route automation stops without preventing the rest of Sector Manager from loading.

## Player visibility boundary

Per the requested choice, this feature uses **standard native Foundry token
hiding**, not a separate marker renderer. Visible to Players clears `Token.hidden`;
GM-only sets it. Scene access, vision and the rest of Foundry's normal visibility
rules still apply. The module does not activate Scenes or force visibility through
walls/vision. Paths, waypoint order, speed, private progress and manager state
remain GM-only, and the passive PIXI route overlay is never created for players.
Revoking GM status closes the route window and removes its geometry.

Native hidden TokenDocument data may still be replicated to player clients by
Foundry. **Hidden does not provide strict coordinate confidentiality.** This is
the acknowledged native visibility boundary, not a promise to conceal native
coordinates from a player inspecting client data. The module adds no player-facing
route payload or custom socket broadcast of hidden geometry.

## Files and validation

- New `scripts/patrols/model.mjs`: validation, integer clock/progress math and manual
  waypoint reconciliation using existing grid math.
- New `scripts/patrols/service.mjs`: private storage, active-GM queue, world-time
  hooks, native assignments/movement, recovery, pause/resume and permissions.
- New `scripts/patrols/overlay.mjs`: passive geometry on the existing PIXI stage.
- New `scripts/patrols/ui.mjs`: route list/editor, map picking and scoped styles.
- `scripts/zone/runtime.mjs`: lifecycle, menu button and guarded window API.
- `scripts/wandering/model.mjs`: excludes assigned route tokens, even while paused.
- `module.json`: declares module files and prepares 0.1.58 download URL.
- `tests/patrol-model.test.mjs`, `tests/patrol-service.test.mjs`, `tests/patrol-overlay.test.mjs`,
  `tests/patrol-browser.cjs`, `tests/interface-browser.cjs`: new coverage and one
  intentional menu-label expectation/fixture entry point.
- `README.md` and this document: usage, integration decisions and manual checks.

Run Node tests with `node --test tests/*.test.mjs`. The focused browser command is
`node tests/patrol-browser.cjs`; other browser suites run individually as
`node tests/<suite>-browser.cjs`. These simulate Foundry APIs in real Chromium,
not a live licensed Foundry installation. Syntax/release preparation, ZIP integrity
and root manifest/module byte comparisons, workflow lint and portable-schema
validation are part of the final review checks. No release/tag is created by this PR.

## Manual Foundry v14 checklist — not performed here

Use a backup official MYZ world.

1. Configure a Zone grid (also test reversed/swapped axes) and create a native NPC
   caravan token that fits a sector and is not a Party/Ark/player-owned token.
2. Open Patrols / Trade Routes, name a route, map-pick adjacent waypoints including
   a diagonal, inspect their numbers/arrows, reorder/remove a point and Cancel.
3. Save a valid route at 60 minutes/sector with a chosen start and assignment.
   Confirm the token is centered, the definition is paused, and Start works.
4. Advance **Foundry world time** one hour and verify one transition. If using a
   tool that advances time on Party travel, move the Party and confirm exactly
   one transition through the same clock event. Without that tool, Party movement
   alone must not move the route. The module does not advance the clock itself.
5. Advance 30 minutes twice, then 150 minutes; inspect exact saved partial progress
   and final position. Test long jumps/many cycles, two-point routes, repeated
   sectors, valid Loop wrap and Back and Forth endpoints without duplicated stops.
6. Pause with partial progress, advance many hours and Start. Confirm no paused-time
   catch-up; rewind the clock and confirm no reverse movement or interval replay.
7. Reload/reconnect while partially complete. Check the saved baseline and position
   on the configured Scene, including while viewing another Scene.
8. Drag on-route and off-route; inspect synchronized index/direction or pause/status.
   Verify the next tick does not teleport over a manual change. Test grid changes.
9. Edit a running route and Cancel; verify it remains paused. Remove its current
   waypoint and require an explicit start. Test speed changes and stale concurrent
   edits. Reassign/remove a token, delete a token, and assign a replacement.
10. With a player connected, toggle Visible to Players; check native visibility
    updates while the map is open. Confirm no route geometry/UI is available to
    that player and the Configuration Journal has default/player ownership NONE.
11. Test two GM accounts; only the elected active GM edits/advances. Replayed clock
    notifications should not move twice. Avoid switching writers during a save.
12. Cancel and confirm route deletion; the token must remain with its current
    properties. Check ordinary wandering/Party movement, sector selection,
    existing overlays, panning, zoom and sector import/export remain functional.
13. In a disposable copy, test denied native token/Journal updates and pending
    movement recovery. Inspect the concise GM status and console diagnostic; no
    empty replacement state or automatic token/Actor creation should occur.

Real v14 world-time hook timing, native movement/vision, GM handoff and player
permissions require this checklist. Browser tests cannot establish those live
behaviors. Roads, terrain penalties, vehicle stats, resources, encounters, combat,
trade profits and Campaign Log integration remain deliberately out of scope.

### Final automated results (0.1.58)

- `node --test tests/*.test.mjs`: **583/583 passed**, including 27 new patrol
  model/service/overlay tests.
- All **16 browser suites passed**; the focused patrol browser was rerun after
  final route fixes. Real Chromium checks map picking, invalid input, draft
  reorder/removal/cancel, clock progress, visibility, passive geometry, token
  retention and player denial. The route editor screenshot was inspected. PIXI
  route primitives are additionally checked in isolation; native Foundry rendering
  remains a live check.
- `node --check scripts/sector-manager.mjs`, release preparation for v0.1.58,
  all declared JavaScript syntax/files, `unzip -t`, byte comparisons of ZIP root
  manifest/README/all declared modules/styles, actionlint 1.7.7 and
  `git diff --check`: passed.
- `python tests/validate-portable-schema.py`: **28 valid and 10 invalid checks
  passed** across both schemas. Sector portability implementation and schemas
  are unchanged.

## Native token movement fix (0.1.59)

See [the investigation, diagnostics and regression report](patrol-movement-fix.md).
Native v14 x/y are integer top-left coordinates, and prepared fields can be
animated. The patrol service now normalizes its calibrated center to integer
top-left pixels, awaits `TokenDocument.move` for positional changes, and verifies
`toObject(true)` source data from the assigned Scene's current TokenDocument.
Visibility-only changes still use `update`. No hook validation is bypassed.

On a genuine rejection, exception or wrong-source position, the route pauses and
retains its prior waypoint, partial progress and time baseline. The private pending
intent holds the proposed after checkpoint for a safe Resume. If movement already
succeeded but acknowledgement failed, source verification commits that checkpoint
without issuing a second move. Console diagnostics distinguish rejection, exception
and verification mismatch and include the route/token/Scene, start/destination
sectors, expected/source/prepared coordinates and returned result summary.

Existing 0.1.58 intents remain readable, including fractional target coordinates.
Already completed intents reconcile without moving twice. Older intents did not
store a before-progress checkpoint, so historical pre-fix consumption cannot be
reconstructed or automatically undone; no speculative history is invented.
