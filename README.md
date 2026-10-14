# MYZ Sector Manager v0.1.0

Foundry VTT v14 GM-only Journal-backed sector editor.

## Forge installation

1. Upload the repository files (`module.json`, `scripts/sector-manager.mjs`, `README.md`) to the root of your public GitHub repository.
2. Create a GitHub Release with tag **v0.1.0**.
3. Attach **myz-sector-manager-v0.1.0.zip** AND **module.json** from this package to that release.
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
