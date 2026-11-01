# Patrol movement failure investigation — 0.1.59

## Confirmed code defects

The failing line was in `PatrolRoutes.settle`, not a veto hook. The service looked
up the assigned **native TokenDocument** with
`game.scenes.get(route.sceneId).tokens.get(assignment.tokenId)`, calculated a Zone
sector's Scene-pixel center, subtracted half the token's tactical-grid dimensions
and called `await token.update({x,y,hidden}, {animate:false,myzPatrol:true})`.
It immediately compared the original instance's prepared `token.x/y/hidden` against
the exact, unrounded requested values. Any mismatch was labeled a veto, even if
that conclusion was unsupported. It also saved advanced route state before it knew
whether the token had arrived.

Two API mismatches are reproducible:

1. **Fractional targets versus integer native coordinates.** Zone calibration can
   use fractional pixels. v14 Token schema x/y are integer top-left coordinates.
   A successful native integer normalization can never equal an unrounded request.
   Example from the regression fixture: requested `(200.75,150.75)`, native stored
   `(201,151)`. The original exact comparison reported failure despite the update.
2. **Document update acknowledgement versus movement completion / source data.**
   v14's movement API exposes a completion-aware `TokenDocument.move` Promise and
   distinguishes animated prepared fields from source position/dimensions. The
   original `update` followed by reading the same prepared instance did not make
   those distinctions. A completion/source fixture reproduces the false failure;
   the fixed code waits for movement and re-resolves the stored Scene document.

Both new reproductions were run against the original 0.1.58 implementation before
changing production code: **2 failures**. They now pass. Existing mocks used exact
integer centers and immediate Object.assign updates, which hid both mismatches.
These example values are test data, **not readings from the user's Foundry world**.
The supplied stack alone contains no actual coordinate/result data, so it cannot
identify whether that particular live event was normalization, pending/prepared
state, a genuine external restriction or another mismatch. The new diagnostics
provide that distinction rather than treating every mismatch as a veto.

The API audit uses published Foundry v14.369 declarations at
[`e613e06e85f6fcded8a9621ad23337f20d0bff70`](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/documents/token.d.mts):
`TokenDocument.Schema.x/y` are integer top-left coordinates; `move` resolves true
on completion/false if stopped or prevented, whereas `update` has a different
return contract. The declarations explicitly distinguish prepared animated fields
from source values. No live licensed Foundry runtime was exercised here.

## Hook and authority trace

- The repository registers **no `preUpdateToken` veto handler**. There is no
  module-level hook rejection to disable or bypass.
- `zone/runtime.mjs` already excludes `options.myzPatrol` from ordinary
  `updateToken` sector-entry handling. Its move/stop handlers ultimately require
  a designated Party/Expedition token; route assignment already rejects those.
- `PatrolRoutes` already ignores its marked update and holds its per-token busy
  guard through the whole native movement Promise, including move/stop hooks.
- `ZoneStore.tokenChanged` only updates configured Party tracking.
- `MovementRecovery` only retains offline movements without an active GM; patrol
  movement requires an active GM. No extra pending Party move is created.
- Campaign tracking is Party-bound. No Campaign/Travel code is modified here.
- Assignment resolves the configured Scene and token identity, validates GM update
  permission, excludes player-owned/Party/Ark tokens and rechecks active-GM
  authority. After movement, verification re-resolves **that Scene collection**;
  a stale original object or a surprising return value is not authoritative.

External system/module `preUpdateToken` / `preMoveToken` restrictions still run.
There is no global validation switch, wall/region bypass or forced permission
change. Native move options disable animation, camera pan, auto-rotation and ruler
presentation; the existing scoped `myzPatrol` marker remains.

## Fix and coordinate handling

`target` still uses `coordinateToBounds`, `sceneCellSize` and the native token's
source dimensions. Its output is **integer Scene-pixel top-left x/y**, rounded
before persistence/update/verification. It is not a sector code, screen coordinate,
PIXI marker coordinate or token-center value. Scene bounds/size validation remains;
integer positioning can differ from the mathematical center by at most half a pixel
per axis. Source data is read through public `toObject(true)`, not a private
`_source` mutation. No arbitrary epsilon weakens final verification.

Positional changes prefer `await token.move(...)`. Visibility-only changes use
`update`; the fallback supports test/older document implementations without move.
After completion, strict expected x/y/hidden are checked against source data from
the current assigned Scene TokenDocument. A boolean, undefined or unusual returned
object does not itself determine success: source data does. An already-correct
source position reconciles without moving again. Prepared coordinates and return
summaries are diagnostic only.

## Failure state and recovery

The existing durable intent now carries optional `routeBefore` / `routeAfter`
checkpoints (waypoint index, direction, partial milliseconds and processed time).
During a planned transition, public route progress remains at its before values.
Only verified native arrival commits the after checkpoint and removes the intent.

