# Document reference audit and migration design — v0.1.24

Audited runtime scripts, module.json, repository assets/data, documentation and tests for UUID literals, directory lookups, fromUuid/fromUuidSync, names/constants and indirect ID mappings. Found **28 unique module-level RollTable dependencies**: 13 generation, 2 events, 13 terrain descriptions. All are configurable registry entries. There are **0 bundled defaults**: no source table exports, authored descriptions or redistribution authorization are present. No fixed module-level Actor, Item, Scene, Macro, Journal or compendium dependency was found.

## Complete resource inventory

All fixed world UUIDs now live exclusively in `scripts/document-references.mjs` as migration candidates, never fresh-world defaults. The consumer column identifies both the original source and the current registry caller. Every row is configurable and expects RollTable documents; bundled defaults are unavailable for every row.

| Registry key | Discovered legacy UUID | Purpose | Consumer | Expected type | Requirement |
|---|---|---|---|---|---|
| `generation.environment` | `RollTable.UEm95WiZocwvFGSU` | Sector Environment | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.ruinsA` | `RollTable.QxY3EmhqXMdKa3sC` | Normal Ruins | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.ruinsB` | `RollTable.n1CEYKphbiBZLDUb` | Industrial Ruins | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.rot` | `RollTable.rp2JNLkCDatudc88` | Rot Level | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.threatLevel` | `RollTable.3FWOT8OJaXc7bfrC` | Threat Level | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.threatType` | `RollTable.Kk8jRbrOk3NejHUB` | Threat Type | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.humanoid` | `RollTable.5ZVTmWwi5wyi52rd` | Humanoid Threats | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.encounter` | `RollTable.Sh3Srm3KHyGgR7uh` | D66 Encounters | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.monster` | `RollTable.tsNy12fCcREgIDLk` | Monster Threats | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.phenomenon` | `RollTable.jIRwumcfuFBGU8Zp` | Phenomena | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.artifact` | `RollTable.aarjzrm2IwJYczhi` | Artifacts | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.mood` | `RollTable.8aGJhfpHDBv52W1K` | Sector Mood | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `generation.scrap` | `RollTable.sWLvZ6qZikXt2k6l` | Scrap | sector-randomizer.mjs / entry-generation.mjs | RollTable | Required |
| `events.zone` | `RollTable.24wtBybpf1ObKbcG` | Zone Events | entry-generation.mjs | RollTable | Optional |
| `events.ark` | `RollTable.c5Saikp36mQWGqL1` | Ark Events | entry-generation.mjs | RollTable | Optional |
| `terrainDescriptions.ashDesert` | `RollTable.FMb1CJATTxsXLKNy` | Ash Desert | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.crumblingRuins` | `RollTable.iOuf5HBkPTJRtai7` | Crumbling Ruins | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.deadWoods` | `RollTable.DDIlg70LYjP70uGk` | Dead Woods | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.decayedRuins` | `RollTable.cB0RcJZRY9SCZMIs` | Decayed Ruins | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.derelictIndustries` | `RollTable.PlKYSGrma1BD3ZOw` | Derelict Industries | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.glasifiedField` | `RollTable.AFvYlL3SKE7TJlyy` | Glasified Field | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.hugeCrater` | `RollTable.yJ2ZT69torV7PyQn` | Huge Crater | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.marshlands` | `RollTable.udnDBnBSFQz5NrJl` | Marshlands | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.overgrownRuins` | `RollTable.LJR12IhuWO5QidLz` | Overgrown Ruins | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.scrublands` | `RollTable.6y7FfEQgbSGMO9Rk` | Scrublands | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.settlement` | `RollTable.QmXrOSRquBrSMKgo` | Settlement | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.thickWoods` | `RollTable.5esCJTuBkL01hsE4` | Thick Woods | terrain-descriptions.mjs | RollTable | Optional |
| `terrainDescriptions.unscathedRuins` | `RollTable.bf0HSWkE02OfTqK9` | Unscathed Ruins | terrain-descriptions.mjs | RollTable | Optional |

## Registry and resolution contract

