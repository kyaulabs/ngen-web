// $KYAULabs: activity.test.js kyau@aura.kyaulabs 2026/11/16 -0800 Exp $
import { beforeEach, expect, it, vi } from 'vitest';
import { Activity, API, SNAPSHOT, UI } from '../../app.js';

const now = Date.parse('2026-11-17T12:00:00Z');
const commit = (id, date = '2026-11-16T10:00:00Z') => ({
  sha: id.toString(16).padStart(40, '0'), commit: { committer: { date } },
});
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data, headers: { get: () => null } });
beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.stubGlobal('fetch', vi.fn());
});

it('counts unique commits by UTC committer day within the calendar window', () => {
  const late = commit(1, '2026-11-16T23:30:00-08:00');
  late.commit.author = { date: '2000-01-01T00:00:00Z' };
  const data = Activity.fromCommits([
    late, late, commit(2, '2026-11-17T03:00:00Z'), commit(3, '2026-11-16T23:59:59Z'),
    commit(4, '2025-11-22T23:59:59Z'), commit(5, '2025-11-23T00:00:00Z'), commit(6, '2026-11-18T00:00:00Z'),
  ]);
  expect(data.days).toHaveLength(364);
  expect(data.days.filter((day) => day.count).map((day) => [day.date.toISOString().slice(0, 10), day.count]))
    .toEqual([['2025-11-23', 1], ['2026-11-16', 1], ['2026-11-17', 2]]);
  expect(data.weekly[0]).toBe(1);
  expect(data.weekly.at(-1)).toBe(3);
  expect(data.days.filter((day) => day.future)).toHaveLength(4);
});

it.each([null, {}, { sha: 'bad', commit: { committer: { date: '2026-11-16' } } }, commit(1, 'invalid'), { sha: 'a'.repeat(40), commit: { author: { date: '2026-11-16' } } }])('rejects malformed history rather than dropping a commit: %j', (record) => {
    expect(() => Activity.fromCommits([record])).toThrow('Invalid commit history');
  });

it('completes an exact full-page boundary and reuses the session cache', async () => {
  fetch.mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, i) => commit(i + 1))))
    .mockResolvedValueOnce(response([]));
  const first = await API.fetchActivity(commit(1).sha);
  expect(first.weekly.reduce((sum, count) => sum + count, 0)).toBe(100);
  expect(await API.fetchActivity(commit(1).sha)).toEqual(first);
  expect(fetch).toHaveBeenCalledTimes(2);
  const query = new URL(fetch.mock.calls[0][0]).searchParams;
  expect(query.get('since')).toBe('2025-11-23T00:00:00.000Z');
  expect(query.get('until')).toBe('2026-11-18T00:00:00.000Z');
});

it('accepts genuinely empty history as zero rather than an unavailable feed', async () => {
  fetch.mockResolvedValue(response([]));
  const data = await API.fetchActivity(commit(1).sha);
  expect(data.weekly).toEqual(Array(52).fill(0));
  expect(data.days.every((day) => day.count === 0)).toBe(true);
});

it.each([null, {}, Array(101).fill(commit(1)), [commit(1, 'invalid')]])('rejects invalid history pages: %j', async (page) => {
    fetch.mockResolvedValue(response(page));
    await expect(API.fetchActivity(commit(1).sha)).rejects.toThrow(/Invalid commit history/);
  });

it('does not publish partial counts when a later history page fails', async () => {
  fetch.mockImplementation(async (input) => {
    const url = new URL(input);
    if (url.pathname === '/repos/kyaulabs/ngen') return response(SNAPSHOT.repo);
    if (url.pathname.endsWith('/branches')) return response([{ name: 'main', commit: { sha: commit(1).sha } }]);
    if (url.pathname.endsWith('/participation')) return response({ all: Array(52).fill(1) });
    if (url.pathname.endsWith('/commits')) {
      if (!url.searchParams.has('sha')) return response([commit(1)]);
      return url.searchParams.get('page') === '1'
        ? response(Array.from({ length: 100 }, (_, i) => commit(i + 1))) : response(null, 503);
    }
    return response([]);
  });
  const data = await API.loadAll();
  expect(data.mode).toBe('live');
  expect(data.activityAvailable).toBe(false);
  expect(data.missingFeeds).toContain('activity');
  expect(data.days.every((day) => day.count === 0)).toBe(true);
  document.body.innerHTML = '<span id="activity-total"></span><div id="kpi-grid"></div>';
  UI.renderActivityMeta(data);
  UI.renderKpis(data);
  expect(document.querySelector('#activity-total').textContent).toBe('—');
  expect(document.querySelector('.kpi-delta').textContent).toBe('this week unavailable');
});

it('bounds history requests without mistaking the page limit for a complete result', async () => {
  fetch.mockResolvedValue(response(Array.from({ length: 100 }, (_, i) => commit(i + 1))));
  await expect(API.fetchActivity(commit(1).sha)).rejects.toThrow('complete-history limit');
  expect(fetch).toHaveBeenCalledTimes(10);
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
