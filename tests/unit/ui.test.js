// $KYAULabs: ui.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { FixtureSynth as Synth } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { API, UI, ItemModal, ContribModal, Reveal, Theme, Charts, STATE, Utils, boot } from '../../app.js';

let data;
let listeners;
const key = (el, name) => el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
beforeEach(async () => {
  document.body.innerHTML = readFileSync('index.html', 'utf8');
  Utils.reducedMotion = true;
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  data = { ...await API.loadAll(), ticker: Synth.tickerCommits(), releases: Synth.releases() };
  STATE.data = data;
  UI._tracker = {};
  Theme._listeners = [];
  listeners = [];
  for (const target of [window, document]) {
    const original = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((name, fn, options) => {
      listeners.push([target, name, fn]); original(name, fn, options);
    });
  }
  ItemModal.init(); ContribModal.init();
});
afterEach(() => {
  ItemModal.close(); ContribModal.close();
  for (const [target, name, fn] of listeners) target.removeEventListener(name, fn);
  Utils.reducedMotion = true;
  vi.useRealTimers();
});

describe('dashboard renderers', () => {
  it('renders all sections, links, counters and live/sim badges', () => {
    UI.renderAll(data); UI.renderHud();
    expect(document.querySelectorAll('#hero-chips a')).toHaveLength(6);
    expect(document.querySelectorAll('.kpi-value')).toHaveLength(6);
    expect(document.querySelectorAll('.ticker-item')).toHaveLength(data.ticker.length * 2);
    expect(document.querySelectorAll('.branch-card')).toHaveLength(data.branches.length);
    expect(document.querySelectorAll('.contrib-card')).toHaveLength(data.contributors.length);
    expect(document.querySelector('#hud-session').textContent).toMatch(/^0x[0-9A-F]{6}$/);
    expect(document.querySelector('#feed-badge-text').textContent).toBe('SNAPSHOT');
    UI.setFeedBadge('live');
    expect(document.querySelector('#feed-badge-text').textContent).toBe('LIVE');
    expect(document.querySelector('#footer-sync').textContent).not.toBe('');
    UI.renderAll(data);
  });
  it('handles absent optional markup and missing repository fields', () => {
    UI.renderChips({ ...data, repo: { pushed_at: new Date().toISOString() } });
    expect(document.querySelector('#hero-chips').textContent).toContain('NOASSERTION');
    UI.renderChips({ ...data, repo: { watchers_count: 2 } });
    expect(document.querySelector('#hero-chips').textContent).toContain('2');
    UI.renderKpis({ ...data, contributors: [{ login: 'test' }], weekly: [0] });
    UI.renderKpis({ ...data, contributors: [], weekly: [1] });
    UI.renderBranches({ ...data, branches: [] });
    expect(document.querySelector('#branches-list').textContent).toContain('no branch data');
    UI.renderContributors({ ...data, contributors: [{ login: 'zero' }] });
    expect(document.querySelector('.contrib-count').textContent).toContain('0');
    document.body.innerHTML = '';
    UI.renderAll(data); UI.renderHud();
    ItemModal.init(); ContribModal.init();
    ItemModal.open({}, 'issue'); ContribModal.open('kyau');
    expect(document.body.innerHTML).toBe('');
  });
  it('toggles release notes without collapsing on notes or links', () => {
    UI.renderReleases(data);
    const card = document.querySelector('.release-card');
    expect(card.classList.contains('expanded')).toBe(true);
    card.querySelector('.release-body').click();
    expect(card.classList.contains('expanded')).toBe(true);
    card.querySelector('a').addEventListener('click', (event) => event.preventDefault());
    card.querySelector('a').click();
    expect(card.classList.contains('expanded')).toBe(true);
    card.querySelector('.release-toggle').click();
    expect(card.querySelector('button').getAttribute('aria-expanded')).toBe('false');
    card.click(); expect(card.classList.contains('expanded')).toBe(true);
    UI.renderReleases({ ...data, releasesSynthetic: false, releases: data.releases.map((r) => ({ ...r, synthetic: false })) });
    expect(document.querySelector('#releases-note').textContent).toContain('Streamed live');
    document.querySelector('#releases-note').remove(); UI.renderReleases(data);
  });
});

