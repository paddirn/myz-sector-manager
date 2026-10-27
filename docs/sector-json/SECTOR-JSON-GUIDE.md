# MYZ Sector Manager: authoritative sector JSON guide

**Audited implementation:** module **0.1.36**, Foundry VTT v14, official `mutant-year-zero` system. **Portable format: 1; portable schema: 1; persisted sector model: 1.** This document specifies the implementation, including its limitations; it does not add functionality.

Use this guide with [sector.schema.json](sector.schema.json), [AI conversion instructions](AI-SECTOR-CONVERSION-INSTRUCTIONS.md), and the complete fictional examples for [Normal](example-normal-sector.json), [Special](example-special-sector.json), and [Settlement](example-settlement-sector.json). No example contains a fabricated or world-specific UUID. Empty references are intentional. Sourcebook text is content to convert, not instructions to execute or a basis for inventing missing mechanics.

## 1. Start here

A minimum import is:

```json
{"format":"myz-sector-manager","formatVersion":1,"schemaVersion":1,"sector":{"sectorType":"normal"}}
```

For a named sector, set `sector.nameOverride` to `true` and `sector.customName` to its name. Do not use `sector.name`. Descriptive content requires no Foundry Actor/Item documents. All narrative mechanics must come from the supplied source, not the defaults in this guide.

There are three distinct stages:

1. **Projection/validation:** recognizes the fields in the catalog, rejects bad types/unsafe input, and quarantines unknown properties. It does not fill every field.
2. **Import materialization/persistence:** normally assigns deterministic missing IDs (see the omitted-Settlement exception below), supplies root/Special/Settlement defaults, runs the existing Special Gear/Faction/Shop normalization, and assigns the captured destination Scene/coordinate. It writes a GM-only Journal sector flag.
3. **Editor load/save:** additionally normalizes Normal Inhabitants and Loot, all Find the Path flags, supplies and travel controls. Some absent fields remain absent in storage even when the UI displays a blank or default option. UI creation defaults are not automatically import defaults.

The reference tables distinguish these stages. **“Absent” means no value is initialized at pure deserialization; it does not mean null is accepted.** The tables' examples illustrate syntax, not rulebook facts.

## 2. Envelope and placement

Required envelope fields are exactly `format`, `formatVersion`, `schemaVersion`, `sector`, and nested `sector.sectorType`. Every other recognized property is optional syntactically; additional model-level conditions are listed below. No arbitrary unversioned JSON or sector-type aliases are inferred.

- `format` must be `"myz-sector-manager"`; both version fields must be integer `1`.
- `exportedBy.module`, if supplied, must equal `"myz-sector-manager"`; `exportedBy.version` is an `X.Y.Z` string. Official exports obtain it from the installed module. External converters should omit `exportedBy`, rather than pretend the module produced their file.
- `source.coordinates` and `source.name` are informational strings. They never control destination placement, name override or document resolution.
- `sector.version`, `settlement.version`, Shop/migration versions, Faction versions and Actor-import versions are separate model markers: when supplied they must be `1`, not the module release number.
- `extensions.unknown` contains compatibility records `{ "path": ["sector", "unsupportedField"], "value": <safe JSON> }`. It is metadata, not an injection mechanism. The importer stores it as `portableExtensions`, and exports it back in the envelope.

The GM selects the destination using the existing Zone grid/sector selection. An empty-square New Sector prompt may be cancelled before choosing Import Sector. The Scene, coordinate, viewed Scene, selection revision, grid and occupied-record snapshot are captured and rechecked. Original `code`, `sceneId`, `placement`, `initialSavePending`, `journalName` and `portableExtensions` are not importable content fields: exporting strips/moves them; putting them in `sector` in an external file quarantines them. Destination placement is assigned by the importer, never copied from the file.

Nested IDs are content identities. They may be reused in different imported sector Journals. Supply stable IDs using 1–128 ASCII letters, digits, `_` or `-`. IDs are optional and otherwise receive deterministic `import-entry-N` identifiers. IDs must be unique within each collection; Settlement Projects, Inhabitants, Factions, Events, Threads and legacy Shops share an additional identity namespace, including legacy inventory checks. Shop groups/Items also share a Shop identity namespace. Do not rely on duplicate IDs being repaired: import may reject them; a few existing normalizers can still regenerate colliding Shop/member IDs. Use unique IDs throughout one file for reliable relationships. `factionId` points to a Faction's ID, not its name or Actor UUID. Missing associations are retained and shown as missing, not guessed.

## 3. Active types and exact entry families

The validator deliberately supports inactive content retained during sector-type conversion. A Normal file can retain `special` or `settlement`, but those fields do not become visible on Normal tabs. A typographical mistake that sends content to an inactive branch can therefore import successfully while appearing to lose it. Choose the intended active branch.

| Active type | Visible content |
| --- | --- |
| `normal` | Overview (`description`, `mood`, `notes`, environment), Locations, Inhabitants stored as `encounters`, Gear & Artifacts stored as `loot` plus Consumables, Effects, Find the Path, History |
| `special` | Overview (`special.overview`, `special.situation`, `special.source`, Scene, root environment/notes and overlay image), Locations from `special.locations`, Inhabitants from `special.inhabitants`, Gear & Artifacts from `special.gear`, Events from `special.events`, Images from `special.images`, Find the Path and root History |
| `settlement` | Overview from `settlement` plus root name/terrain/coordinates; Projects, Inhabitants, Factions, Events, Threads, Shop from `settlement` |

**Accepted fields are not identical across entry families.** The complete tables below are grouped by their actual validator descriptors:

| Family | Exact collections | Accepted structure |
| --- | --- | --- |
| Record | `sector.locations`, `.encounters`, `.effects`, `.loot`, `.secrets`, `.history`; `sector.special.images`, `.locations`, `.gear`, `.events` | All fields in the Record table, including the common metadata and effect/Macro fields. Their UI meaning depends on the collection. |
| Inhabitant | `sector.special.inhabitants`, `sector.settlement.inhabitants` | Inhabitant table; **no** Record-only `duration`, `category`, Macro or trigger fields. |
| Project | `sector.settlement.projects` | Inhabitant/common fields plus `progress`, `completedAt`; see Project table. |
| Faction | `sector.settlement.factions` | Common fields plus legacy structured notes, Info/version fields and member-reference collections; see Faction table. |
| Settlement Event | `sector.settlement.events` | Common fields plus `trigger`, `outcomes`, `related`; **no** automatic Macro trigger. |
| Settlement Thread | `sector.settlement.threads` | Common fields plus `npcs`, `factions`, `clues`, `developments`, `resolution`. |
| Shop Item | `sector.settlement.shop.groups[].entries` | **Only** `id`, `uuid`, `legacyEntryId`, `travelType`; narrative, price, quantity or Item statistics are not active Shop fields. |
| Legacy Shop / inventory | `sector.settlement.shops`, `.shops[].inventory` | Separate archived formats; not the active Shop. |

Root `secrets` is accepted legacy storage without a current dedicated tab. Put important secrets in visible root `notes`, Settlement `notes`, Faction `info`, or relevant `details`/`notes` as described by the UI matrix; label GM secrets clearly. The whole Sector Manager and its Journal records are GM-only. There is no supported per-field player visibility/secret flag; do not invent one.

## 4. Normal sectors and generation metadata

Normal authored files use the root arrays. `encounters` is the storage key even though the visible tab says Inhabitants. Its title/details/reference fields support descriptive NPCs without Actors. Locations use title/details and optional Scene/Journal reference. Effects add category, duration and optional Macro references. History is a list of title/details/status/reference records, not the separate automatic Travel Event History service. A Record's `notes` can be retained without being a separate visible control: put narrative intended for the Normal record editor in `details`.

Root exploration-status UI choices are `Unexplored`, `Scouted`, `Visited`, `Explored`, `Cleared`, `Lost`. Generic non-Inhabitant Record status controls offer `Active`, `Hidden`, `Discovered`, `Resolved`, `Collected`, `Depleted`, `Inactive`. The validator accepts strings beyond these choices, but a select control without a matching option can display/persist its first option on editing; use the documented UI vocabulary for reliable display.

Normal Inhabitants' editor normalizes status to `Active`, `Resolved`, `Defeated`, `Hidden` and type to `Humanoid`, `Monster`, `Encounter`; unmatched values may be retained in `legacyStatus`/`legacyType` while the active selection falls back to Active/Encounter. This normalization happens on editor load, not in `validatePortable` alone.

Normal Loot uses `quantity`, `collected`, `type` and `typeSource`. Recognized loot categories are `scrap`, `armor`, `artifact`, `chassis`, `gear`, `weapon`. Unknown strings pass the basic schema but normalize to Scrap with legacy metadata. Quantity defaults to 1 on editor load; nonnegative decimals and explicit zero are supported. If `collected` is absent, legacy status Collected/Depleted implies true. These flags do not award or remove items.

