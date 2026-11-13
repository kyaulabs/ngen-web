import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync('data/snapshot.json', 'utf8'));
const base = 'https://github.com/kyaulabs/ngen';
const issue = { number: 12, title: 'Review orbital navigation', state: 'open', html_url: `${base}/issues/12`, user: { login: 'kyau', html_url: 'https://github.com/kyau' }, labels: [{ name: 'feature', color: '63ddf8' }], created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-12T00:00:00Z', body: '## Summary\nControlled browser fixture.\n## Verification\n<script>window.injected = true</script>\n[javascript](javascript:alert(1))' };

export async function controlNetwork(page, offline = false) {
  if (offline) await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, options) => String(input).startsWith('https://api.github.com/')
      ? Promise.reject(new TypeError('Controlled offline transport')) : fetch(input, options);
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    // Keep all evidence local, including contributor avatars. No production data.
    if (url.hostname === 'avatars.githubusercontent.com') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#315362"/></svg>' });
    if (offline || url.hostname !== 'api.github.com') return route.fulfill({ status: 503, json: { message: 'Controlled offline fixture' } });
    let data = [];
    if (url.pathname === '/repos/kyaulabs/ngen') data = snapshot.repo;
    if (url.pathname.endsWith('/languages')) data = { 'C++': 180000, CMake: 18000, Python: 8000 };
    if (url.pathname.endsWith('/contributors')) data = snapshot.contributors;
    if (url.pathname.endsWith('/branches')) data = snapshot.branches.map((branch) => ({ ...branch, commit: { sha: branch.sha } }));
    if (url.pathname.endsWith('/participation')) data = { all: Array.from({ length: 52 }, (_, i) => i < 40 ? 0 : (i * 17) % 61) };
    if (url.pathname.endsWith('/commits')) data = [{ sha: 'abcdef0123456789', html_url: `${base}/commit/abcdef0`, commit: { message: 'feat(engine): controlled test fixture', author: { date: '2026-11-12T00:00:00Z' } } }];
    if (url.pathname.endsWith('/releases')) data = [{ tag_name: 'v0.1.0-fixture', name: 'Browser test fixture', body: '## Notes\nControlled release data for browser verification.', published_at: '2026-11-12T00:00:00Z', html_url: `${base}/releases` }];
    if (url.pathname.endsWith('/issues')) data = [{ ...issue, state: url.searchParams.get('state') }];
    if (url.pathname.endsWith('/pulls')) data = [{ ...issue, number: 13, state: url.searchParams.get('state'), html_url: `${base}/pull/13`, head: { ref: 'feature' }, base: { ref: 'develop' } }];
    if (url.pathname === '/search/issues') data = { total_count: 1 };
    if (url.pathname === '/users/kyau') data = { login: 'kyau', name: 'Controlled profile', public_repos: 1, followers: 0 };
    return route.fulfill({ json: data });
  });
}
