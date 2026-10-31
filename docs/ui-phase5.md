# Phase 5: regression, portable compatibility and cleanup — 0.1.55

## Executive summary

The Phase 0–4C editor changes pass the complete automated regression suite.
No missing portable descriptor was found among **140 normalized named editor
field paths across all 22 tabs**. All three types retain active and inactive
supported content through import/export and conversion. This is automated
validation with simulated Foundry APIs, not a live Foundry compatibility claim.

**Format 1, schema 1 and persisted model 1 remain appropriate.** The fixes below
correct validation, deterministic defaults and preview permissions; they do not
reinterpret authored data, introduce a migration, redesign UI or change gameplay.
Version 0.1.55 is prepared for the normal PR/merge/tag workflow. This PR does not
publish a release or tag.

`myz-sector-THE-DOOM-SPHERE.json` was not available in this workspace. It was not
tested. The existing Special example was used as the basis for an explicitly
synthetic legacy-compatible fixture, with 5 Locations, 6 Inhabitants, 19 Gear
entries and 6 Events. Unicode, paragraph breaks and fictional citations exercise
preservation without claiming to contain the user's source material. Equipment
mentioned in narrative is not deduplicated against Gear entries.

## Authoritative paths and format assessment

- `scripts/portable/schema.mjs`: shared descriptors and envelope contract.
- `serialization.mjs`: `project`, `materialize`, `validatePortable`,
  `serializeSector`, `deserializeSector`, `inspectReferences`.
- `persistence.mjs`: `captureDestination`, `assertDestination`,
  `replacementData`, `persistImportedSector` implement guarded atomic replacement.
- `ui.mjs`: `importSector` validates/previews/confirms before persistence;
  `exportSector` explicitly distinguishes saved content from unsaved drafts.
- `sector-manager.mjs`: `normalize`, `loadDraft`, `capture`, `changeSectorType`,
  `saveSector`/`writeSector`, and collection save handlers remain authoritative
  for editor normalization and writes.
- `sector-types.mjs`, `settlement.mjs`, `settlement-factions.mjs`,
  `settlement-shop.mjs`, `loot.mjs`, `sector-fields.mjs`, `travel-time.mjs`:
  existing model defaults, compatibility rules and type-aware behavior.
- `settlement-ark.mjs` and `settlement-projects.mjs`: read-only hydration/draft
  snapshots versus explicit native progress/completion writes.
- `ui/documents.mjs`, `ui/reference.mjs`, `ui/images.mjs`,
  `ui/inhabitant-portraits.mjs`: permission checks and display fallbacks.

Both published Schema artifacts are checked against the runtime descriptors.
The standalone Schema retains named definitions and image safety descriptions;
image safety, recursive budgets and relationship/identity checks additionally
require runtime validation. Schema validation alone is not sufficient to import.

## Field coverage matrix

The [property-by-property matrix](sector-json/phase5-field-coverage.md) enumerates
every named Schema-family property with purpose, classification, storage,
serializer/importer/schema coverage and test families. The [authoritative field
catalog](sector-json/SECTOR-JSON-GUIDE.md) supplies exact types, constraints,
defaults and distinctions between editable fields and retained metadata.

