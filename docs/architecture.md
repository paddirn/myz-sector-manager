# Current architecture

Code baseline: `ef7a012` (manifest `0.1.64`). This is a navigation and contract guide, not a replacement for source. Relative paths below are repository-root paths. Historical feature documents describe the version they were written for.

## Composition and persistence boundaries

`module.json` declares native ES modules and `styles/interface.css`; there is no application bundler or required runtime package installation. `scripts/sector-manager.mjs` composes the services during Foundry init/ready and exposes `game.myzSectorManager`. Sector editing is GM-only, with explicitly separate player shop and party-skill interfaces.

| Owner | State and responsibility |
| --- | --- |
| Sector Journal Entry | `flags.myz-sector-manager.sector`, persisted model version 1; authored content, generation results and type-specific collections |
| Zone configuration Journal | `zoneConfiguration`, selected managed Scene, grid, Ark and Party/Expedition assignments; `scripts/zone/store.mjs` resolves it through `zoneConfigurationId` |
| Travel service | World settings `travelEventsConfiguration` and `partyRoster`; private configuration-Journal `travelEvents` flag for weather, history and processed events |
| Patrol service | Private configuration-Journal `patrolRoutes` state, including assignments, schedule progress and pending movement |
| Wandering service | World `wanderingConfiguration`, Token `wanderingEnabled` flags, private entry receipts |
| Campaign Log | Separate private Journal `campaignLog` flag, located by `campaignLogJournalId`; sessions, visits, notes, receipts and combat tracking |
| UI instance | Draft, selected tab/sector, collapse identities, scroll snapshots and save status; these are not portable content |

Service queues serialize their own operations; they are not a global database transaction. Authority and state are checked again around asynchronous operations. Avoid introducing cross-service waits that deadlock these queues.

## Main Sector Manager window

`SectorManager` in `scripts/sector-manager.mjs` extends Foundry `ApplicationV2`. It owns selection, draft loading/capture, rendering, listeners, explicit saving, partial-write queues and integrations. `scripts/sector-types.mjs` selects the type-specific tabs and normalizes compatible defaults.

| Type | Internal tabs | Content ownership |
| --- | --- | --- |
| Normal | Overview, Locations, Encounters, Loot, Effects, Find the Path, History | Normal root fields/collections; displayed Encounters = Inhabitants and Loot = Gear & Artifacts |
| Special | Overview, Locations, Inhabitants, Gear & Artifacts, Events, Images, Find the Path, History | Primarily `special.*`, plus shared sector fields |
| Settlement | Overview, Projects, Inhabitants, Factions, Events, Threads, Shop | `settlement.*`; specialized Projects, Factions and Shop controllers |

Shared display names do not imply interchangeable data collections. Type conversion/normalization retains supported inactive content. See `scripts/sector-content.mjs`, `sector-fields.mjs`, `inhabitants*.mjs`, `settlement*.mjs`, `loot.mjs` and `sector-images.mjs` for domain rendering and field rules.

Shared UI building blocks live in `scripts/ui/`:

- `entry.mjs` renders card/header markup and accessible collapse controls. Presentation does not create persistent IDs or decide persistence policy.
- `actions.mjs`, `entry-order.mjs` and collection-specific handlers implement collection actions and ordering.
- Document/reference/drop/image/portrait helpers resolve native documents, enforce expected types and permissions, and render previews. `scripts/document-references*.mjs` centralizes configured references.
- `save-state.mjs` compares canonical records and acknowledges only paths actually written. A draft must not silently overwrite another client's unrelated changes.
- `scroll.mjs` preserves position through rerenders. `main-window.mjs` supplies the main frame control, while `SectorManager.DEFAULT_OPTIONS.actions.myzMinimize` dispatches native `minimize()`/`maximize()` calls. Rendering is deferred while minimized; the application instance and draft survive.

Not every edit has the same persistence timing: explicit Save Sector coexists with targeted automatic writes. Inspect the relevant handler and queue before changing save behavior. Keep dirty-state/baseline updates paired with acknowledged persistence.

Generation is separate from display: `sector-randomizer.mjs`, `entry-generation.mjs`, `rolltable-results.mjs` and configured document references resolve tables and stage results before applying them. Environment text can contain a name plus independent `Ruin`, `Threat` and `Artifact` Yes/No flags. Explicit flags override inferred defaults. Do not turn a compound text result into a terrain label containing metadata or treat a TableResult's own UUID as its referenced document.

## Party movement and game clock

