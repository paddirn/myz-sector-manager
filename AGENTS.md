# MYZ Sector Manager development

- Use the existing checkout; cloud tasks are isolated. Do not create worktrees unless requested.
- Target Foundry VTT v14 and the official Mutant: Year Zero system. Preserve module ID `myz-sector-manager`, public APIs, and GM-only access.
- Preserve existing Journal Entry sector records in `flags.myz-sector-manager.sector`. New fields need backward-compatible defaults; never discard existing records or loot. Keep the record schema version compatible unless an explicit migration is requested.
- Preserve interface behavior unless the task requests changes. Avoid unrelated redesigns and refactors.
- Use feature branches and pull requests targeting `main`. Do not modify main directly. Do not push version tags or publish releases without explicit user authorization.
- No paid services or runtime package dependencies are required. Preserve TLS and artifact verification.
- Before review/release run `node --check scripts/sector-manager.mjs`, `node --test tests/*.test.mjs`, and `node scripts/prepare-release.mjs vX.Y.Z` using the manifest version. Check the ZIP with `unzip -t` and verify module.json is at its root. Packaging refuses to overwrite existing output; inspect and remove only generated stale output before rebuilding.
- Local tests simulate Foundry APIs. The user performs live Foundry v14 testing in a backup world; do not claim live compatibility was tested here. Supply relevant manual checks, especially persistence, older records, and GM access.
- Keep module version, tag `vX.Y.Z`, archive `myz-sector-manager-vX.Y.Z.zip`, and version-specific download URL aligned. Keep the stable manifest URL in README.md and module.json unchanged.
- Release packaging includes README.md and files declared in module.json (including pack directories). If new assets are referenced indirectly, add them explicitly to the package script and test archive contents.
- Release automation must fail on an existing release, tag/version mismatch, missing files, invalid manifest, syntax errors, or failing tests. Never add automatic clobbering, release deletion, or tag replacement. Document release failures honestly; recover partial releases only with explicit authorization.
