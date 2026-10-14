import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export function validateManifest(manifest, tag, root) {
  assert.equal(manifest.id, 'myz-sector-manager', 'Module ID must remain unchanged');
  assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use an X.Y.Z version');
  assert.equal(tag, `v${manifest.version}`, 'Tag must match the manifest version');
  assert.equal(manifest.compatibility?.minimum, '14');
  assert.equal(manifest.compatibility?.verified, '14');
  assert.equal(typeof manifest.title, 'string');
  assert(manifest.title.trim(), 'Module title is required');
  const base = 'https://github.com/paddirn/myz-sector-manager/releases';
  const archive = `${manifest.id}-${tag}.zip`;
  assert.equal(manifest.manifest, `${base}/latest/download/module.json`);
  assert.equal(manifest.download, `${base}/download/${tag}/${archive}`);
  assert(Array.isArray(manifest.esmodules) && manifest.esmodules.length, 'ES modules are required');
  const files = [...new Set(['module.json', 'README.md', ...manifest.esmodules, ...(manifest.scripts ?? []), ...(manifest.styles ?? []), ...(manifest.languages ?? []).map(x => x.path), ...(manifest.packs ?? []).map(x => x.path)])];
  for (const file of files) {
    assert.equal(typeof file, 'string');
    assert(file && !path.isAbsolute(file) && !file.split(/[\\/]/).includes('..') && !file.startsWith('-'), `Unsafe module path: ${file}`);
    const resolved = fs.realpathSync(path.join(root, file));
    assert(resolved.startsWith(`${fs.realpathSync(root)}${path.sep}`), `File escapes module root: ${file}`);
    assert(fs.statSync(resolved).isFile() || fs.statSync(resolved).isDirectory(), `Missing module file: ${file}`);
  }
  return {archive, files};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  process.chdir(root);
  const manifest = JSON.parse(fs.readFileSync('module.json', 'utf8'));
  const {archive, files} = validateManifest(manifest, process.argv[2], root);
  for (const file of [...manifest.esmodules, ...(manifest.scripts ?? [])]) {
    const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'});
    assert.equal(result.status, 0, `JavaScript syntax check failed: ${file}`);
  }
  fs.mkdirSync('dist', {recursive: true});
  const output = path.join('dist', archive);
  assert(!fs.existsSync(output), `Refusing to overwrite ${output}; remove stale build output first`);
  const result = spawnSync('zip', ['-r', output, ...files], {stdio: 'inherit'});
  assert.equal(result.status, 0, 'ZIP creation failed');
  fs.copyFileSync('module.json', 'dist/module.json');
  console.log(`Prepared ${output} and dist/module.json`);
}
