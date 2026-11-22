// $KYAULabs: roadmap.test.js kyau@aura.kyaulabs 2026/11/22 -0800 Exp $
import { beforeEach, expect, it, vi } from 'vitest';
import { API, SNAPSHOT, Roadmap } from '../../app.js';

const milestone = { number: 1, title: 'M4 — Controlled mission', description: 'Public objective.', state: 'open', open_issues: 3, closed_issues: 2 };
const response = (data, link = null, status = 200) => ({ ok: status === 200, status, json: async () => data, headers: { get: () => link } });
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });

it('loads real milestone counters independently of the other repository feeds', async () => {
  fetch.mockImplementation(async (input) => {
    const path = new URL(input).pathname;
    return response(path === '/repos/kyaulabs/ngen' ? SNAPSHOT.repo : path.endsWith('/milestones') ? [milestone] : []);
  });
  const data = await API.loadAll();
  expect(data.milestones).toEqual([{ number: 1, title: milestone.title, description: milestone.description, state: 'open', open: 3, closed: 2 }]);
});
it('follows complete milestone pagination rather than truncating at the first page', async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({ ...milestone, number: index + 1 }));
  fetch.mockResolvedValueOnce(response(first, '<https://api.github.com/repos/kyaulabs/ngen/milestones?state=all&per_page=100&page=2>; rel="next"'))
    .mockResolvedValueOnce(response([{ ...milestone, number: 101 }]));
  const rows = await API.fetchMilestones();
  expect(rows).toHaveLength(101);
  expect(rows.at(-1).number).toBe(101);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('reads actual public project columns and explicitly requests each card status', async () => {
  const columns = [{ id: 'todo', name: 'Todo' }, { id: 'doing', name: 'In Progress' }, { id: 'done', name: 'Done' }];
  fetch.mockImplementation(async (input) => {
    const url = new URL(input);
    if (url.pathname === '/repos/kyaulabs/ngen') return response(SNAPSHOT.repo);
    if (url.pathname.endsWith('/milestones')) return response([milestone]);
    if (url.pathname === '/orgs/kyaulabs/projectsV2/4') return response({ public: true });
    if (url.pathname.endsWith('/fields')) return response([{ id: 10, name: 'Status', data_type: 'single_select', options: columns.map((column) => ({ id: column.id, name: { raw: column.name } })) }]);
    if (url.pathname.endsWith('/items')) {
      expect(url.searchParams.get('fields')).toBe('10');
      expect(url.searchParams.get('q')).toBe('repo:kyaulabs/ngen');
      return response([{ id: 101, content_type: 'Issue', archived_at: null, fields: [{ id: 10, value: { id: 'doing' } }], content: { number: 12, title: 'Controlled objective', state: 'open', url: 'https://api.github.com/repos/kyaulabs/ngen/issues/12', milestone: { number: 1 } } }]);
    }
    return response([]);
  });
  const data = await API.loadAll();
  expect(data.project).toEqual({ columns, items: [{ id: 101, kind: 'issue', number: 12, title: 'Controlled objective', state: 'open', milestone: 1, status: 'doing' }] });
});
const columns = [{ id: 'todo', name: 'Todo' }, { id: 'doing', name: 'In Progress' }, { id: 'done', name: 'Done' }];
const fields = [{ id: 10, name: 'Status', data_type: 'single_select', options: columns.map((column) => ({ id: column.id, name: { raw: column.name } })) }];
const card = (id, status = 'todo', overrides = {}) => ({ id, content_type: 'Issue', fields: status === null ? [] : [{ id: 10, value: { id: status } }], content: { number: id, title: `Objective ${id}`, state: 'open', url: `https://api.github.com/repos/kyaulabs/ngen/issues/${id}`, milestone: { number: 1 } }, ...overrides });
function projectTransport(items = [card(1)], definitions = fields, isPublic = true) {
  fetch.mockImplementation(async (input) => {
    const path = new URL(input).pathname;
    return response(path.endsWith('/fields') ? definitions : path.endsWith('/items') ? items : { public: isPublic });
  });
}
const normalized = { number: 1, title: milestone.title, description: milestone.description, state: 'open', open: 1, closed: 1 };

