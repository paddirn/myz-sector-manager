# Phase 5 portable field coverage

This matrix enumerates every object property in the named portable Schema families.
UI purpose comes from the source-audited field catalog; not every persisted field has a separate editor control.
The focused browser audit additionally checks every named control rendered in all 22 tabs against runtime descriptors (140 normalized paths).

**Coverage key:** Flag = recognized persisted sector content/metadata; Envelope = file-only metadata; Export/Import/Schema = recognized by all three, with the documented deterministic defaults and model normalizations.
References are saved identifiers/snapshots, never live Documents. Unknown fields are quarantined, not active model fields.
Tests: P = portable-sectors; D = sector-json-documentation; B = ui-phase5-browser. P/D cover each family; B checks rendered editable paths and saved round trips. This does not claim every possible value combination is tested.

| Field | Editor / purpose | Classification | Storage | Export / Import / Schema | Coverage |
| --- | --- | --- | --- | --- | --- |
| `Envelope.format` | Interchange envelope; see guide | Versioned envelope metadata/content | Envelope | Yes / Yes / Yes | P, D |
| `Envelope.formatVersion` | Interchange envelope; see guide | Versioned envelope metadata/content | Envelope | Yes / Yes / Yes | P, D |
| `Envelope.schemaVersion` | Interchange envelope; see guide | Versioned envelope metadata/content | Envelope | Yes / Yes / Yes | P, D |
| `Envelope.exportedBy` | Interchange envelope; see guide | Versioned envelope metadata/content | Envelope | Yes / Yes / Yes | P, D |
| `Envelope.source` | Interchange envelope; see guide | Versioned envelope metadata/content | Envelope | Yes / Yes / Yes | P, D |
| `Envelope.sector` | Interchange envelope; see guide | Versioned envelope metadata/content | Envelope | Yes / Yes / Yes | P, D |
| `Envelope.extensions` | Interchange envelope; see guide | Versioned envelope metadata/content | Envelope | Yes / Yes / Yes | P, D |
| `SectorContent.version` | Version marker; no ordinary content control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.sectorType` | Active sector type / tab family | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.nameOverride` | Custom sector name toggle, Overview | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.customName` | Sector/Settlement name, Overview | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.terrain` | Terrain, Overview and overlay | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.description` | Visible Normal Description / Settlement Description or legacy Faction description | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.mood` | Normal Overview Mood | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.rot` | Normal/Special Rot control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.threatLevel` | Normal/Special Threat Level control, or generation category metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.locations` | Locations entries | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.encounters` | Normal Inhabitants tab | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.effects` | Normal Effects tab | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.loot` | Normal Gear & Artifacts tab | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.secrets` | Legacy sector storage | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.history` | Root History entries or Settlement history narrative | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.supplies` | Normal Loot Consumables; retained hidden content in Special/Settlement | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.pathStunts` | Normal/Special Find the Path checkboxes | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.travel` | Normal/Special Find the Path reference calculator | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.special` | Special type-specific content | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.settlement` | Seven Settlement tabs | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SectorContent.randomization` | Previously generated-sector provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.duration` | Normal Effect Duration / Trigger text | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.category` | Normal Effect category selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.macroUuid` | Normal Effect entry Macro reference | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.triggerId` | Normal Effect stable automatic-trigger identity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.macroRunOnce` | Run Once (First Entry Only) checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.macroEnabled` | Legacy once/repeat checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Record.macroDisabled` | Disable automatic trigger checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Inhabitant.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.progress` | Settlement Project assignment Progress | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.completedAt` | Settlement Project Date / Session Completed | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.arkSource` | Read-only Ark Project synchronization metadata | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Project.workPoints` | Accumulated Project Work Points | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.info` | Faction Info multiline notes | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.description` | Visible Normal Description / Settlement Description or legacy Faction description | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.leader` | Settlement leadership or legacy Faction Leader | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.goals` | Legacy Faction Goals | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.resources` | Settlement Resources and Shortages / legacy Faction Resources | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.relationship` | Legacy Faction Relationship to Party | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.allies` | Legacy Faction Allies | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.rivals` | Legacy Faction Rivals / Enemies | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.tensions` | Legacy Faction Current Tensions | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.infoVersion` | Faction note migration marker | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.membersVersion` | Faction member migration marker | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.members` | Faction Members gallery | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.actors` | Legacy Faction Actor reference list | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Faction.actorUuids` | Legacy Faction Actor UUID string list | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Member.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Member.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Member.actorUuid` | Legacy Member UUID fallback | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Shop.version` | Version marker; no ordinary content control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Shop.groups` | Ordered Shop groups | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Shop.migration` | Legacy Shop recovery summary | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Shop.playerAccess` | GM opt-in to publish only the standalone Shop | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Shop.trading` | GM resource trading configuration | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopGroup.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopGroup.name` | Source name or Shop group heading | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopGroup.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopGroup.entries` | Ordered Shop Item references | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopItem.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopItem.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopItem.legacyEntryId` | Prior merchant inventory entry identity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopItem.travelType` | Shop Vehicle Travel Type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopItem.passengers` | Shop Vehicle Passengers | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopMigration.version` | Version marker; no ordinary content control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopMigration.source` | Source citation or provenance metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopMigration.unlinked` | Archived entries without usable UUIDs | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopMigration.duplicates` | Legacy duplicate UUID occurrence count | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.proprietor` | Legacy merchant proprietor text | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyShop.inventory` | Legacy merchant inventory archive | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `LegacyInventory.price` | Legacy inventory price/barter text or number | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.trigger` | Settlement Event Trigger / Conditions | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.outcomes` | Settlement Event Consequences / Outcomes | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementEvent.related` | Settlement Event Related NPCs/Factions | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.id` | Stable entry identity; no direct editor input | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.title` | Nested entry heading/name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.details` | Nested narrative / description editor | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.status` | Exploration or entry state, context-dependent control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.legacyStatus` | Compatibility metadata for old Normal Inhabitant status | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.legacyType` | Compatibility metadata for old Inhabitant/Loot type | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.referenceTitle` | Prior resolved reference name | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.referenceName` | Reference display-name fallback, notably Projects | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.referencePack` | Saved source-pack metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.referenceType` | Reference classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.referenceWarning` | Reference warning text / generated-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.detailsFormat` | Safe Inhabitant description preview selector | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.portrait` | Stored Inhabitant image path | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.imageSrc` | Stored Special image-source metadata | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.titleOverride` | Protect an edited title during later explicit reference linking | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.typeSource` | Loot category provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.resource` | Legacy generated supply-entry metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.generated` | Core generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.generation` | Add-entry generation provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.actorImport` | Existing explicit Actor Info snapshot marker | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.role` | Settlement Inhabitant Role / Occupation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.factionId` | Settlement Inhabitant associated Faction | Stable content identity / relationship | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.npcs` | Thread Important NPCs | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.factions` | Settlement Factions array or Thread Factions text | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.clues` | Thread Clues / Discoveries | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.developments` | Thread Possible Developments | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `SettlementThread.resolution` | Thread Resolution / Outcome | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.overlayImage` | Special map overlay illustration | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.sceneUuid` | Special Overview Scene reference | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.source` | Source citation or provenance metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.overview` | Visible Special Overview | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.situation` | Special Situation or Settlement Current Situation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.images` | Special Images gallery | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.locations` | Locations entries | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.inhabitants` | Special/Settlement Inhabitants | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.gear` | Special Gear & Artifacts | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Special.events` | Special/Settlement Events | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.version` | Version marker; no ordinary content control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.type` | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.disposition` | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.population` | Settlement Overview Population | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.leadership` | Settlement Overview Leadership | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.description` | Visible Normal Description / Settlement Description or legacy Faction description | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.notes` | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.history` | Root History entries or Settlement history narrative | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.situation` | Special Situation or Settlement Current Situation | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.defenses` | Settlement Defenses / Security | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.resources` | Settlement Resources and Shortages / legacy Faction Resources | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.economy` | Settlement Trade and Economy | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.image` | Settlement Overview Image | Saved asset path / snapshot | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.arkUuid` | Optional Settlement Ark reference | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.projects` | Settlement Projects tab | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.inhabitants` | Special/Settlement Inhabitants | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.factions` | Settlement Factions array or Thread Factions text | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.events` | Special/Settlement Events | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.threads` | Settlement Threads | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.shops` | Legacy merchant archive | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Settlement.shop` | Active grouped Settlement Shop | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supplies.cleanGrub` | Consumable: Clean Grub | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supplies.rotGrub` | Consumable: Rot Grub | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supplies.cleanWater` | Consumable: Clean Water | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supplies.rotWater` | Consumable: Rot Water | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supplies.bullets` | Bullets supply or obtained Find the Path stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supplies.booze` | Consumable: Booze | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supplies.components` | Consumable: Components | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supply.quantity` | Normal Loot/Special Gear or legacy inventory quantity | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Supply.collected` | Normal Loot or Consumable collection checkbox | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.safePath` | Find the Path basic effect | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.artifact` | Find the Path artifact stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.assessRot` | Find the Path assess-Rot stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.bullets` | Bullets supply or obtained Find the Path stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.grub` | Find the Path grub stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.water` | Find the Path water stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.halfTime` | Find the Path half-time stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.rush` | Find the Path rushed stunt | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `PathStunts.saferRoute` | Rot Finder safer-route bookkeeping | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Travel.mode` | Travel Mode calculator | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Travel.rushed` | Travel rushed duplicate switch | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Travel.stalker` | Travel Stalker duplicate switch | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Travel.open` | Open/Empty Terrain travel modifier | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Travel.difficult` | Difficult Terrain travel modifier | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Travel.night` | Nighttime travel modifier | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Travel.difficulty` | Difficult Terrain multiplier | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.method` | Generation provenance method | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.threatLevel` | Normal/Special Threat Level control, or generation category metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.numericThreatLevel` | Legacy root Threat Level fallback | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.levelSelection` | Existing numeric-level selection provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.environment` | Existing environment eligibility result | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.baseDice` | Actual recorded Base Dice faces | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.rolledOnes` | Recorded count of dice showing 1 | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.rolledSixes` | Recorded count of dice showing 6 | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.threatSeverity` | Count of threatening Base Dice ones in existing generation metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.threatCount` | Recorded generated threat-identity count | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.artifactCount` | Recorded generated artifact count | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.threatMode` | Core or individual-d3 house-rule provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Randomization.sources` | Persisted table-result provenance array | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Environment.name` | Source name or Shop group heading | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Environment.ruins` | Environment ruin-table eligibility metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Environment.threats` | Environment threat eligibility metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Environment.artifacts` | Environment artifact eligibility metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Environment.manual` | Environment manual-authoring classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Generated.method` | Generation provenance method | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Generated.threatCategory` | Generated threat classification metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Generated.threatSeverity` | Count of threatening Base Dice ones in existing generation metadata | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Generated.threatMode` | Core or individual-d3 house-rule provenance | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Generated.sources` | Persisted table-result provenance array | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Generation.method` | Generation provenance method | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `Generation.sources` | Persisted table-result provenance array | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ActorImport.version` | Version marker; no ordinary content control | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ActorImport.uuid` | Optional Foundry document link; context-dependent | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ExportedBy.module` | Producing module identifier | Interchange provenance/extension data | Envelope | Yes / Yes / Yes | P, D; B when editable |
| `ExportedBy.version` | Version marker; no ordinary content control | Interchange provenance/extension data | Envelope | Yes / Yes / Yes | P, D; B when editable |
| `Source.coordinates` | Original coordinate metadata | Interchange provenance/extension data | Envelope | Yes / Yes / Yes | P, D; B when editable |
| `Source.name` | Source name or Shop group heading | Interchange provenance/extension data | Envelope | Yes / Yes / Yes | P, D; B when editable |
| `Extensions.unknown` | Preserved unknown path/value records | Interchange provenance/extension data | Envelope | Yes / Yes / Yes | P, D; B when editable |
| `UnknownField.path` | Original unknown-property path | Interchange provenance/extension data | Envelope | Yes / Yes / Yes | P, D; B when editable |
| `UnknownField.value` | Original unknown safe JSON value | Interchange provenance/extension data | Envelope | Yes / Yes / Yes | P, D; B when editable |
| `ShopTrading.enabled` | GM enables chat-only resource trade requests | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopTrading.values` | Per-Settlement relative resource values | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopResourceValues.bullets` | Relative Bullet value | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopResourceValues.cleanGrub` | Relative clean Grub value | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopResourceValues.cleanWater` | Relative clean Water value | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ShopResourceValues.booze` | Relative Booze (Dose) value | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ArkProjectSource.version` | Synchronization metadata version | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ArkProjectSource.arkUuid` | Source Ark Actor | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ArkProjectSource.projectUuid` | Stable embedded Project Item source | Document identifier / saved metadata | Flag | Yes / Yes / Yes | P, D; B when editable |
| `ArkProjectSource.missing` | Source unavailable/deleted/unlinked marker | Sector content / model metadata | Flag | Yes / Yes / Yes | P, D; B when editable |

## Deliberate exclusions

| Data | Classification and handling |
| --- | --- |
| `code`, `sceneId`, `placement` | World placement; stripped from content, selected destination replaces them. Source coordinates are informational. |
| `journalName`, Journal ID/ownership/pages | Foundry container metadata; no source Journal identity copied. Import creates/updates only the chosen GM Journal. |
| `initialSavePending` | Authoring lifecycle; blocks export until saved. |
| `portableExtensions` | Stored compatibility area moved to envelope extensions; never applied as arbitrary active properties. |
| ENTRY_UI/OVERVIEW_UI/scroll maps, focus, image loading, reference caches, dirty status | Temporary UI state outside flags; not serialized. |
| Token fired state, Party roster, world table/reference configuration, Travel Event History, Campaign Log | Other world/service flags and settings; not sector content and not serialized. |
| Actor/Item system data, live Ark population/development/project requirements, live Shop prices/statistics, derived Actor portrait | Native/derived document data; not read or copied by exporter. Existing explicitly saved snapshots remain content. |
| Safe unknown properties | Preserved by original path in `extensions.unknown`; no editor or active semantics. |

Both Schema artifacts derive from the runtime descriptors; the standalone Schema uses named definitions. Full field constraints, default/normalization details and per-tab editing distinctions remain in [the authoritative guide](SECTOR-JSON-GUIDE.md).