`ZoneRuntime` (`scripts/zone/runtime.mjs`) composes `ZoneStore`, overlays/calibration, `SectorEntryTriggers`, Travel Events, Wandering and Patrols. `scripts/zone/grid.mjs` is the geometry authority: canonical sector coordinates and calibrated Scene-pixel bounds are distinct from native Token top-left coordinates.

`SectorEntryTriggers` observes `updateToken`, `moveToken` and `stopToken` through the runtime. It tracks exact assigned Scene/token identities, primes positions at startup, waits for completed destinations and ignores within-sector movement. Intermediate path cells and reload baselines are not entries. Secondary GMs observe state but do not execute authoritative effects.

Destination processing order is significant:

1. Capture the Campaign visit association at detection time.
2. Run eligible Travel Events for saved Normal sectors or genuinely blank grid squares.
3. Run eligible Random Wandering.
4. Execute applicable Normal sector-entry Macros sequentially.

Run Once uses `macroRunOnce`, with legacy `macroEnabled` fallback; `macroDisabled` is separate. Per-token fired/attempt state lives in Journal `entryTriggers`. Preserve duplicate protection and recursion guards. Patrol and Wandering origins (`myzPatrol`, `myzWandering`) update baselines without creating Party travel effects.

`scripts/travel-time.mjs` calculates durations and linked Find the Path modifiers; it does not advance world time. Patrols consume Foundry `game.time.worldTime` updates. Party entry processing and clock advancement are separate mechanisms; do not add another implicit time advance.

## Random Travel Events

`scripts/travel/model.mjs` validates settings/roster/state; `service.mjs` runs queued active-GM event processing; `eligibility.mjs` distinguishes saved Normal, blank, authored and unsupported records. A blank cell is an in-memory context, not a newly created sector Journal. `blankEntry` is independently configurable. An occupied cell with an unsupported record must not be mistaken for blank.

Default weather and encounter checks are independent 1-in-12 rolls; configured reduction for Explored/Cleared encounters uses 1-in-20. Initial weather establishes state silently, and unchanged weather produces no report by itself. Current configuration remains authoritative.

Configured weather/threat tables and nested results use shared safe resolution. Threat Type selects the specific table; Find the Path/Stalker handling is in `stalkers.mjs`. Preserve configured probability semantics, recursion/error handling and independent environment eligibility during generation.

`report.mjs` presents meaningful results in a persistent GM-only DialogV2. Weather and encounter changes share one report; long content scrolls. Close/X resolves the awaited dialog, allowing the event queue and subsequent Macros to continue. Successful events remain in history; notifications are for warnings/errors. `reference.mjs` opens resolved Journal/JournalPage and other native sheets with the appropriate render API and page-parent fallback.

Processed receipts, pending reports and weather revisions protect retries/GM handoff. `recovery.mjs` buffers bounded raw movement data when no active GM is available and revalidates on recovery; it does not replay historical entry Macros. `diagnostics.mjs`/`debug.mjs` expose private inspection/testing without changing gameplay probabilities. See [travel-events.md](travel-events.md) and [travel-event-diagnosis.md](travel-event-diagnosis.md).

## Patrol Routes and scheduling

`scripts/patrols/model.mjs` validates paths and assignments, `schedule.mjs` computes active windows/departures, `movement.mjs` converts/verifies native movement, and `service.mjs` coordinates durable progress. `ui.mjs` and `overlay.mjs` provide editing and map picking. Route definitions are private world configuration, not portable sector content.

The active GM responds to `updateWorldTime`, using integer milliseconds and saved high-water progress. Loop/Ping-Pong paths, active windows crossing midnight and departure cycles are modeled explicitly. Analytical schedule calculations avoid iterating each elapsed minute. Paused time is not accumulated as travel catch-up.

A transition persists a pending intent before moving the assigned native Scene TokenDocument. Coordinates are rounded native top-left positions derived from calibrated cell centers and source token dimensions. Await `TokenDocument.move`, re-resolve the document and inspect source data; prepared animation coordinates or an update return value alone do not prove arrival.

Only verified movement acknowledges waypoint/schedule progress. Failure pauses without consuming the failed transition; Resume reconciles an already-arrived pending move rather than moving twice. Diagnostics distinguish thrown errors, rejected/unapplied movement and failed verification. See [patrol-movement-fix.md](patrol-movement-fix.md).