it('follows opaque project cursors and caches page metadata separately from ordinary JSON', async () => {
  const path = '/orgs/kyaulabs/projectsV2/4/items?fields=10&q=repo%3Akyaulabs%2Fngen';
  fetch.mockResolvedValueOnce(response([card(1)], '<https://api.github.com/orgs/kyaulabs/projectsV2/4/items?fields=10&q=repo%3Akyaulabs%2Fngen&per_page=100&after=opaque-cursor>; rel="next"'))
    .mockResolvedValueOnce(response([card(2)]));
  expect(await API.fetchList(path)).toHaveLength(2);
  expect(await API.fetchList(path)).toHaveLength(2);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(new URL(fetch.mock.calls[1][0]).searchParams.get('after')).toBe('opaque-cursor');
});

it.each([
  'https://evil.example/milestones?state=all&per_page=100',
  'https://api.github.com/repos/elsewhere/private/milestones?state=all&per_page=100',
  'https://api.github.com/repos/kyaulabs/ngen/milestones?state=closed&per_page=100',
  'https://api.github.com/repos/kyaulabs/ngen/milestones?state=all&per_page=100&state=closed',
  'https://someone@api.github.com/repos/kyaulabs/ngen/milestones?state=all&per_page=100',
])('rejects pagination scope changes before requesting them: %s', async (url) => {
  fetch.mockResolvedValue(response([milestone], `<${url}>; rel="next"`));
  await expect(API.fetchMilestones()).rejects.toThrow('Unsafe pagination');
  expect(fetch).toHaveBeenCalledOnce();
});

it('rejects cycles and page-limit truncation instead of returning partial lists', async () => {
  fetch.mockResolvedValue(response([milestone], '<https://api.github.com/repos/kyaulabs/ngen/milestones?state=all&per_page=100>; rel="next"'));
  await expect(API.fetchMilestones()).rejects.toThrow('Cyclic pagination');
  sessionStorage.clear();
  fetch.mockImplementation(async (input) => {
    const url = new URL(input);
    url.searchParams.set('page', String(Number(url.searchParams.get('page') || '1') + 1));
    return response([milestone], `<${url}>; rel="next"`);
  });
  await expect(API.fetchMilestones()).rejects.toThrow('pagination limit');
});

it.each([null, {}, Array(101).fill(milestone)])('rejects malformed list pages: %j', async (data) => {
  fetch.mockResolvedValue(response(data));
  await expect(API.fetchMilestones()).rejects.toThrow('Invalid list page');
});

it.each([null, { ...milestone, number: 0 }, { ...milestone, state: 'invented' }, { ...milestone, closed_issues: -1 }])('rejects invalid milestone metadata: %j', async (row) => {
  fetch.mockResolvedValue(response([row]));
  await expect(API.fetchMilestones()).rejects.toThrow('Invalid milestone');
});

it('does not request fields or cards from a non-public project', async () => {
  projectTransport([], fields, false);
  await expect(API.fetchProject()).rejects.toThrow('Public project unavailable');
  expect(fetch).toHaveBeenCalledOnce();
});

it.each([[], [{ ...fields[0], options: null }], [{ ...fields[0], options: [{ id: 1, name: { raw: 'Todo' } }] }], [{ ...fields[0], options: [fields[0].options[0], fields[0].options[0]] }]].map((definitions) => [definitions]))('refuses missing or malformed project status definitions: %j', async (definitions) => {
  projectTransport([], definitions);
  await expect(API.fetchProject()).rejects.toThrow(/status/);
});

it('keeps actual board state separate from issue state and excludes archived/foreign cards', async () => {
  const closed = card(1, 'doing'); closed.content.state = 'closed';
  const unknown = card(2, 'new-option');
  const unassigned = card(3, null); unassigned.content.milestone = null;
  const foreign = card(4); foreign.content.url = 'https://api.github.com/repos/elsewhere/repo/issues/4';
  projectTransport([closed, unknown, unassigned, card(5, 'todo', { archived_at: '2026-11-01' }), foreign]);
  const data = await API.fetchProject();
  expect(data.items).toHaveLength(3);
  expect(data.items[0]).toMatchObject({ state: 'closed', status: 'doing' });
  expect(data.items[1].status).toBe('new-option');
  expect(data.items[2]).toMatchObject({ milestone: null, status: null });
});

