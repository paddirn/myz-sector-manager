# Functional main-window Minimize / Restore — 0.1.64

## Root cause and reproduction before the fix

`SectorManager` is a native Foundry `ApplicationV2`, with
`window.minimizable:true`. Its frame button rendered `data-action="myzMinimize"`,
but there was no matching entry in `SectorManager.DEFAULT_OPTIONS.actions`.
The only callback was in the frame definition's `onClick` metadata. Native frame
clicks use the ApplicationV2 action dispatcher; that metadata did not register
this custom action. Thus the button could hover/click without invoking `minimize()`.
This is a wiring failure before a native window method, not a demonstrated CSS
failure or an unavailable minimization API.

The prior browser fixture incorrectly attached each frame definition's `onClick`
directly. Correcting it to dispatch `data-action` through registered actions made
the existing 0.1.63 minimize test fail: minimized state stayed unset and no native
method ran. The fix passes that corrected test. No licensed Foundry runtime was
available; this is code/API inspection plus a faithful dispatcher regression,
not a claim to have inspected a live client callback stack.

The documented API was checked against pinned public v14 declarations:
[DEFAULT_OPTIONS.actions and action dispatch](https://github.com/League-of-Foundry-Developers/foundry-vtt-types/blob/e613e06e85f6fcded8a9621ad23337f20d0bff70/src/foundry/client/applications/api/application.d.mts).
`ClickAction` handlers run with the application as `this`; native `minimize()` and
`maximize()` remain the supported state/geometry APIs.

## Fix and state preservation

- Register `myzMinimize` in the main class's `DEFAULT_OPTIONS.actions`. Its ordinary
  function receives the correct application instance and invokes the shared toggle.
- Frame metadata supplies the registered action name, not an unused callback.
  Existing minimize/restore definitions are reused without adding a second button;
  other native controls and their handlers are retained.
- Toggle calls native **`minimize()`** or **`maximize()`**, awaiting completion and
  serializing rapid repeated button actions. An unchanged native state or thrown
  error is reported as a real error; no fake CSS fallback masks it.
- After native transitions, synchronize **Minimize / Restore**, tooltip, accessible
  name and minus/restore icon. Keep the button directly left of the native three-dot
  menu. Native title-bar double-click restoration updates the same control.
- While minimized or minimizing, main `render()` requests are deferred rather than
  replacing hidden form DOM or automatically restoring the window. Latest pending
  render arguments are applied through normal rendering after explicit restoration.
- Capture only existing UI scroll/focus state before collapse through `ScrollKeeper`;
  restore it after the native expansion. Normal input handling already keeps unsaved
  values in the draft. No save, cancel, close or forced form capture is added by the
  minimize action. Pending normal rendering on Restore uses the existing editor
  renderer and scroll keeper, rather than directly replacing fields in this helper.
- Native window handling owns position/dimensions, animation, dragging and resize.
  Explicit dragging of a minimized title bar retains native behavior. No custom
  content hiding or window-size fallback is used by product code.

Clock/Patrol refreshes normally update only the Zone summary. Scene changes and
other normal content render requests remain deferred while collapsed. Focusing
or bringing the application forward does not restore it. Existing explicit close
and unsaved-change confirmation still work, including while minimized; a reopened
application starts with a fresh, expanded instance. No sector, route or document
storage fields are added.

## Files changed

- `scripts/sector-manager.mjs`: main-only registered action, native transition
  wrappers and deferred-render lifecycle.
- `scripts/ui/main-window.mjs`: registered-action frame metadata, serialized native
  toggle, real failure handling, icon/label/placement synchronization.
- `tests/interface-browser.cjs`: correct native action-registry simulation; native
  drag/restore geometry contract in the fixture, not in product code.
- `tests/main-window.test.mjs`: metadata versus action dispatch, native reuse,
  correct instance, rapid actions and native failure cases.
- `tests/main-window-browser.cjs`: real browser event dispatch, visible collapse,
  Restore/click/keyboard/title bar, drag, deferred updates, unsaved state/geometry/
  scroll, existing controls and close/reopen.
- `tests/sector-manager.test.mjs`: imports the updated helper into the existing VM
  fixture without bypassing main-class action registration.
- `module.json`, `README.md`, `docs/reference-and-minimize.md`, this guide: prepared
  0.1.64 version and corrected implementation/testing documentation.

Secondary windows, encounter references, Travel Events, Patrol/Wandering movement,
Campaign Log, sector data and portable JSON formats have no product-code changes.
No version tag or release is created by this PR.

## Manual Foundry v14 checklist — not performed here

1. Open the main Sector Manager, select a sector and non-Overview tab, edit text
   without saving, expand an entry and scroll the content/sidebar. Move and resize
   the window. Record its location and dimensions.
2. Click Minimize. Verify the actual native window collapses to its accessible title
   bar. Only one control should exist immediately left of the three-dot menu, now
   showing Restore with a restore icon, tooltip and accessible label.
3. Click Restore. Verify original geometry, unsaved values, dirty status, sector,
   tab and scroll positions, without a save/discard/close action. Repeat via keyboard
   and native title-bar double-click restoration.
4. Minimize, then advance the clock, update Patrol routes, refresh sector/Scene
   data and focus/bring the window forward. It must remain minimized until explicit
   Restore; pending ordinary content refreshes should apply afterward without losing
   unsaved edits. Check custom modules/themes that trigger main render calls.
5. Drag the minimized title bar and restore. Check native placement/remembered size
   and that ordinary dragging/resizing still work after restoration.
6. Repeatedly click during native animation; verify no double transition, duplicate
   controls or damaged geometry. Verify existing three-dot and close controls.
7. Close with unsaved edits while minimized: Cancel must retain the instance; an
   explicit Discard may close it. Reopen and confirm one working Minimize button.
8. Check secondary windows did not gain the module's control. Recheck the already
   fixed encounter reference button, ordinary sector edits and import/export.

Native v14 action dispatch, animations, core/theme CSS and inter-module refresh
behavior still require the backup-world checks. Temporary diagnostic logging was
not added to product code; only genuine native-transition failures are reported.

## Automated results

- **665/665 Node tests passed.** The frame/action tests now validate action metadata,
  correct native instance, rapid transitions, failures and duplicate prevention.
- **All 17 browser suites passed** with corrected action dispatch. The expanded main
  suite checks visible collapse, Restore button/keyboard/title bar, drag, exact
  dimensions, deferred clock/Patrol/sector render requests, unsaved values, sector/
  tab/scroll, close/reopen and existing controls. The focused lifecycle suite was
  rerun after the final no-op restore guard and passed.
- Before the fix, that corrected dispatcher made the existing minimize browser
  regression fail; the old fixture's direct metadata callback had hidden the bug.
- Main entry/all declared JavaScript syntax, release preparation for v0.1.64, ZIP
  integrity/root manifest/README/source-byte checks passed.
- actionlint 1.7.7 and `git diff --check` passed.
- Portable JSON validation: **28 valid and 10 invalid checks passed**. No data/schema
  migration or unrelated product behavior changed.

These are simulated native APIs in Node/Chromium. The live-world checklist remains
necessary; no live Foundry runtime was available.
