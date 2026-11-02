# MYZ Sector Manager development

## Scope and compatibility
- GM-oriented, Journal-backed Zone/sector tools for FoundryVTT **v14** and the official **Mutant: Year Zero** system. Preserve module ID `myz-sector-manager`, public `game.myzSectorManager` APIs, and existing player-facing shop/roll permissions.
- Read [docs/architecture.md](docs/architecture.md) for subsystem boundaries and [docs/codex-handoff.md](docs/codex-handoff.md) for verified state and regression traps. Historical feature docs may describe superseded behavior; current code wins.
- Use this checkout; do not create worktrees unless requested. Use feature branches and PRs targeting `main`. Tags/releases require explicit authorization; never replace published tags/assets automatically.

## Source map
- `scripts/sector-manager.mjs`: ApplicationV2 editor, draft/save lifecycle, hooks and public API composition.
- `scripts/ui/`, `styles/interface.css`: shared cards, references, drops, images, portraits, scroll/save state and window controls. Top-level domain modules implement sector types, generation, inhabitants, loot and settlement features.
- `scripts/zone/`: calibrated grid, configuration, overlay and Party/Expedition entry orchestration.
- `scripts/travel/`, `scripts/patrols/`, `scripts/wandering/`: entry events/recovery, clock-driven routes, and entry-driven random movement respectively.
- `scripts/campaign/`: sessions, visits, notes and combat logging. `scripts/portable/`: sector JSON schema, serialization, preview and import persistence.
- `tests/`: Node regressions, browser fixtures and portable-schema validation. `.github/workflows/release.yml` and `scripts/prepare-release.mjs`: tagged release validation/packaging.

## Patterns and invariants
- Follow existing `.mjs` ES modules, named exports, injected `env=globalThis` services and pure model helpers. Reuse shared renderers/controllers; avoid a new framework or runtime dependency.
- Escape record-derived HTML/attributes; resolve document references with current permissions. GM-private data must not leak through public chat, sockets or player UI.
- Keep draft state, UI-only state and persisted state separate. Preserve queued writes, stale-record checks, acknowledged partial writes and rerender/scroll handling.
- Only the elected active GM performs authoritative movement/event/log effects. Preserve endpoint detection, duplicate receipts and `myzPatrol`/`myzWandering` origin suppression; services must not advance the clock twice.
- Preserve `flags.myz-sector-manager.sector` version-1 records, stable entry IDs, UUIDs, portraits, unknown/legacy fields and inactive sector-type content. Normal root collections, `special.*` and `settlement.*` are distinct storage models.
- Portable format/schema remain version 1. Use compatible defaults; no destructive migration or schema bump without an explicit requirement. Keep world-specific Zone, route, trigger and Campaign state outside portable sector content.

## Verification and delivery
- Prefer targeted changes and focused tests: `node --test tests/<affected>.test.mjs`; inspect imports and related regressions before widening scope. Documentation-only changes need path/link and `git diff --check` validation, not a release build.
- For application changes, run `node --check scripts/sector-manager.mjs` and the full `node --test tests/*.test.mjs` before review; add relevant UI regressions. Browser scripts run individually with `node tests/<name>-browser.cjs` and require development-only Playwright plus Chromium (some honor `MYZ_CHROMIUM_PATH`).
- Portable/schema changes also require `python tests/validate-portable-schema.py` (development-only `jsonschema`); keep both published schemas aligned with `scripts/portable/schema.mjs`.
- Before release: `node scripts/prepare-release.mjs vX.Y.Z`, `unzip -t dist/myz-sector-manager-vX.Y.Z.zip`, and compare its root `module.json` with the source. The builder refuses existing output; inspect stale generated files before removing them. Run `actionlint .github/workflows/release.yml` where available.
- Keep manifest version, tag, archive and version-specific download URL aligned; preserve the stable manifest URL. Package declared files and explicitly account for indirect assets. Preserve TLS/artifact checks and fail-on-existing-release behavior.
- Tests simulate Foundry. Report exactly what ran; never claim live v14 testing. Supply manual backup-world checks for native movement, dialogs, permissions, persistence and older records as relevant.