it('refuses malformed or duplicated active NGEN project items', async () => {
  const invalid = card(1); invalid.content.state = 'invented';
  projectTransport([invalid]);
  await expect(API.fetchProject()).rejects.toThrow('Invalid project item');
  sessionStorage.clear(); projectTransport([card(1), card(1)]);
  await expect(API.fetchProject()).rejects.toThrow('Duplicate project item');
});

it('normalizes issue and PR objectives without inventing records', async () => {
  fetch.mockResolvedValue(response([{ number: 1, title: 'Issue', state: 'open' }, { number: 2, title: 'Pull request', state: 'closed', pull_request: {} }]));
  expect(await API.fetchMilestoneItems(1)).toEqual([{ kind: 'issue', number: 1, title: 'Issue', state: 'open' }, { kind: 'pr', number: 2, title: 'Pull request', state: 'closed' }]);
  await expect(API.fetchMilestoneItems(0)).rejects.toThrow('Invalid milestone number');
  sessionStorage.clear(); fetch.mockResolvedValue(response([{}]));
  await expect(API.fetchMilestoneItems(1)).rejects.toThrow('Invalid milestone objective');
});

it('orders milestone steps by their title prefixes across pages, not by issue number or state', async () => {
  const rows = [['F', 76], ['E', 75], ['C', 74], ['B', 73], ['A', 72], ['D', 55]].map(([step, number]) => ({
    number, title: `C1-${step}: Objective ${step}`, state: 'ABC'.includes(step) ? 'closed' : 'open',
  }));
  fetch.mockResolvedValueOnce(response(rows.slice(0, 3), '<https://api.github.com/repos/kyaulabs/ngen/issues?state=all&milestone=11&per_page=100&page=2>; rel="next"'))
    .mockResolvedValueOnce(response(rows.slice(3)));
  const objectives = await API.fetchMilestoneItems(11);
  expect(objectives.map(({ number, state }) => [number, state])).toEqual([
    [72, 'closed'], [73, 'closed'], [74, 'closed'], [55, 'open'], [75, 'open'], [76, 'open'],
  ]);
});

it('distinguishes unavailable and genuinely empty roadmap feeds', () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  Roadmap.render({ milestones: null, project: null });
  expect(document.body.textContent).toContain('milestone feed unavailable');
  expect(document.querySelectorAll('progress')).toHaveLength(0);
  document.querySelector('#kanban-tab').click();
  expect(document.querySelector('#kanban-view').textContent).toContain('project board unavailable');
  Roadmap.render({ milestones: [], project: { columns, items: [] } });
  expect(document.body.textContent).toContain('no GitHub milestones published');
  expect(document.querySelectorAll('.kanban-column')).toHaveLength(3);
  expect(document.querySelectorAll('.kanban-card')).toHaveLength(0);
});

it('shows one expanded quest, initially C1, in the documented execution order without reordering Kanban', async () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  fetch.mockResolvedValue(response([{ number: 73, title: 'Standalone project workflow', state: 'closed' }]));
  const plan = ['C1', 'M4', 'C2', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12', 'M13'];
  const milestones = ['M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12', 'M13', 'C1', 'C2', 'Later']
    .map((code, index) => ({ ...normalized, number: index + 1, title: `${code} — Controlled mission` }));
  Roadmap.render({ milestones, project: { columns, items: [] } });
  expect([...document.querySelectorAll('.milestone-marker')].map((tab) => tab.getAttribute('aria-label').split(' — ')[0])).toEqual([...plan, '#13']);
  expect([...document.querySelectorAll('#roadmap-filter option')].slice(1).map((option) => option.textContent)).toEqual(milestones.map(({ title }) => title));
  expect(document.querySelectorAll('.milestone-card')).toHaveLength(1);
  expect(document.querySelector('.milestone-card h3').textContent).toContain('C1');
  expect(document.querySelector('.milestone-card details').open).toBe(true);
  await vi.waitFor(() => expect(document.querySelector('.milestone-items').textContent).toContain('Standalone project workflow'));
  expect(new URL(fetch.mock.calls[0][0]).searchParams.get('milestone')).toBe('11');
  expect(fetch).toHaveBeenCalledOnce();
});