The registry defines stable keys, labels, categories, types, required/optional status, descriptions, default UUIDs, legacy UUIDs and migration identity aliases. Current values/statuses are resolved from the restricted world setting `documentReferences` (format version 1). Resolution is explicit custom override → bundled default only when default/unset → unavailable; disabled prevents fallback. All current default UUIDs are null. No name-based substitution occurs. Resolvers check exact UUID, type, roll capability and Observer access, with fresh lookup on each operation. An optional description failure preserves existing text and deduplicates repeated warnings. Missing required generation dependencies fail that atomic generation attempt; manual sector editing and unrelated features remain usable.

`TABLE_UUIDS`, `EVENT_TABLES` and `TERRAIN_DESCRIPTION_TABLES` exports remain legacy compatibility inventories. Runtime consumers use registry keys, never these IDs as fallback. Threat parent/category classification also uses configured subtype UUIDs; old nested references fail clearly instead of being misclassified. Generation probabilities, environment flags and result-document resolution remain unchanged.

## Versioned migration strategy for every inventory row

On ready, before consumers start, only the active GM runs migration version 1. Existing overrides, including disabled/default, are retained. For absent entries, probe the listed legacy UUID and validate type/access. Require a recognized normalized name (aliases in the registry) and usable formula/ranged nonempty results. Terrain-description tables additionally require six equally weighted results covering 1–6 and formula 1d6, independent of row order. Successful candidates become world overrides.

A resolving UUID alone is insufficient evidence of identity. Wrong-type, missing, inaccessible or ambiguously named/structured candidates are recorded for explicit GM review and never automatically activated. The settings page displays candidate UUID/name and offers a confirmed review/assignment action. Worlds with nonstandard names may require this review; exact-ID/type checks cannot prove identity. A single settings write stores version/time/outcomes. Concurrent configuration changes abort migration without writing; failed migration is retryable from Settings. Repeated startup is idempotent. Original sector flags, document IDs, pages, stored references, Macro state and tracking configuration are never rewritten by this migration.

## References deliberately retained with their owner

- `sector-manager.mjs`, `sector-types.mjs`: Normal Locations/Encounters/Loot/Effects/History references; Special Scene/Locations/Inhabitants/Gear/Events/Images references; Effects Macro UUIDs. These remain per-sector, including exact embedded-page UUIDs.
- `location-text.mjs`, `sector-randomizer.mjs`: returned RollTable document UUIDs, inline/result metadata, nested references and generation provenance remain result-specific. Native getDocument and legacy collection/document-ID metadata fallback are retained.
- `zone/store.mjs`, `zone/config.mjs`, `zone/runtime.mjs`, `zone/presentation.mjs`: designated Scene IDs, Scene-token IDs, optional group Actor UUIDs and retained legacy Ark data remain world tracking configuration.
- `zone/entry-triggers.mjs`: stable Effect IDs, Macro UUIDs, sector Journal identity and per-token execution state remain attached to the sector.
- `game.journal.get` and `game.scenes.get` select records/configured Scenes using saved IDs; these are not hardcoded content dependencies. The internal configuration Journal setting, module ID, schema version, folder names and keybinding IDs remain internal.
- `module.json` contained no packs/assets providing table content. Other UUID literals are documentation examples or tests, not additional runtime dependencies.

## Import/export and conflict safety

Exports contain only reference modes/UUIDs, optional names/types and version metadata. They do not export documents, sector data, tracking state or credentials. Merge changes imported keys; Replace returns omitted keys to defaults. Imports validate structure/version/keys/types/size/prototype safety, resolve candidates and show a preview before confirmation. Draft changes require Save. Missing imported UUIDs and names remain available for correction; no unrelated substitute is chosen. Save uses one restricted native settings write with optimistic stale-baseline detection, not a distributed transaction.

## Portable assets still needed

Supply the actual 13 authored terrain-table exports, including the six original result descriptions, paragraph breaks, 1d6 formula, weights and ranges, plus redistribution permission. IDs cannot reconstruct content. Other commercial MYZ tables remain GM-provided unless redistribution is separately authorized. No world data was silently copied, no descriptions were fabricated, and no proprietary rulebook content or pretend-working empty compendium was bundled. Future legal packs need stable module-owned IDs and the supported v14 compendium build format. Settings are registry-driven and can grow without implementing a custom terrain editor.
