import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync('data/snapshot.json', 'utf8'));
const base = 'https://github.com/kyaulabs/ngen';
const releaseLogo = '<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kyaulabs/ngen/v0.1.0/brand/logos/png/ngen-wordmark-dark-640.png"><img src="https://raw.githubusercontent.com/kyaulabs/ngen/v0.1.0/brand/logos/png/ngen-wordmark-light-640.png" width="400" alt="NGEN"></picture></p>';
const branchHeads = Object.fromEntries(snapshot.branches.map((branch) => [branch.sha, {
  sha: branch.sha,
  author: { login: branch.name === 'main' ? 'kyau' : 'kyaulabs-bot', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  commit: { committer: { date: branch.name === 'main' ? '2026-11-02T04:27:04Z' : '2026-11-16T23:15:16Z' } },
}]));
const history = Array.from({ length: 163 }, (_, index) => ({
  sha: (index + 1).toString(16).padStart(40, '0'),
  commit: { committer: { date: new Date(Date.UTC(2026, 10, 2 + index % 16, 10)).toISOString() } },
}));
const issue = { number: 12, title: 'Review orbital navigation', state: 'open', html_url: `${base}/issues/12`, user: { login: 'kyau', html_url: 'https://github.com/kyau' }, labels: [{ name: 'feature', color: '63ddf8' }], created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-12T00:00:00Z', body: '## Summary\nControlled browser fixture.\n## Verification\n<script>window.injected = true</script>\n[javascript](javascript:alert(1))' };

export async function controlNetwork(page, offline = false, reviewState = 'dark') {
  const checksUnavailable = reviewState === 'checks-unavailable-dark';
  if (offline || checksUnavailable) await page.addInitScript(({ offline, checksUnavailable }) => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, options) => String(input).startsWith('https://api.github.com/')
      && (offline || (checksUnavailable && String(input).includes('/check-runs?')))
      ? Promise.reject(new TypeError('Controlled unavailable transport')) : fetch(input, options);
  }, { offline, checksUnavailable });
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
    if (url.pathname.endsWith('/participation')) data = { all: [...Array(49).fill(0), 1, 0, 0] };
    if (url.pathname.endsWith('/commits')) data = url.searchParams.has('sha')
      ? history.slice((Number(url.searchParams.get('page')) - 1) * 100, Number(url.searchParams.get('page')) * 100)
      : [{ sha: 'abcdef0123456789', html_url: `${base}/commit/abcdef0`, commit: { message: 'feat(engine): controlled test fixture', author: { date: '2026-11-12T00:00:00Z' } } }];
    if (url.pathname.startsWith('/repos/kyaulabs/ngen/commits/')) data = branchHeads[url.pathname.split('/').pop()] || [];
    if (url.pathname.endsWith('/check-runs')) {
      const main = url.pathname.includes(snapshot.branches.find((branch) => branch.name === 'main').sha);
      data = { total_count: main ? 14 : 4, check_runs: main
        ? Array.from({ length: 14 }, (_, index) => ({ status: 'completed', conclusion: index === 13 ? 'skipped' : 'success' }))
        : [{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'success' }, { status: 'in_progress', conclusion: null }, { status: 'queued', conclusion: null }] };
    }
    if (url.pathname.endsWith('/check-runs') && reviewState === 'checks-failed-dark') data = {
      total_count: 4, check_runs: ['success', 'success', 'success', 'failure'].map((conclusion) => ({ status: 'completed', conclusion })),
    };
    if (url.pathname.endsWith('/check-runs') && reviewState === 'checks-empty-dark') data = { total_count: 0, check_runs: [] };
    if (url.pathname.endsWith('/status')) data = { total_count: 0, statuses: [] };
    if (url.pathname.endsWith('/releases')) data = [{ tag_name: 'v0.1.0-fixture', name: 'Browser test fixture', body: `${releaseLogo}\n\n## Notes\nControlled release data for browser verification.`, published_at: '2026-11-12T00:00:00Z', html_url: `${base}/releases` }];
    if (url.pathname.endsWith('/issues')) data = [{ ...issue, state: url.searchParams.get('state') }];
    if (url.pathname.endsWith('/pulls')) data = [{ ...issue, number: 13, state: url.searchParams.get('state'), html_url: `${base}/pull/13`, head: { ref: 'feature' }, base: { ref: 'develop' } }];
    if (url.pathname === '/search/issues') data = { total_count: 1 };
    if (url.pathname === '/users/kyau') data = { login: 'kyau', name: 'Controlled profile', public_repos: 1, followers: 0 };
    return route.fulfill({ json: data });
  });
}
