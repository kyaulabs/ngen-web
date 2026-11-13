// $KYAULabs: api.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API, CONFIG, SNAPSHOT } from '../../app.js';

beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });
const response = (data, status = 200, link = null) => ({ ok: status === 200, status, json: async () => data, text: async () => data, headers: { get: () => link } });

describe('API cache and transport', () => {
  it('handles fresh, missing, expired, corrupt and inaccessible caches', () => {
    expect(API._cacheGet('missing')).toBeNull();
    API._cacheSet('test', { n: 1 });
    expect(API._cacheGet('test')).toEqual({ n: 1 });
    sessionStorage.setItem(CONFIG.cacheKey + 'old', JSON.stringify({ t: 0, d: 1 }));
    expect(API._cacheGet('old')).toBeNull();
    sessionStorage.setItem(CONFIG.cacheKey + 'corrupt', '{');
    expect(API._cacheGet('corrupt')).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => API._cacheSet('full', 1)).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
    expect(API._cacheGet('test')).toBeNull();
  });
  it.each(['/languages', '/search/issues?q=test', '/users/kyau'])('fetches and caches %s', async (path) => {
    fetch.mockResolvedValue(response({ ok: true }));
    expect(await API.fetchJSON(path)).toEqual({ ok: true });
    expect(await API.fetchJSON(path)).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledOnce();
    const prefix = path.startsWith('/languages') ? '/repos/kyaulabs/ngen' : '';
    expect(fetch.mock.calls[0][0]).toBe(`https://api.github.com${prefix}${path}`);
  });
  it('preserves HTTP errors', async () => {
    fetch.mockResolvedValue(response(null, 429));
    await expect(API.fetchJSON('/languages')).rejects.toMatchObject({ status: 429 });
  });
});

describe('exact counts and normalization', () => {
  it('prefers search totals including zero', async () => {
    fetch.mockResolvedValue(response({ total_count: 0 }));
    expect(await API.fetchCount('issue', 'open')).toBe(0);
  });
  it('falls back to the Link header after a failed search', async () => {
    fetch.mockResolvedValueOnce(response(null, 403)).mockResolvedValueOnce(response([], 200, '<https://api.github.com/pulls?state=closed&page=83>; rel="last"'));
    expect(await API.fetchCount('pr', 'closed')).toBe(83);
  });
  it.each([[[], 0], [[{}], 1], [{}, null]])('falls back to list length for %j', async (data, expected) => {
    fetch.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(data));
    expect(await API.fetchCount('issue', 'closed')).toBe(expected);
  });
  it('returns null for failed fallback requests', async () => {
    fetch.mockResolvedValue(response(null, 500));
    expect(await API.fetchCount('pr', 'open')).toBeNull();
    fetch.mockRejectedValue(new Error('offline'));
    expect(await API.fetchCount('issue', 'open')).toBeNull();
  });
  it('normalizes missing and populated issue/PR metadata', () => {
    expect(API.normalizeRow({}, 'issue')).toMatchObject({ user: 'ghost', labels: [], merged: false, comments: null, body: '', head: '', base: '' });
    expect(API.normalizeRow({}, 'pr')).toMatchObject({ mergedAt: null, head: '', base: '', draft: false });
    const row = API.normalizeRow({ number: 1, labels: [{ name: 'bug' }, { name: 'fix', color: 'ffffff' }], user: { login: 'kyau', html_url: 'user', avatar_url: 'avatar' }, created_at: 'created', updated_at: 'updated', closed_at: 'closed', merged_at: 'merged', draft: true, comments: 0, milestone: { title: 'v1' }, assignees: [{ login: 'kyau' }], head: { ref: 'fix/test' }, base: { ref: 'develop' }, body: ' A\r\nB ' }, 'pr');
    expect(row).toMatchObject({ labels: [{ name: 'bug', color: '8b9bb4' }, { name: 'fix', color: 'ffffff' }], user: 'kyau', merged: true, draft: true, comments: 0, milestone: 'v1', assignees: ['kyau'], head: 'fix/test', base: 'develop', body: 'A\nB' });
    expect(API.normalizeRow({ created_at: 'date' }, 'issue').updatedAt).toBe('date');
  });
  it('normalizes merge titles and incomplete commits', () => {
    expect(API.normalizeCommit({})).toMatchObject({ sha: '', msg: 'commit' });
    expect(API.normalizeCommit({ sha: 'abcdef012345', commit: { message: 'Merge pull request #1\n\nfix: title', author: { date: 'date' } } })).toMatchObject({ sha: 'abcdef0', msg: 'fix: title', date: 'date' });
    expect(API.normalizeCommit({ commit: { message: 'ordinary', committer: { date: 'fallback' } } }).date).toBe('fallback');
    expect(API.normalizeCommit({ commit: { message: 'Merge branch test' } }).msg).toBe('Merge branch test');
  });
});