it('replaces the quest when browsing without changing Current or accepting stale objectives', async () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  let finishCurrent;
  fetch.mockImplementation((url) => new URL(url).searchParams.get('milestone') === '11'
    ? new Promise((resolve) => { finishCurrent = resolve; })
    : Promise.resolve(response([{ number: 12, title: 'Define coordinate frames', state: 'open' }])));
  Roadmap.render({ milestones: [normalized, { ...normalized, number: 11, title: 'C1 — Creator SDK/toolchain' }], project: null });
  await vi.waitFor(() => expect(finishCurrent).toBeTypeOf('function'));
  document.querySelector('.milestone-card details').open = false;
  document.querySelector('#milestone-marker-1').click();
  expect(document.querySelectorAll('.milestone-card')).toHaveLength(1);
  expect(document.querySelector('.milestone-card').dataset.milestone).toBe('1');
  expect(document.querySelector('.milestone-card details').open).toBe(true);
  expect(document.querySelector('.roadmap-current').textContent).toBe('Current C1');
  expect(document.querySelector('#milestone-marker-11[aria-selected=false] .milestone-beacon').textContent.trim()).toBe('Current');
  expect(document.querySelector('#milestone-detail').getAttribute('aria-labelledby')).toBe('milestone-marker-1');
  finishCurrent(response([{ number: 73, title: 'Stale creator objective', state: 'open' }]));
  await vi.waitFor(() => expect(document.querySelector('.milestone-items').textContent).toContain('Define coordinate frames'));
  expect(document.body.textContent).not.toContain('Stale creator objective');
  const details = document.querySelector('.milestone-card details');
  details.open = false;
  document.querySelector('#milestone-marker-1').click();
  expect(details.open).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not mark an unlisted or closed C1 as Current', () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  Roadmap.render({ milestones: [normalized], project: null });
  expect(document.querySelector('.roadmap-current, .milestone-beacon')).toBeNull();
  Roadmap.render({ milestones: [{ ...normalized, number: 11, title: 'C1 — Creator SDK/toolchain', state: 'closed' }], project: null });
  expect(document.querySelector('.roadmap-current, .milestone-beacon')).toBeNull();
  expect(document.querySelector('.milestone-card .tag').textContent).toBe('Closed');
});

it.each([
  [3, 'M6', [27, 132, 22, 131], [131, 22, 27, 132], [[131, '22a'], [132, '28a']]],
  [4, 'M7', [133, 33, 28], [28, 33, 133], [[133, '35a']]],
  [9, 'M12', [57, 134, 56], [56, 134, 57], [[134, '57a']]],
  [10, 'M13', [135, 66, 65], [65, 135, 66], [[135, '66a']]],
])('places the documented handoff gates within milestone #%d without adding rail entries', async (number, code, responseOrder, displayOrder, gates) => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  const objectives = { 22: 'A', 27: 'F', 28: 'A', 33: 'F', 56: 'A', 57: 'B', 65: 'E', 66: 'F' };
  fetch.mockResolvedValue(response(responseOrder.map((id) => ({
    number: id, state: id === 132 ? 'closed' : 'open',
    title: objectives[id] ? `${code}-${objectives[id]}: Engine objective` : `${code} handoff: <img src=x>`,
  }))));
  Roadmap.render({ milestones: [{ ...normalized, number, title: `${code} — Test milestone`, open: responseOrder.length }], project: null });
  const links = () => [...document.querySelectorAll('.milestone-item-list a')];
  await vi.waitFor(() => expect(links()).toHaveLength(responseOrder.length));
  expect(links().map((link) => Number(new URL(link.href).pathname.split('/').at(-1)))).toEqual(displayOrder);
  const handoffs = [...document.querySelectorAll('.milestone-handoff a')];
  expect(handoffs.map((link) => link.getAttribute('href'))).toEqual(gates.map(([id]) => `https://github.com/kyaulabs/ngen/issues/${id}`));
  expect(handoffs.map((link) => link.querySelector('.milestone-handoff-label').textContent)).toEqual(gates.map(([, step]) => `Handoff · ${step}`));
  expect(document.querySelectorAll('.milestone-marker')).toHaveLength(1);
  expect(document.querySelector('.milestone-card progress').max).toBe(responseOrder.length + 1);
  expect(document.querySelector('img')).toBeNull();
});

