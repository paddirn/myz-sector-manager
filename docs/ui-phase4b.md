# Phase 4B: Gear & Artifacts and Events presentation (0.1.52)

## Current implementation and changes

Inspected main `88a9334` (0.1.51), including the Phase 1 EntryCard/EntryHeader, Phase 2 portraits/ScrollKeeper and Phase 3 actions/unsaved guard. Baseline Node result: **507/507 passed**, with no preexisting failures.

| Family | Existing rendering / collection | Previous differences | Shared presentation now |
| --- | --- | --- | --- |
| Normal Gear & Artifacts | `SectorManager.build()`, internal Loot, `loot` | Generic entry body; Quantity used integer step despite decimal storage; Collected/legacy status and consumables; generic Details label | Shared Gear header/fields, Title → Quantity → Type → existing reference; Description / Notes; Normal-only Collected and legacy-status controls |
| Special Gear & Artifacts | `SectorManager.specialEntries()`, `special.gear` | Separate quantity/type/body templates; authored Items; positive whole quantities | Same Gear header/fields, labels, spacing and empty state; no Collected or consumables |
| Special Events | `SectorManager.specialEntries()`, `special.events` | Title, Journal/Page reference and Description | Shared Event Title / Description (five rows), shared card/header and empty state; Journal/Page remains its adapter metadata |
| Settlement Events | `renderSettlement()`, `settlement.events` | Separate Event Title/Description and status/trigger/outcome/related/notes rendering | Same Event Title / Description and card foundation; Status remains its adapter metadata; all other Settlement fields remain after Description |

`scripts/ui/content.mjs` provides `gearFields`, `gearEntry`, `eventFields`, `eventEntry` and the common empty message. Both entry renderers delegate to the existing `entryCard`; they introduce no second card, confirmation, collapse or event-listener system. Configured markup uses the existing field/reference renderers. Helpers do not resolve references, normalize stored collections, generate IDs, register hooks or perform writes.

The Gear adapter in Sector Manager supplies quantity rules, Collected markup, legacy status, warnings and existing references. The Settlement Event adapter supplies Status, Trigger / Conditions, Consequences / Outcomes, Related NPCs or Factions, and GM Notes. The existing `related` text field is retained; this phase does not create separate relationship arrays. Special Events do not gain Settlement fields. Event title fallback uses a client-only card attribute so clearing a title or editing another field keeps the same visible fallback before/after rerender.

## Intentional model differences

- **Normal Loot:** nonnegative quantities, including zero and fractional values. Its input now uses `min="0" step="any"`; the existing `lootQuantity()` semantics are unchanged. Stored decimals are not rounded or truncated. Collected, strike-through/collapse, legacy-status notes, generation, availability indicators and the separate consumables panel remain.
- **Special Gear:** `min="1" step="1"` and the existing `specialQuantity()` normalization. Invalid/non-positive/fractional quantities continue to become 1, rather than being rounded. No Collected control or consumables panel is added. Existing authored names, overrides, Item drops and collection saves remain.
- **Special Events:** authored title/details and Journal/JournalEntryPage reference only in the visible form. Any inactive/unknown saved properties are retained, not converted to Settlement fields.
- **Settlement Events:** status, trigger, outcome, combined related NPC/faction text and GM notes remain in their existing fields and collection. They do not acquire Journal references.
- Effects/Macros, generated History Add Event, Travel Events, Campaign Log, combat logging and other event systems are not routed through the new Event component.

## Types, titles and references

Both Gear forms use `LOOT_TYPES`, `lootTitle()` and the existing select-options helper. `selectOptions()` accepts an optional display-label function; its original two-argument API and option values are unchanged. Known types retain friendly capitalized labels.

Nonempty unknown type strings now survive `normalizeLoot()` (and therefore Special Gear normalization) and remain selected as **Legacy/custom value**. Previously they were changed to Scrap, and Special Gear could lose the original altogether. Known case variants still canonicalize as before; missing/empty types still default to Scrap. Existing `legacyType` metadata is retained. Previously saved Scrap is not automatically replaced by a legacyType value, since that could undo an intentional choice. The portable schemas already allow string types and are unchanged; the authoritative format guide and its tests now describe the preservation behavior.

Reference hydration no longer infers an old/unclassified Gear type merely by rendering a link. Type inference remains on explicit reference edits/drops and generated/drop creation, using the existing revision guard and Item-type inference. As before, choosing a supported type is a manual override; dropping the same reference preserves it, while deliberately assigning a different reference can infer the new Item's type. Custom titles and existing Special `titleOverride` / `referenceTitle` rules remain. Source Item changes do not refresh stored names/descriptions/types on ordinary rendering.

World/Compendium Items, Special Journal/Page references, native click/keyboard opening, clear/drop behavior and missing-reference displays reuse the existing controls and resolver. Rendering does not update source Items, Actors, Scenes or Journals. No new external assets or dependencies.

