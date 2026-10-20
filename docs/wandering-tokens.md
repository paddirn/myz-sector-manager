# Wandering Tokens — v0.1.27

Wandering Tokens provides simple, GM-controlled NPC movement on the calibrated **Sector Manager Zone grid**. It does not use tactical grid squares for travel distance, perform pathfinding, roll encounters, or simulate factions/combat. No token wanders unless its own placed-token flag is explicitly enabled.

## Quick setup

1. Configure your Zone Scene, calibrated sector grid and Party/Expedition token in **Zone Map / Tracking → Configure / Tracking** as usual.
2. Open an NPC's placed Token Configuration. At the bottom of **Identity**, find **Sector Manager → Allow Random Wandering** and save the native token form. Alternatively, open its token HUD and click the lock/footprints control. Lock means stationary; footprints means its wandering flag is enabled. The tooltip is **Toggle Random Wandering**. Player-controlled tokens cannot be enabled through these controls.
3. For many NPCs, select their placed tokens on the canvas, then expand **Zone Map / Tracking** in Sector Manager and use **Enable Wandering for Selected Tokens** or **Disable Wandering for Selected Tokens**. Only selected, modifiable TokenDocuments are updated, using native Scene batches. Player-owned tokens are excluded from enablement; one GM summary reports the update count.
4. Open **Module Settings → Wandering Tokens**, or use the **Wandering Tokens** button in Zone Map / Tracking. Save global options there. Automatic wandering defaults to enabled, maximum **2** distinct tokens per check, **Every Party sector entry**, and **Allow Entry into Special Sectors** off. Maximum can be 1–6. Frequency can be every entry, one **25% chance per entry**, or Manual only.
5. **Wander Now** uses the same movement rules immediately, even with automatic wandering disabled or Manual only selected. The active GM receives one small summary; automatic wandering is silent. Players receive no controls, reports or chat messages from this feature.

For example, enable the placed tokens for a Zone Ghoul and a wild dog. After the Party completes a crossing from A1 into B1, up to those two NPCs each move one Zone sector in a randomly chosen valid North/South/East/West direction. They may share a destination, remain hidden, or enter an uncreated sector. Nothing creates a sector record, changes its exploration status, or adds an encounter.

## Eligibility and storage

Global options are stored in the GM-restricted world setting `myz-sector-manager.wanderingConfiguration` (format version 1). Save detects conflicting settings edits. Cancel leaves saved configuration unchanged.

Individual opt-in is `flags.myz-sector-manager.wanderingEnabled === true` on the **placed TokenDocument**. Missing flags mean false. No Actor flags or Actor prototypes are changed. Two tokens from the same Actor have independent opt-ins. Prototype-token defaults are intentionally not provided in this version.

Candidates must belong to the designated Zone Scene, be modifiable by the GM, have at least one valid adjacent destination, and have no active/pending/paused movement or wandering operation. Every registered Party/Expedition token is excluded regardless of its flag. Actor player ownership, native OWNER permission and token ownership are checked for all non-GM users, including offline users and default ownership. Disposition and hidden status do not determine eligibility. An enabled flag does not override these exclusions.

## Grid and movement

The existing grid origin, rectangular dimensions, reference coordinates, axis orientation and conversion helpers determine movement. North/South/East/West are physical map directions, including on swapped/reversed coordinate grids. Candidates are sampled randomly without replacement. A direction is chosen uniformly from that token's valid adjacent sectors, with no indefinite rerolls.

Known Special sectors are excluded as NPC destinations by default; the option permits them. Ordinary and uncreated sectors remain valid, and occupancy is unrestricted. The Party entering a Special or uncreated square still triggers an automatic check independently of NPC destination restrictions.

Token footprints must fit the destination sector and the Scene image rectangle, including native Scene padding coordinates. Relative position within the source sector is retained where possible. A token straddling its current cell is clamped inside the destination; a token larger than a sector cannot wander. Tactical cell size is used only to measure the token footprint, never to select the Zone travel distance.

Movement uses native v14 `TokenDocument.move` when available, with animation requested, automatic rotation/rulers disabled, and wall/cost constraints ignored for abstract Zone travel. Native `update` with animation is the compatibility fallback. Only x/y data is sent; visibility, rotation, elevation, ownership, disposition and Actor data are retained. Other modules, Regions or native movement controls may still stop or pause a move; a paused native move remains awaited until completed/stopped. This feature does not bypass native permissions or other modules' movement hooks.

## Entry ordering and duplicate protection

The existing Party crossing dispatcher owns initialization, token-center detection, completed waypoints and duplicate position filtering. Its order is **Travel Events → Wandering Tokens → sector-entry Macros**. A persistent Travel Event report must be closed before wandering proceeds. Normal-sector Travel/Macro rules remain unchanged, but wandering also runs on valid Special and uncreated destinations.

