# Single-sector JSON import and export (0.1.36)

The **Sector Manager Settings** gear sits immediately to the right of **+ New Sector**. It replaces the old collapsible Zone tools section. Configure / Tracking, View Zone, Select on map, Show/Hide overlay, Wander Now, Wandering Tokens, and both selected-token wandering actions retain their behavior. Import Sector and Export Sector are GM-only. The browser's native popover opens in the top layer, closes outside/on Escape or after a choice, and supports Up/Down/Home/End. It follows the application when moved or resized; no document-wide menu listeners are installed.

## Export

Select a saved sector, then choose **Export Sector**. The download is `myz-sector-[sanitized name].json`. An uncreated square or initial-save-pending record cannot be exported. Export reads the persisted `flags.myz-sector-manager.sector`, never reconstructs data from form HTML and never modifies its source. If you have unsaved edits, choose Cancel, Save and Export, or explicitly Export Last Saved Version while retaining the draft. Pending collection saves finish before the saved snapshot is read.

All three types are supported. Active and inactive supported content is preserved, including rich text, environmental data, stunts/travel planning, supplies, generated-entry provenance, Special content/images, Settlement overview/projects/inhabitants/factions/events/threads, legacy Shop archives and the active grouped Shop. IDs, faction associations, UUID strings, Project assignment progress, group/Item ordering, group types and Vehicle Travel Type are retained. No live Actor/Item documents, DOM, runtime caches, per-token fired state or temporary editor accordions are serialized.

## Import

1. Configure a Zone Scene/grid. Use **Select on map** or the grid overlay to select a destination square. A selected saved sector also supplies its Zone coordinate. For an empty square, cancel the existing New Sector prompt, then choose Import Sector; the selected square remains shown beside Zone Map / Tracking.
2. Choose **Import Sector**, select a local `.json` file, and click Preview. URLs and batch files are not supported.
3. Review the name/type, captured Scene/coordinate, occupancy, entry counts, source versions, unknown-field/migration warnings and missing UUIDs. The original file coordinate never selects the destination.
4. Choose Import. An occupied square instead requires a second **Replace Existing Sector** confirmation, with Cancel as the default. Replacement is complete, not a merge.
5. After persistence succeeds the new/replaced sector opens. Other sectors, Zone settings, Actors and Items are untouched. Import never moves tokens, rolls tables, executes Macros, runs sector effects or creates replacement references.

The Scene, viewed canvas Scene, selected-square revision, grid and destination sector snapshot are captured at the start and checked again before committing. Changes require restarting import, including a selection change away and back. Multiple records occupying the same square block import until their ambiguity is resolved. Local concurrent clicks are guarded. Foundry does not provide a server-side compare-and-swap flag transaction here: another GM writing the same Journal at precisely the commit instant remains a practical concurrency limitation; coordinate imports between GMs.

New imports are scoped to their destination Scene using `placement: {version: 1, sceneId: ...}` plus the normal destination `code`. Existing legacy global Normal/Special records retain their scope. Settlements retain their established Scene behavior. Nested IDs remain content identities, not Scene identities; repeat imports can safely reuse them in independent sector records. Missing optional IDs are assigned deterministic `import-entry-N` values. Duplicate/unsafe IDs in a collection, or duplicate IDs in Settlement's shared entry namespace, are rejected rather than guessing relationship repairs.

### Replacement and recovery

Replacement uses one Journal update. Explicit Foundry deletion operators remove obsolete content recursively, including stale type-specific fields; arrays replace as arrays. The same operation saves the previous sector and its fired-state history in `flags.myz-sector-manager.lastSectorImport` and clears the replaced sector's old `entryTriggers`. A rejected update leaves the old content intact. The Journal identity and unrelated flags/pages remain; no referenced documents are deleted. Only the most recent replacement snapshot is retained. There is no automatic rollback that might overwrite later edits and no recovery GUI in this initial version. A GM/developer can inspect `journal.getFlag('myz-sector-manager', 'lastSectorImport')` to recover the previous data. Back up your world before destructive replacements.

## Format for external tools and LLM-generated files

See [the machine-readable JSON Schema](sector-portable.schema.json) and actual validated examples:

- [Normal](examples/sector-normal.json)
- [Special](examples/sector-special.json)
- [Settlement](examples/sector-settlement.json)

Example envelope:

```json
{
  "format": "myz-sector-manager",
  "formatVersion": 1,
  "schemaVersion": 1,
  "sector": {
    "sectorType": "normal",
    "nameOverride": true,
    "customName": "The Rust Bridge",
    "terrain": "Ruined Bridge",
    "description": "A bridge spans the river."
  }
}
```

`format`, `formatVersion`, `schemaVersion`, and `sector.sectorType` are required. Use exactly `normal`, `special` or `settlement`; no speculative aliases are inferred. The optional `exportedBy` identifies the producing module and its real installed version. Module release version, envelope format version and sector schema version are separate. Optional `source.coordinates`/`source.name` describe provenance only. Coordinates, Scene identity, placement and Journal identity are not required content fields and never override import placement. To name a sector, use the existing `nameOverride: true` and `customName` fields, not an invented `name` field. Provide actual descriptions; defaults do not fabricate narrative content.

