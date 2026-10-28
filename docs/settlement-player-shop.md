# Linked Arks and standalone Player Shops (0.1.37)

## GM setup

1. Open a Settlement in Sector Manager. On Overview, find **Linked Ark Sheet**. Drop an official MYZ Ark Actor or paste its Actor UUID. Character Actors are rejected. Save Sector.
2. The linked information is read-only. **Open Ark Sheet** opens the original sheet for editing. Actor changes and changes to its embedded Items refresh this view. Missing/inaccessible links produce a warning and retain the UUID. While linked, Population is read-only and displays the Ark's `system.population`; unlinked stored Population is retained and returns when the link is cleared. Missing/inaccessible Arks show Unavailable, never a fabricated zero. Leadership and other authored fields remain separate.
3. On **Shop**, expand **Player Shop and Resource Trading (GM configuration)**. Enable Player Shop access and Save Sector. This explicitly publishes the Shop's Item names, descriptions (excluding secret blocks), displayed statistics/comments, prices, group names and exchange rates to **all players** who have its macro/identifier. Nothing else from the sector is published. Only enable this for information intended for players.
4. Optionally enable resource trade requests. Enter positive **relative resource values**, including decimals such as `0.5`, `0.25`, `1.5` or `2.75`, for Bullets, Clean Grub, Clean Water and Booze (Dose), then Save Sector. Trading defaults to disabled. Default values are 1:1:1:1, configurable house settings, **not official MYZ exchange rates**.
5. Click **Copy Macro** beside the macro shown in that Settlement's Shop configuration. A confirmation appears; if clipboard access fails, the displayed text is selected for manual copying. Create a Script Macro, grant players permission to run it, and share it. Players do **not** need access to the GM sector Journal or source Items.

An active GM must be connected. The standalone window exposes only that Settlement's Shop; it never opens the Sector Manager or grants Journal permissions. A missing/unpublished/non-Settlement reference gives a clear error.

## Example macro

Use the **actual** JournalEntry UUID copied from the Settlement's configuration (not an Actor UUID, coordinate, title, or the example placeholder):

```js
await game.myzSectorManager.openPlayerShop("JournalEntry.YOUR_SETTLEMENT_JOURNAL_ID");
```

`openPlayerShop(journalUuid)` is the public API. It returns the standalone ApplicationV2 instance after opening, or rejects with an error and displays a notification. Journal identifiers survive renaming and coordinate changes. Deleting/recreating or importing as a new Journal creates a different identifier; update its macro. Replacing content in an existing Journal retains its identifier. No API lists or returns arbitrary private sector records for players.

## Purchase requests

Select an eligible **Party Roster** character and click **Buy** beside an Item to request exactly one unit. The existing module calls its Player Roster configuration **Party Roster**; configure it through Module Settings → Party Roster. Compact rows preserve group/Item order and show name, price and Buy. The authoritative GM rechecks current roster membership, official character type, ownership, availability and selected Item. Chat uses exactly this visible format, with two paragraphs:

```
Scout wants to buy something from the shop:

Hiking Boots (cost 1-2)
```

Character/Item names and price strings are resolved fresh and safely escaped. Range punctuation is retained. No quantities, totals, player/Settlement metadata or technical identifiers are added to this player request message. Requests never transfer Items, spend resources, or change stock; existing GM Buy behavior is unchanged.

The existing Shop stores **Item references, not stock quantities**. Each Buy requests one unit rather than inventing stock or changing inventory quantities. The GM fulfills a purchase manually.

Only **roster-assigned**, owned world character Actors of the official MYZ types `mutant`, `animal`, `human`, or `robot`, with valid resource fields, are eligible. The assigned character is preferred, with a selector for additional eligible Actors. Other players' Actors and Ark/NPC/vehicle Actors are excluded. Roster membership and ownership are checked again on the GM side for both purchases and trades. An owned Actor outside the roster is excluded. Multiple eligible roster characters remain selectable; an empty eligible roster disables both operations with a clear message. Roster `enabled`/Stalker eligibility flags control automatic Find the Path checks, not Shop membership.

## Decimal values and whole-number trade requests (0.1.40)

Resource Trading appears above the Gear and Services introduction/inventory. A portrait dropdown includes only eligible, owned Party Roster characters, with arrow/Home/End/type-ahead navigation, Enter/Space selection, Escape/outside dismissal and portrait fallback. The window title is `<Settlement Name> - Gear and Services`.

Values are **relative values**, not output amounts. Giving Q units of A requests:

