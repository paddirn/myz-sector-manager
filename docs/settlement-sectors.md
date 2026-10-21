# Settlement sectors

Settlements are a third sector type for inhabited communities, trading posts and Arks. Normal sectors retain exploration and random generation; Special sectors retain their story/location editor. Settlements use the same GM-only Sector Manager window and controls, with seven tabs dedicated to community records. Existing sectors are never converted automatically.

## Create and save

1. In Zone Settings, choose the Zone Scene and configure its custom sector grid.
2. Click an empty grid square, or **+ New Sector** and enter its coordinates. Select **Settlement**.
3. Enter a Settlement Name, then **Save Sector**. The name is required on save; all other descriptive fields are optional.
4. Open it through the sidebar or grid overlay. Save edits with **Save Sector**. Switching sectors or closing a dirty Settlement asks before discarding changes. Changing tabs keeps draft edits. Entry removal and type conversion require confirmation.

The same resizable window, scrolling content area, expandable cards, document links and FilePicker used for Special sectors are reused. Descriptions use the existing multiline editors. Imported Actor Info snapshots preserve supported HTML formatting and show a sanitized preview below the editable Description. Project content remains editable in its native Item sheet.

**Change Sector Type** first asks you to choose Normal, Special or Settlement, then confirms. Hidden type-specific content is retained when converting back. Conversion is saved only with Save Sector. Existing common metadata stays intact; Settlement fields remain separate from Normal and Special content.

## Seven tabs

- **Overview:** Name, community type, disposition, freeform population, leadership and custom terrain; description, optional illustration and private notes. An optional compact section holds history, current situation, defenses, shortages and economy. Images support a path or Foundry FilePicker; clear the path to remove an illustration. An optional Ark Actor reference opens the existing dashboard/sheet.
- **Projects:** Add an assignment, then drop an official MYZ Ark Project Item on its reference, or drop the Item onto the tab's blank area. Both world Items and Compendium Items work. Other Item types are rejected. Cards display the source name, image, description, development/other requirements, skills, work points, bonuses and special rules; **Open Project Item Sheet** opens the system's sheet. Track Planned, In Progress, Completed or Abandoned status, progress, notes and completion date/session independently for this Settlement. Missing source documents show a warning; assignments and progress remain. Removing an assignment never deletes the Item.
- **Inhabitants:** Descriptive NPCs with custom occupation, disposition, portrait, optional Actor reference, private notes and a stable-ID faction association. Drop a world or Compendium Actor on the blank tab area to create and save a snapshot of its name, portrait and Info narrative. Duplicate Actor UUIDs select the existing entry. The same Actor can appear independently in other sectors. Linking an Actor into a pre-existing entry fills blank Description/portrait/name fields and preserves custom content; nothing resynchronizes edited descriptions automatically. No Actor is created automatically. If a faction is deleted, the inhabitant remains and shows the missing association until you select a replacement or None.
- **Factions:** Groups with independent dispositions, descriptions, leaders, goals, influence, allies, rivals, tensions and notes. A friendly Settlement may contain a hostile faction. Leaders/allies/rivals are descriptive text; this does not create world documents.
- **Events:** Persistent, GM-authored narrative developments with status, conditions, outcomes, related people/groups and notes. These entries never execute automatically and are separate from random Travel Events.
- **Threads:** Open-ended storylines with status, people, factions, clues, developments, outcomes and private notes. No scheduling or quest automation.
- **Shop:** One categorized inventory of existing Item references. Add custom groups, rename/reorder them, expand/collapse them, or delete a confirmed empty group. Every group has exactly **Item | Cost | Requirement | Weight | Comment**. The Item cell contains only its native document link; group-level controls select, move, reorder, remove or replace a reference outside the table. Gear and Artifact Items can be dropped from Items or Compendiums into a group table. General-area drops use the selected/default group (General Gear when needed); Items are never classified into groups automatically. A repeated UUID in its own group selects its existing row; a drop into another group moves that row. Use **Refresh Items** to reread current source values. Missing/unsupported references stay visible and can be selected for replacement or removal. No Item is created, transferred, purchased or deleted.

Shop drops and blank-area Actor drops save only their own collection, including edits in that collection; unrelated draft fields still use **Save Sector**. Save a new sector once before dropping. Other group/list edits use Save Sector. Saves reject conflicting changes to the same saved collection and retain the draft for review.

