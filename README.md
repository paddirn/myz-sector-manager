# MYZ Sector Manager v0.1.1

Foundry VTT v14 GM-only Journal-backed sector editor.

## Forge installation

1. In The Forge / Foundry Setup, install the module using this manifest URL:
   `https://github.com/paddirn/myz-sector-manager/releases/latest/download/module.json`
2. Enable the module in a Foundry v14 test world.
3. Create a Script Macro: `await game.myzSectorManager.open();`

The manifest works after the first automated release completes. For later releases, use Foundry's module Update control; no manual ZIP upload is needed. If an older installation uses a raw GitHub manifest URL, reinstall it using the stable URL above. Back up the world first.

## Features
- GM-only Journal Entry sector records, searchable selector, tabbed editor.
- Overview, Locations, Encounters, Loot, Effects (weather/phenomena/special effects), Secrets, History.
- Data stored in `flags.myz-sector-manager.sector`.
- API: `game.myzSectorManager.open(journalId)` and `game.myzSectorManager.getSector(journalId)`.

## Caveats
Prototype not yet tested in a live Foundry v14 world. Back up your world first.
Native Journal windows do not automatically use the Sector Sheet. No automatic map pins, import, or player view yet.

## Version 0.1.1

- Sidebar entries expand for long names, show bold coordinates first, then exploration status and sector name, and sort naturally by coordinates (A2 before A10). Entries without coordinates follow those with coordinates and sort by name.
- Drop a Scene into a Locations reference, an Actor into an Encounters reference, or an Item into a Loot reference. World and compendium document UUIDs are resolved through Foundry. Use **Open Reference** to open the document sheet or view the referenced scene without activating it for other players. Manual UUID entry remains available, including in Secrets and History.
- Loot includes decimal quantities and collected checkboxes for Clean Grub, Rot Grub, Clean Water, Rot Water, Bullets, and Booze. Checkboxes track collection only; they do not reduce quantities or transfer supplies to actors. Save Sector to persist changes.
- Existing loot entries and other sector fields are retained. Older records receive zeroed supply counters when opened, persisted on the next save.

## Development checks

Requires Node.js; no package installation is needed:

```sh
node --check scripts/sector-manager.mjs
node --test tests/*.test.mjs
```

The Node tests use a simulated Foundry API to check sorting, escaping, document references, legacy data, and supply persistence. Live Foundry v14 validation is performed by the user in a backup world. Check long names and A2/A10 ordering, valid and wrong-type drops (including compendium entries), reference buttons, fractional supply quantities, collected checkboxes, and reopening saved sectors. Confirm old loot is intact and player access remains restricted.

## Publish a release (no manual ZIPs)

### One-time setup

1. Open the release-automation pull request on GitHub, review it, then click **Merge pull request** and confirm. This adds automation; merging alone does not publish anything.
2. Open **Settings → Actions → General**. Ensure GitHub Actions is enabled and GitHub-authored actions are allowed. This workflow uses `actions/checkout` and `actions/setup-node`.
3. The release job explicitly requests only `contents: write`. You normally do not need to change the repository-wide default workflow permission from read-only. If an organization policy blocks write permissions, an administrator must permit this workflow to write repository contents. No personal access token or paid service is needed: GitHub supplies the workflow token automatically.

### First release: v0.1.1

1. Make sure the feature changes and this automation pull request are merged into **main**. The current `module.json` already declares `0.1.1`, its stable manifest URL, and the matching ZIP download URL.
2. Test in your backup Foundry v14 world before publishing. Local tests cannot verify the live Foundry interface.
3. Ask Codex: **“Verify main contains the release automation and module version 0.1.1, run the checks, then create and push tag v0.1.1 at that main commit. Do not manually create a release; let GitHub Actions do it.”** This is a separate publishing authorization. Do not draft or publish a release through GitHub's Releases form first.
4. Open the repository's **Actions** tab and select **Release Module**. Wait for a green checkmark.
5. Open **Releases**. The `v0.1.1` release should contain **module.json** and **myz-sector-manager-v0.1.1.zip**. GitHub's additional source-code archives are not the installable module ZIP.
6. In The Forge / Foundry Setup, install or update through the stable manifest URL above. Test in your backup world and check that old sectors and loot remain intact.

If you prefer to push the tag yourself from a local clone with the merged main checked out:

```sh
git switch main
git pull --ff-only origin main
# Verify module.json says 0.1.1 and the automation is present first.
git tag v0.1.1
git push origin v0.1.1
```

### Every later release

1. Ask Codex to implement the changes on a feature branch, update `module.json` to the next version (for example `0.1.2`), set its `download` URL to `https://github.com/paddirn/myz-sector-manager/releases/download/v0.1.2/myz-sector-manager-v0.1.2.zip`, update version-specific documentation, run checks, and create a pull request. Keep `id` and the stable `manifest` URL unchanged.
2. Review and merge the pull request. Test the changes in your backup world.
3. Authorize Codex to push the matching version tag at the tested main commit, as above. Publish versions in increasing order: the workflow marks the new release as latest.
4. Watch Actions, check both release assets, then use Foundry's Update control.

### What the workflow checks

Only pushed tags matching `v*.*.*` trigger publication. The validator further requires an exact numeric `vX.Y.Z` tag matching `module.json`, the unchanged module ID and v14 compatibility, correct manifest/download URLs, present declared files, and valid JavaScript. All Node tests must pass. The ZIP contains `module.json` at its root, README.md, and the runtime files declared by the manifest. Development tests and release tooling are excluded. There is no build or dependency installation step.

For a local package check, run from the repository root (replace the tag with the actual manifest version):

```sh
node scripts/prepare-release.mjs v0.1.1
unzip -t dist/myz-sector-manager-v0.1.1.zip
unzip -p dist/myz-sector-manager-v0.1.1.zip module.json | cmp - module.json
```

`dist/` is ignored by Git. Packaging refuses to overwrite an existing ZIP: inspect and remove only the generated output before rebuilding.

### If something fails

Open the failed Actions run and read the first failing step, or send its log to Codex. A tag/version mismatch or missing file must be fixed in a new reviewed commit before publishing a new version. Do not move an existing release tag.

A repeated run for an existing release stops without changing that release or its assets. Concurrent runs for the same tag are serialized. If publishing creates a release but an upload fails, it may leave a partial release: inspect it before taking any action. The workflow never deletes releases or overwrites assets automatically. Ask for help recovering it, or publish a corrected new version. No release has been published by merely adding this workflow.