```
floor(Q × V[A] / V[B]) units of B
```

The direction is unchanged from older settings. Examples: Bullets=1, Water=0.5 yields **1 Bullet for 2 Water**, or **2 Water for 1 Bullet** in reverse. Bullets=1, Grub=0.25 yields **1 Bullet for 4 Grub**. This is not an instruction to invert a separately configured directional exchange table; this module has only relative values.

GM-authored rates are stored as exact canonical decimal **strings**; existing numeric rates remain accepted. Rates must be greater than zero and at most 1,000,000, with at most 18 fractional digits. JSON authors should use strings for long decimals to avoid JSON number parsing rounding. Integer/rational BigInt arithmetic performs multiplication/division and rounding; for example 0.3/0.1 yields exactly 3. All twelve directed pairs among the four resources use the same rule. Existing three-resource values remain unchanged; missing Booze receives a relative value of 1.

Give quantities remain whole numbers from 1 through 1,000,000. The minimum Give is `ceil(V[B]/V[A])`, at least 1, to ensure a positive whole Receive amount. The form shows this minimum and a reduced whole-number ratio; changing the pair or fresh rates raises an insufficient quantity to the minimum. The minus control stops at that minimum. Manually typed invalid/fractional quantities still disable the request. Larger quantities receive the exact floor of the ratio; unsafe integer output or a minimum beyond the quantity limit is refused.

**Trades now post requests only.** Confirmation and chat describe the character, Settlement, offered amount and requested amount. The active GM validates current settings/rates, roster membership, ownership, whole quantity and available offered resources. It does **not** deduct/add resources, update stock, transfer Items, or write Actor flags. The GM resolves the request manually. Existing resource balances are displayed read-only; Booze reads `system.resources.booze.value`.

The Shop polls its existing GM-filtered API every ten seconds while open, preserving selections/quantities; Refresh Shop fetches immediately. Pending requests suspend polls. Purchase rows reuse the GM Shop's exact per-group informational column definitions, with a Buy button for quantity 1 and horizontal scrolling rather than omitted columns. No GM management controls are published. The supplied three-paragraph introduction appears verbatim between Trading and inventory.

## Verified MYZ data model

Verified against official `superseva/mutant-year-zero` **14.0.4**, commit `ade55c93a4c6c29828dee790aaeed4fbd81803b9`, `module/data-model.js`, `module/actor/sheets/ark-sheet.mjs`, and Ark templates:

| Display | Official source |
| --- | --- |
| Ark Population | `system.population` (string) |
| Ark Coordinates | `system.coordinates` (string) |
| Ark Water Source | `system.water_source` (string) |
| Ark development levels | `system.dev_levels.{food,culture,technology,warfare}.value` (current integer only; no max/suffix) |
| Ark Projects | Embedded Actor Items with `type === "project"`; completed state `system.completed` |
| Ark Artifacts | Embedded Actor Items with `type === "artifact"` |
| Ark Bosses | `system.bosses.boss1` through `boss6`, each `name`, `type`, `description` |
| Ark Info | `system.description` (HTML, displayed as plain text) |
| Character Bullets | `system.resources.bullets.value` (non-negative number, decimals allowed) |
| Character Clean Grub | `system.resources.grub.value` (non-negative number, decimals allowed) |
| Character Booze (Dose) | `system.resources.booze.value` (non-negative number, decimals allowed) |
| Character Clean Water | `system.resources.water.value` (non-negative number, decimals allowed) |

MYZ derives development **values** from completed Projects and Artifacts; this module reads those prepared values rather than recomputing them. Ark Projects/Artifacts are named embedded Items, not guessed `system.projects` or `system.artifacts` arrays. Rich Info is flattened to readable text; open the native Ark sheet for its original formatting. Nothing is written to the Ark or MYZ system source. All resource fields are read-only to Shop requests; this version performs no Actor resource updates.

## Persistence and portable JSON

Sector/schema version remains 1 with additive, backward-compatible fields:

| Sector path | Type / default | Behavior |
| --- | --- | --- |
| `settlement.arkUuid` | UUID string, `""` | Existing field; now drives the live read-only Ark panel. Missing references retained. |
| `settlement.shop.playerAccess` | boolean, `false` | GM opt-in to publish the Shop to players. |
| `settlement.shop.trading.enabled` | boolean, `false` | Enables chat-only resource trade requests. |
| `settlement.shop.trading.values.bullets` | positive number/canonical decimal string ≤1,000,000 (≤18 fractional digits), default 1 | Relative Bullet value. |
| `settlement.shop.trading.values.cleanGrub` | positive number/canonical decimal string ≤1,000,000 (≤18 fractional digits), default 1 | Relative clean Grub value. |
| `settlement.shop.trading.values.booze` | positive number/canonical decimal string ≤1,000,000 (≤18 fractional digits), default 1 | Relative Booze (Dose) value; added when missing. |
| `settlement.shop.trading.values.cleanWater` | positive number/canonical decimal string ≤1,000,000 (≤18 fractional digits), default 1 | Relative clean Water value. |

These fields are declared in `scripts/portable/schema.mjs` and the published `docs/sector-portable.schema.json`, survive export/import, and are normalized without discarding existing groups, references, old merchant archives, or unknown retained fields. Old sectors remain unpublished with trading disabled. Exporting/importing an enabled Shop preserves the enabled state: review it before sharing the new Journal's macro.

User request/response flags are runtime bookkeeping, outside portable sector content. Old Actor transaction receipts remain untouched and are no longer read or written. The Ark UUID is a reference, not a copied Actor or a promise that another world has that Actor.

## Authority, retries and practical limits

Requests use the requesting player's **User document flags**, whose update permissions Foundry enforces, rather than trusting a user ID in an unauthenticated module socket packet. The elected active GM serializes all Shop operations, rereads live documents, and publishes only an allowlisted Shop response. Manipulating a player's local UI/response cannot change the authoritative price or resource fields. The GM service has no operation to edit sector records, expose other tabs, change stock, create Items, or update arbitrary Actor fields.

The UI blocks double-clicks while a request is pending. The active GM serializes chat requests and caches request IDs in memory to suppress duplicate submissions in the current service session. Requests are not replayed automatically after reload/GM handover. There is no resource transaction, receipt write or claim of database atomicity.

A chat failure reports that posting could not be confirmed and explicitly says resources were unchanged. Check chat before retrying after a timeout or ambiguous posting failure, to avoid duplicate requests. The player character and Settlement stock always remain unchanged by Shop requests.

## Tracking and overlay display

One selected-sector coordinate button spans the Ark and Party distance rows (and additional expedition rows), retaining the existing distance calculations and navigation. Labels wrap at narrow widths.

Overlay labels previously used PIXI's default text texture resolution (the browser DPR in PIXI 7.4.3), which stays fixed as stage zoom changes. Zoom can enlarge that texture, while small/fractional font sizes and fractional display scaling can soften its sampling. Overlay text now uses a renderer/DPR/zoom-aware resolution, with a minimum 2× texture sampling, rounded up in half steps and capped at 4, with regeneration only when the resolution bucket or existing drawing signature changes. This is local to the overlay; it does not change Foundry renderer settings, CSS transforms, coordinates, hit testing, grid lines or global texture defaults. Higher zoom beyond the cap can still soften text; the cap bounds texture memory.

## Manual Foundry v14 checks before release

Automated tests simulate Foundry APIs; Chromium/PIXI checks do not load licensed Foundry.

1. In a backup world with official MYZ v14, link/drop/paste an Ark; verify all listed fields, native sheet opening, live Actor and embedded Item edits, wrong Actor rejection, missing Actor warnings, and Save/reload.
2. As GM, publish one Shop and leave a second unpublished. As a separate player account with **no sector Journal permission**, run the shared macro. Confirm only the designated Shop appears; unpublished/missing/Normal/Special identifiers fail. Check world and Compendium Item names/prices, unavailable rows, Copy Macro success/failure, and that secrets/private tabs remain absent.
3. Test assigned/multiple owned characters and another player's Actor; confirm only authorized characters work. Verify each Buy submits exactly one Item at quantity 1; test fixed/range prices, public chat, and unchanged resources/Items/stock.
4. Enable trading; test all six directions, integer rounding, fractional existing balances, zero/negative/fractional inputs, insufficient supplies and confirmation cancellation. Confirm the character sheet and Actor flags are unchanged after requests and reload.
5. With two players, submit simultaneous trades against the same authorized character and against different characters. Change balances/rates/disable access while confirmation is open. Confirm stale-rate requests fail, duplicate clicks post once, and unauthorized requests are rejected.
6. Disconnect/reconnect player/GM during a request; inspect chat before retrying. Verify no Actor update is attempted, even if Actor updates would fail; chat failures must not change resources. Check that an active GM is required and a secondary GM does not also process requests.
7. Import/export an older and a fully configured Settlement; verify Ark UUID, access/rates, notes, groups and inactive data survive. Test all existing GM Shop editing/Buy controls.
8. Check the shared distance button at narrow/wide sizes, live Party moves and selected-sector navigation. Check overlay text/alignment at 50%, 100%, 150%, 200% canvas zoom and 1×/1.5×/2× display scaling, including pan/hover/click/right-click/token movement. Inspect performance on a dense map.