Authored collections support Add, edit, removal and expansion/collapse; Settlement removals are confirmed. Shop deletion is limited to empty groups and reference removal never deletes source Items. Project order follows addition order, matching existing collections; Shop groups/entries have explicit up/down controls. No document picker is added: native directory/Compendium drag-and-drop and existing live links are used.

## Zone behavior

Settlements have a double turquoise map border and a “Settlement” name label, using the calibrated Zone grid. **Module Settings → Settlement map highlight color** accepts a six-digit hex color (`#47aeb3` by default). Invalid colors safely use the default. The existing Normal/Special styles, tactical grid, map images and pointer navigation remain unchanged. The optional Settlement illustration can appear in the same small overlay image region used for Special sectors.

Party entry into a Settlement does not roll random Travel encounters or weather changes and does not execute hidden Normal sector-entry Macros. Global weather is retained. The existing wandering check still runs when appropriate; NPC destination selection uses the same **Allow Entry into Special / Settlement Sectors** option for both authored types. Cardinal movement, Party eligibility, duplicate protection and active-GM authority remain in place. No Last Known Position functionality is restored.

## Storage and Ark compatibility

The authoritative data remains in GM-only Journal flags `flags.myz-sector-manager.sector`, under the existing version-1 sector record. New Settlements add `sectorType: "settlement"`, the configured Zone `sceneId`, and a `settlement` object with its own `version: 1`. Scene association keeps identical Settlement coordinates on different configured Zone Scenes independent. Select the appropriate Zone Scene to show its Settlements; legacy Normal/Special scope is unchanged. A conversion back to Normal/Special follows that type's existing scope.

Common name, coordinates and terrain stay at sector level. Settlement content has `type`, `disposition`, `population`, `leadership`, `description`, `image`, `notes`, `history`, `situation`, `defenses`, `resources`, `economy`, `arkUuid`, and structured `projects`, `inhabitants`, `factions`, `events`, `threads` arrays. The active single Shop is `shop: {version: 1, groups: [{id, name, entries: [{id, uuid}]}]}`. The old `shops` array is retained only as a recovery archive. All repeated records have persisted stable `id` values; faction relationships use those IDs. Unknown properties and inactive data are retained. Unsupported Settlement schema versions and malformed arrays fail clearly without writing.

Shop entries contain UUID references and stable IDs, without copies of source names/cost/requirement/weight/comment. Only UUIDs and identifying Project metadata (`referenceName`, `referencePack`, `referenceType`) accompany portable content. No Foundry Document instances or Item system data are serialized. Source definitions are read live; assignment progress is local. The model is prepared for a later versioned JSON format; import/export is not implemented here.

An Ark-type Settlement describes its location and community. The official MYZ Ark dashboard remains responsible for statistics and mechanical progression. Project assignments do not change `completed`, work points, Development Levels or any other source Item/Actor fields, and there is no automatic synchronization.

### Verified system source

Project mapping was checked against the official `mutant-year-zero` system v14.0.4, source commit `ade55c93a4c6c29828dee790aaeed4fbd81803b9`:

- [MYZProjectDataModel](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/module/data-model.js): Item type `project`; fields `description`, `DEV_Requirement`, `other_requirements`, `skills`, `work_points`, `DEV_Bonus`, `special`, `comment`, `food`, `culture`, `technology`, `warfare`.
- [Native project template](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/templates/item/partials/project.hbs).

## Testing in a backup Foundry v14 world

Automated tests model native APIs and browser interactions; they are not licensed Foundry runtime testing. Before release, verify:

1. Create two Settlements, save every tab, close/reopen, change Scenes and reload the world. Check private Journal ownership and that players cannot use the editor or see overlay secrets.
2. Drop actual world/Compendium project Items, an incompatible Item, Actor references and an image using native FilePicker. Open their native sheets. Remove or make a source unavailable and confirm warnings preserve saved data. Check independent progress when two Settlements share a Project.
3. Test all list controls and categorized Shop inventory with long text; delete a referenced faction and test cancelled removals/unsaved-close prompts. Confirm original Items are unchanged.
4. Convert between all three types and back, saving and reloading. Verify older Normal/Special records, loot and unknown flags remain intact.
5. Check Settlement overlay color, image placement, zoom/pan, labels and clicks on your calibrated map. Switch the configured Zone Scene and verify same-coordinate Settlements remain separate.
6. Move a designated Party token into a Settlement. Confirm no random Travel/weather/Normal Macro checks, no duplicate movement events and unchanged global weather. Test wandering with the shared destination option both off and on; confirm hidden NPC visibility remains unchanged.

