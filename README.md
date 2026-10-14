# MYZ Sector Manager v0.1.1

Foundry VTT v14 GM-only Journal-backed sector editor.

## Forge installation

1. Upload the repository files (`module.json`, `scripts/sector-manager.mjs`, `README.md`) to the root of your public GitHub repository.
2. Create a GitHub Release with tag **v0.1.1**.
3. Attach **myz-sector-manager-v0.1.1.zip** AND **module.json** from this package to that release.
4. In The Forge, install via manifest URL:
   `https://github.com/paddirn/myz-sector-manager/releases/latest/download/module.json`
5. Enable module in Foundry v14. Create a Script Macro: `await game.myzSectorManager.open();`

The ZIP has `module.json` at the archive root, as expected for release installation.

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
node --test tests/sector-manager.test.mjs
```

The Node tests use a simulated Foundry API to check sorting, escaping, document references, legacy data, and supply persistence. Live Foundry v14 validation is performed by the user in a backup world. Check long names and A2/A10 ordering, valid and wrong-type drops (including compendium entries), reference buttons, fractional supply quantities, collected checkboxes, and reopening saved sectors. Confirm old loot is intact and player access remains restricted.

Release automation has not yet been added. Version 0.1.1 is prepared in the source manifest only; no tag or release has been published.