describe('contributor activation', () => {
  it('opens contributor profiles but not external links or unrelated keys', () => {
    vi.spyOn(ContribModal, 'open').mockImplementation(() => {});
    UI.renderContributors(data);
    const card = document.querySelector('.contrib-card');
    card.click(); key(card, 'Enter'); key(card, ' '); key(card, 'x');
    expect(ContribModal.open).toHaveBeenCalledTimes(3);
    card.querySelector('a').addEventListener('click', (event) => event.preventDefault());
    card.querySelector('a').click();
    expect(ContribModal.open).toHaveBeenCalledTimes(3);
  });
});

describe('tracker queues', () => {
  it('opens the selected closed record when synthetic queues share a number', () => {
    const bucket = { open: Synth.trackerRows('issue', 'open', 1), closed: Synth.trackerRows('issue', 'closed', 1) };
    expect(bucket.open[0].number).toBe(bucket.closed[0].number);
    vi.spyOn(ItemModal, 'open').mockImplementation(() => {});
    UI.renderTracker('issue', bucket, data.counts);
    document.querySelector('#issues-tabs [data-state="closed"]').click();
    document.querySelector('#issues-list .term-open').click();
    expect(ItemModal.open).toHaveBeenCalledExactlyOnceWith(bucket.closed[0], 'issue');
  });
  it.each(['issue', 'pr'])('switches %s tabs, supports arrows and opens records', (kind) => {
    const bucket = { open: Synth.trackerRows(kind, 'open', 2), closed: Synth.trackerRows(kind, 'closed', 3) };
    const prefix = kind === 'pr' ? 'prs' : 'issues';
    vi.spyOn(ItemModal, 'open').mockImplementation(() => {});
    UI.renderTracker(kind, bucket, data.counts);
    UI.renderTracker(kind, bucket, data.counts);
    const tabs = [...document.querySelectorAll(`#${prefix}-tabs .tracker-tab`)];
    const list = document.querySelector(`#${prefix}-list`);
    expect(list.querySelectorAll('.term-row')).toHaveLength(2);
    list.querySelector('button').click();
    expect(ItemModal.open).toHaveBeenCalledExactlyOnceWith(bucket.open[0], kind);
    tabs[1].click(); expect(list.querySelectorAll('.term-row')).toHaveLength(3);
    tabs[1].focus(); key(tabs[1], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[0]);
    key(tabs[0], 'ArrowLeft'); expect(document.activeElement).toBe(tabs[1]);
    key(tabs[0], 'x'); list.click();
    document.querySelector(`#${prefix}-tabs`).click();
    document.activeElement.blur(); key(tabs[0], 'ArrowRight');
    const button = list.querySelector('button'); button.dataset.num = '-1'; button.click();
    expect(ItemModal.open).toHaveBeenCalledOnce();
    expect(UI._findTrackerRow(kind, -1)).toBeNull();
    UI._setTrackerTab(kind, 'invalid'); expect(list.textContent).toContain('no closed');
    UI.renderTracker(kind, { open: [], closed: [] }, data.counts);
    expect(list.textContent).toContain('no closed');
    UI._setTrackerTab(kind, 'open'); expect(list.textContent).toContain('queue clear');
    document.querySelector(`#${prefix}-tabs`).remove(); document.querySelector(`#${prefix}-count-badge`).remove();
    UI.renderTracker(kind, bucket, data.counts);
    expect(list.querySelectorAll('.term-row')).toHaveLength(2);
  });
  it('tolerates uninitialized tracker state', () => {
    UI._tracker = null;
    UI._setTrackerTab('issue', 'open');
    expect(UI._findTrackerRow('issue', 1)).toBeNull();
    UI._tracker = { issue: { bucket: {} } };
    expect(UI._findTrackerRow('issue', 1)).toBeNull();
  });
});