Same-sector movement, intermediate pass-throughs, initial load, ordinary refreshes and unrelated NPC moves do not trigger checks. Only the active authoritative GM executes wandering. Movement permission, ownership, Party assignments and authority are checked again before token updates. Operations are serialized and individual token identities are held in an in-flight set, rather than one global movement boolean. Programmatic updates include `myzWandering` origin metadata; registration checks also exclude NPCs from Party dispatch on movement/stop hooks.

Before an automatic chance/move, its entry ID is claimed in the existing private configuration Journal's additive `flags.myz-sector-manager.wanderingEntries`, retaining the latest 1000 IDs. Repeated calls/reloads cannot repeat a retained claim. Reconnect does not initiate a fresh crossing; previously completed automatic checks are not replayed. Offline Travel Events recovery does not replay wandering or Macros. A crash after claiming can leave an incomplete check without retries; this avoids moving NPCs twice. Active-GM checks and native updates are not an atomic server transaction: movement already submitted before authority changes cannot be undone, and no completed-movement guarantee is claimed after interruption.

A failed NPC move is logged and other selected NPCs can continue. A failed wandering step does not block subsequent sector-entry actions. Manual errors are summarized for the GM; ordinary automatic movement creates no popups. Sector data and existing Macro firing history are untouched.

## Validation and backup-world checks

Automated tests simulate Foundry APIs and exercise real Chromium interfaces; they do not load a licensed Foundry world. In a backup **Foundry v14 / official MYZ** world, verify:

- The added Identity field saves both checked and unchecked states through native Token Configuration, and a second placed token sharing its Actor remains independent after reload.
- HUD placement/icons and toggle refresh coexist with your other HUD modules; players see neither control.
- Bulk selection changes only selected modifiable NPCs; offline player-owned Actors remain excluded, even with hostile disposition.
- Completed animated Party crossings, teleports and paused waypoints cause one check each; Special and uncreated Party destinations work, with no initial-load or same-sector checks.
- Native NPC animation, token sizes, padded Scene edges, unusual grid orientation, Special destinations and hidden status behave as expected. Check any Region/movement module hooks in your world.
- Two GMs, authority handover, a queued Travel Event report and sequential sector Macros do not duplicate checks or expose private information.
- World reload preserves configuration, flags, sector records and Macro behavior. Manual wandering works with automatic movement disabled and Manual only selected.

## Wandering Tokens: Last Known Positions

Starting with **v0.1.28**, wandering can leave a persistent, player-visible Tile at an NPC's last known position. In **Wandering Tokens → Last Known Position Markers**, these three options default to enabled:

- **Enable Last Known Position Markers**: create one marker before the first eligible movement of a visible NPC. Turn it off to retain the earlier wandering behavior, without marker creation or automatic hiding. Existing markers remain until cleared.
- **Use Grayscale Markers**: new markers request a local PIXI ColorMatrixFilter on their Tile mesh. The source image and shared textures are never modified. Unsupported filters fall back to the original artwork; marker alpha is 0.65 in either case. This option is captured when a marker is created, so existing marker styles do not change when it is toggled.
- **Automatically Hide Wandering Tokens**: hide a marked NPC before its movement is submitted. With this off, a marker can exist while the real token remains visible. Disabling a setting never automatically reveals a token.

For example, a visible **Zone Rat** occupies **B07**. On its first wandering move, Sector Manager leaves a faded Tile at B07, hides the Rat, then moves it to B08. Players continue seeing the faded Rat at B07; the GM can see its hidden token at B08. Later moves leave the marker at B07 until the GM clears or resets it.

The marker uses the **placed token's texture**, not the Actor portrait, with its exact original document x/y and texture scale/tint. New markers are always upright (`rotation: 0`) at the original token elevation **plus 1**. Native v14 `TokenDocument.getSize` converts the captured grid-unit dimensions to a pixel footprint; legacy adapters use the Scene tactical cell dimensions once. Texture scale does not multiply Tile width/height. Standard Tile rendering supplies normal Scene/fog/layer visibility; relative overlap with other tokens follows native elevation/sorting. PNG/JPEG/WebP/transparency and animated textures use native Tile texture support. Unsupported animation/filter combinations retain the original art. Marker Tiles are not hidden, but do not bypass Scene visibility or fog. No tactical collision or separate wandering algorithm is added.

### Previously hidden NPCs and manual revealing

An NPC already hidden on its first marker-enabled wandering move leaves **no player-visible marker**. A persistent suppressed state prevents retroactive marker creation if the GM later reveals it. A hidden NPC is not considered observed merely because it wanders.

