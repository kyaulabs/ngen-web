import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync('data/snapshot.json', 'utf8'));
const base = 'https://github.com/kyaulabs/ngen';
const releaseLogo = '<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kyaulabs/ngen/v0.1.0/brand/logos/png/ngen-wordmark-dark-640.png"><img src="https://raw.githubusercontent.com/kyaulabs/ngen/v0.1.0/brand/logos/png/ngen-wordmark-light-640.png" width="400" alt="NGEN"></picture></p>';
export const releaseCode = '  printf "%s\\n" "<NGEN>"\n\nsha256sum -c ngen-source.tar.gz.sha256  ';
const releaseNotes = `## Notes\nControlled release data for browser verification.\n\n## Downloads\n\n| File | Purpose |\n|---|---|\n| \`ngen-source.tar.gz\` | Source |\n| \`ngen-source.tar.gz.sha256\` | Checksum |\n\n## Get started\n\n\`\`\`sh\n${releaseCode}\n\`\`\`\n\n\`\`\`sh\nngen --help\n\`\`\`\n\n## 📜 Changelog\n### Fixes\nKeep full history in the popup.\n\n- [Controlled changeset](${base}/commit/abcdef0)\n\n<script>window.injected = true</script>`;
const branchHeads = Object.fromEntries(snapshot.branches.map((branch) => [branch.sha, {
  sha: branch.sha,
  author: { login: branch.name === 'main' ? 'kyau' : 'kyaulabs-bot', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  commit: { committer: { date: branch.name === 'main' ? '2026-11-02T04:27:04Z' : '2026-11-16T23:15:16Z' } },
}]));
const history = Array.from({ length: 163 }, (_, index) => ({
  sha: (index + 1).toString(16).padStart(40, '0'),
  commit: { committer: { date: new Date(Date.UTC(2026, 10, 2 + index % 16, 10)).toISOString() } },
}));
const milestones = [
  { number: 1, title: 'M4 — Coordinates/travel/streaming', description: 'Canonical coordinates, origin transfer, warp travel and connected-system streaming.', state: 'open', open_issues: 1, closed_issues: 1 },
  { number: 3, title: 'M6 — Authoritative multiplayer', description: 'M6 — Introduce authoritative multiplayer. Source: https://github.com/kyaulabs/ngen/blob/main/docs/planning/milestones.md', state: 'open', open_issues: 3, closed_issues: 1 },
  ...[[2, 'M5 — Miniature offline universe'], [4, 'M7 — Persistence/economy'], [5, 'M8 — Security law/sovereignty'], [6, 'M9 — Fleet scale/time dilation'], [7, 'M10 — Fenced regional transfer'], [8, 'M11 — Optional graphics'], [9, 'M12 — Optional settlement'], [10, 'M13 — Production hardening/release'], [12, 'C2 — Local creator MCP']]
    .map(([number, title]) => ({ number, title, state: 'open', open_issues: 0, closed_issues: 0 })),
  { number: 11, title: 'C1 — Creator SDK/toolchain', description: 'A reusable engine boundary, standalone projects, scene authoring and an independent creator workflow.', state: 'open', open_issues: 1, closed_issues: 1 },
];
const issue = { number: 12, title: 'Review orbital navigation', state: 'open', html_url: `${base}/issues/12`, user: { login: 'kyau', html_url: 'https://github.com/kyau' }, labels: [{ name: 'feature', color: '63ddf8' }], created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-12T00:00:00Z', body: '## Summary\nControlled browser fixture.\n## Verification\n<script>window.injected = true</script>\n[javascript](javascript:alert(1))' };

export async function controlNetwork(page, offline = false, reviewState = 'dark') {
  const checksUnavailable = reviewState === 'checks-unavailable-dark';
  const roadmapUnavailable = reviewState === 'roadmap-unavailable-dark';
  if (offline || checksUnavailable || roadmapUnavailable) await page.addInitScript(({ offline, checksUnavailable, roadmapUnavailable }) => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, options) => String(input).startsWith('https://api.github.com/')
      && (offline || (checksUnavailable && String(input).includes('/check-runs?'))
        || (roadmapUnavailable && /\/(?:milestones|orgs\/kyaulabs\/projectsV2)(?:\/|\?)/.test(String(input))))
      ? Promise.reject(new TypeError('Controlled unavailable transport')) : fetch(input, options);
  }, { offline, checksUnavailable, roadmapUnavailable });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    // Keep all evidence local, including contributor avatars. No production data.
    if (url.hostname === 'avatars.githubusercontent.com') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#315362"/></svg>' });
    if (offline || url.hostname !== 'api.github.com') return route.fulfill({ status: 503, json: { message: 'Controlled offline fixture' } });
    let data = [];
    if (url.pathname === '/repos/kyaulabs/ngen') data = snapshot.repo;
    if (url.pathname.endsWith('/milestones')) data = milestones;
    if (url.pathname === '/orgs/kyaulabs/projectsV2/4') data = { public: true };
    if (url.pathname === '/orgs/kyaulabs/projectsV2/4/fields') data = [{ id: 10, name: 'Status', data_type: 'single_select', options: [{ id: 'todo', name: { raw: 'Todo' } }, { id: 'doing', name: { raw: 'In Progress' } }, { id: 'done', name: { raw: 'Done' } }] }];
    if (url.pathname === '/orgs/kyaulabs/projectsV2/4/items') data = [
      { number: 12, title: 'M4-B: Define coordinate frames', state: 'open', status: 'todo', milestone: 1 },
      { number: 55, title: 'C1-D: Build creator workflow', state: 'open', status: 'doing', milestone: 11 },
      { number: 14, title: 'M4-D: Verify trajectory bounds', state: 'closed', status: 'done', milestone: 1 },
    ].map((row) => ({ id: row.number, content_type: 'Issue', fields: [{ id: 10, value: { id: row.status } }], content: { number: row.number, title: row.title, state: row.state, url: `https://api.github.com/repos/kyaulabs/ngen/issues/${row.number}`, milestone: { number: row.milestone } } }));
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
    if (url.pathname.endsWith('/releases')) data = [{ tag_name: 'v0.1.0-fixture', name: 'NGEN v0.1.0', body: `${releaseLogo}\n\n${releaseNotes}`, published_at: '2026-11-12T00:00:00Z', html_url: `${base}/releases`, assets: ['ngen-source.tar.gz', 'ngen-source.tar.gz.sha256'].map((name) => ({ name, browser_download_url: `${base}/releases/download/v0.1.0-fixture/${name}` })) }];
    if (url.pathname.endsWith('/issues')) data = [{ ...issue, state: url.searchParams.get('state') }];
    if (url.pathname.endsWith('/issues') && url.searchParams.has('milestone')) data = url.searchParams.get('milestone') === '1'
      ? [{ ...issue, number: 14, title: 'M4-D: Verify trajectory bounds', state: 'closed' }, { ...issue, title: 'M4-B: Define coordinate frames', state: 'open' }]
      : url.searchParams.get('milestone') === '11'
        ? [{ ...issue, number: 55, title: 'C1-D: Build creator workflow', state: 'open' }, { ...issue, number: 73, title: 'C1-B: Create a standalone project workflow', state: 'closed' }]
        : url.searchParams.get('milestone') === '3' ? [
          { number: 132, title: 'Adopt authoritative multiplayer in the Space MMO', state: 'open' },
          { number: 27, title: 'M6-F: Verify the multiplayer test scenario', state: 'open' },
          { number: 22, title: 'M6-A: Assemble the headless server', state: 'closed' },
          { number: 131, title: 'Start runnable Space MMO development in its own repo', state: 'open' },
        ] : [];
    if (url.pathname.endsWith('/pulls')) data = [{ ...issue, number: 13, state: url.searchParams.get('state'), html_url: `${base}/pull/13`, head: { ref: 'feature' }, base: { ref: 'develop' } }];
    if (reviewState === 'roadmap-empty-dark' && (url.pathname.endsWith('/milestones') || url.pathname === '/orgs/kyaulabs/projectsV2/4/items')) data = [];
    if (url.pathname === '/search/issues') data = { total_count: 1 };
    if (url.pathname === '/users/kyau') data = { login: 'kyau', name: 'Controlled profile', public_repos: 1, followers: 0 };
    return route.fulfill({ json: data });
  });
}