`randomization`, `generated`, and `generation` preserve provenance; importing them does not generate anything. External conversions normally omit them. Do not claim an environment roll, Base Dice result, severity, table source or artifact count that did not occur. `randomization.numericThreatLevel` is a recognized legacy fallback only when root `threatLevel` is missing; the editor removes that old duplicate metadata during normal cleanup/save. `generated.method: "core"` marks entries as generated: later Randomize may replace them. Do not mark manually authored content as core-generated.

`generated.sources` / `generation.sources` / `randomization.sources` are arrays of safe arbitrary JSON, not arrays of live Foundry documents. They have no editor controls. `levelSelection` is safe arbitrary JSON provenance. The catalog fully lists all other recognized generation properties and their types.

## 5. Special sectors: visible narrative and optional documents

Use `special.overview` for the visible Overview and `special.situation` for The Situation. `special.source` is a text source citation, not a document UUID. `special.sceneUuid` links a Scene; it is content and is distinct from the destination Zone Scene. `special.overlayImage` is an optional installed image path. There is no separate Special description field. **Root `description` is retained but is not displayed in the Special Overview.** Combine an introductory description and an Overview into `special.overview` once, using headings if useful; do not duplicate it into an invisible field expecting another visible panel.

- **Locations:** use Record fields; the visible fields are `title`, `details`, `uuid`, and status. UUID may identify a Scene, JournalEntry or JournalEntryPage. Additional accepted Record metadata remains metadata; a Macro placed here is not an automatic trigger.
- **Inhabitants:** use the Inhabitant table. Visible editable fields are title, details and Actor reference, with an Actor-derived heading avatar when the reference resolves. A stored portrait and rich details can be retained/imported; the heading avatar specifically resolves the Actor. `role`, `disposition` and `factionId` are accepted by this descriptor but have no Special-specific editing controls or automatic Faction association feature.
- **Gear & Artifacts:** use Record fields. Visible fields are title, details, optional Item UUID, loot category and quantity. `specialQuantity` only retains whole quantities ≥1: missing, zero or fractional quantities become **1**. This differs from Normal Loot and supplies. Use recognized loot categories: an unknown Special Gear type becomes Scrap, and this helper does not automatically add a legacyType field to preserve that unsupported original type (unlike Normal Loot). `collected` may be retained if present but has no Special collection checkbox. Do not represent liquid/fractional supplies by a fractional Special Gear quantity.
- **Events:** use Record fields; visible fields are title, details and optional Journal/Page reference. These are authored event descriptions, not executable Travel Events. Accepted Macro metadata here does not run automatically.
- **Images:** use Record fields; visible metadata is title, details and a reference to an **image-type JournalEntryPage**. The preview reads the resolved page's media `src`. `imageSrc` is retained metadata, not a replacement image-page reference or a guarantee of a rendered image. Empty/missing references produce placeholders. No Journal pages or images are created by importing JSON.

`titleOverride: true` prevents a later explicit Actor/Item reference assignment from replacing a custom title in the relevant linking flows. `referenceTitle` records a previously resolved title. `referenceName` is particularly useful as a Project name fallback. These do not perform name lookup. `detailsFormat: "html"` enables the Inhabitant safe-preview path; descriptions remain editable strings, and sanitization removes unsafe tags/attributes. Other `detailsFormat` strings are accepted but do not enable that HTML preview. General description controls are textareas; HTML tags may remain literal text rather than a rich rendered view.

`actorImport: {"version":1,"uuid":...}` is metadata for a previous explicit Actor Info snapshot. Do not create it for a narrative-only NPC, and do not expect it to fetch statistics during import. Only explicit later Actor drag/drop invokes the Actor Info import flow, which can preserve existing manual descriptions. No typed NPC attribute/skill/mutation/equipment model exists in portable Inhabitant entries. Preserve those facts and exact numbers in organized `details` text instead of inventing `system`, `attributes`, `skills`, `mutations` or `equipment` properties.

## 6. Settlement: all seven tabs

### Overview

Use `settlement.description` for its visible Description and `settlement.notes` for GM Notes. Root `description`/`notes` are retained common storage but are not the Settlement Overview controls. Use `settlement.type`, `disposition`, `population`, `leadership`, `image`, and the optional history/situation/defenses/resources/economy sections. Population is text, e.g. `"About forty"`, not a numeric JSON field. Root `customName` with `nameOverride: true` names the Settlement; the editor requires a name to save it. `settlement.arkUuid` optionally references an official MYZ Ark Actor; statistics are not copied.

Suggested UI choices (these are **not strict validator enums**):

- Settlement type: `Ark`, `Village`, `Town`, `Trading Post`, `Outpost`, `Fortress`, `Industrial Facility`, `Mobile Settlement`, `Other`.
- Disposition: `Unknown`, `Friendly`, `Neutral`, `Unfriendly`, `Hostile`.

### Projects

A Project is an assignment/reference to a real Item of official MYZ type `project`. Use the Project fields: `uuid`, `status`, text `progress`, `completedAt`, `notes`, with `referenceName`/`title` as optional fallback metadata. Progress is not a numeric work-point counter or an update to the source Item. Suggested statuses: `Planned`, `In Progress`, `Completed`, `Abandoned`; other strings are retained by the UI's fallback choices. Import does not fill omitted status with Planned; the UI's first selection may display Planned.

An omitted/empty UUID can retain assignment notes/progress, but no Project Item statistics or sheet are available. The entry has no general title/description editor like an Inhabitant; a heading may use a supplied title/referenceName while the body requests a Project reference. A missing/wrong-type UUID is retained and shown unavailable. The import preview only checks UUID resolution, not whether an Item is the correct MYZ Project type. Do not create fictional Project Items or put work-point requirements into unsupported Item-stat fields. If no real reference is supplied, describe the proposal and source mechanics in assignment `notes`.

### Inhabitants

Use Inhabitant fields. Visible editable fields include title, details, role, disposition, factionId, portrait, optional Actor UUID and notes. `factionId` matches a Faction ID; a missing Faction is retained as a missing association. This does not populate Faction Member galleries automatically. Descriptions can contain complete source NPC statistics as text without any Actor.

### Factions

Use `title`, multiline `info`, `infoVersion: 1`, `membersVersion: 1`, and `members`. The heading and Members section collapse independently in session-only UI state; do not add collapse flags to JSON.

A Member is an Actor reference, as a UUID string or `{ "id": ..., "uuid": ... }`; the object can use legacy `actorUuid` as a fallback. Its effective UUID must be **nonempty**, although the general UUID descriptor alone permits empty strings. Missing but syntactically valid UUIDs are retained as removable placeholders. Duplicate Actor UUIDs within a faction are deduplicated; the same Actor may belong to another faction. The gallery opens live Actor sheets and reads their names/portraits. Narrative-only people belong in `info` and/or Settlement Inhabitants; they cannot be invented as document-free gallery Members.

Legacy `details`, `description`, `leader`, `goals`, `resources`, `disposition`, `relationship`, `allies`, `rivals`, `tensions`, `notes` are recognized. Without `infoVersion: 1`, nonempty values are appended to Info with readable labels once; original values remain. Providing the marker says this conversion already occurred. `actors` and `actorUuids` are legacy reference lists: they join Members only while `membersVersion` is absent. The normalizer fills both version markers with 1. Do not duplicate the same narrative into Info and legacy fields in a newly authored file.

### Events and Threads

Settlement Events use title/details/status/notes plus textual `trigger`, `outcomes`, `related`. Suggested statuses: Planned, Active, Resolved, Cancelled. Threads use title/details/status/notes plus textual `npcs`, `factions`, `clues`, `developments`, `resolution`; suggested statuses: Open, In Progress, Resolved, Abandoned. These relationships are narrative text, not ID arrays. No automatic logic or roll occurs.

### Shop

`settlement.shop` has version 1 and ordered `groups`. A group has ID, display `name`, `type`, and ordered `entries`. Supported layouts: `general`, `weapons`, `armor`, `vehicles`, `services`; `type` is a string, not a strict enum. Missing type becomes General; unknown type strings remain stored and show a General view. The group name is independent of type.

Each active entry accepts exactly `id`, **nonempty** Item `uuid`, `legacyEntryId`, and optional `travelType` (`Land` or `Water`, exact case). A UUID may be unresolved and retained, but it must not be fabricated to make a Shop row. **There is no valid document-free active Shop Item entry.** Empty groups are valid. The Settlement example demonstrates all layouts with empty groups; trade goods are described in `settlement.economy`. Add actual entries only after the GM provides genuine Item UUIDs. One source UUID may occur only once across the active Shop; duplicate references reject import.

