// $KYAULabs: ngen.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { expect, it, vi } from 'vitest';
import { API, CONFIG, UI, Reveal, Utils } from '../../app.js';

it('loads telemetry for NGEN without sharing Prism browser storage', () => {
  expect(CONFIG.repo).toBe('ngen');
  expect(CONFIG.themeKey).toBe('ngen-theme');
  expect(CONFIG.cacheKey).toMatch(/^ngen\./);
});

it('marks pending or unavailable weekly statistics instead of reporting zero commits', async () => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const data = await API.loadAll();
  expect(data.activityAvailable).toBe(false);
  expect(data.ticker).toEqual([]);
  expect(data.releases).toEqual([]);
  expect(data.issues).toEqual({ open: [], closed: [] });
});

it('renders all counters immediately when reduced motion is requested', () => {
  document.body.innerHTML = '<div class="kpi-value" data-target="42" data-format="int">0</div>';
  Utils.reducedMotion = true;
  vi.stubGlobal('IntersectionObserver', class { observe() {} });
  Reveal.watchCounters();
  expect(document.querySelector('.kpi-value').textContent).toBe('42');
});

it('reports a failed copy instead of showing a false success', async () => {
  document.body.innerHTML = '<div><code>git clone example</code><button class="clone-copy">Copy</button></div><p id="copy-status"></p>';
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  document.execCommand = vi.fn(() => false);
  const add = document.addEventListener.bind(document);
  let handler;
  vi.spyOn(document, 'addEventListener').mockImplementation((event, fn, options) => { handler = fn; add(event, fn, options); });
  UI.bindCloneCopy();
  const button = document.querySelector('button'); button.click();
  await vi.waitFor(() => expect(document.querySelector('#copy-status').textContent).toContain('Copy failed'));
  expect(button.textContent).toBe('Copy');
  document.removeEventListener('click', handler);
  delete document.execCommand;
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
