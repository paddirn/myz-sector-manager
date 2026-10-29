# GM-requested blind party skill rolls (0.1.45)

Create a **Script Macro**, usable by GMs, containing exactly:

```js
await game.myzSectorManager.requestPartySkillRoll();
```

The active GM selects a basic skill pair, an integer skill-dice modifier (default 0; -100 to 100), and one owned world roster character per connected non-GM player. Review the list before clicking **Request Blind Rolls**. Ambiguous character selections must be chosen explicitly; disconnected players and unsupported skills are shown as unavailable. The configured Party Roster is authoritative. NPCs, unrelated Actors, GM/Assistant GM accounts and specialist skill requests are excluded. Existing travel/Stalker eligibility switches do not remove character membership from the roster.

An eligible assigned User character is preferred. Players also publish a nonsecret controlled-character hint through their own User flags when a unique roster token is controlled; the GM validates its ownership/roster membership before using it. Remote token control is not otherwise globally observable. When no unique preference is available, the GM chooses a character in the review dialog. The review never chooses multiple characters for one player.

Each player receives **GM Requests a Blind Skill Roll**, with portrait, character, actual skill/program and modifier. Nothing rolls until the player clicks **Roll [skill]**. The player receives only **Roll submitted**, not dice or a result. Cancel or the window X marks the request canceled. To reopen outstanding pending requests after reconnecting, a player can use:

```js
await game.myzSectorManager.openPendingPartySkillRolls();
```

Canceled/completed requests cannot be rolled again. The GM issues a new request if another attempt is intended. Multiple outstanding requests use separate IDs/nonces in one reusable GM management window. Successful rows show Completed only after the authoritative manager records their result and private chat acknowledgement. The GM summary updates submission status, actual skill, modifier, successes (including zero), and full native dice details. Only GM accounts receive the persistent detailed chat result. Closing the summary leaves those private chat messages available.

## Verified MYZ API and skill mappings

Checked against official `mutant-year-zero` **14.0.4**, source commit `ade55c93a4c6c29828dee790aaeed4fbd81803b9`: `module/item/item.js`, `module/actor/myz-actor.mjs`, `module/data-model.js`, `module/component/dice-roller.js`, `module/config.js`, and `packs/core-skills/_source`.

| Mutant basic skill/key | Robot program/key | Native attribute |
| --- | --- | --- |
| Endure / ENDURE | Overload / OVERLOAD | strength |
| Force / FORCE | Force / FORCE | strength |
| Fight / FIGHT | Assault / ASSAULT | strength |
| Sneak / SNEAK | Infiltrate / INFILTRATE | agility |
| Move / MOVE | Move / MOVE | agility |
| Shoot / SHOOT | Shoot / SHOOT | agility |
| Scout / SCOUT | Scan / SCAN | wits |
| Comprehend / COMPREHEND | Datamine / DATAMINE | wits |
| Know the Zone / KNOWTHEZONE | Analyze / ANALYZE | wits |
| Sense Emotion / SENSEEMOTION | Question / QUESTION | empathy |
| Manipulate / MANIPULATE | Explicitly unsupported | empathy |
| Heal / HEAL | Explicitly unsupported | empathy |

The system contains Robot `MANIPULATEPROGRAM` and `REPAIR` definitions. This feature does not infer a basic-skill equivalence from those names or request specialist programs. Embedded Item `type: skill` and `system.skillKey` identify the actual skill; missing or duplicate matching Items fail clearly rather than rolling a different skill. Human/animal character Actors use the requested basic key only when that embedded skill actually exists. The attribute is read from the actual skill's `system.attribute`, not a second hardcoded attribute formula.

