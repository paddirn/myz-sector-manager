# Player Shop and Ark Projects (0.1.43)

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

Project cards are grouped as Not completed (Work Points ≥1, descending progress then alphabetical title), Not started (zero Work Points, blue and alphabetical), Completed (green, alphabetical), Not Available (muted gray). Not started is display-only: its saved status remains Not completed. Completed and Not Available headings omit progress; the other headings show current/total. Unavailable totals show ? rather than a fabricated zero. The existing source array is never sorted. Section collapse state stays local to the editor session; expanded cards span both grid columns and collapsed cards return to one column. Legacy status strings remain stored/displayed and appear in the incomplete section until explicitly changed.

New Projects start Not completed with `workPoints: 0`. Status and Work Points are directly beneath the Project name. `workPoints` is an optional portable-v1 nonnegative safe integer; the old `progress` string remains preserved separately, without treating old prose/requirements as accumulated progress.

The centralized multiplier helper safely converts native `work_points` to text and reads its **first numeric value anywhere**, including `2 x number of PCs`, `3 × number of PCs`, `Work Points: 4 per PC`, and `Requires 5 work points per character`. Positive decimal multipliers are accepted. Missing, nonnumeric, zero, negative or non-finite values give an unavailable requirement and a visible diagnostic naming the native field. No substitute zero is used.

Total equals multiplier × **max(1, active non-GM/non-Assistant player accounts)**. The GM-only case therefore uses one effective player. Connections refresh totals without altering progress, status, or source checkboxes.

Work Points are always editable nonnegative safe integers, even with an unavailable total, and may exceed the requirement. Minus stops at zero; plus adds one. The compact centered input, heading, readiness and grouping refresh in place rather than replacing focused controls; first progress moves a card from Not started to Not completed, and returning to zero moves it back. Saved source order remains untouched.

**There is no automatic completion.** A Not completed Project at or above a known positive total displays **! Ready to Complete !** in bold green beside the controls. Reducing progress hides it. Completed and Not available never display it and retain their progress. Only explicitly selecting Completed checks a linked Ark Project.

For linked Ark Projects, explicit status changes immediately update only the stable source embedded Item's `system.completed`, through the Ark's `updateEmbeddedDocuments`, after verifying GM authority, Ark ownership, UUID/parent/type and source identity. No-op writes are skipped and native refresh hooks are suppressed during the local write to avoid loops. Native sheet completion remains authoritative: checked becomes Completed; unchecked becomes Not completed, retaining an existing saved Not available distinction. Missing/deleted/unlinked sources retain snapshots and metadata with an error rather than changing another Project. Manual Projects never need an Ark update.

**Save Sector** persists local Work Points/status metadata. Native Ark checkbox changes take effect immediately; closing the editor without saving does not undo those native changes. No source requirement text or unrelated Ark Project is modified.

## Manual Foundry v14 checks

Automated tests use simulated Foundry APIs and Chromium; a licensed live Foundry world was not available.

1. In a backup world, open the Player Shop with an assigned character, then with a unique controlled roster token. Verify fallback, keyboard switching, the arrow, current resources, weight and red Encumbered warning. Change inventory and confirm live updates.
2. Drop world/Compendium Vehicle Actors, enter a Vehicle Actor UUID, try a wrong Actor type, and reopen an old Vehicle Item row. Compare each value with its native sheet. Save/reopen and export/import; verify original legacy metadata remains.
3. Buy Item and Actor entries. Check exact-one request chat, weight/comment sanitization, native clicking/dragging for authorized users, and normal denied access for unauthorized users. Confirm no Actor resources, inventory or ownership changed. Select identical trade resources and verify one warning and disabled Request Trade.
4. Open linked and manual Projects. Check two-column collapsed cards, full-width expanded cards, group collapse retention, alphabetical completed cards and unchanged saved order.
5. Connect four players plus multiple GM/Assistant GM accounts. With multiplier 2, verify total 8. Set progress 5, disconnect two players, and verify progress 5/4 remains incomplete with Ready to Complete visible. Increase beyond the total and verify it remains incomplete. Explicitly select Completed and verify only the correct Ark checkbox changes. Disconnect all players and verify the requirement remains 2.
6. Exercise Not available → Not completed with retained progress, native Ark checkbox changes, zero players, flexible/unknown multipliers, missing sources, editable progress without a total, permission failures, Save/reopen and JSON round trips. Check zero → positive → zero grouping, descending progress/ties, readiness hiding and unchanged stored order. Confirm no recursive update storm or duplicate entries.

## Player Shop resources and exchange layout (0.1.43)

Each character resource appears on its own line beside a larger, uncropped portrait, with name and arrow retained. The selector stays in its one-third column and weight/Encumbered remain below it. Resource changes and character switching refresh the values.

Trading uses four equal desktop columns: Give, Receive, two-line Offer/Rate summary, and a centered normal-size Request Trade button. Narrow windows use two columns. Labels/dropdown text are centered, headings retain their readable text, and Minimum Give is removed from the normal summary. Invalid exchanges still show one useful error.

Changing Give sets quantity to the selected character's available **whole units** (floor of fractional resources, capped at the existing 1,000,000-unit transaction limit). Manual values are clamped to availability; zero available units displays zero and disables Request Trade. The plus button stops at availability, minus stops at the exchange's valid positive minimum, and insufficient availability disables requests with the exchange error. Character/resource updates refresh maxima and clamp existing quantities. Rates/calculations and server-side authorization/balance revalidation remain unchanged; no sheets are modified.

Manual Shop checks: switch all four Give resources, try a character with fractional/zero/insufficient resources, enter an excess amount, change a character's resources while the Shop is open, and reduce availability during confirmation. Verify two-line summaries, one warning, centered four-column desktop/two-column narrow layout, and unchanged purchase/trade chat.