**Deferred to Phase 4A:** reference-field/resolver consolidation, richer common previews and consistent expected-document-type validation during hydration. Explicit drops validate expected types, while existing stored UUIDs currently resolve through the generic resolver. This task keeps that architecture and legacy references intact; only the Item-inference side effect on ordinary hydration is suppressed. No Phase 4C work is included.

## Saving, identity and compatibility

No persistence service or collection path changes. Manual Gear/Event edits and removals remain draft-only until Save Sector. Normal Collected continues saving the whole Loot collection only; it does not save consumables or unrelated notes. Special blank-area Item drops continue saving the Special Gear collection, including pending edits within that collection, while leaving other draft fields alone. The Phase 3 scope feedback, conflict checks, shared write queue and Save/Discard/Cancel guard are retained.

Add, named Cancel-default Remove, Expand All / Collapse All and keyboard behavior use Phase 3 handlers. Scroll/focus use Phase 2/3 helpers. Shared cards keep the existing stable UI IDs and stored IDs; array order is not changed or inferred from display order. Inactive content still survives sector-type conversion. Schema versions, portability schemas, unknown-field quarantine, Journal flags, GM/player permissions and public macros are unchanged. No data migration.

## Changed files

1. `scripts/ui/content.mjs` — shared presentation-only Gear/Event fields, card adapters and empty states.
2. `scripts/ui/options.mjs` — optional friendly option labels while preserving custom choices.
3. `scripts/loot.mjs` — retain nonempty unknown type strings; all quantity/Collected rules remain.
4. `scripts/sector-manager.mjs` — integrate Normal/Special Gear and Special Events, preserve live title fallbacks, and gate Item inference to explicit assignment.
5. `scripts/settlement-ui.mjs` — Settlement Event adapter retains all specialized fields.
6. `module.json` — prepare 0.1.52 and include the new runtime module.
7. `README.md` — explain behavior and the focused check.
8. `docs/sector-json/SECTOR-JSON-GUIDE.md` — correct unknown-type preservation guidance; no schema change.
9. `docs/ui-phase4b.md` — this audit, architecture, boundaries, deferred finding and manual checklist.
10. `tests/ui-content.test.mjs` — shared fields/quantity/options/escaping/purity tests.
11. `tests/sector-manager.test.mjs` — renderer adapters and deliberate empty-state expectation updates.
12. `tests/sector-types.test.mjs` — requested unknown Special Gear preservation expectation.
13. `tests/sector-json-documentation.test.mjs` — match the documented unknown-type behavior.
14. `tests/portable-sectors.test.mjs` — round trips across all sector types and both content families.
15. `tests/interface-browser.cjs` — reuse the existing manager fixture for focused Phase 4B checks.
16. `tests/ui-phase4b-browser.cjs` — 30-entry real-DOM Gear/Event interactions with simulated Foundry APIs.

## Verification

Executed **515/515 Node tests** and all **eleven browser scripts**: interface, ui-phase4b, ui-phase3, ui-phase2, overlay (real PIXI/WebGL), party-skills, player-shop, campaign-log, travel, document-reference and wandering. The new browser check covers long collections, decimal/whole quantities, custom types, no render-time inference/writes, world/Compendium/missing references, manual titles/types, scope-specific autosaves, consumables, save/scroll/bulk controls, guarded drafts, named cancelled/confirmed removal, stable record deletion, Add/reopen and zero Campaign/source-document writes.

Commands:

```sh
node --check scripts/sector-manager.mjs
node --test tests/*.test.mjs
node tests/ui-phase4b-browser.cjs
node tests/interface-browser.cjs
# Existing ui-phase2, ui-phase3, overlay, party-skills, player-shop,
# campaign-log, travel, document-reference and wandering browser scripts.
node scripts/prepare-release.mjs v0.1.52
unzip -t dist/myz-sector-manager-v0.1.52.zip
```

Also passed: actionlint, both JSON Schemas/examples, the ZIP-root manifest, and byte-for-byte presence of all declared runtime modules. Browser tests simulate Foundry APIs; no live Foundry v14 world is available. No tag or release is created by this implementation task.

### Manual verification in a backup Foundry v14 world

1. Open long Normal Loot and Special Gear lists. Check field alignment at narrow widths, references, native tooltips, quantity zero/decimals versus positive whole Special quantities, unknown types, and custom title/type persistence after save/reopen.
2. Test world/Compendium Item links and drops, missing references, manual overrides and an Item renamed/edited in another sheet. Opening/rerendering must not update stored Item-derived fields or source documents.
3. With other notes dirty, toggle Normal Collected or drop a Special Item. Confirm only the existing collection scope saves; consumables and unrelated fields retain their original behavior. Try Save/Discard/Cancel and a save conflict/failure.
4. In long Special and Settlement Event lists, edit every specialized field and references where present. Save/reopen, cancel and confirm named deletion, add an Event and verify stable identities and retained order.
5. Exercise individual/bulk collapse, keyboard focus, sidebar/main scroll and add/remove/save at mid-list. Convert sector types and round-trip older JSON with custom types/unknown fields. Confirm no Travel/Campaign/Effect execution or player-permission changes.