A genuine rejection, thrown exception or source mismatch pauses the route and
preserves before values. Resume retries/reconciles the pending transition before
establishing the fresh clock baseline; paused time does not accumulate. A token
that already arrived is not moved again. A GM change after token movement but
before acknowledgement leaves an intent that the next authority can reconcile.
Native movement and the Journal still cannot share a server transaction, so the
previous documented active-GM/CAS limitation remains.

These are optional private intent fields, not a new route/editor design or sector
portable schema. Version-1 state and old 0.1.58 intents remain supported. Legacy
fractional targets are compared in their native integer representation. Older
intents lacked before-progress checkpoints: the fix cannot retroactively infer
historical progress/elapsed time already consumed before it was installed.

## Diagnostics

A failure console entry includes:

- Route ID/name, assigned token ID and Scene ID.
- Starting sector from the saved native baseline and intended destination sector.
- Expected integer x/y/hidden, actual persisted x/y/hidden, and prepared coordinates.
- API used, return-value summary and classification: `rejected`, `exception`,
  `verification` (or context/target `validation`).
- Current user/active GM identity and whether this is a legacy intent.

The normal GM notification and route status are concise. No player notification or
player-facing route payload is introduced. A rejected result means stopped or
prevented; it does not name an external hook without evidence. A verification
mismatch does not claim that a veto occurred.

## Changed files

- `scripts/patrols/movement.mjs`: source-position helpers, exact comparisons,
  checkpoints and safe result summaries.
- `scripts/patrols/service.mjs`: integer targets, completed movement/source checks,
  re-resolving native documents, checkpoint commit/recovery and diagnostics.
- `scripts/patrols/model.mjs`: validates optional before/after intent checkpoints;
  existing legacy intents still validate.
- `tests/patrol-service.test.mjs`: v14-style move/update hooks, two original failure
  reproductions and failure/progress/result/legacy/Party/handoff regressions.
- `tests/patrol-browser.cjs`: native move/stop lifecycle simulation alongside the
  existing Party/Zone handlers; no editor redesign or weakened checks.
- `module.json`: declares helper and prepares aligned 0.1.59 assets.
- `README.md`, `docs/patrol-routes.md`, this report: behavior and manual checks.

## Validation and manual Foundry checks

Run all Node tests and browser suites, syntax/manifest/release preparation,
workflow lint, portable-schema examples, ZIP integrity and root manifest/module
byte comparisons. Results are recorded in the PR. Browser/Node tests simulate
Foundry APIs; they do not establish live runtime behavior.

In a backup Foundry v14 world:

1. Open the existing paused route and Resume. Check that an already-moved token
   does not jump twice and that the route resumes normally.
2. Test a fractional calibration, odd sector dimensions, a non-square token and
   the configured Scene while viewing another Scene. Inspect source x/y using
   the assigned Scene token's `toObject(true)`; expect integer top-left values.
3. Advance one hour, two half-hours and a large jump. Confirm a single final move,
   centered within native pixel precision, and correct waypoint/direction/progress.
4. Check alongside Party movement, Travel Events and another connected GM. No
   Party travel effect or second clock advance should come from patrol movement.
5. In a disposable test setup, reject a movement with a temporary native hook.
   Check the diagnostic route/Scene/token/sector and coordinate values, and verify
   waypoint/progress/baseline remain unchanged while paused. Remove the restriction
   and Resume; it should commit the failed transition once and skip paused time.
6. Inspect a genuine exception/source mismatch report if one occurs. Do not assume
   an external module veto from the generic paused notification alone.
7. Reload between movement and acknowledgement in a disposable world if possible;
   source reconciliation should acknowledge arrival without replaying it.

If a native Region intentionally pauses movement, its completion Promise remains
pending until that native movement is resolved; this fix does not bypass Region
behavior. Native v14 timing, external hook interactions and real multi-client
handoff remain manual verification items.

### Final automated results

- `node --test tests/*.test.mjs`: **593/593 passed** (10 added reproductions and
  movement/state/hook/result/handoff regressions).
- All **16 browser suites passed**, including the patrol, existing Zone/overlay,
  Party, Travel, Campaign Log and sector UI suites.
- `node --check scripts/sector-manager.mjs`, release preparation for v0.1.59,
  manifest/required files and declared module syntax, `unzip -t`, root manifest and
  source-byte comparisons, actionlint 1.7.7 and `git diff --check`: passed.
- Portable JSON example/schema validation: **28 valid and 10 invalid checks passed**.
  Sector portability code/schemas, route editor and travel/Campaign handlers have
  no changes.

0.1.59 is prepared for review; this change does not create a version tag or publish
any release.
