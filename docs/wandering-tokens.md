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

## Restored wandering and old world data (unreleased v0.1.30)

The runtime is restored to v0.1.27, commit `041bf83c47b2ef8df8025e549c8a67bce6c29a65`. Marker creation/rendering, automatic hiding, marker settings, lifecycle handling, management controls and experimental alignment diagnostics are removed. The module does not automatically change any token's visibility or delete existing Tiles/flags.

For old world data, use the [optional, confirmed GM cleanup macro](legacy-marker-cleanup.md). It deletes only known module-owned legacy marker Tiles on the viewed Scene, clears recognized obsolete tracking flags and removes the three obsolete global options while preserving all normal wandering configuration. Current hidden/visible status, per-token wandering eligibility, ordinary Tiles and other Scenes are preserved. Run it on each affected Scene and manually reveal only the NPCs you intend to show. Unknown schema versions or inaccessible flags may remain inert.