All valid Foundry Item document types can be linked. Group type is a display layout, not an Item-type filter. Item name, image, cost, damage, range, bonus, weight, armor/Rot protection, comment, requirements and supported passenger fields come from the live Item. There are **no active `cost`, `price`, `quantity`, `name`, `damage`, `system` or copied Item-data properties on Shop entries**. Such properties are unknown and quarantined. Vehicle Travel Type is entry-local; on display it falls back to a compatible Item's Land/Water field or Land. It is not inferred from a sourcebook vehicle description unless the source actually specifies it.

The Buy dialog reads the source Item's Cost: nonnegative integer or inclusive integer range with hyphen/en dash. It rolls only when the GM confirms a purchase and posts one public informational Chat message; import neither buys nor announces anything. No resources, Item quantities or Actors change. Arbitrary barter descriptions cannot become invented Bullet prices.

`settlement.shops` is the legacy merchant archive, not a second active Shop. If active `shop` is absent, referenced legacy inventory entries migrate into ordered groups, keeping the archive and marking migration counts. Unlinked entries remain in the archive, not visible active stock; duplicate UUID occurrences are counted and skipped. If `shop` is supplied, the archive is retained without merging it into active inventory. Do not misuse this archive for new AI-generated trade stock.

## 7. UUIDs, images and reference behavior

The following are **notation patterns**, not UUIDs to paste into files. Replace every angle-bracket component with an actual copied Foundry UUID; otherwise omit/empty the reference where allowed.

| Document | Typical explicit UUID notation |
| --- | --- |
| World Actor / Item | `Actor.<documentId>` / `Item.<documentId>` |
| Compendium Actor / Item | `Compendium.<package>.<pack>.Actor.<documentId>` / `Compendium.<package>.<pack>.Item.<documentId>` |
| Journal / Page | `JournalEntry.<journalId>` / `JournalEntry.<journalId>.JournalEntryPage.<pageId>` |
| Compendium Journal / Page | `Compendium.<package>.<pack>.JournalEntry.<journalId>` optionally followed by `.JournalEntryPage.<pageId>` |
| Scene / RollTable / Macro | `Scene.<id>` / `RollTable.<id>` / `Macro.<id>`; compendium equivalents use the `Compendium.<package>.<pack>.<type>.<id>` form |
| Embedded Actor Item | `Actor.<actorId>.Item.<itemId>` where an existing Item reference is supported |

The importer validates safe UUID characters, not this entire grammar. `fromUuid` is the authority on actual forms (including Foundry-supported older compendium forms). Allowed characters are ASCII letters, digits, `_`, `.`, `-`, up to 512 characters. Names are not UUIDs and are not resolved by similarity. Different UUID fields have these editor expectations:

| Field/context | Expected referenced document |
| --- | --- |
| Root/Special Locations `uuid` | Scene, JournalEntry or JournalEntryPage |
| Normal Inhabitants and Effects `uuid` | Actor, JournalEntry or JournalEntryPage |
| Normal Loot / Special Gear / Shop stock | Item; Shop accepts any Item type |
| Special/Settlement Inhabitants; Faction Members | Actor |
| Special Events | JournalEntry or JournalEntryPage |
| Special Images | Image-type JournalEntryPage with media source |
| Special Scene / Settlement Ark / Projects | Scene / Ark-type Actor / MYZ Project Item |
| Effect `macroUuid` | Macro |
| Generic root History | No specific document type restriction in its reference helper |
| RollTable UUIDs in provenance | Metadata only; not configurable generation tables and never rolled by import |

Most narrative `uuid` properties may be omitted or empty. Shop stock and effective Faction Member UUIDs may not. Preview scans recognized `uuid`/`Uuid`/`UUID` suffix fields, and plural UUID string lists, under sector content, caching one resolution per distinct string. It does not inspect quarantined unknown values for active references. A truthy resolved document is marked resolved without validating its expected document type; later editor helpers can still report a wrong-type reference unavailable. Resolution does not create, rename, substitute or execute documents. Missing-reference warnings do not erase narrative data or the original string.

Images are installed relative paths or HTTP(S) paths, not bundled image bytes. Empty strings mean no supplied image. Runtime `imagePath` rejects data/blob URLs, control characters, disallowed URI schemes and `.webm`, `.mp4`, `.m4v`, `.ogg` paths (including query/fragment suffixes). Missing files are not created or uploaded. The documentation Schema checks string length but leaves the runtime image-path predicate to the importer.

## 8. Sourcebook-to-JSON conversion

Decide Normal, Special or Settlement from the source and requested purpose. A named adventure location with an Overview/Situation is usually Special; an inhabited community with the seven Settlement concerns may be Settlement. Ask when type is ambiguous rather than silently converting one into another.

| Sourcebook heading/content | Faithful Special-sector destination |
| --- | --- |
| Sector title | Root `nameOverride: true`, `customName` |
| Introductory description | Include once in `special.overview` so it is visible; root `description` is storage-only in Special |
| Overview | `special.overview`, preserving subsections, often following the introduction |
| The Situation | `special.situation` |
| Source citation | `special.source` |
| Named places | One `special.locations` entry per meaningful place, title/details and optional real reference |
| Inhabitants | One `special.inhabitants` entry per NPC/group; preserve names and all provided attributes, skills, mutations, gear and narrative in `details` |
| Artifacts / gear | `special.gear` entries with source-supported category and whole quantity; optional real Item reference only |
| Grub, Water & Bullets | Source facts in visible Overview/notes, or descriptive Gear entries where whole-quantity semantics fit; root `supplies` can retain exact numeric resources but **has no visible Consumables editor in Special** |
| Events | One `special.events` entry per distinct event, title/details; no invented automated trigger |
| GM secrets | Clearly labeled passages in root `notes`, or labeled entry details as appropriate; all records remain GM-only |
| Maps/images | Real provided image-page UUIDs; otherwise retain the description in notes and leave references/images empty |

Do not use `.special.description`, `.special.artifacts`, `.special.npcs`, `.special.supplies` or root `inhabitants`: none is an active import field. For a Normal sector, use `encounters`, `loot` and root `supplies` instead. For a Settlement, use its seven branches. For source-only NPC statistics, a multiline details block such as `Attributes (as supplied): ...\nSkills: ...\nMutations: ...\nEquipment: ...\nGM secret: ...` preserves mechanics without pretending to create an Actor. Include only values actually supplied.

Narrative sections map to strings; distinct NPCs, places, events and goods map to entries in the appropriate arrays. Keep connected paragraphs together, preserve lists/qualifiers and separate GM facts explicitly. Unsupported structured information belongs in readable `details`/`notes`, not invented properties; safe unknown properties survive as extension records but will not appear as usable editor fields. Do not intentionally depend on quarantine for essential narrative visibility.

## 9. Omission, zero and unknown information

| Unknown source information | Recommended representation | Actual default/caveat |
| --- | --- | --- |
| Threat Level | Omit and record “unspecified” in visible notes | Runtime uses 1 unless the recognized old numeric metadata supplies a value. Explicit integer 0 is valid and different. |
| Terrain | Omit or `""`; retain source wording if given | Empty; automatic names may display Unknown Terrain. Custom text is allowed. |
| Rot | Omit and explain unknown in notes | Defaults to 0, **not an unknown state**. Explicit 0 asserts the value; do not pretend it was sourced. Known UI levels 0 Rot Oasis, 1 Weak Rot, 2 Rot-Heavy Area, 3 Rot Hotspot; other numbers/legacy strings are accepted. |
| UUID | Omit/empty on descriptive entries | No Actor/Item is created. Use empty member lists and empty Shop entry lists when documents are absent. |
| Quantity | Preserve “quantity unspecified” in text; omit numeric field if not known | Normal Loot and Special Gear display/default to 1. Special Gear zero/fractions become 1. Do not mistake that fallback for source mechanics; use Overview/notes instead when this would mislead. |
| Supplies | Omit unspecified resources and record unknown in notes | Editor fills missing resources with quantity 0 and collected false; zero is a real displayed quantity, not an uncertainty flag. |
| NPC statistics | Retain only supplied facts in details | No numerical defaults for narrative NPC stats; no Actor creation. |
| Image | Omit or empty string | Placeholder; never invent an installation path. |
| Optional section | Omit, empty string or empty array of the correct type | No invented narrative. Null generally fails the typed validator. |
| Visit stunts/travel state | Usually omit for a fresh sector | Editor treats known stunts as false, travel as foot/difficulty 2 with modifiers false. These are bookkeeping defaults, not earned effects. |

