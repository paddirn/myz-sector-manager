import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function assertReleaseAbsent({repository, tag, token, request = fetch}) {
  const url = `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
  const response = await request(url, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}});
  if (response.status !== 404) throw new Error(response.ok ? 'Release already exists; refusing to overwrite it.' : `Release lookup failed: HTTP ${response.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await assertReleaseAbsent({repository: process.env.GITHUB_REPOSITORY, tag: process.env.RELEASE_TAG, token: process.env.GH_TOKEN});
}