## Shop migration and recovery (0.1.32)

Opening a v0.1.31 Settlement builds a draft single Shop. Each old merchant inventory becomes a group named after that merchant; source Item UUIDs are retained, with one active entry per UUID across the Settlement. Entries with no Item reference and duplicate occurrences remain in the complete original `settlement.shops` archive, including merchant descriptions, manual prices, quantities, notes and unknown metadata. They are never silently discarded or converted into invented Items. Unsupported legacy Item types retain their UUID and display a warning.

Migration persists only when you save the sector or drop a Shop Item. It is versioned and idempotent; an existing `shop` object is authoritative, even if its groups are empty, so removed rows do not reappear. **Previous Shop data retained for recovery → Download Previous Shop Data** exports the archived JSON. Keep this backup before editing older data. You can consult it to reconnect old unlinked entries to real Items; it is a recovery record, not an automatic import feature. No world-wide migration or source-document changes run on startup.

## Verified Shop and Actor source fields

Checked against official MYZ **v14.0.4** at source commit `ade55c93a4c6c29828dee790aaeed4fbd81803b9` (not a live installed Foundry world):

| Shop column | Gear (`Item.type = gear`) | Artifact (`Item.type = artifact`) |
|---|---|---|
| Item | Document name and UUID | Document name and UUID |
| Cost | `system.cost` | `system.cost` |
| Requirement | `system.requirement` | `system.dev_requirement` |
| Weight | `system.weight` | `system.weight` |
| Comment | `system.comment` | `system.comment` |

Absent fields stay blank. Requirement text truncates visually with the full value in its tooltip. Cost/weight/comments are read without conversion or invented currency/weight rules. Comment is a native StringField: text and line breaks display safely, without executing HTML. Only the verified Gear and Artifact types are accepted; weapons, armor, Projects and other separate Item types are rejected with an explanation.

Sources: [Item schema/mixins](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/module/data-model.js), [physical header](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/templates/item/partials/header-physical.hbs), [Gear](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/templates/item/partials/gear.hbs), [Artifact development fields](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/templates/item/partials/dev-levels.hbs).

Actor imports are shared by **Normal Inhabitants** (internal tab `Encounters`, storage `encounters`), **Special Inhabitants** (`special.inhabitants`) and **Settlement Inhabitants** (`settlement.inhabitants`). The official [character Info template](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/templates/actor/tabs/character-info.hbs) for mutant/animal/human/robot uses `system.party[].value`/`isBuddy`, `system.hate`, `system.protect`, `system.dream`, `system.myHome`, `system.description` and `system.notes`. These narrative sections are combined with headings. The [NPC/generic Info template](https://github.com/superseva/mutant-year-zero/blob/ade55c93a4c6c29828dee790aaeed4fbd81803b9/templates/actor/tabs/info.hbs) uses `system.description` only. Attributes, combat statistics, equipment, mechanical special features and other tabs are not copied. Empty Info produces an empty Description.

Snapshot fields are the existing `title`, `details`, `uuid`, plus `portrait`, `detailsFormat: "html"` and `actorImport: {version: 1, uuid}`. Source HTML is restricted to supported formatting tags, passed through native Foundry TextEditor enrichment with rolls/embeds/document expansion disabled, then sanitized again. There are no source event handlers, scripts, images or unsafe links in the description preview. Existing manually authored text is not automatically imported or reinterpreted. The import marker prevents a later rerender or relink from repopulating a deliberately cleared snapshot.

Additional backup-world checks: test actual Gear/Artifact schema values, native Compendium drag payloads, missing-reference replacement, migration backup download, all three Actor drop surfaces, character versus NPC Info, safe rich formatting, edited snapshots after source changes, and native Item/Actor links. Automated mocks/browser tests do not establish live Foundry compatibility.