Manually revealing a token with an existing marker leaves that marker untouched and does not immediately hide the token again. Its next actual wandering move reapplies automatic hiding if that option is on and the marker still exists. Clear removes the association and suppresses future marker creation until Reset; it does not hide or reveal the real token. A suppressed/cleared token without a marker keeps its current visibility during wandering.

### Clear and reset

The existing GM token HUD gains two additive controls, alongside the wandering toggle:

- **Clear Last Known Position** deletes only markers owned by this module and linked to that token. It leaves token coordinates and visibility unchanged and prevents automatic replacement.
- **Reset Last Known Position** confirms removal of the old marker and explicitly authorizes a new player-visible marker on the next successful wandering move, including for a hidden token. It does not reveal the token or create a new Tile immediately. Be aware that the next marker exposes the token's position at that future move's origin.

In Sector Manager's **Zone Map / Tracking**, **Clear Selected Last Known Positions** applies to the explicitly selected, modifiable tokens. **Clear All Last Known Positions** asks for confirmation and removes only module-owned markers on the currently viewed Scene, clearing corresponding token references. It does not move or reveal tokens, touch other Scenes, or delete ordinary Tiles. A Scene change while an action waits cancels that action rather than applying it to an unintended Scene. Existing HUD controls, including those supplied by other modules, are not replaced.

### Persistence, recovery and privacy

Both documents use `flags.myz-sector-manager.lastKnownPosition`. Token tracking has schema version 1, source Scene/token IDs, a phase, Tile ID where applicable, and operation/origin/visibility data when needed. Tile metadata has `kind: "wandering-last-known"`, version 1, source Scene/token IDs, timestamp, original sector/position, operation ID and grayscale preference. Names are never used as ownership identifiers. The existing `wanderingEnabled` flag keeps its meaning.

Creation is ordered: validate destination/artwork → persist a pending operation → create the Tile → persist its association and hide the token in one token update → await native movement → finalize. No destination means no marker, hide or initialization. Markers do not move or multiply on later wandering checks or ordinary reloads.

Tile/artwork failure prevents movement and does not initialize a successful marker. Hiding failure also prevents movement. If movement fails without leaving its origin, rollback removes the new marker and restores visibility only when this operation successfully hid it and it is still at its origin. A partial/stopped move that changes position retains the original marker and keeps any automatic hiding already applied. Cleanup failures leave pending state for reconciliation instead of revealing an NPC. Interrupted pending operations are inspected by the active GM at Scene readiness/handover and before another marker-enabled move: at-origin operations are cleared conservatively without automatically revealing the token; completed/partial moves retain their existing marker. Pending native moves are left alone until completion/stop. Late Tiles from operations already cleared during handover are removed when received. Interrupted moves are not replayed automatically. Native document updates across Tiles and tokens are not an atomic server transaction; connection loss can require GM review.

Deleting a source token removes only its owned marker. Deleting a Tile manually clears or reconciles stale tracking without replacing it. Copied tokens cannot adopt another token's marker; their copied tracking is cleared. Orphaned module markers are cleaned on Scene readiness. Marker lifecycle mutations share the authoritative GM's wandering queue; per-token in-flight guards, retained entry claims, origin metadata and Party-only dispatch remain in force. Tile, visibility and flag updates do not initiate Party events, Macros or wandering.

Automated tests cover failures, hidden NPC suppression, first/subsequent moves, copies, reloads, cleanup and actual PIXI/WebGL filter isolation. They use simulated Foundry documents. In a backup v14 world, verify native Tile sizing/layering/fog, video/animated artwork, grayscale alongside other filters, player-view hiding before animation, restart/handover recovery, HUD coexistence (including Token HUD Art Button), both cleanup actions, and the following Travel/Macro sequence. No live Foundry verification was performed here.


### Marker source transform fix (v0.1.29)

All source artwork/footprint/position/elevation values are captured once before image loading, pending-state writes, hiding or movement. The Tile uses the captured top-left x/y directly, including fractional/off-grid positions; no center offset, snapping, sector conversion or sprite transform determines its origin. Sector conversion is used only for the stored sector annotation. Rotation is explicitly 0, and marker elevation is source elevation + 1 (including negative values); the source token's elevation/rotation are unchanged.

The old implementation already copied top-left x/y directly, but copied source rotation and re-read appearance/dimensions/elevation after awaited operations. A rotated Tile can appear visually displaced about its center despite unchanged document x/y; live source edits could also change its footprint between capture and creation. No incorrect center-to-origin calculation was found. The fix freezes creation inputs instead of applying correction offsets.

Existing Tiles are not repositioned, rotated or elevated automatically, preserving any GM corrections. No repair operation guesses original positions or elevations from a wandering token's current location. Clear/Reset remain explicit management tools for future marker creation. Verify actual v14 Tile rendering above your background map, elevation/level interactions, native footprint sizing and off-grid/scaled artwork in a backup world; automated tests do not load Foundry itself.