| Surface / collection | Editor and stored data | Export / import / Schema | Regression evidence |
| --- | --- | --- | --- |
| Shared Overview | Name override/custom name, terrain, Rot, threat, exploration status, description, mood, notes | All recognized; code/Scene placement intentionally excluded from content | P: zero/custom values; B: named controls and edited notes |
| Normal Locations | IDs, title/details/status, Scene or Journal/Page UUID, reference snapshots | Preserved | P/D plus interface drop/snapshot tests |
| Normal Inhabitants (`encounters`) | IDs, name/details, status/type and legacy originals, Actor/Journal reference, portrait/import metadata | Preserved; existing canonical encounter normalization on editor load | P/B and Phase 2/4A browser suites |
| Normal Gear (`loot`) | Title, decimal/zero quantity, type/typeSource, Collected, Item reference, provenance | Preserved; no Special Collected semantics added | P/B and Phase 4B/browser autosave coverage |
| Supplies | Seven resource quantities and Collected booleans | Zero/fractions/false preserved | P and existing loot tests |
| Effects | Category, duration, Macro UUID, trigger ID, run-once/enabled/disabled compatibility fields, narrative/reference data | Preserved; token fired-state flags excluded | P and entry-trigger tests |
| Find the Path / travel | Known stunts, foot/vehicle and modifiers/difficulty | Preserved with documented existing linked-switch/default normalization | P/D and interface tests |
| History / secrets | Root entry arrays, IDs, narrative/status/reference metadata | Preserved; secrets is accepted legacy storage without a current dedicated tab | P/D |
| Special Overview | Source, overview, situation, Scene UUID, overlay image; shared root fields retained | Preserved | P/D/B |
| Special Locations | Separate IDs, title/details and Journal/Page/Scene references | Preserved separately from inactive Normal locations | P/D and interface tests |
| Special Inhabitants | IDs, title/details, Actor reference, saved portrait and Actor import marker | Preserved; runtime Actor portrait is not synthesized by export | P/B and portrait/reference suites |
| Special Gear | IDs, titles/details, whole quantity, custom type and Item reference | Preserved; existing zero/fraction normalization to 1 now warns | P/D/B; 19 synthetic entries retained |
| Special Events | IDs, title/details, reference and existing compatible metadata | Preserved separately from Settlement Events | P/D/B |
| Special Images | IDs, names/notes, image Page UUID, saved imageSrc snapshot | Preserved; no binary export or fallback-image substitution | P/D and Phase 4A/4C suites |
| Settlement Overview | Type, disposition, population, leadership, image, description/notes/history/situation/defenses/resources/economy, Ark UUID | Preserved; live Ark display values not read by serializer | P/D/B and linked Ark interface tests |
| Projects | IDs, Item reference/title/reference metadata, status, local workPoints, progress text, completion date, notes, arkSource snapshot | Preserved; no native Item data export/write | P/D and project/Ark suites |
| Settlement Inhabitants | IDs, narrative, role, disposition, factionId, Actor reference, saved portrait | Preserved; missing association warned and retained | P/B |
| Factions / Members | Faction and member IDs, Info/version, Actor UUIDs; legacy structured notes/lists | Existing additive conversion retained; original fields remain | P/D and Faction interface tests |
| Settlement Events / Threads | Status, narrative, triggers/outcomes/related; NPC/Faction/clue/development/resolution text | Preserved; text relationships are not inferred into UUIDs | P/D/B |
| Shop | Stable group/stock IDs and order, group type/name, Item/Vehicle UUID, passengers/travelType, playerAccess, trading values; migration metadata | Preserved; live prices/statistics are native document data | P/B and Shop suites |
| Legacy Shops | Full supported merchant/inventory archive | Preserved; existing reference-only active Shop migration retained | P/D and interface migration tests |
| Generated provenance | randomization, generation/generated and sources | Safe recognized metadata retained; no rolls performed | P and generator/parser suites |
| Unknown properties | Quarantined by original path under portableExtensions | Envelope extensions survive repeated cycles; never activated | P including null/zero/false/empty values |
| Temporary / world / native data | Scroll, focus, collapse, caches, loading, fired state, roster, settings, Campaign Log, Travel history, live Documents | Excluded from sector-content contract; no new serialization | B source purity; existing service suites |

P = `portable-sectors.test.mjs`; D = `sector-json-documentation.test.mjs`;
B = `ui-phase5-browser.cjs`. The browser checks actual rendered names against
runtime descriptors; it does not merely compare a second handwritten field list.

## Confirmed defects and changes

| Defect | Before | Correction / compatibility |
| --- | --- | --- |
| Omitted Settlement body | Runtime default Shop construction assigned a fresh random group ID on each materialization | Initialize the absent body before portable defaults; deterministic empty Shop, same as explicit `{}`. No authored entry removed. |
| Cross-Shop ID collisions | Group versus stock, or stock across groups, could pass per-array checks and be randomly repaired by normalizeShop | Reject collision with ID and Shop context before mutation. Explicit identities are never guessed/repaired. |
| Incomplete extensions | Missing path/value passed projection; preview could fail on path.join | Require both fields in descriptors and both published schemas. Safe null remains valid for value. |
| Preview permission divergence | Direct fromUuid treated truthy restricted results as resolved and propagated raw resolver diagnostics | Reuse requireDocument; cache one result per UUID, retain authored data, report safe unavailable/inaccessible messages. |
| Integer Schema drift | Operational Schema omitted safe-integer maximum already enforced at runtime | Declare maximum 9007199254740991; standalone Schema already declared it. No runtime value acceptance changed. |
| Silent compatibility outcomes | Special Gear fractional/zero fallback and missing faction association had no preview warning | Explain existing quantity normalization and preserved missing association, without remapping or new mechanics. |
| Documentation drift | Claimed missing default IDs could be random and unknown dropdowns could fall back; preview description lacked permission checks | Update current behavior, exclusions, asset/native boundaries and compatibility contract. |