it('does not invent missing handoffs and keeps real handoffs visible without the preceding objective', async () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  fetch.mockResolvedValue(response([
    { number: 57, title: 'M12-B: Engine objective', state: 'open' },
    { number: 134, title: 'M12 handoff: Optional settlement', state: 'open' },
  ]));
  Roadmap.render({ milestones: [{ ...normalized, number: 9, title: 'M12 — Optional settlement' }], project: null });
  await vi.waitFor(() => expect(document.querySelector('.milestone-item-list a')?.href).toMatch(/\/issues\/134$/));
  expect(document.querySelectorAll('.milestone-handoff')).toHaveLength(1);
  fetch.mockResolvedValue(response([{ number: 22, title: 'M6-A: Engine objective', state: 'open' }]));
  Roadmap.render({ milestones: [{ ...normalized, number: 3, title: 'M6 — Multiplayer' }], project: null });
  await vi.waitFor(() => expect(document.querySelector('.milestone-item-list a')?.href).toMatch(/\/issues\/22$/));
  expect(document.querySelectorAll('.milestone-handoff')).toHaveLength(0);
});

it('renders escaped quests, honest zero-item progress and keyboard-operated views', () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  Roadmap.render({ milestones: [{ ...normalized, title: '<img src=x>', description: '<script>literal</script>', open: 0, closed: 0, state: 'closed' }], project: { columns: [], items: [] } });
  expect(document.querySelectorAll('img, script')).toHaveLength(0);
  expect(document.body.textContent).toContain('No tracked items');
  expect(document.body.textContent).not.toContain('100%');
});

it.each([
  ['M6 — Introduce multiplayer. Source: https://github.com/kyaulabs/ngen/blob/main/docs/planning/milestones.md', 'Introduce multiplayer.'],
  ['C1 - Deliver the SDK. Use M4-A.\nSource: https://github.com/kyaulabs/ngen/issues/11', 'Deliver the SDK. Use M4-A.'],
  ['M6-A is a prerequisite. Source: https://github.com/kyaulabs/ngen/issues/11 is discussed here.', 'M6-A is a prerequisite. Source: https://github.com/kyaulabs/ngen/issues/11 is discussed here.'],
  ['Source: https://github.com/kyaulabs/ngen/issues/11', null],
])('removes only display boilerplate from milestone descriptions: %s', (description, expected) => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  Roadmap.render({ milestones: [{ ...normalized, description }], project: null });
  expect(document.querySelector('.milestone-description')?.textContent ?? null).toBe(expected);
  expect(document.querySelector('.milestone-heading h3').textContent).toBe(normalized.title);
});

it('lists Kanban before Milestones but opens Milestones and applies keyboard shortcuts in visual order', () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  Roadmap.render({ milestones: [], project: { columns, items: [] } });
  const tabs = [...document.querySelectorAll('.roadmap-tabs [role=tab]')];
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Kanban', 'Milestones']);
  const [kanban, milestones] = tabs;
  expect(milestones.getAttribute('aria-selected')).toBe('true');
  expect(milestones.tabIndex).toBe(0);
  expect(kanban.tabIndex).toBe(-1);
  milestones.focus();
  const press = (key) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  press('Home');
  expect(document.activeElement).toBe(kanban);
  press('End');
  expect(document.activeElement).toBe(milestones);
  press('ArrowLeft');
  expect(document.activeElement).toBe(kanban);
  press('ArrowRight');
  expect(document.activeElement).toBe(milestones);
});