Optional fields and nested structures are enumerated in the Schema generated from the same descriptors as runtime validation. Common entry fields include `id`, `title`, `details`, `notes` and optional `uuid`. Normal Inhabitants use the existing `encounters` key. Special arrays live under `special`. Settlement arrays and `shop` live under `settlement`. All nested IDs are at most 128 characters and use safe letters, numbers, underscores and hyphens and must be unique in their applicable collection/namespace. Inhabitant `factionId` must refer to the intended Faction `id`; the importer never guesses associations from text. Current typed values are required (numbers, booleans, strings and arrays are not silently interchanged). Project progress/status and descriptive narrative are strings. Quantities and Threat Level are nonnegative numbers; Threat Level is an integer. Omit missing document references for descriptive entries. Active Shop Item entries require an Item `uuid`; omit the entry or use an empty group for narrative-only inventories.

UUIDs are strings up to 512 characters using letters, digits, underscores, dots and hyphens. Both world and Compendium UUIDs are resolved through Foundry's `fromUuid`, once per distinct UUID in a preview. The illustrative UUIDs in the Settlement example intentionally produce missing-reference warnings until replaced with real destination references. A failed lookup identifies the affected path; the original UUID and descriptive content remain. No name matching, document duplication, UUID substitution or document creation occurs. Relative image paths can be shared, but the underlying image files are not bundled or uploaded by JSON export; make those assets available in the receiving installation.

### Compatibility and migrations

Format v1 / schema v1 is the first sector interchange format in this repository. Supported v1 files may omit newer optional fields; the existing model supplies defaults. Existing legacy Faction note/member structures and legacy merchant archives receive explicit additive, idempotent conversions; original fields/archive content remain available. Unsupported future versions and arbitrary unversioned JSON are rejected. There are no historical sector interchange versions to infer from unrelated JSON exports.

`schemaMigrations` in `scripts/portable/serialization.mjs` is a registry keyed by source schema version. A future v1→v2 function returns new sector data; the pipeline advances one version at a time on clones and reports each step. Missing migration paths fail. Current format/schema constants are both 1. Migrations and default IDs are deterministic; their tests also verify the source parsed object is unchanged.

Unknown properties do not populate the active model. Safe unknown JSON is retained in the envelope's `extensions.unknown`, as `{path: ["sector", "unknownField"], value: ...}` records, and warnings identify their original paths. In a stored sector this lives only in the dedicated `portableExtensions` area; later exports restore it to the envelope. Extension data is never merged back into arbitrary properties or executed. Existing unknown envelope metadata is handled the same way. This supports partial compatibility without pretending unknown behavior is implemented.

### Validation and rendering

Limits: 5 MiB JSON, nesting depth 40, 100,000 values, 2,000 elements per modeled collection, and one million characters per narrative string (UUIDs 512). The importer rejects malformed JSON, unsupported versions/types, non-JSON/live objects, dangerous prototype keys anywhere (`__proto__`, `constructor`, `prototype`), bad UUID syntax and unsupported image paths. No imports from arbitrary URLs are provided. The preview escapes all content; existing form fields escape imported markup, and rich Inhabitant previews use the module's safe narrative renderer. Rich-text strings are preserved as content without trusting or executing them.

## Physical Columns and Rows

**Columns** counts squares horizontally; **Rows** counts squares vertically. The old controls exposed the stored letter-axis and number-axis counts directly. If “Lettered columns run” was **Vertically (swap axes)**, the field labeled Columns controlled vertical squares, explaining the apparent reversal. The form now translates physical counts according to that orientation. Saved `grid.columns` still means the number of lettered positions and `grid.rows` the number of numbered positions. No migration, transpose, coordinate change, distance change or underlying grid-math change occurs. Opening/saving an unchanged vertical-orientation configuration retains its stored values exactly. Tests cover 12×8, 5×10 and 20×6 in both orientations.

## Manual Foundry v14 checklist

Automated tests simulate Foundry APIs; these live checks have **not** been performed here.

1. Back up a world using the official MYZ system. Open Sector Manager and check the gear beside New Sector, keyboard/outside/Escape dismissal, window move/resize, and each original settings action.
2. Export a saved populated Settlement; verify the explicit unsaved-edit choices. Select an empty square, cancel new creation, import the file, and compare all seven tabs, links, images, Shop order/Vehicle modes, Project progress and Faction associations.
3. Export/import Normal and Special records, including multiline/rich text, generated metadata, supplies, references and inactive preserved content.
4. Import into an occupied square, cancel, verify no changes, then repeat with explicit replacement. Check stale type-specific fields are absent, unrelated Journal flags/pages/settings are retained and the recovery flag contains the previous content.
5. Try missing Actor/Item/Compendium/Macro references and optional/unknown fields. Check preview paths, preserved descriptions/UUIDs and missing-reference controls.
6. Try malformed/unsupported files, change the Scene or selected square during preview, and verify no destination write. Confirm no Travel Events, wandering movement, table rolls or Macros occur during import.
7. Configure a non-square grid in each letter orientation; check physical Columns/Rows, overlay size, unchanged known coordinates and Party tracking. Reopen the form without editing and verify values are retained.
8. Reopen imported records after switching tabs, Scenes and reloading the world. Verify GM-only access, native drag-and-drop and correct image asset availability.