No editable sector fields were found missing from the serializer/schema. Retained
metadata without a direct control is intentional: provenance, legacy archive,
reference/title snapshots, legacy fields, inactive collections and secrets.
No collections or public APIs were removed. Conservative cleanup removes only the
unused SECTOR_SCHEMA import in serialization and contentEmpty import in Settlement
UI. The exported contentEmpty compatibility adapter remains available.

## Compatibility and round-trip results

All supported version-1 exports remain supported. Invalid colliding Shop IDs and
incomplete extension records now fail clearly instead of being repaired or failing
later. No format 2 or automatic world migration is needed. Arbitrary unversioned
JSON and unsupported future versions remain rejected. Optional omissions are
normalized deterministically; explicitly invalid types are not coerced.

Normal, Special and Settlement full-content exports survived five repeated
cross-world cycles with equal portable sector content and extension records.
Tests preserve IDs, relationships, group/entry order, UUID families, image paths,
Unicode, paragraphs, zero/false/empty/unknown-null values and supported decimals.
The synthetic Special legacy fixture survived six cycles with exact original
5/6/19/6 collections and entry narrative/identity values. All three types plus the
synthetic fixture were loaded in the actual editor DOM, edited, saved and exported
through the real handlers; edited text and repeated portable content matched.

Conversions Normal → Special → Settlement → Normal and back retain inactive
collections and export the intended active type; active inhabitants indicators
read the matching collection. Different worlds replace placement, not IDs or
narrative. Missing UUIDs preserve entries and snapshots; no Actors/Items are
created or names guessed. Compendiums/assets must exist or be relinked.

Native Ark boundaries remain intact: export reads saved sector flags, not live
system data; import writes only the selected sector Journal. Existing saved
assignment snapshots stay portable. Opening a resolvable linked Ark can refresh
the draft; explicit native completion remains a separate guarded user action.
Faction gallery and linked Actor portraits resolve live rather than exporting
runtime thumbnails. Saved portrait and image paths retain their original values.

Import policy remains complete replacement with preview and Cancel-default second
confirmation. Input validates before writes. Current selection/Scene/grid and
baseline guards remain; the same atomic update retains the recovery snapshot and
clears old fired state. Failed writes leave prior content intact. Tests cover empty,
occupied/different-type, matching IDs, missing references, cancellation, malformed
input and failed persistence. No new merge policy or rollback process is added.
Export with unsaved edits still offers Cancel, Export Last Saved Version or Save
and Export; it reads persisted flags after pending collection writes, never
silently switches to the draft. Existing multiple-GM conflict handling is retained.

## Changed files

- `scripts/portable/serialization.mjs`: deterministic defaults, Shop identity
  validation, safe reference inspection, compatibility warnings, unused import.
- `scripts/portable/schema.mjs`: extension required fields and safe-integer bounds.
- `scripts/settlement-ui.mjs`: unused import only.
- `tests/portable-sectors.test.mjs`: eight focused regression tests with repeated
  cycles, synthetic legacy content, identities, references/images, edge values,
  validation atomicity, permissions and conversions.
- `tests/ui-phase5-browser.cjs`: editor field/Schema audit and real edit/save/export.
- `tests/interface-browser.cjs`: focused Phase 5 fixture entry point only.
- `tests/fixtures/sector-special-legacy-v1.json`: clearly synthetic legacy fixture.
- `tests/validate-portable-schema.py`: optional development-only external validator,
  both schemas with source and runtime exports plus invalid cases; no module dependency.
- `tests/sector-json-documentation.test.mjs`: property-matrix completeness assertion.
- `docs/sector-portable.schema.json`, `docs/sector-json/sector.schema.json`: align
  with descriptors, retaining named standalone families and permissive extensions.
