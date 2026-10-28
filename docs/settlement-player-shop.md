# Linked Arks and standalone Player Shops (0.1.37)

## GM setup

1. Open a Settlement in Sector Manager. On Overview, find **Linked Ark Sheet**. Drop an official MYZ Ark Actor or paste its Actor UUID. Character Actors are rejected. Save Sector.
2. The linked information is read-only. **Open Ark Sheet** opens the original sheet for editing. Actor changes and changes to its embedded Items refresh this view. Missing/inaccessible links produce a warning and retain the UUID. While linked, Population is read-only and displays the Ark's `system.population`; unlinked stored Population is retained and returns when the link is cleared. Missing/inaccessible Arks show Unavailable, never a fabricated zero. Leadership and other authored fields remain separate.
3. On **Shop**, expand **Player Shop and Resource Trading (GM configuration)**. Enable Player Shop access and Save Sector. This explicitly publishes the Shop's Item names, descriptions (excluding secret blocks), displayed statistics/comments, prices, group names and exchange rates to **all players** who have its macro/identifier. Nothing else from the sector is published. Only enable this for information intended for players.
4. Optionally enable resource trading. Enter positive whole relative values (1–1,000,000) for Bullets, Clean Grub, and Clean Water, then Save Sector. Trading is disabled by default. The default relative values are 1:1:1, configurable house settings, **not official MYZ exchange rates**.
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

## Trading arithmetic and actual character resources

For resource values `V`, giving `Q` units of A receives:

```
floor(Q × V[A] / V[B]) units of B
```

All six directed exchanges use the same values. Example house values Bullets=3, Grub=2, Water=1: 3 Grub yields 2 Bullets; 1 Bullet yields 3 Water. Integer multiplication/division uses BigInt, so rounding is deterministic. Received fractions/remainders are discarded; trades returning zero units are refused. Entered trade quantities must be positive whole numbers, at most 1,000,000. The Give and Receive controls appear in aligned columns. Give quantity starts at 1, with centered minus/plus buttons around a compact, approximately two-digit input; the received amount is also centered beneath its dropdown; the prominent read-only Receive amount updates as either resource, quantity or character changes. While open, the window checks the existing GM-filtered Shop API every ten seconds for new rates/availability, preserving the selected resources and Give quantity; Refresh Shop also fetches them immediately. Pending requests suspend these background checks. Giving/receiving the same resource is refused.

Confirmation states the exact deduction, addition and rate. The GM rechecks the current saved Settlement, publication/trading settings, inventory/rate revision, Actor ownership, and current balances before updating the Actor. If rates or displayed balances changed, refresh and review again.

The official MYZ system permits fractional resource balances; pre-existing fractions are preserved. Only the submitted trade quantity and received amount must be whole units. No duplicate module inventory is created.

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
| Character Clean Water | `system.resources.water.value` (non-negative number, decimals allowed) |

MYZ derives development **values** from completed Projects and Artifacts; this module reads those prepared values rather than recomputing them. Ark Projects/Artifacts are named embedded Items, not guessed `system.projects` or `system.artifacts` arrays. Rich Info is flattened to readable text; open the native Ark sheet for its original formatting. Nothing is written to the Ark or MYZ system source. Rot Grub/Water, Booze and other resource fields are untouched by trading.

## Persistence and portable JSON

Sector/schema version remains 1 with additive, backward-compatible fields:

| Sector path | Type / default | Behavior |
| --- | --- | --- |
| `settlement.arkUuid` | UUID string, `""` | Existing field; now drives the live read-only Ark panel. Missing references retained. |
| `settlement.shop.playerAccess` | boolean, `false` | GM opt-in to publish the Shop to players. |
| `settlement.shop.trading.enabled` | boolean, `false` | Enables actual resource exchanges. |
| `settlement.shop.trading.values.bullets` | integer 1–1,000,000, default 1 | Relative Bullet value. |
| `settlement.shop.trading.values.cleanGrub` | integer 1–1,000,000, default 1 | Relative clean Grub value. |
| `settlement.shop.trading.values.cleanWater` | integer 1–1,000,000, default 1 | Relative clean Water value. |