Root travel controls are reference calculations, not movement/resource automation. On editor load, `pathStunts.halfTime` overrides `travel.stalker`, and `pathStunts.rush` overrides `travel.rushed`; stale duplicate travel switches do not win. Other stunts require safePath; legacy normalization can infer safePath true from already-saved additional stunts. Difficult Terrain excludes Open Terrain. Do not award Find the Path stunts simply because they were listed in source rules.

## 10. Validation, schema limits and migrations

Use JSON Schema Draft 2020-12 with [sector.schema.json](sector.schema.json). It uses `$defs`/`$ref` and three type-discriminated branches, but intentionally allows inactive preserved data and safe unknown properties. It removes the earlier custom `image-path` format annotation in favor of an explanatory description so standard validators need no Foundry plugin.

**Schema success alone is not sufficient.** The actual importer additionally checks:

- 5 MiB UTF-8 input/output; nesting depth ≤40; ≤100,000 JSON values; ≤2,000 modeled-array entries and unknown-extension records. Generic metadata arrays are safe JSON with the global budgets; not every arbitrary metadata array has the modeled-array cap.
- Only finite numbers/plain JSON; no live Document objects or code. All keys `__proto__`, `constructor`, `prototype` are rejected anywhere, including unknown metadata.
- Identifier uniqueness/namespaces, effective nonempty Faction Member UUIDs, nonempty Shop Item UUIDs and globally unique active Shop UUIDs.
- Image-path safety, Faction/Shop model normalizers, current destination and GM checks, and persistence permissions.

General string fields may be up to 1,000,000 characters; some short semantic fields/metadata have no generic string cap in the implementation, so consult the catalog rather than inventing a universal limit. IDs are 128 characters; UUIDs 512. JSON Schema integers are capped at JavaScript's safe integer maximum to match runtime integer validation. JSON numbers are not quantities unless their field says so.

The standalone Schema preserves the runtime's permissive objects: `additionalProperties: true` does not activate unknown properties. It intentionally does not try to encode all recursive security budgets, normalization side effects or cross-entry uniqueness constraints. An empty Member UUID or Shop UUID can pass the base Schema and fail model validation. These are documented limitations, **not new valid authoring patterns**.

Supported interchange versions: **format 1/schema 1 only**. `schemaMigrations` is currently an empty registry keyed by source version. Its pipeline clones input and advances one registered step at a time when a future target is introduced; it has no existing v0→v1 or speculative alias migration. Older supported v1 files can omit optional fields. Current legacy conversions concern Faction Info/member lists, merchant archives, and normal UI legacy flags; they are not support for arbitrary older/unversioned JSON formats. Future format/schema values are safely rejected.

Round trips preserve supported content and ID relationships, not byte-for-byte files: defaults, deterministic IDs, normalized Special Gear/Factions/Shop and editor housekeeping can be added. Unknown fields become extensions, original placement is replaced, source metadata/version can change, and current UI can normalize legacy values. Per-token fired-state history, runtime caches, temporary collapse state, Party roster, global settings, Travel Event History service state and source Actor/Item documents are not portable sector content.

## 11. Common mistakes and corrections

| Incorrect assumption/input | Correct approach |
| --- | --- |
| `{"name":"Mara","description":"A scout"}` in an Inhabitant | `{"title":"Mara","details":"A scout","uuid":""}`. The first keys are quarantined; Faction's legacy description is a separate exception. |
| Root `name` or Special `description` creates visible naming/intro controls | Use root customName/nameOverride and visible `special.overview`. |
| Guessing `Actor.Mara` or an Item UUID from a display name | Use a genuine copied UUID; otherwise omit/empty the allowed reference. A syntactically safe invented string is still a broken reference. |
| Restricting all Shop Items to Gear/Artifact | Any valid Item type is allowed; group layout is separate. Only Project references require official MYZ `project` Items. |
| Assuming all IDs are mandatory, or reusing one ID everywhere | Missing IDs are deterministically assigned. Supplied IDs must be safe/unique; provide explicit Faction IDs for associations. |
| `sectorType: "Special"`, `"ark"` or `"village"` | Use exact `special` or `settlement`; Village/Ark are optional Settlement type strings. |
| `travel.mode: "boat"` or `travelType: "water"` | Use exact foot/vehicle and Land/Water respectively. Do not confuse suggested UI strings with strict enums. |
| Numeric `progress: 7` or `population: 40` | Use text `"7"`, `"About forty"`; those are text fields. |
| Putting Normal `encounters` in a Special file and expecting the Inhabitants tab | Use `special.inhabitants`. Inactive branches can be retained but remain hidden. |
| Setting `source.coordinates` to choose where a file imports | The selected destination square wins; source coordinates are informational. |
| Adding a Shop row with empty UUID plus title/price | Invalid active stock. Keep groups empty and goods/prices in Overview economy until real Item UUIDs exist. |
| Adding `members:[{"title":"Mara","uuid":""}]` | Use `members:[]` and describe Mara in Info/Inhabitants; the Member requires a nonempty Actor UUID. |
| Using root/special `supplies` to make visible Special consumables | Only root supplies is recognized; its UI is Normal Loot. Keep Special resource facts visible in overview/notes as well only if needed, avoiding duplicate prose. |
| Expecting a standalone image path to create a Special Images gallery page | Gallery previews require image-type JournalEntryPage references. No page is created. |
| Losing “unsupported” attributes after import | They are preserved under `extensions.unknown`, not dropped into live fields; move important prose/mechanics into supported details/notes before generation. |
| Treating schema validation as UUID existence/type or destination validation | Run the actual parser/normalizer and review Foundry's preview; document lookups and placement checks occur separately. |

## 12. Verification and provenance

Audited code: `scripts/portable/{schema,serialization,persistence,ui}.mjs`, `sector-manager.mjs`, `sector-types.mjs`, `sector-fields.mjs`, `loot.mjs`, `travel-time.mjs`, `inhabitants*.mjs`, `settlement*.mjs`, `shop-purchases.mjs`, `sector-images.mjs`, `zone/presentation.mjs`, `zone/entry-triggers.mjs`, and naming/persistence helpers. The field catalog below is enumerated directly from current runtime descriptors; defaults/UI notes additionally follow materialization, normalization and rendering code, not an example export.

External validation (Python `jsonschema` is a development tool, not a module dependency):

```sh
python3 - <<'PY'
import json
from pathlib import Path
from jsonschema import Draft202012Validator
base = Path('docs/sector-json')
schema = json.loads((base / 'sector.schema.json').read_text())
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
for path in base.glob('example-*-sector.json'):
    validator.validate(json.loads(path.read_text()))
    print('Schema passed:', path)
PY
node --test tests/sector-json-documentation.test.mjs
node --test tests/*.test.mjs
```

The documentation tests run the examples through the actual parser, materializer and serializer, check export/schema compatibility and round-trip content, and check schema properties against descriptors. These checks do not execute a live Foundry import. Native document resolution, actual sheets/images, world placement and reload persistence still need a Foundry v14 test world. The existing [import/export operational guide](../sector-portability.md) supplies that manual checklist.

## 13. Complete field reference

All object properties are optional **unless a table explicitly says required**. Array elements are typed objects of the named family unless a UUID-string alternative is stated. For an active Settlement with the entire settlement object omitted, the existing model can create a default General Gear group with a fresh random ID. Supplying an explicit settlement object (and shop/groups when desired) uses the portable materializer’s deterministic defaults. No runtime behavior is changed by this documentation.

An extensions.unknown record should always provide both path and value. The current descriptor does not require them syntactically; a missing path can pass pure parsing and then fail the preview, which expects path.join(). Avoid manually constructing incomplete extension records.

A field recognized by a broad Record/common descriptor is not a promise of UI behavior in every accepting collection. Use the context matrix above. “Retain” means recognized storage, not a new control or automation. Each object/array below lists all declared properties; safe undeclared properties are quarantined rather than becoming active model fields.

### Envelope

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `format` | exact "myz-sector-manager" | Required; REQUIRED; exact identifier | File discriminator; no editor control | "myz-sector-manager" | Only the exact format identifier is recognized. |
| `formatVersion` | exact 1 | Required; REQUIRED; 1 | Outer-envelope version; import preview | 1 | Reject unsupported/future values. |
| `schemaVersion` | exact 1 | Required; REQUIRED; 1 | Portable content version; import preview | 1 | Checked separately from module/model versions. |
| `exportedBy` | object (table below) | Optional; Absent (informational) | Producer metadata; no model control | {} (then supply supported subfields) | Informational; external converters should normally omit. |
| `source` | object (table below) | Optional; Absent (informational) | Source citation or provenance metadata | {} (then supply supported subfields) | Envelope source is informational; special.source is visible text. |
| `sector` | object (table below) | Required; REQUIRED | Reusable sector content | {} (then supply supported subfields) | Required object; actual destination is supplied by the GM. |
| `extensions` | object (table below) | Optional; unknown defaults to [] | Quarantined compatibility metadata | {} (then supply supported subfields) | Never applied as arbitrary active properties. |