- `docs/sector-portability.md`, `docs/sector-json/SECTOR-JSON-GUIDE.md`: compatibility
  and current operational behavior.
- `docs/sector-json/phase5-field-coverage.md`, this report: complete audit/matrix.
- `README.md`, `module.json`: review notes and aligned prepared 0.1.55 download URL.

## Automated results

Baseline: 527/527 Node tests passed before changes.

| Command / check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 535/535 passed after implementation (additional catalog assertion remains in existing test) |
| `node tests/ui-phase5-browser.cjs` | Passed: 140 named field paths, all types + synthetic legacy fixture, real edit/save/export and sidebar scroll |
| Each `node tests/*browser.cjs` file | All 14 suites passed; run individually, not one Node process with expanded filenames |
| `python tests/validate-portable-schema.py` | 28 valid document/Schema checks and 10 invalid document/Schema checks passed; Python jsonschema is a development tool only |
| `node --check scripts/sector-manager.mjs` | Passed |
| `/workspace/tools/actionlint-1.7.7/actionlint` | Passed |
| `node scripts/prepare-release.mjs v0.1.55` | Passed; validates manifest, required files and syntax of all declared modules |
| `unzip -t dist/myz-sector-manager-v0.1.55.zip` | Passed |
| ZIP content comparison | Root module.json, README, every declared module/style match source; dist manifest matches |
| `git diff --check` | Passed |

The 14 suites are interface, document-reference, Phase 2, Phase 3, Phase 4A,
Phase 4B, Phase 4C, Phase 5, overlay, wandering, travel, player-shop, campaign-log
and party-skills. They cover long/empty collections, 22 tabs at desktop/narrow/
maximized widths, removal cancellation, Save/Discard/Cancel, failed/conflicting
saves, collection autosaves, Ark writes, Shop interactions, Actor/Item drops,
reference opening/hydration, image fallbacks and scroll/focus restoration.
No automatic formatter, speculative component rewrite or schema migration ran.

## Manual Foundry v14 checklist

Use a backed-up official MYZ world; these live checks have not been performed.

1. Export populated Normal, Special and Settlement sectors, and import into empty
   squares in another world. Compare every tab, ID relationships, notes, supplied
   Doom Sphere content when available and asset availability after reload.
2. Test missing world/Compendium/Actor/Page/Macro references; relink deliberately.
   Verify saved narrative/portrait paths survive; gallery/Actor images fall back
   without replacing saved paths. Confirm restricted documents are not exposed.
3. Cancel previews/replacement and dirty navigation. Repeat confirmed replacement
   into another type; verify recovery snapshot/unrelated Journal flags. Test
   failed permission writes and concurrent GM edits without data loss.
4. Exercise Add/Remove, cancellation, collapse, keyboard focus, long/narrow views,
   sector selection, sidebar/editor scroll, image load and reference hydration.
5. Test draft-only, loot/stunt/collection autosaves, unsaved export choices and
   save after import. Confirm native Ark statuses/Work Points and Shop player
   purchases use existing permissions and calculations.
6. Check imported linked Ark synchronization and player-publication settings
   before giving macros to players. Import itself must not write Ark Items,
   execute macros, move tokens or generate Travel Events.

## Remaining limitations, in priority order

- **P1 verification:** actual Foundry v14/theme/native dialogs, reloads and player
  permissions need the backup-world checks; the user's Doom Sphere export is
  unavailable. Simulated APIs cannot establish live runtime correctness.
- **P2 existing concurrency limit:** destination snapshots are checked immediately
  before writes, but Foundry supplies no server compare-and-swap for the exact
  concurrent commit instant. Coordinate imports between GMs; unchanged limitation.
- **P2 external assets/references:** JSON does not bundle images/Compendiums/native
  Actors or Items. Missing/wrong-type references need manual relinking; resolver
  previews check permission/existence, not every family-specific native type.
- **P3 documented normalization:** defaults/IDs and legacy Faction/Shop conversions
  are additive; Special Gear quantities follow existing whole-unit rules.
  Encounter legacy normalization and travel/stunt housekeeping occur in the editor.
  Round trips preserve meaningful content, not JSON key order/formatting or source
  world placement/provenance. Unknown fields remain inert extension records.
- **P3 cleanup deferred:** further inline-style/component extraction is not proven
  necessary for stabilization and is deliberately left untouched.
