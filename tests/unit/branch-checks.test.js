// $KYAULabs: branch-checks.test.js kyau@aura.kyaulabs 2026/11/16 -0800 Exp $
import { beforeEach, expect, it, vi } from 'vitest';
import { API, SNAPSHOT, UI } from '../../app.js';

const sha = 'a'.repeat(40);
const done = (conclusion) => ({ status: 'completed', conclusion });
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });

it.each([
  ['success', [done('success'), done('neutral'), done('skipped')], ['success'], 4],
  ['pending', [done('success'), { status: 'in_progress', conclusion: null }, { status: 'queued' }], ['pending'], 1],
  ['failure', [done('failure'), { status: 'in_progress' }], ['success'], 1],
  ['failure', [done('timed_out'), done('action_required'), done('startup_failure')], ['error', 'failure'], 0],
  ['neutral', [done('cancelled'), done('stale')], [], 0],
  ['none', [], [], 0],
])('summarizes %s from check runs and legacy commit statuses', async (state, runs, statuses, passed) => {
  fetch.mockImplementation(async (url) => response(url.includes('/check-runs?')
    ? { total_count: runs.length, check_runs: runs }
    : { total_count: statuses.length, statuses: statuses.map((value) => ({ state: value })) }));
  expect(await API.fetchChecks(sha)).toEqual({ state, passed, total: runs.length + statuses.length });
  expect(fetch.mock.calls.every(([url]) => new URL(url).pathname.includes(`/commits/${sha}/`))).toBe(true);
});

it.each([
  [{ total_count: 101, check_runs: [done('success')] }, { total_count: 0, statuses: [] }],
  [{ total_count: 0, check_runs: [] }, { total_count: 2, statuses: [{ state: 'success' }] }],
  [{ check_runs: [] }, { total_count: 0, statuses: [] }],
  [{ total_count: 1, check_runs: [done('unknown')] }, { total_count: 0, statuses: [] }],
  [{ total_count: 1, check_runs: [{ status: 'unknown' }] }, { total_count: 0, statuses: [] }],
])('refuses to claim success for incomplete or unrecognized checks: %j', async (runs, statuses) => {
  fetch.mockImplementation(async (url) => response(url.includes('/check-runs?') ? runs : statuses));
  await expect(API.fetchChecks(sha)).rejects.toThrow(/checks/i);
});

it('keeps a failed checks endpoint unavailable rather than inferring success from legacy statuses', async () => {
  fetch.mockImplementation(async (url) => url.includes('/check-runs?')
    ? response(null, 403) : response({ total_count: 1, statuses: [{ state: 'success' }] }));
  await expect(API.fetchChecks(sha)).rejects.toMatchObject({ status: 403 });
});
it('loads the HEAD author and checks independently of a failed commit-detail request', async () => {
  const head = { sha, author: { login: 'kyau', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' }, commit: { committer: { date: '2026-11-02T12:00:00Z' } } };
  const other = 'b'.repeat(40);
  fetch.mockImplementation(async (input) => {
    const path = new URL(input).pathname;
    if (path === '/repos/kyaulabs/ngen') return response(SNAPSHOT.repo);
    if (path.endsWith('/branches')) return response([{ name: 'main', commit: { sha } }, { name: 'develop', commit: { sha: other } }]);
    if (path.endsWith('/commits')) return response([head]);
    if (path.endsWith('/check-runs')) return response({ total_count: 1, check_runs: [done(path.includes(other) ? 'failure' : 'success')] });
    if (path.endsWith('/status')) return response({ total_count: 0, statuses: [] });
    if (path.endsWith(`/commits/${other}`)) return response(null, 403);
    return response([]);
  });
  const data = await API.loadAll();
  expect(data.branches[0].author?.login).toBe('kyau');
  expect(data.branches[0].checks).toEqual({ state: 'success', passed: 1, total: 1 });
  expect(data.branches[1].checks).toEqual({ state: 'failure', passed: 0, total: 1 });
  expect(data.branches[1].committedAt).toBeUndefined();
  expect(data.branches[1].author).toBeUndefined();
});
it.each([
  ['success', 14, 14, 'checks passed'], ['pending', 2, 4, 'checks pending'],
  ['failure', 1, 4, 'checks failed'], ['neutral', 0, 1, 'cancelled or stale'],
  ['none', 0, 0, 'no checks'], ['unavailable', 0, 0, 'checks unavailable'],
])('renders accessible %s check details without relying on color alone', (state, passed, total, label) => {
  document.body.innerHTML = '<div id="branches-list"></div>';
  UI.renderBranches({ repo: SNAPSHOT.repo, branches: [{ name: 'main', sha, checks: state === 'unavailable' ? undefined : { state, passed, total } }] });
  const link = document.querySelector('.branch-checks');
  expect(link.textContent).toBe(total ? `${passed}/${total}` : '—');
  expect(link.getAttribute('aria-label')).toContain(label);
  expect(link.getAttribute('href')).toBe(`https://github.com/kyaulabs/ngen/commit/${sha}/checks`);
  expect(link.dataset.state).toBe(state);
});

it('keeps the compact avatar profile link usable when an avatar fails to load', () => {
  document.body.innerHTML = '<div id="branches-list"></div>';
  UI.renderBranches({ repo: SNAPSHOT.repo, branches: [{ name: 'main', sha, committedAt: '2026-11-16T10:00:00Z', author: { login: 'kyau', avatar_url: 'https://avatars.githubusercontent.com/u/1' } }] });
  document.querySelector('.branch-author img').dispatchEvent(new Event('error'));
  expect(document.querySelector('.branch-author').getAttribute('href')).toBe('https://github.com/kyau');
  expect(document.querySelector('.branch-avatar').textContent).toBe('KY');
  expect(document.querySelector('.branch-avatar').classList.contains('contrib-avatar-fallback')).toBe(true);
});

it('rejects unsafe avatar sources and escapes branch and status text', () => {
  document.body.innerHTML = '<div id="branches-list"></div>';
  const branch = { name: '"><img src=x onerror=alert(1)>', sha, committedAt: '2026-11-16T10:00:00Z', author: { login: 'kyau', avatar_url: 'https://evil.example/avatar' }, checks: { state: 'failure', passed: '<script>bad</script>', total: 4 } };
  UI.renderBranches({ repo: { html_url: 'javascript:alert(1)' }, branches: [branch] });
  expect(document.querySelectorAll('img, script')).toHaveLength(0);
  expect(document.querySelector('.branch-avatar').textContent).toBe('KY');
  expect(document.querySelector('.branch-checks').textContent).toContain('<script>bad</script>');
  expect(document.querySelector('.branch-tree').getAttribute('href')).toMatch(/^https:\/\/github.com\/kyaulabs\/ngen\/tree\//);
  UI.renderBranches({ repo: SNAPSHOT.repo, branches: [{ ...branch, sha: '', author: { login: '<img src=x>' }, checks: { state: '__proto__' } }] });
  expect(document.querySelectorAll('.branch-author, .branch-checks, img, script')).toHaveLength(0);
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