describe('copy controls, reveals and boot', () => {
  it.each([true, false])('copies every command with clipboard availability %s', async (available) => {
    vi.useFakeTimers();
    const writeText = vi.fn();
    if (available) writeText.mockResolvedValue(); else writeText.mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    document.execCommand = vi.fn(() => true);
    UI.bindCloneCopy();
    const button = document.querySelector('.core-install .clone-copy'), before = button.innerHTML;
    button.click(); await Promise.resolve(); await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('git clone --recurse-submodules https://github.com/kyaulabs/ngen.git');
    if (!available) expect(document.execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    vi.advanceTimersByTime(1200); expect(button.innerHTML).toBe(before);
    document.body.insertAdjacentHTML('beforeend', '<div><code> </code><button class="clone-copy">empty</button></div><div><button class="clone-copy">missing</button></div>');
    [...document.querySelectorAll('.clone-copy')].slice(-2).forEach((el) => el.click());
    document.body.click();
    expect(writeText).toHaveBeenCalledOnce();
    delete document.execCommand;
  });
  it('reveals intersections and counts up only visible values', () => {
    vi.useFakeTimers();
    Utils.reducedMotion = false;
    const observers = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) { this.callback = callback; this.targets = []; this.unobserve = vi.fn(); observers.push(this); }
      observe(target) { this.targets.push(target); }
    });
    Reveal.init(); UI.renderKpis(data); Reveal.watchCounters();
    for (const observer of observers) {
      observer.callback(observer.targets.map((target) => ({ target, isIntersecting: false })));
      expect(observer.unobserve).not.toHaveBeenCalled();
      observer.callback(observer.targets.map((target) => ({ target, isIntersecting: true })));
      expect(observer.unobserve).toHaveBeenCalledTimes(observer.targets.length);
    }
    vi.advanceTimersByTime(1500);
    expect([...document.querySelectorAll('.kpi-value')].every((el) => Number(el.dataset.target) === 0 || el.textContent !== '0')).toBe(true);
    const value = document.createElement('div'); Reveal._countUp(value); expect(value.textContent).toBe('0');
    delete window.IntersectionObserver;
    Reveal.init(); Reveal.watchCounters();
    vi.advanceTimersByTime(1500);
    expect([...document.querySelectorAll('.reveal')].every((el) => el.classList.contains('in'))).toBe(true);
  });
  it.each([false, true])('boots the dashboard with catastrophic failure %s', async (failure) => {
    vi.useFakeTimers();
    vi.spyOn(Charts, 'buildAll').mockImplementation(() => {});
    vi.spyOn(API, 'loadAll')[failure ? 'mockRejectedValue' : 'mockResolvedValue'](failure ? new Error('failed') : data);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0);
    const originalParent = document.querySelector('.ticker').parentElement;
    await boot();
    expect(document.body.classList.contains('loaded')).toBe(true);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(100);
    window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('scroll'));
    expect(document.querySelector('.ticker').parentElement).toBe(document.body);
    expect(document.querySelectorAll('.ticker-spacer')).toHaveLength(1);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0); window.dispatchEvent(new Event('scroll'));
    expect(document.querySelector('.ticker').parentElement).toBe(originalParent);
    Theme.toggle(); window.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(300);
    expect(Charts.buildAll).toHaveBeenCalledTimes(3);
    STATE.data = null; Theme.toggle(); window.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(300);
    expect(Charts.buildAll).toHaveBeenCalledTimes(3);
  });
  it('boots without ticker or navigation markup', async () => {
    document.querySelector('.ticker').remove(); document.querySelector('.nav').remove();
    vi.spyOn(Charts, 'buildAll').mockImplementation(() => {});
    await boot();
    expect(document.body.classList.contains('loaded')).toBe(true);
  });
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