### ExportedBy

Here `version` is the producing module release string, not a model marker; external converters may omit this entire informational object.

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `module` | exact "myz-sector-manager" | Optional; Absent; no initialized field | Producing module identifier | "myz-sector-manager" | Informational; exact identifier when supplied. |
| `version` | string — pattern ^\d+\.\d+\.\d+$ | Optional; Absent; no initialized field | Version marker; no ordinary content control | "0.1.36" (actual producing version) | Use 1 for model markers, X.Y.Z only for producer version. |

### Source

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `coordinates` | string — ≤1000000 chars | Optional; Absent; no initialized field | Original coordinate metadata | "Source text" | Never controls destination placement. |
| `name` | string — ≤1000000 chars | Optional; Absent; no initialized field | Source name or Shop group heading | "Canal Haven" | Envelope source.name is informational; Shop group.name is editable. |

### Extensions

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `unknown` | array of object (table below) — ≤2000 | Optional; Absent; no initialized field | Preserved unknown path/value records | [] (typed entries as documented) | Up to 2,000; do not hand-author incomplete extension records. |

### UnknownField

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `path` | array of string — ≤1000000 chars or integer — ≥0 — ≤2000 | Optional; Absent; no initialized field | Original unknown-property path | [] (typed entries as documented) | Supply an array of property strings/nonnegative integer indices; preview expects this array. |
| `value` | safe JSON | Optional; Absent; no initialized field | Original unknown safe JSON value | "Source text" | Kept as data, never executed or activated. |

### SectorContent

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `version` | exact 1 | Optional; 1 | Version marker; no ordinary content control | 1 | Use 1 for model markers, X.Y.Z only for producer version. |
| `sectorType` | "normal" / "special" / "settlement" | Required; REQUIRED; no default | Active sector type / tab family | "special" | Strict exact normal, special or settlement. |
| `nameOverride` | boolean | Optional; false | Custom sector name toggle, Overview | false | true uses customName; false uses coordinate/terrain naming. |
| `customName` | string — ≤1000000 chars | Optional; "" | Sector/Settlement name, Overview | "Canal Haven" | Use with nameOverride true; Settlement save requires a name. |
| `terrain` | string — ≤1000000 chars | Optional; "" | Terrain, Overview and overlay | "Source text" | Any text allowed; autocomplete suggestions are not an enum. |
| `status` | string — ≤1000000 chars | Optional; "Unexplored" | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `description` | string — ≤1000000 chars | Optional; "" | Visible Normal Description / Settlement Description or legacy Faction description | "Source text" | Root description is hidden in Special and Settlement; nested entry descriptions usually belong in details. |
| `notes` | string — ≤1000000 chars | Optional; "" | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `mood` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Normal Overview Mood | "Source text" | Retained but not shown in Special or Settlement Overview. |
| `rot` | string — ≤1000000 chars or number | Optional; 0 | Normal/Special Rot control | "Source text" | Known UI numeric levels 0–3; strings/numbers remain accepted. Hidden in Settlement Overview. |
| `threatLevel` | integer — ≥0 | Optional; 1, or legacy numericThreatLevel | Normal/Special Threat Level control, or generation category metadata | 0 | Root is nonnegative integer; randomization.threatLevel is category text. Not interchangeable. |
| `locations` | array of object (table below) — ≤2000 | Optional; [] | Locations entries | [] (typed entries as documented) | Root and Special use different active arrays; see family matrix. |
| `encounters` | array of object (table below) — ≤2000 | Optional; [] | Normal Inhabitants tab | [] (typed entries as documented) | Use title/details; manual NPC statistics remain text. |
| `effects` | array of object (table below) — ≤2000 | Optional; [] | Normal Effects tab | [] (typed entries as documented) | Only Normal Effects use automatic entry Macro controls. |
| `loot` | array of object (table below) — ≤2000 | Optional; [] | Normal Gear & Artifacts tab | [] (typed entries as documented) | Normal collection/quantity/category normalization applies on editor load. |
| `secrets` | array of object (table below) — ≤2000 | Optional; [] | Legacy sector storage | [] (typed entries as documented) | No dedicated current tab; keep important GM secrets in visible notes as well only where necessary. |
| `history` | array of object (table below) — ≤2000 | Optional; [] | Root History entries or Settlement history narrative | [] (typed entries as documented) | Root is an entry array; Settlement history is text. Not Travel Event History state. |
| `supplies` | object (table below) | Optional; {}; editor fills resource defaults | Normal Loot Consumables; retained hidden content in Special/Settlement | {} (then supply supported subfields) | Seven named resources; missing resources default to zero on editor load. |
| `pathStunts` | object (table below) | Optional; {}; editor fills false flags | Normal/Special Find the Path checkboxes | {} (then supply supported subfields) | Visit bookkeeping; never assume an earned stunt from sourcebook rules. |
| `travel` | object (table below) | Optional; Absent; retained if supplied | Normal/Special Find the Path reference calculator | {} (then supply supported subfields) | Planning data only; does not move tokens or advance time. |
| `special` | object (table below) | Optional; Special defaults | Special type-specific content | {} (then supply supported subfields) | Inactive content can still be retained on other types. |
| `settlement` | object (table below) | Optional; Only materialized for active/present Settlement; see section 6 | Seven Settlement tabs | {} (then supply supported subfields) | When absent on an active Settlement, normal model defaults may create a General Gear group with a fresh ID; supply an explicit object for deterministic portable defaults. |
| `randomization` | object (table below) | Optional; Absent; retained if supplied | Previously generated-sector provenance | {} (then supply supported subfields) | Usually omit for authored conversions; importing never rolls tables. |

### Record

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; no initialized field | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; no initialized field | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; no initialized field | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; no initialized field | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; no initialized field | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | number — ≥0 | Optional; Normal Loot/editor or Special Gear: 1; zero/fraction distinctions in section 9 | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Context-dependent; sections 4–6 (not a universal import default) | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; no initialized field | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; no initialized field | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; no initialized field | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |
| `duration` | string — ≤1000000 chars | Optional; Absent; no initialized field | Normal Effect Duration / Trigger text | "Source text" | Record descriptor accepts it elsewhere without an automatic trigger. |
| `category` | string — ≤1000000 chars | Optional; Absent; no initialized field | Normal Effect category selector | "Source text" | Suggested exact Weather, Phenomenon, Special Effect, Hazard; other Record uses retain metadata. |
| `macroUuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Normal Effect entry Macro reference | "" where allowed; otherwise real copied UUID | Not executed by import. Macro fields on other Record collections do not enable that workflow. |
| `triggerId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Normal Effect stable automatic-trigger identity | "Source text" | Optional stored key; do not copy per-token fired-state history into the sector. |
| `macroRunOnce` | boolean | Optional; Absent; no initialized field | Run Once (First Entry Only) checkbox | false | false means repeatable, not disabled. Falls back to legacy macroEnabled. |
| `macroEnabled` | boolean | Optional; Absent; no initialized field | Legacy once/repeat checkbox | false | Not the current enable/disable state. |
| `macroDisabled` | boolean | Optional; Absent; no initialized field | Disable automatic trigger checkbox | false | true disables future eligible entry execution; import itself never executes. |

### Inhabitant

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; no initialized field | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; no initialized field | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; no initialized field | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; no initialized field | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; no initialized field | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | number — ≥0 | Optional; Normal Loot/editor or Special Gear: 1; zero/fraction distinctions in section 9 | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Context-dependent; sections 4–6 (not a universal import default) | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; no initialized field | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; no initialized field | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; no initialized field | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |

### Project

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; no initialized field | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; no initialized field | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; no initialized field | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; no initialized field | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; no initialized field | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | number — ≥0 | Optional; Normal Loot/editor or Special Gear: 1; zero/fraction distinctions in section 9 | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Context-dependent; sections 4–6 (not a universal import default) | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; no initialized field | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; no initialized field | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; no initialized field | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |
| `progress` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Project assignment Progress | "Source text" | Text, not a numeric work-point update to the source Item. |
| `completedAt` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Project Date / Session Completed | "Source text" | Free text, not a mandatory ISO date. |

