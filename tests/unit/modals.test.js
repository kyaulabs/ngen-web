// $KYAULabs: modals.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { FixtureSynth as Synth } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { API, ItemModal, ContribModal, STATE, Utils } from '../../app.js';

const key = (el, name) => el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
let listeners;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = readFileSync('index.html', 'utf8');
  Utils.reducedMotion = true;
  vi.spyOn(API, 'fetchJSON').mockRejectedValue(new Error('offline'));
  STATE.data = { contributors: [{ login: 'kyau', contributions: 10 }, { login: 'second' }] };
  listeners = [];
  const original = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((name, fn, options) => { listeners.push([name, fn]); original(name, fn, options); });
  ItemModal.init(); ContribModal.init();
});
afterEach(() => {
  ItemModal.close(); ContribModal.close();
  for (const [name, fn] of listeners) document.removeEventListener(name, fn);
  Utils.reducedMotion = true; vi.useRealTimers();
});

const open = (modal) => {
  if (modal === ItemModal) modal.open(Synth.trackerRows('issue', 'open', 1)[0], 'issue');
  else modal.open('kyau');
};

describe.each([['item', ItemModal], ['contributor', ContribModal]])('%s modal accessibility', (_name, modal) => {
  it('opens, focuses close, dismisses with Escape and restores origin focus', async () => {
    const origin = document.querySelector('#theme-toggle'); origin.focus();
    key(document, 'Escape'); open(modal); await Promise.resolve();
    vi.advanceTimersByTime(20);
    expect(modal.el.hidden).toBe(false);
    expect(modal.el.classList.contains('on')).toBe(true);
    expect(document.activeElement).toBe(modal.box.querySelector('.term-dot-close'));
    key(document, 'x'); expect(modal._open).toBe(true);
    key(document, 'Escape'); expect(modal.el.hidden).toBe(true);
    expect(document.activeElement).toBe(origin);
    modal.close();
  });
  it('dismisses via backdrop or close button, with transition delay when animated', () => {
    Utils.reducedMotion = false;
    open(modal); modal.box.click(); expect(modal._open).toBe(true);
    modal.el.click(); expect(modal._open).toBe(false);
    vi.advanceTimersByTime(300); expect(modal.el.hidden).toBe(true);
    open(modal); modal.box.querySelector('.term-dot-close').click();
    vi.advanceTimersByTime(300); expect(modal.el.hidden).toBe(true);
  });
});

describe.each([['item', ItemModal]])('%s documentation tabs', (_name, modal) => {
  it('supports click, wrapping arrow keys and unrelated key guards', async () => {
    open(modal); await Promise.resolve();
    const tabs = [...modal.box.querySelectorAll('.pkg-tab')];
    expect(tabs.length).toBeGreaterThan(1);
    key(modal.box, 'ArrowRight');
    tabs[0].focus(); key(tabs[0], 'ArrowLeft');
    expect(document.activeElement).toBe(tabs.at(-1));
    key(tabs.at(-1), 'ArrowRight'); expect(document.activeElement).toBe(tabs[0]);
    key(tabs[0], 'x'); tabs[1].click();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(modal.box.querySelector('.pkg-tabpanel.active').dataset.panel).toBe('1');
    modal._activateTab(document.createElement('button'));
    modal.box.innerHTML = '<p>No tabs</p>'; key(modal.box, 'ArrowLeft');
  });
});