Collision filters use the route's selected **target dispositions** (default Hostile), not an inferred opposing-disposition rule. Bounded intermediate occupancy checks stop at the first match; stopping persists before a consolidated active-GM whisper. Native token hiding is used; it is not strict network coordinate secrecy. Assigned tokens, including paused ones, are excluded from Random Wandering. See [patrol-schedules.md](patrol-schedules.md) and [patrol-collision-filters.md](patrol-collision-filters.md).

## Random Wandering

`scripts/wandering/model.mjs` validates configuration and eligibility; `service.mjs` owns its queue/receipts and native movement; `ui.mjs` provides controls. Enabled tokens move to eligible cardinal neighboring cells, subject to configured frequency, maximum token count and grid/token-fit limits.

Player-controlled tokens, assigned Party/Expedition tokens, route-assigned tokens and busy tokens are excluded. Automatic wandering runs after Travel Events and before Macros. Movement carries `myzWandering` so it cannot recursively generate travel effects. The former Last Known Position marker feature is absent; do not restore it as part of ordinary movement maintenance. See [wandering-tokens.md](wandering-tokens.md) and [legacy-marker-cleanup.md](legacy-marker-cleanup.md).

## Campaign Log

`scripts/campaign/model.mjs` validates and reduces commands; `service.mjs` persists private state and serializes updates; `ui.mjs` renders the log. GM commands are independent private embedded Journal pages (`campaignLogCommand`), reduced by the elected active GM rather than public socket payloads.

Sessions use real-world ISO timestamps internally, a selected Party identity and a duration/expiry. The service records visits on destination changes, including blank cells. Invalid/unavailable positions do not invent a location. Travel visit capture happens before awaited event dialogs, so later notes retain their original visit association.

`travel-notes.mjs` formats meaningful Travel Event notes; test events and duplicate IDs are excluded. `combat-service.mjs` observes combat lifecycle and `combat.mjs` preserves individual participant identities/defeated state while producing concise **Combat Encounter** notes. Presentation groups matching name/status, omits visible UUID/Scene/location metadata, and keeps visit linkage internally. Previously edited notes are not rewritten for presentation changes. Logging requires an active session; gameplay services do not require recording to be active. See [campaign-log.md](campaign-log.md), [campaign-combat.md](campaign-combat.md) and [travel-log-overlay.md](travel-log-overlay.md).

## Portable sector JSON

`scripts/portable/schema.mjs` defines the supported content shape. `serialization.mjs` validates, normalizes defaults, round-trips supported content and preserves unknown JSON fields under `extensions.unknown`; format and schema are both **1**, as is the sector record version. Files are limited to 5 MiB. Module release version is independent of portable format version.

Export strips world placement/runtime bookkeeping (`code`, `sceneId`, `placement`, pending-save/name bookkeeping); source coordinates/name are informational. Import binds content to an explicitly selected destination. UUID references remain references; importing does not create the external Actors/Items/Journals they point to.

`ui.mjs` previews content/references. `persistence.mjs` captures Scene, selection revision, grid and destination baseline, then rejects stale destinations before writing. Replacement requires confirmation and uses Foundry deletion operators to remove stale nested fields atomically. `lastSectorImport` backs up the replaced sector and trigger state; destination `entryTriggers` are reset. Creation produces a private sector Journal. Zone configuration, routes, Campaign sessions and travel history are not transported.

Published schemas are `docs/sector-portable.schema.json` and `docs/sector-json/sector.schema.json`; examples and the external Python validator exercise both against runtime round trips. Preserve IDs, Unicode, portrait paths, inactive type content and unknown extensions. See [sector-portability.md](sector-portability.md), [sector-json/SECTOR-JSON-GUIDE.md](sector-json/SECTOR-JSON-GUIDE.md) and [ui-phase5.md](ui-phase5.md).

## Verification map

- `node --test tests/*.test.mjs`: complete Node regressions; use individual related files during development.
- `tests/*-browser.cjs`: UI interaction fixtures using development-only Playwright/Chromium; these simulate native Foundry APIs.
- `python tests/validate-portable-schema.py`: both schemas, examples, round trips and invalid fixtures; requires development-only `jsonschema`.
- `scripts/prepare-release.mjs`: tag/manifest/file checks, declared-module syntax and root-manifest ZIP; it does not run tests itself. The release workflow runs Node tests first.
- `.github/workflows/release.yml`: version-tag trigger, scoped contents-write permission, ZIP verification, existing-release refusal, and manifest/ZIP publication. Never overwrite an existing release to repair a local build.

Native movement/animation, multi-client authority handoff, system sheets/dice, clipboard permissions and installed-world data still need live Foundry v14 verification when affected. Browser mocks cannot establish those properties.