### Faction

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; retained if supplied | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; retained if supplied | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; retained if supplied | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; retained if supplied | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; retained if supplied | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | number — ≥0 | Optional; Absent; retained if supplied | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Absent; retained if supplied | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; retained if supplied | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; retained if supplied | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; retained if supplied | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |
| `info` | string — ≤1000000 chars | Optional; Consolidated legacy text, or "" | Faction Info multiline notes | "Source text" | Preferred field for new factions; preserve legacy labels only through actual migration. |
| `description` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Visible Normal Description / Settlement Description or legacy Faction description | "Source text" | Root description is hidden in Special and Settlement; nested entry descriptions usually belong in details. |
| `leader` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Settlement leadership or legacy Faction Leader | "Source text" | Settlement.leadership is current Overview field; Faction.leader becomes labeled Info. |
| `goals` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Legacy Faction Goals | "Source text" | Consolidated once into Info; no separate current control. |
| `resources` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Settlement Resources and Shortages / legacy Faction Resources | "Source text" | Correct type is text; no automatic supply counts. |
| `relationship` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Legacy Faction Relationship to Party | "Source text" | Text is consolidated into Info. |
| `allies` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Legacy Faction Allies | "Source text" | Text is consolidated into Info. |
| `rivals` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Legacy Faction Rivals / Enemies | "Source text" | Text is consolidated into Info. |
| `tensions` | string — ≤1000000 chars | Optional; Absent; retained if supplied | Legacy Faction Current Tensions | "Source text" | Text is consolidated into Info. |
| `infoVersion` | exact 1 | Optional; 1 after normalization | Faction note migration marker | 1 | 1 suppresses re-consolidation; omitted marker migrates legacy notes once. |
| `membersVersion` | exact 1 | Optional; 1 after normalization | Faction member migration marker | 1 | Omitted enables legacy lists to join members; 1 means already migrated. |
| `members` | array of string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ or object (table below) — ≤2000 | Optional; [] after migration/deduplication | Faction Members gallery | [] (typed entries as documented) | Actor UUID references only; no document-free named member cards. |
| `actors` | array of string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ or object (table below) — ≤2000 | Optional; Absent; retained if supplied | Legacy Faction Actor reference list | [] (typed entries as documented) | Used for migration only when membersVersion is absent; archive retained otherwise. |
| `actorUuids` | array of string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ — ≤2000 | Optional; Absent; retained if supplied | Legacy Faction Actor UUID string list | [] (typed entries as documented) | Same migration condition; unknown/missing references stay references. |

### Member

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Effective nonempty UUID required | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `actorUuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Effective nonempty UUID required | Legacy Member UUID fallback | "" where allowed; otherwise real copied UUID | Effective member.uuid becomes this if uuid is empty/omitted. |

### SettlementEvent

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; no initialized field | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; no initialized field | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; no initialized field | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; no initialized field | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; no initialized field | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | number — ≥0 | Optional; Normal Loot/editor or Special Gear: 1; zero/fraction distinctions in section 9 | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Context-dependent; sections 4–6 (not a universal import default) | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; no initialized field | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; no initialized field | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; no initialized field | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |
| `trigger` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Event Trigger / Conditions | "Source text" | Text only; does not install an automatic event handler. |
| `outcomes` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Event Consequences / Outcomes | "Source text" | Text only. |
| `related` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Event Related NPCs/Factions | "Source text" | Text, not an ID or UUID array. |

### SettlementThread

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; no initialized field | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; no initialized field | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; no initialized field | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; no initialized field | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; no initialized field | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | number — ≥0 | Optional; Normal Loot/editor or Special Gear: 1; zero/fraction distinctions in section 9 | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Context-dependent; sections 4–6 (not a universal import default) | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; no initialized field | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; no initialized field | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; no initialized field | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |
| `npcs` | string — ≤1000000 chars | Optional; Absent; no initialized field | Thread Important NPCs | "Source text" | Narrative text. |
| `factions` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Factions array or Thread Factions text | "Source text" | Use array only under settlement.factions; Thread relationships are prose. |
| `clues` | string — ≤1000000 chars | Optional; Absent; no initialized field | Thread Clues / Discoveries | "Source text" | Narrative text. |
| `developments` | string — ≤1000000 chars | Optional; Absent; no initialized field | Thread Possible Developments | "Source text" | Narrative text. |
| `resolution` | string — ≤1000000 chars | Optional; Absent; no initialized field | Thread Resolution / Outcome | "Source text" | Narrative text. |

### Special

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `overlayImage` | string — ≤1000000 chars, runtime image-path check | Optional; "" | Special map overlay illustration | "" | Optional installed path; no image upload or page creation. |
| `sceneUuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; "" | Special Overview Scene reference | "" where allowed; otherwise real copied UUID | Content Scene link, not import placement. |
| `source` | string — ≤1000000 chars | Optional; "" | Source citation or provenance metadata | "Source text" | Envelope source is informational; special.source is visible text. |
| `overview` | string — ≤1000000 chars | Optional; "" | Visible Special Overview | "Source text" | Use for introduction plus overview without duplicating prose. |
| `situation` | string — ≤1000000 chars | Optional; "" | Special Situation or Settlement Current Situation | "Source text" | Narrative, not a structured event trigger. |
| `images` | array of object (table below) — ≤2000 | Optional; [] | Special Images gallery | [] (typed entries as documented) | Image JournalEntryPage references; details can retain a caption with no preview. |
| `locations` | array of object (table below) — ≤2000 | Optional; [] | Locations entries | [] (typed entries as documented) | Root and Special use different active arrays; see family matrix. |
| `inhabitants` | array of object (table below) — ≤2000 | Optional; [] | Special/Settlement Inhabitants | [] (typed entries as documented) | Normal uses encounters instead. |
| `gear` | array of object (table below) — ≤2000 | Optional; [] | Special Gear & Artifacts | [] (typed entries as documented) | Whole quantity normalization applies. |
| `events` | array of object (table below) — ≤2000 | Optional; [] | Special/Settlement Events | [] (typed entries as documented) | Distinct entry descriptors; authored descriptions, not automatically executed. |