describe('data aggregation', () => {
  it('uses the verified snapshot without inventing records when offline', async () => {
    fetch.mockRejectedValue(new Error('offline'));
    const data = await API.loadAll();
    expect(data.mode).toBe('sim');
    expect(data.repo).toEqual(SNAPSHOT.repo);
    expect(data.days).toHaveLength(364);
    expect(data.counts).toEqual(SNAPSHOT.counts);
    expect(data.releasesSynthetic).toBe(true);
  });
  it('normalizes live responses, removes bots and release branches', async () => {
    vi.spyOn(API, 'fetchCount').mockResolvedValue(1);
    vi.spyOn(API, 'fetchJSON').mockImplementation(async (path) => {
      if (!path) return { full_name: 'kyaulabs/ngen', default_branch: 'develop' };
      if (path === '/languages') return { JavaScript: 1 };
      if (path.includes('contributors')) return [{ login: 'kyau', contributions: 1 }, { login: 'a[bot]' }, { login: 'bot', type: 'Bot' }, { login: 'kyaulabs-bot' }];
      if (path.includes('branches')) return [{ name: 'develop', protected: true, commit: { sha: 'abc' } }, { name: 'feature' }, { name: 'release/1.2.3' }];
      if (path.includes('releases')) return [{ tag_name: 'v1', name: 'First', published_at: 'date', body: ' notes\r\n ' }, { tag_name: 'v0', created_at: 'created' }];
      if (path.includes('participation')) return { all: Array(53).fill(1) };
      if (path.includes('commits')) return [{ sha: 'abcdef0' }, {}];
      if (path.includes('issues')) return [{ number: 1 }, { number: 2, pull_request: {} }];
      return [{ number: 3 }];
    });
    const data = await API.loadAll();
    expect(data.mode).toBe('live');
    expect(data.languages).toEqual({ JavaScript: 1 });
    expect(data.contributors.map((c) => c.login)).toEqual(['kyau', 'kyaulabs-bot']);
    expect(data.branches.map((b) => b.name)).toEqual(['develop', 'feature']);
    expect(data.branches[0].isDefault).toBe(true);
    expect(data.weekly).toHaveLength(52);
    expect(data.ticker).toHaveLength(1);
    expect(data.issues.open.map((r) => r.number)).toEqual([1]);
    expect(data.pulls.closed[0].number).toBe(3);
    expect(data.releases[1].name).toBe('v0');
    expect(data.releasesSynthetic).toBe(false);
  });
  it('trusts empty lists only when counters agree', async () => {
    vi.spyOn(API, 'fetchJSON').mockResolvedValue([]);
    vi.spyOn(API, 'fetchCount').mockResolvedValue(0);
    expect((await API.loadAll()).issues.open).toEqual([]);
    API.fetchCount.mockResolvedValue(3);
    expect((await API.loadAll()).issues.open).toEqual([]);
  });
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