The GM calls `Actor.getRollData()`, using `attributeDiceTotals[attribute].baseDiceTotal` and `skillDiceTotals[key].skillDiceTotal` / `.gearDiceTotal`, including the system's prepared equipped-item/native modifiers. The optional request modifier adds to skill/program dice. Basic skill rolls do not silently select a weapon or add an extra weapon bonus. A GM-only `Roll` evaluates native `db`, `ds`, `dg` terms; `game.myz.DiceRoller.ParseResults(roll, signedSkillTotal)` and `.CountSuccesses(dice)` interpret the native results, including negative skill dice. No separate dice rules are implemented. No push, resource consumption, or automatic Actor update is performed.

## Why the native player roll handler is bypassed

Native `Item.roll()` / `DiceRoller.Roll()` / `SendToChat()` can open a local roll dialog, use the client's core roll mode, emit roll payloads/native dice flags, and expose results through chat/visualization integrations. They cannot guarantee the requested secrecy when invoked on a player client.

This implementation therefore uses the authorized player click only as consent. Evaluation and result parsing happen on the active GM. The player never receives rolled dice, counts, totals, formulas or the GM summary through custom messaging/state. Results use **GM-only whisper recipients and `blind: true`**, independent of the core roll-mode setting. Detailed GM chat uses a formatted result card with portrait, native MYZ dice images grouped by Base/Skill or Program/Gear, modifier and successes, **without a `rolls` array or native MYZ dice flags**. The module never calls `dice3d`, `Roll.toMessage`, the native public roll handler or a result socket broadcast. This avoids supplying a result payload to normal Dice So Nice chat-roll visualization paths.

Automated checks verify this module's data flow and stub dice visualization calls to fail if invoked. **Live Foundry and Dice So Nice were not loaded**, so compatibility with installed versions and arbitrary third-party hooks is not certified. Test the actual world with a separate player browser before relying on secrecy. A module that intercepts/eavesdrops on all GM-side Roll evaluation is outside this feature's control; the supported execution path deliberately avoids native/public chat and visualization entry points.

## Authorization, lifecycle and persistence

Messaging uses Foundry's supported User document flag updates, as the existing Player Shop does. Server User permissions authenticate the changed document. Only the active GM can publish requests; players can update only their own authorization responses. Requests contain only metadata/nonsecret status. Responses contain only request ID, target token, Actor UUID and Roll/Cancel choice. Client success counts are ignored. The GM rechecks current roster membership, ownership, connected user, IDs, target nonce, skill, current native pool, expiry and GM authority before evaluating. Duplicate and replayed submissions cannot evaluate twice in one request session. A neutral consumed state is persisted before evaluation.

Results remain in GM-client memory and private GM chat, never User flags. Fifty request sessions of up to 100 recipients are supported within a 30-minute validity window. A periodic expiry check closes stale player prompts and marks unanswered or interrupted evaluating rows failed; disconnects show Disconnected until reconnecting, without auto-rolling. Pending prompts can be reopened. Reloading the active GM clears its pending request metadata and does not replay cached player responses or reroll lost requests. Old GM summaries are not reconstructed from public state; already-posted private GM chat remains available. A GM failover requires issuing fresh requests. This favors preventing duplicate/unauthorized rolls over recovering unfinished sessions automatically.

If native parsing fails, the row is Failed with a GM-only diagnostic. If private chat fails after evaluation, dice remain in the private summary and the row is Failed; there is no public-message fallback. Check the summary before issuing a replacement request.

## Manual Foundry v14 checks

Automated tests use simulated Foundry APIs and real Chromium DOM interactions.