### Settlement

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `version` | exact 1 | Optional; 1 | Version marker; no ordinary content control | 1 | Use 1 for model markers, X.Y.Z only for producer version. |
| `type` | string — ≤1000000 chars | Optional; "Other" | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `disposition` | string — ≤1000000 chars | Optional; "Unknown" | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `population` | string — ≤1000000 chars | Optional; "" | Settlement Overview Population | "Source text" | Text; not a JSON number. |
| `leadership` | string — ≤1000000 chars | Optional; "" | Settlement Overview Leadership | "Source text" | Text; not an Actor association. |
| `description` | string — ≤1000000 chars | Optional; "" | Visible Normal Description / Settlement Description or legacy Faction description | "Source text" | Root description is hidden in Special and Settlement; nested entry descriptions usually belong in details. |
| `notes` | string — ≤1000000 chars | Optional; "" | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `history` | string — ≤1000000 chars | Optional; "" | Root History entries or Settlement history narrative | "Source text" | Root is an entry array; Settlement history is text. Not Travel Event History state. |
| `situation` | string — ≤1000000 chars | Optional; "" | Special Situation or Settlement Current Situation | "Source text" | Narrative, not a structured event trigger. |
| `defenses` | string — ≤1000000 chars | Optional; "" | Settlement Defenses / Security | "Source text" | Narrative; no invented combat statistics. |
| `resources` | string — ≤1000000 chars | Optional; "" | Settlement Resources and Shortages / legacy Faction Resources | "Source text" | Correct type is text; no automatic supply counts. |
| `economy` | string — ≤1000000 chars | Optional; "" | Settlement Trade and Economy | "Source text" | Use for source-only goods/prices when no Shop Item UUIDs exist. |
| `image` | string — ≤1000000 chars, runtime image-path check | Optional; "" | Settlement Overview Image | "" | Installed path only; no asset upload. |
| `arkUuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; "" | Optional Settlement Ark reference | "" where allowed; otherwise real copied UUID | Expected official Ark Actor; no statistics are synchronized. |
| `projects` | array of object (table below) — ≤2000 | Optional; [] | Settlement Projects tab | [] (typed entries as documented) | Assignments to Project Items; optional empty reference can retain notes/progress. |
| `inhabitants` | array of object (table below) — ≤2000 | Optional; [] | Special/Settlement Inhabitants | [] (typed entries as documented) | Normal uses encounters instead. |
| `factions` | array of object (table below) — ≤2000 | Optional; [] | Settlement Factions array or Thread Factions text | [] (typed entries as documented) | Use array only under settlement.factions; Thread relationships are prose. |
| `events` | array of object (table below) — ≤2000 | Optional; [] | Special/Settlement Events | [] (typed entries as documented) | Distinct entry descriptors; authored descriptions, not automatically executed. |
| `threads` | array of object (table below) — ≤2000 | Optional; [] | Settlement Threads | [] (typed entries as documented) | Investigation/narrative records. |
| `shops` | array of object (table below) — ≤2000 | Optional; [] | Legacy merchant archive | [] (typed entries as documented) | Retained; migrate referenced inventory only if active shop is absent. |
| `shop` | object (table below) | Optional; Version 1 with empty groups when settlement object supplied; see section 6 | Active grouped Settlement Shop | {} (then supply supported subfields) | Import materialization can fill version/groups; no manual entry price field. |

### Shop

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `version` | exact 1 | Optional; 1 | Version marker; no ordinary content control | 1 | Use 1 for model markers, X.Y.Z only for producer version. |
| `groups` | array of object (table below) — ≤2000 | Optional; [] | Ordered Shop groups | [] (typed entries as documented) | Order is preserved, not alphabetized by the importer. |
| `migration` | object (table below) | Optional; Absent unless legacy migration occurs | Legacy Shop recovery summary | {} (then supply supported subfields) | Informational; do not invent claims about recovered inventory. |

### ShopGroup

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `name` | string — ≤1000000 chars | Optional; Absent; UI “Unnamed group” | Source name or Shop group heading | "Canal Haven" | Envelope source.name is informational; Shop group.name is editable. |
| `type` | string — ≤1000000 chars | Optional; "general" | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `entries` | array of object (table below) — ≤2000 | Optional; [] | Ordered Shop Item references | [] (typed entries as documented) | No active narrative-only stock; every entry needs a nonempty Item UUID. |

### ShopItem

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; MODEL REQUIRED, nonempty | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `legacyEntryId` | string — ≤1000000 chars | Optional; Absent | Prior merchant inventory entry identity | "Source text" | Recovery metadata; not a live document UUID. |
| `travelType` | "Land" / "Water" | Optional; Absent; display uses Item value or Land | Shop Vehicle Travel Type | "Land" | Only Land or Water; entry-local and independent of the Item. |

### ShopMigration

Here `source` is migration provenance such as `settlement.shops`, not a sourcebook citation or UUID.

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `version` | exact 1 | Optional; Absent; no initialized field | Version marker; no ordinary content control | 1 | Use 1 for model markers, X.Y.Z only for producer version. |
| `source` | string — ≤1000000 chars | Optional; Absent; no initialized field | Source citation or provenance metadata | "Source text" | Envelope source is informational; special.source is visible text. |
| `unlinked` | integer — ≥0 | Optional; Absent; no initialized field | Archived entries without usable UUIDs | 0 | Nonnegative integer count; not active stock. |
| `duplicates` | integer — ≥0 | Optional; Absent; no initialized field | Legacy duplicate UUID occurrence count | 0 | Informational; active Shop rejects duplicate UUIDs. |

### LegacyShop

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; no initialized field | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; no initialized field | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; no initialized field | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; no initialized field | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; no initialized field | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | number — ≥0 | Optional; Normal Loot/editor or Special Gear: 1; zero/fraction distinctions in section 9 | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Context-dependent; sections 4–6 (not a universal import default) | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; no initialized field | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; no initialized field | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; no initialized field | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |
| `proprietor` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy merchant proprietor text | "Source text" | Archive only, no active merchant interface. |
| `inventory` | array of object (table below) — ≤2000 | Optional; Absent; no initialized field | Legacy merchant inventory archive | [] (typed entries as documented) | Not active Shop entries. |

### LegacyInventory

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `id` | string — ≤128 chars, pattern ^[A-Za-z0-9_-]+$ | Optional; Assigned when missing; prefer explicit stable ID | Stable entry identity; no direct editor input | "npc-mara" | Optional; deterministic IDs normally supplied by materialization. Keep unique in the relevant namespace. |
| `title` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested entry heading/name | "Canal Haven" | For entries, title is the correct key; name is not an alias. |
| `details` | string — ≤1000000 chars | Optional; Absent; no initialized field | Nested narrative / description editor | "Source text" | Put supplied statistics/mechanics in text here when no Actor exists. |
| `notes` | string — ≤1000000 chars | Optional; Absent; no initialized field | GM Notes in root Overview or Settlement entries; context-dependent metadata elsewhere | "Source text" | Root notes is not Settlement Overview notes; normal/Special individual records primarily display details. |
| `status` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Exploration or entry state, context-dependent control | "Source text" | Use the exact UI vocabulary discussed in sections 4–6; validator accepts strings. |
| `type` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Context-dependent loot category, Inhabitant classification, Settlement kind or Shop layout | "Source text" | Read context-specific vocabulary; unrelated Item type must not be guessed. |
| `legacyStatus` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Normal Inhabitant status | "Source text" | No independent editing control; retained original while current selection normalizes. |
| `legacyType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Compatibility metadata for old Inhabitant/Loot type | "Source text" | No independent editing control. |
| `referenceTitle` | string — ≤1000000 chars | Optional; Absent; no initialized field | Prior resolved reference name | "Source text" | Supports later explicit reference assignments; no name-based lookup. |
| `referenceName` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference display-name fallback, notably Projects | "Source text" | Does not resolve a missing UUID. |
| `referencePack` | string — ≤1000000 chars | Optional; Absent; no initialized field | Saved source-pack metadata | "Source text" | No automatic pack/name search. |
| `referenceType` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference classification metadata | "Source text" | Does not create/type-convert the referenced document. |
| `referenceWarning` | string — ≤1000000 chars | Optional; Absent; no initialized field | Reference warning text / generated-entry metadata | "Source text" | Stored warning; not proof that reference resolution was performed now. |
| `detailsFormat` | string — ≤1000000 chars | Optional; Absent; no initialized field | Safe Inhabitant description preview selector | "html" | html enables sanitized preview in Inhabitant contexts; other strings stay text/metadata. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
| `portrait` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Inhabitant image path | "" | Normal imported portrait body/Settlement portrait editor; Special heading avatar still resolves the Actor. |
| `imageSrc` | string — ≤1000000 chars, runtime image-path check | Optional; Absent; no initialized field | Stored Special image-source metadata | "" | Gallery preview still requires a resolvable image-type JournalEntryPage. |
| `titleOverride` | boolean | Optional; Absent; no initialized field | Protect an edited title during later explicit reference linking | false | Does not itself resolve documents. |
| `quantity` | string — ≤1000000 chars or number | Optional; Absent; archived as supplied | Normal Loot/Special Gear or legacy inventory quantity | "Source text" | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Context-dependent; sections 4–6 (not a universal import default) | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |
| `typeSource` | string — ≤1000000 chars | Optional; Context-dependent; sections 4–6 (not a universal import default) | Loot category provenance | "Source text" | Common values manual, reference, default, legacy; plain string validator. May be initialized by normalization. |
| `resource` | string — ≤1000000 chars | Optional; Absent; no initialized field | Legacy generated supply-entry metadata | "Source text" | Not a new consumable field or item transfer. |
| `generated` | object (table below) | Optional; Absent; no initialized field | Core generation provenance | {} (then supply supported subfields) | method core can make an entry eligible for replacement by later Randomize. |
| `generation` | object (table below) | Optional; Absent; no initialized field | Add-entry generation provenance | {} (then supply supported subfields) | No roll or automation on import. |
| `actorImport` | object (table below) | Optional; Absent; no initialized field | Existing explicit Actor Info snapshot marker | {} (then supply supported subfields) | Do not invent for narrative-only NPCs; does not fetch/copy Actors during JSON import. |
| `role` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant Role / Occupation | "Source text" | Accepted common metadata elsewhere; not a typed Actor role system. |
| `disposition` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement/Settlement Inhabitant relationship or legacy Faction relationship | "Source text" | Strings are not globally enum-restricted; Faction legacy value is consolidated into Info. |
| `factionId` | string — ≤1000000 chars | Optional; Absent; no initialized field | Settlement Inhabitant associated Faction | "npc-mara" | Match the Faction id; does not populate the Member gallery. |
| `price` | string — ≤1000000 chars or number | Optional; Absent; no initialized field | Legacy inventory price/barter text or number | "Source text" | Archived only. Current Buy reads live Item.system.cost. |

### Supplies

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `cleanGrub` | object (table below) | Optional; Absent; no initialized field | Consumable: Clean Grub | {} (then supply supported subfields) | Quantity/collected subobject; exact source units only. |
| `rotGrub` | object (table below) | Optional; Absent; no initialized field | Consumable: Rot Grub | {} (then supply supported subfields) | Quantity/collected subobject. |
| `cleanWater` | object (table below) | Optional; Absent; no initialized field | Consumable: Clean Water | {} (then supply supported subfields) | Nonnegative decimal quantity allowed. |
| `rotWater` | object (table below) | Optional; Absent; no initialized field | Consumable: Rot Water | {} (then supply supported subfields) | Nonnegative decimal quantity allowed. |
| `bullets` | object (table below) | Optional; Absent; no initialized field | Bullets supply or obtained Find the Path stunt | {} (then supply supported subfields) | Supply is a resource subobject; pathStunts.bullets is boolean, not an amount. |
| `booze` | object (table below) | Optional; Absent; no initialized field | Consumable: Booze | {} (then supply supported subfields) | Quantity/collected subobject. |
| `components` | object (table below) | Optional; Absent; no initialized field | Consumable: Components | {} (then supply supported subfields) | Quantity/collected subobject. |

