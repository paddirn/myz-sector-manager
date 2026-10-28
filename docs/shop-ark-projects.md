# Player Shop and Ark Projects (0.1.42)

## Verified official MYZ mappings

Mappings were checked against the official Mutant: Year Zero system 14.0.4, source commit `ade55c93a4c6c29828dee790aaeed4fbd81803b9` (`module/data-model.js`, `lang/en.json`, and the native character, Vehicle and Ark Project templates). No unresolved field mappings remain.

| Display | Native document / property |
| --- | --- |
| Vehicle | Actor, type `vehicle` (not spaceship, character or Item) |
| Cost | `Actor.system.cost` |
| Gear Bonus | `Actor.system.movementBonus.current` / `.max`; native label MYZ.VEHICLE.MOVE_BONUS is Gear Bonus |
| Armor | `Actor.system.vehicleArmor.current` / `.max` |
| Resilience | `Actor.system.resilience.current` / `.max` |
| Occupants | `Actor.system.occupantsCount`, the native Occupants # capacity input; `.occupants` contains assigned Actor UUIDs, not capacity |
| Carried weight / limit | Prepared character `Actor.system.encumbrance.itemsWeight` / `.encumbranceMax` |
| Ark Project completed | Embedded `Item` of type `project`, `Item.system.completed` |
| Project requirement | `Item.system.work_points` (native StringField; never accumulated progress) |

Weight displays Unavailable if the system's computed values are absent; Sector Manager does not reconstruct the encumbrance formula. Item create/update/delete and Actor updates refresh displayed weight/resources. An accessible assigned roster character is preferred, then a unique eligible controlled-token Actor, then the alphabetically first eligible roster character. Manual switching remains selected during refreshes. The arrow remains visible after switching.

## Vehicle references and purchase chat

Create/select a Vehicle Shop group and drop a world or Compendium Vehicle Actor onto it, or replace a row by entering its Actor UUID in the reference input. Other Actor types and new Item drops into Vehicle groups are rejected. Both interfaces show Vehicle name, then Cost, Gear Bonus, Armor, Resilience and Occupants. All statistics are read-only native values. The GM's usual document link opens the source sheet for editing.

Legacy Item references remain intact and visibly marked for repair. Existing `passengers`, `travelType`, IDs and other metadata remain stored/exportable, with saved legacy values included in the GM warning. They are not relabeled as native Actor statistics. Resolve them explicitly to genuine Vehicle Actor UUIDs; there is no name-based conversion or deletion. Vehicle Actors cannot be moved into ordinary Item groups.

Buy still requests exactly one entry and does not transfer documents, change stock or deduct resources. Chat includes character, name, exact cost, weight and public comment when available, plus a native UUID document link. Vehicle entries use Actor links; Item entries use Item links. Native TextEditor enrichment resolves the reference, and standard Foundry content links support clicking and dragging. No ownership/permission updates occur; users without document access remain subject to Foundry's normal access checks. Secret comment blocks and executable text are removed or escaped. Successful purchases no longer repeat their message at the bottom of the Shop; configuration/request errors remain visible.

## Project status, Work Points and source synchronization

Project cards are grouped as Not completed, Completed, Not Available. Incomplete and unavailable cards preserve stored relative order; Completed cards sort alphabetically. The existing source array is never sorted. Section collapse state stays local to the editor session; expanded cards span both grid columns and collapsed cards return to one column. Legacy status strings remain stored/displayed and appear in the incomplete section until explicitly changed.

New Projects start Not completed with `workPoints: 0`. Status and Work Points are directly beneath the Project name. `workPoints` is an optional portable-v1 nonnegative safe integer; the old `progress` string remains preserved separately, without treating old prose/requirements as accumulated progress.

A numeric positive integer `work_points`, an integer string, or the unambiguous forms `N x number of PCs`, `N × number of PCs`, `N * PCs` supplies the multiplier. Other text gives an unavailable total. Total equals multiplier times unique active player User accounts, excluding GM and Assistant GM roles. Character roster size does not affect it. Connections refresh the total without changing status or progress. Zero players never causes automatic completion.

An intentional increase in Work Points to the current positive requirement automatically marks a **Not completed** Project Completed. A status change, unchanged/decreased Work Points, lower requirement after disconnect, unavailable requirement, or Not available status never auto-completes. Existing progress above a lowered requirement is retained; it may be reduced but cannot be increased beyond that requirement. Completed stays Completed when totals change. Not available retains all progress and maps to an unchecked native Ark checkbox. Switching back to Not completed retains progress and does not itself complete the Project.

For linked Ark Projects, explicit status changes/automatic completion immediately update only the stable source embedded Item's `system.completed`, through the Ark's `updateEmbeddedDocuments`, after verifying GM authority, Ark ownership, UUID/parent/type and source identity. No-op writes are skipped and native refresh hooks are suppressed during the local write to avoid loops. Native sheet completion remains authoritative: checked becomes Completed; unchecked becomes Not completed, retaining an existing saved Not available distinction. Missing/deleted/unlinked sources retain snapshots and metadata with an error rather than changing another Project. Manual Projects never need an Ark update.

**Save Sector** persists local Work Points/status metadata. Native Ark checkbox changes take effect immediately; closing the editor without saving does not undo those native changes. No source requirement text or unrelated Ark Project is modified.

## Manual Foundry v14 checks

Automated tests use simulated Foundry APIs and Chromium; a licensed live Foundry world was not available.

1. In a backup world, open the Player Shop with an assigned character, then with a unique controlled roster token. Verify fallback, keyboard switching, the arrow, current resources, weight and red Encumbered warning. Change inventory and confirm live updates.
2. Drop world/Compendium Vehicle Actors, enter a Vehicle Actor UUID, try a wrong Actor type, and reopen an old Vehicle Item row. Compare each value with its native sheet. Save/reopen and export/import; verify original legacy metadata remains.
3. Buy Item and Actor entries. Check exact-one request chat, weight/comment sanitization, native clicking/dragging for authorized users, and normal denied access for unauthorized users. Confirm no Actor resources, inventory or ownership changed. Select identical trade resources and verify one warning and disabled Request Trade.
4. Open linked and manual Projects. Check two-column collapsed cards, full-width expanded cards, group collapse retention, alphabetical completed cards and unchanged saved order.
5. Connect four players plus multiple GM/Assistant GM accounts. With multiplier 2, verify total 8. Set progress 5, disconnect two players, and verify progress 5/4 remains incomplete. Reduce to 3 then intentionally increase to 4; verify completion and only the correct Ark checkbox changes.
6. Exercise Not available → Not completed with retained progress, native Ark checkbox changes, zero players, unknown multipliers, missing sources, permission failures, Save/reopen and JSON round trips. Confirm no recursive update storm or duplicate entries.
