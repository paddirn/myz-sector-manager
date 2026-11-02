# Codex development handoff

Verified source baseline: `ef7a012` on `main`, module `0.1.64`. This document describes code present in the checkout, not a promise of live-world testing or release availability. Read [architecture.md](architecture.md) for ownership and call paths; follow root [AGENTS.md](../AGENTS.md) for development rules.

## Implemented features

- Journal-backed Normal, Special and Settlement sector editing, with type-specific tabs, shared cards/actions, document references, portraits, previews, dirty-state and scroll handling.
- Sector/entry generation from configured RollTables, including compound plain-text environment flags and nested/document results.
- Settlement inhabitants, factions, events, threads, projects, linked Ark functionality, GM Shop editing and standalone player purchases/resource trading; party skill-roll interfaces.
- Calibrated Zone grid/overlay, Ark and Party/Expedition tracking, distance/travel-time displays and sequential per-token Run Once/repeatable entry Macros.
- Automatic Travel Events for saved Normal sectors and eligible blank squares; weather, encounters, Find the Path integration, private history, diagnostics/testing, recovery and persistent queued reports.
- Clock-driven Patrol/Trade Routes with map-picked waypoints, schedules/departures, durable native-token movement, collision disposition filters and GM reports.
- Entry-driven Random Wandering with ownership, Party and patrol exclusions.
- Campaign sessions/visits, editable notes, automatic Travel Event and Combat Encounter notes, private command processing and recording toggle API.
- Portable format-1/schema-1 sector JSON validation, preview, import/export, unknown-field preservation and replacement backup.
- Main-window native Minimize/Restore action wiring and deferred rendering to preserve drafts while minimized.
- Version-tag GitHub Actions release packaging with manifest/ZIP validation and protection against replacing existing releases.

## Architectural decisions to preserve

- Foundry v14 and official Mutant: Year Zero; unchanged module ID and public APIs. GM-private configuration remains separate from explicitly player-facing features.
- Persisted sector version 1 and portable format/schema 1. Normal, Special and Settlement content remain separate; visual consistency does not justify merging their storage models.
- Shared UI helpers own presentation/interaction; domain modules retain field semantics and persistence policy. Existing explicit saves and automatic partial saves must retain optimistic conflict checks.
- Active-GM authority, queues, receipts and movement-origin flags prevent duplicate effects. Party entry processing does not implicitly advance world time; patrol scheduling consumes world-time changes.
- Blank Travel Event contexts do not create sector records. A cell containing unsupported/authored data is not blank.
- Native token hiding is the selected patrol visibility model; route definitions remain private. No claim of strict coordinate secrecy on player clients.
- Native ApplicationV2 minimize/maximize preserves the instance; do not replace it with DOM hiding or close/reopen.
- Import binds content to a validated destination and preserves unsupported JSON in extensions; external UUID targets are not automatically copied between worlds.

## Fixed regression areas worth retesting

These are documented fixes, not a current bug list.

| Area | Regression and present safeguard | Starting points |
| --- | --- | --- |
| Main-window controls | Frame metadata alone did not register a native action; the corrected fixture dispatches through `DEFAULT_OPTIONS.actions`. Deferred renders and rapid-toggle serialization protect state. | `scripts/ui/main-window.mjs`, `tests/main-window.test.mjs`, `docs/minimize-fix.md` |
| Journal references | Synthetic link events could fail to open encounter references; resolve documents and use native sheet APIs/JournalPage parent navigation. | `scripts/travel/reference.mjs`, `tests/travel-reference.test.mjs` |
| Patrol arrival | Fractional requested coordinates and prepared animation fields falsely failed verification; advanced progress could be consumed too early. Integer source coordinates, awaited movement and durable intent now separate arrival from acknowledgement. | `scripts/patrols/movement.mjs`, `scripts/patrols/service.mjs`, `tests/patrol-service.test.mjs` |
| Table parsing | Single-line labeled metadata, nested tables and document references cannot be assumed to be structured fields or TableResult UUIDs. | `scripts/rolltable-results.mjs`, `scripts/entry-generation.mjs`, related generation/travel tests |
| Blank-cell travel | Requiring an existing Normal Journal prevented events on unrecorded map cells. Eligibility and recovery now explicitly distinguish blank cells. | `scripts/travel/eligibility.mjs`, `tests/travel-events.test.mjs`, `tests/travel-recovery.test.mjs` |
| Portable/UI compatibility | Refactoring cards and references must not drop inactive content, unknown fields, portrait paths or manually authored values. | `scripts/portable/`, `tests/portable-sectors.test.mjs`, `docs/ui-phase5.md` |
| Collision rules | Older documentation used opposing dispositions; current filtering uses the route's selected target dispositions. | `scripts/patrols/dispositions.mjs`, `tests/patrol-dispositions.test.mjs`, `docs/patrol-collision-filters.md` |

## Known limitations and unfinished verification

- No additional reproducible open application defect has been established by this documentation task. Historical bug reports alone are not evidence of a remaining defect.
- Foundry v14 is simulated by local tests. Native window geometry/animation, actual Journal sheets, system dice behavior, permissions and multiple connected GM clients require live backup-world verification when changed.
- Patrol stopping and its GM ChatMessage are separate writes. A crash between them can leave a persisted stop without a message; uncertain message delivery is not blindly retried. Preserve safe route state over duplicate reporting.
- Native hidden-token positions may be replicated to player clients; strict coordinate secrecy is not implemented.
- Imported UUIDs can be missing or inaccessible in a different world; preview/warnings do not transfer external documents. Malformed/newer formats fail instead of destructively guessing a migration.
- Current release asset availability and a user's installed-world data are outside this documentation check. Do not infer them from the manifest version or a local test pass.

## Verification and next session

This documentation pass verified local links/literal file paths, passed `git diff --check`, and ran all 665 Node tests successfully. Application files and the manifest were unchanged. Browser interaction, packaging and live Foundry checks were not rerun for this documentation-only change. See AGENTS.md for exact commands and architecture.md for coverage boundaries.

Start a future task by reading these guides, checking `git status` and the current branch/manifest, then following the relevant source imports and tests. Keep changes focused, preserve stored data and authority boundaries, and update these guides only when implementation facts change. Do not create root `HANDOFF.md`; this is the repository's requested handoff location.