### Supply

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `quantity` | number — ≥0 | Optional; Editor: 0 | Normal Loot/Special Gear or legacy inventory quantity | 0 | Normal Loot allows zero/decimals; Special Gear coerces anything except whole ≥1 to 1. Legacy inventory is archival. |
| `collected` | boolean | Optional; Editor: false | Normal Loot or Consumable collection checkbox | false | No resource transfer; retained but no collection checkbox for Special Gear. |

### PathStunts

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `safePath` | boolean | Optional; Editor: false (legacy safePath inference possible) | Find the Path basic effect | false | Do not award by reading a sourcebook description. |
| `artifact` | boolean | Optional; Editor: false (legacy safePath inference possible) | Find the Path artifact stunt | false | Boolean visit bookkeeping, not an artifact entry/count. |
| `assessRot` | boolean | Optional; Editor: false (legacy safePath inference possible) | Find the Path assess-Rot stunt | false | Does not set environmental Rot automatically. |
| `bullets` | boolean | Optional; Editor: false (legacy safePath inference possible) | Bullets supply or obtained Find the Path stunt | false | Supply is a resource subobject; pathStunts.bullets is boolean, not an amount. |
| `grub` | boolean | Optional; Editor: false (legacy safePath inference possible) | Find the Path grub stunt | false | Boolean, not an award/quantity. |
| `water` | boolean | Optional; Editor: false (legacy safePath inference possible) | Find the Path water stunt | false | Boolean, not an award/quantity. |
| `halfTime` | boolean | Optional; Editor: false (legacy safePath inference possible) | Find the Path half-time stunt | false | Authoritative over travel.stalker on load. |
| `rush` | boolean | Optional; Editor: false (legacy safePath inference possible) | Find the Path rushed stunt | false | Authoritative over travel.rushed on load. |
| `saferRoute` | boolean | Optional; Editor: false (legacy safePath inference possible) | Rot Finder safer-route bookkeeping | false | Not an automatic change to the recorded Rot level. |

### Travel

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `mode` | "foot" / "vehicle" | Optional; Editor: "foot" | Travel Mode calculator | "foot" | Strict foot or vehicle. |
| `rushed` | boolean | Optional; Editor: false | Travel rushed duplicate switch | false | On editor load overridden by pathStunts.rush; omitted from storedTravel when saved. |
| `stalker` | boolean | Optional; Editor: false | Travel Stalker duplicate switch | false | Overridden by pathStunts.halfTime; omitted from storedTravel when saved. |
| `open` | boolean | Optional; Editor: false | Open/Empty Terrain travel modifier | false | Difficult Terrain excludes this modifier. |
| `difficult` | boolean | Optional; Editor: false | Difficult Terrain travel modifier | false | Boolean; not a difficulty number. |
| `night` | boolean | Optional; Editor: false | Nighttime travel modifier | false | Boolean; no automatic time advancement. |
| `difficulty` | number — ≥2 | Optional; Editor: 2 | Difficult Terrain multiplier | 2 | Number at least 2; planning reference only. |

### Randomization

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `method` | string — ≤1000000 chars | Optional; Absent; no initialized field | Generation provenance method | "Source text" | Examples core/add-entry are historical facts only; external conversions normally omit. |
| `threatLevel` | string — ≤1000000 chars | Optional; Absent; no initialized field | Normal/Special Threat Level control, or generation category metadata | "Source text" | Root is nonnegative integer; randomization.threatLevel is category text. Not interchangeable. |
| `numericThreatLevel` | integer — ≥0 | Optional; Absent; no initialized field | Legacy root Threat Level fallback | 0 | Only used if root threatLevel is missing, then cleaned up by the editor. |
| `levelSelection` | safe JSON | Optional; Absent; no initialized field | Existing numeric-level selection provenance | "Source text" | Arbitrary safe JSON; no generated defaults. |
| `environment` | object (table below) | Optional; Absent; no initialized field | Existing environment eligibility result | {} (then supply supported subfields) | Ruin/Threat/Artifact eligibility is independent metadata; no generation on import. |
| `baseDice` | array of integer — ≥1, ≤6 — ≤2000 | Optional; Absent; no initialized field | Actual recorded Base Dice faces | [] (typed entries as documented) | Array of integer faces 1–6; no automatic roll. |
| `rolledOnes` | integer — ≥0 | Optional; Absent; no initialized field | Recorded count of dice showing 1 | 0 | Nonnegative integer metadata. |
| `rolledSixes` | integer — ≥0 | Optional; Absent; no initialized field | Recorded count of dice showing 6 | 0 | Nonnegative integer metadata. |
| `threatSeverity` | integer — ≥0 | Optional; Absent; no initialized field | Count of threatening Base Dice ones in existing generation metadata | 0 | Nonnegative integer; never invent a roll. |
| `threatCount` | integer — ≥0 | Optional; Absent; no initialized field | Recorded generated threat-identity count | 0 | Not current encounter-entry count automation. |
| `artifactCount` | integer — ≥0 | Optional; Absent; no initialized field | Recorded generated artifact count | 0 | Not current loot count automation. |
| `threatMode` | string — ≤1000000 chars | Optional; Absent; no initialized field | Core or individual-d3 house-rule provenance | "Source text" | String validator; do not claim generation that did not happen. |
| `sources` | array of safe JSON — ≤2000 | Optional; Absent; no initialized field | Persisted table-result provenance array | [] (typed entries as documented) | Safe arbitrary JSON, not live Documents; do not fabricate sources. |

### Environment

Here `name` is the saved environment result name (e.g. Thick Woods), not a Shop heading or filename. This is generation metadata, not a separate visible environment control.

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `name` | string — ≤1000000 chars | Optional; Absent; no initialized field | Source name or Shop group heading | "Canal Haven" | Envelope source.name is informational; Shop group.name is editable. |
| `ruins` | string — ≤1000000 chars or null | Optional; Absent; no initialized field | Environment ruin-table eligibility metadata | "Source text" | Typical normal or industrial, or null; validator accepts strings. Do not generate from an unsupported inference. |
| `threats` | boolean | Optional; Absent; no initialized field | Environment threat eligibility metadata | false | Boolean independent of artifacts. |
| `artifacts` | boolean | Optional; Absent; no initialized field | Environment artifact eligibility metadata | false | Boolean independent of threats. |
| `manual` | boolean | Optional; Absent; no initialized field | Environment manual-authoring classification metadata | false | Stored metadata; not a request to execute generation. |

### Generated

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `method` | string — ≤1000000 chars | Optional; Absent; no initialized field | Generation provenance method | "Source text" | Examples core/add-entry are historical facts only; external conversions normally omit. |
| `threatCategory` | string — ≤1000000 chars | Optional; Absent; no initialized field | Generated threat classification metadata | "Source text" | Typically humanoid, monster, encounter, phenomenon; string validator. |
| `threatSeverity` | integer — ≥0 | Optional; Absent; no initialized field | Count of threatening Base Dice ones in existing generation metadata | 0 | Nonnegative integer; never invent a roll. |
| `threatMode` | string — ≤1000000 chars | Optional; Absent; no initialized field | Core or individual-d3 house-rule provenance | "Source text" | String validator; do not claim generation that did not happen. |
| `sources` | array of safe JSON — ≤2000 | Optional; Absent; no initialized field | Persisted table-result provenance array | [] (typed entries as documented) | Safe arbitrary JSON, not live Documents; do not fabricate sources. |

### Generation

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `method` | string — ≤1000000 chars | Optional; Absent; no initialized field | Generation provenance method | "Source text" | Examples core/add-entry are historical facts only; external conversions normally omit. |
| `sources` | array of safe JSON — ≤2000 | Optional; Absent; no initialized field | Persisted table-result provenance array | [] (typed entries as documented) | Safe arbitrary JSON, not live Documents; do not fabricate sources. |

### ActorImport

| Property | Type / constraints | Required / default | UI / purpose | Example | Import / restrictions |
| --- | --- | --- | --- | --- | --- |
| `version` | exact 1 | Optional; Absent; no initialized field | Version marker; no ordinary content control | 1 | Use 1 for model markers, X.Y.Z only for producer version. |
| `uuid` | string — ≤512 chars, pattern ^[A-Za-z0-9_.-]*$ | Optional; Absent; no initialized field | Optional Foundry document link; context-dependent | "" where allowed; otherwise real copied UUID | Empty allowed for ordinary narrative entries; effective Faction Member and active Shop Item UUIDs must be nonempty. |