## Ark coordinates and Projects (0.1.39)

The linked Ark's `system.coordinates` appears read-only in Overview and refreshes with Ark edits. There is exactly one visible **Coordinates** field: linked Arks show their live coordinate read-only; unlinked sectors retain the normal editable coordinate. The saved Zone placement code is retained independently, not silently replaced by the displayed Ark coordinate. To edit placement explicitly using the normal coordinate field, clear the link first. The UI parses the Ark coordinate using the existing Zone coordinate parser and checks the current grid, Scene scope and occupying records. Invalid, unavailable, out-of-grid, foreign-Scene, occupied or ambiguous targets produce non-blocking warnings. Matching placements are reported; a valid empty target prompts manual placement.

**Architectural limit:** this release uses the requested read-only fallback. It does not automatically assign, unassign, relocate or replace a sector. Existing Journal/Scene placement has no cross-Journal atomic occupancy transaction, so an automatic move could race another GM's placement. Ark links never change existing placement or move a record to another Scene. Use explicit GM placement controls when appropriate; inspect any occupancy warning first.

Opening/rendering a linked Settlement synchronizes embedded Ark `project` Items into its Projects **draft**, using stable source UUIDs. These are marked **Ark-linked Project — read-only**, have no editable fields or Delete action, and provide **Open Ark Project** where the source is available. Manual Project records stay separate, editable and unchanged. Names, source descriptions, completed/not-completed state, exact `work_points` text and source comments map to existing title/details/status/progress/notes fields. Work-point text is shown as **Work points (source)**, not an invented numerical progress estimate; no start date or completion date is guessed. Full supported Item information still resolves from the source.

Updated sources refresh existing entries rather than appending duplicates. Source deletion, inaccessible/unlinked Arks, and link changes retain the last snapshot with a missing-source marker; manual records are not deleted. Relinking the same available source clears the marker. Synchronization never writes to the source Actor or Item. It only changes the current draft when content differs: **Save Sector** persists snapshots through the normal Journal save. Ark update hooks/repeated loads perform no automatic Journal writes.

Portable v1 Project entries now accept `arkSource: {version: 1, arkUuid, projectUuid, missing}`. All four metadata properties are required when `arkSource` is present; both UUIDs must be nonempty real source identifiers. Ordinary manual Projects omit it. Source metadata, stable entry IDs and missing snapshots survive import/export; they do not create Actors or Items in another world. Both published JSON Schemas and the authoritative field guide declare this optional metadata. Avoid authoring it from sourcebook prose.

Before release in a backup Foundry v14 world, verify roster filtering with multiple players/owned characters and roster removal during confirmation; concise price-range chat; centered controls; live current-only development levels; linked/read-only versus unlinked/editable population; missing Ark warnings; coordinate diagnostics with valid/occupied/ambiguous/invalid/out-of-grid/other-Scene targets and unchanged saved placement; Project source opening, edits, deletion/recovery, repeated loading, manual entries, Save/reload, and portable metadata round trips. No live Foundry instance was available for automated testing.

## Projects display (0.1.40)

Projects use two columns (one at narrow widths). Status **Not completed** sorts first, preserving its stored relative order, with a subtle theme-compatible highlight. **Completed** sorts last alphabetically by the displayed title, without the highlight. Other pre-existing statuses retain an alphabetical middle group. This applies equally to Ark-linked and manual entries; the manual status chooser includes Not completed. Sorting moves existing DOM cards only, preserving source paths, controls, progress, links and stored/source array order.

Manual checks: open the player macro with multiple roster characters and exercise keyboard/avatar fallback behavior; compare all five group column sets against the GM Shop; confirm the exact introduction and dynamic title; configure 0.5/0.25/1.5/2.75 values, test both conversion directions and Booze pairs, minimum/stepper behavior, positive integer output and unchanged Actor resources/flags; inspect proposed-trade chat; export/import old three-value and new decimal settings; verify Project grouping/highlights/two-column layout without saved-order changes; check one visible synchronized Coordinates field with unchanged placement diagnostics. Browser tests simulate Foundry; live v14 testing remains required.