These fields are declared in `scripts/portable/schema.mjs` and the published `docs/sector-portable.schema.json`, survive export/import, and are normalized without discarding existing groups, references, old merchant archives, or unknown retained fields. Old sectors remain unpublished with trading disabled. Exporting/importing an enabled Shop preserves the enabled state: review it before sharing the new Journal's macro.

User request/response flags and Actor transaction receipts are runtime bookkeeping, outside the portable sector content. The Ark UUID is a reference, not a copied Actor or a promise that another world has that Actor.

## Authority, retries and practical limits

Requests use the requesting player's **User document flags**, whose update permissions Foundry enforces, rather than trusting a user ID in an unauthenticated module socket packet. The elected active GM serializes all Shop operations, rereads live documents, and publishes only an allowlisted Shop response. Manipulating a player's local UI/response cannot change the authoritative price or resource fields. The GM service has no operation to edit sector records, expose other tabs, change stock, create Items, or update arbitrary Actor fields.

The UI blocks double-clicks while awaiting a request. A trade writes both native resource changes **and a duplicate-request receipt in one Actor update**. Receipts retain ten minutes of history, capped at 1,000 recent transactions per Actor; further trades fail rather than dropping recent protection. Request IDs, timestamps (two-minute acceptance window), stale balance/rate checks, and an in-memory result cache protect normal retries. Requests are not automatically replayed on reload/GM failover.

A failed Actor update never announces success. If chat posting fails after the Actor update, the response explicitly says the trade completed but its chat announcement failed; the deduction is not repeated. A 60-second timeout disables transaction buttons until explicit Refresh. **Check the character sheet before refreshing/retrying a timed-out trade.** Do not blindly repeat a trade when connection loss leaves its outcome uncertain.

This is not database-level atomicity. Foundry provides no compare-and-swap transaction spanning Actor/Journal/Chat documents. Concurrent trades handled by this elected GM service are serialized; unrelated manual resource edits, other modules, and a GM disconnect exactly during an update remain outside that queue. Players already entitled to edit their characters retain that normal Foundry capability. Test normal operation and failover in a backup world.

## Tracking and overlay display

One selected-sector coordinate button spans the Ark and Party distance rows (and additional expedition rows), retaining the existing distance calculations and navigation. Labels wrap at narrow widths.

Overlay labels previously used PIXI's default text texture resolution (the browser DPR in PIXI 7.4.3), which stays fixed as stage zoom changes. Zoom can enlarge that texture, while small/fractional font sizes and fractional display scaling can soften its sampling. Overlay text now uses a renderer/DPR/zoom-aware resolution, with a minimum 2× texture sampling, rounded up in half steps and capped at 4, with regeneration only when the resolution bucket or existing drawing signature changes. This is local to the overlay; it does not change Foundry renderer settings, CSS transforms, coordinates, hit testing, grid lines or global texture defaults. Higher zoom beyond the cap can still soften text; the cap bounds texture memory.

## Manual Foundry v14 checks before release

Automated tests simulate Foundry APIs; Chromium/PIXI checks do not load licensed Foundry.