1. In a backup world with official MYZ v14, create mutant and robot roster characters with embedded skills, one active GM, two players and a disconnected user. Give one player multiple owned roster characters; assign a preferred character or control a roster token. Verify hints, explicit ambiguity selection, unauthorized Actor exclusion and disconnected status.
2. Run the GM macro, choose Sneak/Infiltrate with positive/negative modifiers, and review recipients. Verify correct native attributes, prepared skill/program and equipped gear totals against each sheet. Try Manipulate/Heal on a Robot and missing/duplicate skills; verify clear unsupported handling. Try invoking the API as a player.
3. Use separate player browser sessions to Roll, Cancel and X. Confirm no dice, result text, count or success appears in their dialogs, notifications, local roll history, chat or normal client-side request state. Verify neutral confirmation and GM-only live summary/full details, including a zero-success result.
4. Set core roll mode to public and enable the actual Dice So Nice version used by the world. Repeat while observing all player clients: no public chat or 3D dice may reveal the result. Do not certify that integration solely from the simulated tests.
5. Send simultaneous requests, double-click/duplicate authorization updates, disconnect/reconnect, reopen pending prompts, alter ownership/roster before submission, and reload/fail over the active GM. Confirm no automatic roll/replay or cross-request mixing; issue fresh requests after GM reload. Confirm expired requests cannot submit.
6. Buy a weighted Shop Item and verify `Weight: …`, `Comment: …`, exact price and the native draggable UUID link. Confirm Actor resources, Item inventory and ownership remain unchanged.

## v0.1.45 bug causes and fixes

- Raw JSON was deliberately inserted by the chat/summary templates using JSON.stringify. Both now share the human-readable party-skill-results renderer, with validated native dice faces and installed MYZ assets. Native roll.hbs was inspected: it includes Push/spend-bullet controls coupled to native roll flags and handlers, so copying it intact would add unsafe/unsupported interactions. The custom card reuses its dice styling/assets without those controls, native roll flags or visualization payloads.
- The tracking subscription was installed in a render constructor option on `new DialogV2`. In the v14.369 API declarations, render/close callbacks belong to static DialogV2.wait options; directly constructed Applications emit render/close events. The subscription never installed in that native contract, leaving the original Pending HTML even when the service recorded a submitted result. The browser mock incorrectly accepted those constructor callbacks and masked the bug. It now deliberately ignores them. The service subscribes directly, refreshes through supported application events and isolates observer errors from authoritative processing.
- The old success state was submitted. A single completion method now associates the actual request ID/Actor UUID with the recorded result, then changes state to completed and notifies the existing window. Duplicate or late completion cannot overwrite a consumed/failed row. Chat failure and malformed results show Failed without preventing other rows from updating; private dice already evaluated remain inspectable where valid.
- There was no result-triggered dialog factory. The old summary factory intentionally created a new GM window per request; it now reuses one management window for all current requests. Directly constructed player dialogs also used the unsupported close option, so X could leave them pending. Supported close events now cancel correctly, while answered-token/response guards prevent prompts reopening during delayed acknowledgements. Rerendering reads the same authoritative store and does not create another window.

The API contract was checked against community Foundry v14.369 declarations (`foundry-vtt-types` commit e613e06e85f6fcded8a9621ad23337f20d0bff70, applications/api/dialog.d.mts). No live Foundry runtime was used.

Additional manual v14 regression checks:

1. Request Sneak from WD-40K. Confirm the GM-only card shows portrait/name, modifier, grouped native dice faces and Total successes, with no raw JSON, formula/debug dump or Push controls. Verify zero-success and Robot Program dice cards too.
2. Roll as the player: only Roll submitted is shown to that client. Confirm the same GM window changes that exact row from Pending to Completed, displays successes, and leaves other pending characters untouched. Rerender/minimize/restore the manager and verify the recorded result remains.
3. Send repeated/simultaneous same-skill requests: only one GM management window exists, each request keeps its own rows, and each targeted player gets one prompt per request. Close a prompt with X, then wait beyond the 15-second refresh: it must stay canceled, not reopen. Submit while acknowledgements are delayed and check no second prompt appears.
4. Simulate a private-chat/native-roll failure or interruption. Confirm Failed, not a permanently Pending row, and no public-result fallback. Inspect valid retained dice in the GM window. Recheck with the installed Dice So Nice version and a separate player browser; actual visualization/runtime compatibility remains unverified by these simulated tests.
