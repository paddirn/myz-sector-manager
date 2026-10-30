# UI standardization: Phases 0 and 1 (0.1.49)

Baseline: main commit `c6588b8` (0.1.48), unchanged from the UI audit. The existing
475 Node tests passed before source changes. Two focused compatibility tests were
added first; the selected Phase 0 suite then passed all 129 tests before refactoring.
No preexisting failures were found in these checks.

## Shared presentation

`scripts/ui/entry.mjs` supplies:

- `entryCard(options)`: outer markup, existing UI identity, body/ARIA relationship,
  collapsed styling, and optional specialized data attributes.
- `entryHeader(options)`: title, right arrow, consistent Remove position and optional
  header/summary slots. The editable Faction-name variant keeps its existing left
  arrow and separate input.
- `updateEntryCollapse(card, collapsed, options)`: in-place body visibility, arrow,
  `aria-expanded`, and focus restoration. It does not capture, save or rerender.
- `bindEntryCollapse(root, toggle)` / `unbindEntryCollapse(root)`: one replaceable
  delegated listener. Native buttons provide Enter/Space activation. Inputs,
  selects, links, editable content and other action buttons do not toggle cards.

Normal cards, Special cards, Settlement ordinary/Project cards, Faction outer cards
and Special Images now reuse this layer. Existing body fields and styles remain.
The host's `entryState`, `setCollapsed`, `setImageCollapsed` and `collapseAll` still
own policy and per-sector state. UI-generated `sm-entry-*` IDs remain separate
from persisted content IDs. Sorted cards keep existing ID-aware capture/removal.
The Shop remains a table with its own selection, grouping and controls.

Slots accept markup produced by module renderers, never raw user data. Titles,
summary text and attributes are escaped by the helper; body/slot producers retain
the existing field escaping and narrative sanitization responsibilities.

## Behavior intentionally retained

- Normal/Special/Settlement initial expansion policies remain different.
- Images retain independent preview and metadata state, including bulk behavior.
- Factions retain editable names, nested Members, Actor galleries and associations.
- Projects retain grouping, Work Points, readiness, two-column collapsed layout,
  source-document display and non-removable linked Ark assignments.
- Sorting remains presentation-only; stored collection order is unchanged.
- Manual edits and existing-card reference attachment remain draft-only.
- Blank-area Actor drops still save their existing Inhabitant collection.
- Special Item/image drops and Shop drops keep their existing collection saves.
- Normal Loot Collected still saves the Loot collection and collapses the card.
- Normal/Special removal remains immediate in the draft; Settlement confirmation
  remains. No new deletion or unsaved-close confirmation policy was introduced.
- Explicit linked Ark Project status changes retain their immediate native write;
  rendering does not write Actor/Item documents.
- Journal-backed Normal encounters, portrait paths, UUIDs, snapshot markers,
  legacy fields, unknown data and hidden inactive collections remain supported.

## Type-aware indicators

`sectorIndicators` uses the existing `inhabitantCollection` mapping:
Normal → `encounters`; Special → `special.inhabitants`; Settlement →
`settlement.inhabitants`. Hidden collections do not contribute to visible counts.

Normal loot availability retains existing Collected/quantity/Consumable rules.
Special's gear icon instead means **Gear & Artifacts Present**, based only on a
nonempty visible `special.gear` collection. It has no Collected rule; legacy
collection metadata is neither interpreted nor changed. Settlement keeps its
existing hidden loot indicator. Root Normal phenomena do not appear as Special or
Settlement phenomena. Icon assets, colors and rendering mechanisms are unchanged.
Sector conversion/rerender and overlay refresh obtain current type-aware values.

## Unknown dropdown values

`scripts/ui/options.mjs` provides `selectOptions(value, choices)`. A nonempty saved
value outside the supplied choices is escaped, included as the selected option,
and labeled **(Legacy/custom value)**. Known choices render normally. Existing
empty/default behavior is retained. An unrelated Save preserves the selected
custom value; choosing a supported replacement is an explicit edit.

The generic Sector Manager select field, Settlement choices and Project Status
use the same option builder. This does not broaden schema enums or change domain
normalization: for example, unsupported Normal encounter status/type values still
use existing canonical values with retained `legacyStatus`/`legacyType` metadata.
Existing Rot custom-value handling, faction missing-association choices, and Shop
specialized dropdowns remain unchanged. Both published JSON schemas are unchanged.

## Phase 2 extension points

`entryHeader` / `entryCard` accept **headerContent** before the title. Special's
existing avatar markup uses this slot unchanged. Phase 2 can insert a shared
avatar there for other collections without rewriting card bodies or collapse.
**summary** accepts escaped contextual text. **titleControl** supports a trusted
editable-title variant. None of these resolve Actors or choose portrait sources.
No Actor-first fallback, new portrait editor, Actor refresh hook, snapshot refresh,
or unified document-reference system has been implemented in this phase.

## Live Foundry v14 verification in a backup world

Automated Node and Chromium fixtures are not a licensed Foundry server. Check:

1. Open existing Normal, Special and Settlement records. Check unchanged initial
   expansion and body fields. Use header clicks, Enter/Space, Expand/Collapse All,
   and rerenders. Unsaved text must survive; focus returns from a hidden body to
   its toggle. Click header inputs/links/action buttons without collapsing.
2. Rename alphabetically sorted Inhabitants and edit/remove another row across all
   three types. Correct content IDs, UUIDs, portraits and notes must remain paired.
3. Check Faction editable names/Members and Project status groups separately from
   their cards. Linked Ark removal remains unavailable; Work Points/status/native
   Ark writes must behave exactly as before. Check source documents remain unchanged
   merely by rendering. Keep a backup before native status-change testing.
4. Toggle Special Image previews and Edit image details independently, then use
   bulk controls. Test Journal image-page drops, save/reopen and missing references.
   Check Shop tables, ordering and sticky controls remain unchanged.
5. Load a custom exploration status, Effect category/status, Settlement type or
   disposition. Check Legacy/custom labeling, an unrelated Save/reopen, then an
   explicit supported replacement. Check legacy Normal encounter metadata and JSON
   round trips remain intact.
6. Convert Normal ↔ Special while retaining distinct hidden/visible inhabitants and
   gear. Check current counts and map tooltips; Special gear shows presence even if
   old collected metadata exists. No hidden collection is deleted or counted.
7. Verify ordinary versus blank-drop save boundaries, existing removal confirmations,
   manual descriptions, duplicate Actor selection, player restrictions, narrow
   layouts, and no duplicate toggle/native-link actions after repeated rerenders.