1. In a backup world with official MYZ v14, link/drop/paste an Ark; verify all listed fields, native sheet opening, live Actor and embedded Item edits, wrong Actor rejection, missing Actor warnings, and Save/reload.
2. As GM, publish one Shop and leave a second unpublished. As a separate player account with **no sector Journal permission**, run the shared macro. Confirm only the designated Shop appears; unpublished/missing/Normal/Special identifiers fail. Check world and Compendium Item names/prices, unavailable rows, Copy Macro success/failure, and that secrets/private tabs remain absent.
3. Test assigned/multiple owned characters and another player's Actor; confirm only authorized characters work. Verify each Buy submits exactly one Item at quantity 1; test fixed/range prices, public chat, and unchanged resources/Items/stock.
4. Enable trading; test all six directions, integer rounding, fractional existing balances, zero/negative/fractional inputs, insufficient supplies and confirmation cancellation. Check the actual character sheet fields after trade and reload.
5. With two players, submit simultaneous trades against the same authorized character and against different characters. Change balances/rates/disable access while confirmation is open. Confirm stale requests fail, duplicate clicks deduct once, and unauthorized attempts cannot write.
6. Disconnect/reconnect player/GM during a request; inspect the sheet before any retry. Verify failed Actor writes produce no success chat and chat failures do not repeat deductions. Check that an active GM is required and a secondary GM does not also process requests.
7. Import/export an older and a fully configured Settlement; verify Ark UUID, access/rates, notes, groups and inactive data survive. Test all existing GM Shop editing/Buy controls.
8. Check the shared distance button at narrow/wide sizes, live Party moves and selected-sector navigation. Check overlay text/alignment at 50%, 100%, 150%, 200% canvas zoom and 1×/1.5×/2× display scaling, including pan/hover/click/right-click/token movement. Inspect performance on a dense map.

## Ark coordinates and Projects (0.1.39)

The linked Ark's `system.coordinates` appears read-only in Overview and refreshes with Ark edits. The separate **Zone placement coordinate (manual)** remains the existing GM placement control, not a copy of the Ark's field. The UI parses the Ark coordinate using the existing Zone coordinate parser and checks the current grid, Scene scope and occupying records. Invalid, unavailable, out-of-grid, foreign-Scene, occupied or ambiguous targets produce non-blocking warnings. Matching placements are reported; a valid empty target prompts manual placement.

**Architectural limit:** this release uses the requested read-only fallback. It does not automatically assign, unassign, relocate or replace a sector. Existing Journal/Scene placement has no cross-Journal atomic occupancy transaction, so an automatic move could race another GM's placement. Ark links never change existing placement or move a record to another Scene. Use explicit GM placement controls when appropriate; inspect any occupancy warning first.

Opening/rendering a linked Settlement synchronizes embedded Ark `project` Items into its Projects **draft**, using stable source UUIDs. These are marked **Ark-linked Project — read-only**, have no editable fields or Delete action, and provide **Open Ark Project** where the source is available. Manual Project records stay separate, editable and unchanged. Names, source descriptions, completed/not-completed state, exact `work_points` text and source comments map to existing title/details/status/progress/notes fields. Work-point text is shown as **Work points (source)**, not an invented numerical progress estimate; no start date or completion date is guessed. Full supported Item information still resolves from the source.

Updated sources refresh existing entries rather than appending duplicates. Source deletion, inaccessible/unlinked Arks, and link changes retain the last snapshot with a missing-source marker; manual records are not deleted. Relinking the same available source clears the marker. Synchronization never writes to the source Actor or Item. It only changes the current draft when content differs: **Save Sector** persists snapshots through the normal Journal save. Ark update hooks/repeated loads perform no automatic Journal writes.

Portable v1 Project entries now accept `arkSource: {version: 1, arkUuid, projectUuid, missing}`. All four metadata properties are required when `arkSource` is present; both UUIDs must be nonempty real source identifiers. Ordinary manual Projects omit it. Source metadata, stable entry IDs and missing snapshots survive import/export; they do not create Actors or Items in another world. Both published JSON Schemas and the authoritative field guide declare this optional metadata. Avoid authoring it from sourcebook prose.

Before release in a backup Foundry v14 world, verify roster filtering with multiple players/owned characters and roster removal during confirmation; concise price-range chat; centered controls; live current-only development levels; linked/read-only versus unlinked/editable population; missing Ark warnings; coordinate diagnostics with valid/occupied/ambiguous/invalid/out-of-grid/other-Scene targets and unchanged saved placement; Project source opening, edits, deletion/recovery, repeated loading, manual entries, Save/reload, and portable metadata round trips. No live Foundry instance was available for automated testing.
