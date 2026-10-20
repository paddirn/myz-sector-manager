# One-time cleanup of abandoned marker data

The wandering implementation is restored to the v0.1.27 baseline. It no longer creates Tiles, processes artwork, hides tokens, or reads marker tracking flags. Existing visible tokens stay visible and hidden tokens stay hidden. Manually reveal NPCs only when you intend to.

After installing the update, reload Foundry so the abandoned marker hooks are no longer loaded. No startup migration deletes world data. Existing module-generated Tiles remain ordinary Scene documents until the GM explicitly removes them. To clean them up, back up the world, view the intended Scene, create a **Script Macro**, paste the following code, and run it as a GM. Review the confirmation counts. Run once on each Scene that contains abandoned markers. Repeating it is safe.

This removes only Tiles with the exact known module marker ownership metadata (including temporary diagnostic Tiles), clears known version-1 marker flags on modifiable tokens in that Scene, and removes only `markers`, `grayscale`, and `autoHide` from the version-1 wandering world configuration. It preserves `wanderingEnabled`, all other settings/flags, token position/visibility, ordinary Tiles, and other Scenes. Unknown metadata/schema versions are left inert for manual review. Settings not encountered or flags the GM cannot modify can safely remain: the restored runtime never reads them.

<!-- legacy-marker-cleanup:start -->
```javascript
const ns = "myz-sector-manager";
const key = "lastKnownPosition";
if (!game.user.isGM) {
  ui.notifications.warn("Legacy cleanup requires a GM.");
  return;
}
const scene = canvas.scene;
if (!scene) throw new Error("View the Scene you want to clean first.");
const kinds = new Set(["wandering-last-known", "wandering-alignment-test"]);
const phases = new Set(["preparing", "moving", "active", "suppressed", "cleared", "armed"]);
const ownedTile = tile => {
  const flag = tile?.getFlag(ns, key);
  return flag?.version === 1 && kinds.has(flag.kind)
    && flag.sourceSceneId === scene.id
    && typeof flag.sourceTokenId === "string" && flag.sourceTokenId.length > 0;
};
const oldTokenState = token => {
  const flag = token?.getFlag(ns, key);
  return flag?.version === 1 && phases.has(flag.phase)
    && typeof flag.sourceSceneId === "string"
    && typeof flag.sourceTokenId === "string";
};
const obsoleteOptions = ["markers", "grayscale", "autoHide"];
const tiles = Array.from(scene.tiles.values()).filter(ownedTile);
const tokens = Array.from(scene.tokens.values()).filter(token =>
  token.canUserModify(game.user, "update") && oldTokenState(token));
const saved = game.settings.get(ns, "wanderingConfiguration");
const hasOptions = saved?.version === 1
  && obsoleteOptions.some(option => Object.hasOwn(saved, option));
if (!tiles.length && !tokens.length && !hasOptions) {
  ui.notifications.info("No known legacy marker data found on this Scene.");
  return {removed: 0, cleared: 0};
}
const confirmed = await foundry.applications.api.DialogV2.confirm({
  window: {title: "Remove Abandoned Marker Data"},
  content: `<p>Remove ${tiles.length} confirmed module marker Tiles and clear ${tokens.length} obsolete token flags on this Scene?</p><p>Known obsolete global marker options will also be removed if present. Tokens will not move or change visibility. Ordinary Tiles and other Scenes are untouched.</p>`
});
if (!confirmed) return {cancelled: true};
if (!game.user.isGM || canvas.scene?.id !== scene.id)
  throw new Error("GM access or viewed Scene changed. Run cleanup again.");
// Revalidate ownership after confirmation; never trust a stale Tile reference.
const ids = tiles.filter(tile => ownedTile(scene.tiles.get(tile.id))).map(tile => tile.id);
const removed = ids.length ? await scene.deleteEmbeddedDocuments("Tile", ids) : [];
let cleared = 0;
const errors = [];
for (const token of tokens) {
  if (!scene.tokens.has(token.id) || !oldTokenState(token)) continue;
  try {
    if (!game.user.isGM || !token.canUserModify(game.user, "update"))
      throw new Error("Token update permission unavailable");
    await token.unsetFlag(ns, key);
    cleared++;
  } catch (error) { errors.push(`Token ${token.id}: ${error.message}`); }
}
try {
  const latest = game.settings.get(ns, "wanderingConfiguration");
  if (latest?.version === 1 && obsoleteOptions.some(option => Object.hasOwn(latest, option))) {
    const clean = {...latest};
    for (const option of obsoleteOptions) delete clean[option];
    await game.settings.set(ns, "wanderingConfiguration", clean);
  }
} catch (error) { errors.push(`Wandering settings: ${error.message}`); }
ui.notifications.info(`${removed.length} legacy marker Tiles removed; ${cleared} token flags cleared. Token positions and visibility unchanged.`);
if (errors.length) {
  console.error("MYZ legacy marker cleanup", errors);
  ui.notifications.warn(`${errors.length} cleanup steps need review in the console. Rerun after correcting permissions.`);
}
return {removed: removed.length, cleared, errors};
```
<!-- legacy-marker-cleanup:end -->

Afterward, delete the temporary Script Macro if you no longer need it. A token hidden by the abandoned feature is not automatically revealed: use Foundry's normal visibility control for NPCs you intend players to see. Existing legacy flags in unvisited Scenes and unknown schema versions remain harmless until reviewed. The old experimental PR is closed; no diagnostic or marker subsystem is bundled in the restored runtime.