describe('item fields', () => {
  it.each(['issue', 'pr'])('renders all populated %s metadata and escapes text', (kind) => {
    const rows = Synth.trackerRows(kind, 'closed', 3);
    for (const row of rows) {
      ItemModal.open({ ...row, title: '<script>bad</script>', avatar: 'https://example.com/avatar', milestone: 'v1', assignees: ['kyau'] }, kind);
      expect(ItemModal.box.querySelector('script')).toBeNull();
      expect(ItemModal.box.textContent).toContain('<script>bad</script>');
      expect(ItemModal.box.textContent).toContain('MILESTONE');
      expect(ItemModal.box.textContent).toContain('ASSIGNEES');
      ItemModal.close();
    }
  });
  it('renders draft state, incomplete branch refs and absent metadata', () => {
    const row = API.normalizeRow({}, 'pr');
    ItemModal.open(row, 'pr');
    expect(ItemModal.box.textContent).toContain('no description provided');
    ItemModal.open({ ...row, draft: true, head: 'feature' }, 'pr');
    expect(ItemModal.box.textContent).toContain('DRAFT');
    expect(ItemModal.box.querySelector('.item-refs').textContent).toContain('?');
    ItemModal.open({ ...row, base: 'main', body: 'plain' }, 'pr');
    expect(ItemModal.box.querySelector('.item-refs').textContent).toContain('?');
    expect(ItemModal.box.querySelector('.md-body').textContent).toBe('plain');
    expect(ItemModal._sections('intro\n## Architect\nNo architect conditions recorded.')).toHaveLength(1);
  });
});

describe('contributor hydration', () => {
  it('hydrates complete profiles and normalizes recent commits', async () => {
    API.fetchJSON.mockImplementation(async (path) => path.startsWith('/users') ? {
      name: 'Name', company: 'Company', location: 'Location', blog: 'example.com', bio: '<script>literal</script>', created_at: '2020-01-01', followers: 2, public_repos: 3,
    } : [{ sha: 'abcdef0123', html_url: 'https://example.com/commit', commit: { message: 'test', author: { date: '2026-01-01' } } }, {}]);
    STATE.data.issues = { open: [{ user: 'kyau' }], closed: [{ user: 'else' }] };
    ContribModal.open('kyau'); await ContribModal._fill('kyau', ContribModal._req);
    expect(ContribModal.box.querySelectorAll('.contrib-commit')).toHaveLength(1);
    expect(ContribModal.box.querySelector('[data-fill="bio"]').textContent).toBe('<script>literal</script>');
    expect(ContribModal.box.querySelectorAll('.contrib-profile .item-field')).toHaveLength(7);
    expect(ContribModal.box.querySelector('.contrib-profile a').href).toBe('https://example.com/');
    expect(ContribModal.box.textContent).toContain('lead maintainer');
  });
  it('handles unavailable, empty and partial profile responses', async () => {
    ContribModal.open('second'); await ContribModal._fill('second', ContribModal._req);
    expect(ContribModal.box.textContent).toContain('commit history unavailable');
    API.fetchJSON.mockResolvedValue({}); await ContribModal._fill('second', ContribModal._req);
    expect(ContribModal.box.querySelector('.contrib-profile')).toBeNull();
    API.fetchJSON.mockResolvedValue({ message: 'Not Found' }); await ContribModal._fill('second', ContribModal._req);
    API.fetchJSON.mockResolvedValue({ blog: 'https://example.com', bio: 'bio' });
    await ContribModal._fill('second', ContribModal._req);
    expect(ContribModal.box.querySelector('.contrib-profile a').href).toBe('https://example.com/');
    ContribModal.box.querySelector('[data-fill="commits"]').remove();
    ContribModal.box.querySelector('[data-fill="bio"]').remove();
    await ContribModal._fill('second', ContribModal._req);
    ContribModal.box.querySelector('[data-fill="profile"]').remove();
    await ContribModal._fill('second', ContribModal._req);
  });
  it('ignores unknown contributors, missing data and stale hydration', async () => {
    ContribModal.open('unknown'); expect(ContribModal._open).toBe(false);
    STATE.data = {}; ContribModal.open('kyau'); expect(ContribModal._open).toBe(false);
    STATE.data = null; ContribModal.open('kyau'); expect(ContribModal._open).toBe(false);
    STATE.data = { contributors: [{ login: 'kyau' }] };
    ContribModal.open('kyau');
    await ContribModal._fill('kyau', -1);
    ContribModal.close(); await ContribModal._fill('kyau', ContribModal._req);
    expect(ContribModal.el.hidden).toBe(true);
  });
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