it('moves marker focus at keyboard and arrow endpoints without wrapping or tabbing to offscreen markers', () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  Roadmap.render({ milestones: [normalized, { ...normalized, number: 11, title: 'C1 — Creator SDK/toolchain' }], project: null });
  const first = document.querySelector('#milestone-marker-11');
  const last = document.querySelector('#milestone-marker-1');
  const previous = document.querySelector('.milestone-prev');
  const next = document.querySelector('.milestone-next');
  const press = (key) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  first.focus();
  press('ArrowLeft');
  expect(document.activeElement).toBe(first);
  press('End');
  expect(document.activeElement).toBe(last);
  expect([first.tabIndex, last.tabIndex]).toEqual([-1, 0]);
  expect(next.disabled).toBe(true);
  press('Tab');
  expect(last.getAttribute('aria-selected')).toBe('true');
  previous.focus(); previous.click();
  expect(document.activeElement).toBe(first);
  expect(previous.disabled).toBe(true);
  press('ArrowRight');
  expect(document.activeElement).toBe(last);
  press('Home');
  expect(document.activeElement).toBe(first);
});

it('does not map unknown or unassigned statuses to Todo, and filters actual milestone membership', () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  const items = [{ id: 1, kind: 'pr', number: 1, title: '<img src=x>', state: 'closed', milestone: 2, status: 'unknown' }, { id: 2, kind: 'issue', number: 2, title: 'Unassigned', state: 'open', milestone: null, status: null }];
  Roadmap.render({ milestones: [], project: { columns, items } });
  expect(document.querySelectorAll('.kanban-column')).toHaveLength(5);
  expect(document.body.textContent).toContain('No status');
  expect(document.body.textContent).toContain('Status unavailable');
  expect(document.querySelectorAll('img')).toHaveLength(0);
  expect(document.querySelectorAll('.kanban-card[href$="/pull/1"]')).toHaveLength(1);
  const filter = document.querySelector('select'); filter.value = 'none'; filter.dispatchEvent(new Event('change'));
  expect(document.querySelectorAll('.kanban-card')).toHaveLength(1);
  expect(document.querySelector('.kanban-card').textContent).toContain('Unassigned');
});

it('loads objective details once and allows a failed request to be retried', async () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  fetch.mockResolvedValueOnce(response(null, null, 503)).mockResolvedValueOnce(response([{ number: 12, title: '<script>literal</script>', state: 'open' }, { number: 13, title: 'Closed PR', state: 'closed', pull_request: {} }]));
  Roadmap.render({ milestones: [normalized], project: null });
  const details = document.querySelector('details');
  await vi.waitFor(() => expect(details.textContent).toContain('objectives unavailable'));
  details.open = false; await new Promise((resolve) => setTimeout(resolve, 0)); details.open = true;
  await vi.waitFor(() => expect(details.querySelectorAll('.milestone-item-list a')).toHaveLength(2));
  expect(details.querySelectorAll('script')).toHaveLength(0);
  expect(details.querySelectorAll('a')[1].href).toContain('/pull/13');
  await Roadmap.loadObjectives(details, normalized);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not claim empty objectives when known counters disagree or overwrite a newer render', async () => {
  document.body.innerHTML = '<div id="roadmap-content"></div>';
  fetch.mockResolvedValue(response([]));
  Roadmap.render({ milestones: [normalized], project: null });
  const details = document.querySelector('details');
  await vi.waitFor(() => expect(details.textContent).toContain('objectives unavailable'));
  let finish;
  sessionStorage.clear(); fetch.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const pending = Roadmap.loadObjectives(details, normalized);
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  Roadmap.render({ milestones: [], project: null });
  finish(response([{ number: 1, title: 'Stale objective', state: 'open' }]));
  await pending;
  expect(document.body.textContent).not.toContain('Stale objective');
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
