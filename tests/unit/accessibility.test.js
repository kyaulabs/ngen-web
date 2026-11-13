// $KYAULabs: accessibility.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { API, Charts, ItemModal, ContribModal, STATE, Utils, boot } from '../../app.js';

let listeners;
beforeEach(() => {
  document.body.innerHTML = readFileSync('index.html', 'utf8');
  Utils.reducedMotion = true;
  listeners = [];
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((name, fn, options) => {
      listeners.push([target, name, fn]); add(name, fn, options);
    });
  }
});
afterEach(() => {
  ItemModal.close(); ContribModal.close();
  for (const [target, name, fn] of listeners) target.removeEventListener(name, fn);
});
const press = (key, shiftKey = false) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));

it.each(['item', 'contributor'])('keeps keyboard focus inside the %s dialog', (kind) => {
  const modal = kind === 'item' ? ItemModal : ContribModal;
  modal.init();
  STATE.data = { contributors: [{ login: 'kyau', contributions: 1, html_url: 'https://github.com/kyau' }] };
  vi.spyOn(API, 'fetchJSON').mockRejectedValue(new Error('offline'));
  if (kind === 'item') modal.open(API.normalizeRow({ number: 1, title: 'Example', html_url: 'https://github.com/kyaulabs/ngen/issues/1' }, 'issue'), 'issue');
  else modal.open('kyau');
  const controls = [...modal.box.querySelectorAll('button, a[href]')];
  controls.at(-1).focus(); press('Tab');
  expect(document.activeElement).toBe(controls[0]);
  press('Tab', true);
  expect(document.activeElement).toBe(controls.at(-1));
});

it('lets users pause and resume the orbital background and ticker', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.spyOn(Charts, 'buildAll').mockImplementation(() => {});
  await boot();
  const toggle = document.querySelector('#motion-toggle');
  toggle.click();
  expect(document.body.classList.contains('motion-paused')).toBe(true);
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(toggle.getAttribute('aria-label')).toBe('Resume background animation');
  toggle.click();
  expect(document.body.classList.contains('motion-paused')).toBe(false);
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
