// $KYAULabs: space.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { createRequire } from 'node:module';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Space } from '../../space.js';
const d3 = createRequire(`${process.cwd()}/package.json`)('./vendor/d3.min.js');

beforeEach(() => {
  document.body.innerHTML = '<div class="space-background"></div><span class="orbital-system"><img class="orbital-art" /></span>';
  vi.stubGlobal('d3', d3);
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => Space.destroy());

it('generates the stellar field and three orbital tracks with a globe on every track', () => {
  Space.init();
  expect(document.querySelectorAll('.space-background svg')).toHaveLength(1);
  expect(document.querySelectorAll('.space-star').length).toBeGreaterThan(80);
  expect(document.querySelectorAll('.orbit-track')).toHaveLength(3);
  expect(document.querySelectorAll('.orbit-track .orbital-globe')).toHaveLength(3);
  expect(document.querySelector('.orbital-system').classList.contains('space-ready')).toBe(true);
});
it('animates tracks, globes and stars, and freezes their positions when paused', async () => {
  window.matchMedia.mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
  Space.init();
  const track = document.querySelector('.orbit-track');
  const globe = document.querySelector('.orbital-globe');
  const field = document.querySelector('.space-field g');
  const before = [track.getAttribute('transform'), globe.getAttribute('cx'), field.getAttribute('transform')];
  await vi.waitFor(() => expect(track.getAttribute('transform')).not.toBe(before[0]));
  expect(globe.getAttribute('cx')).not.toBe(before[1]);
  expect(field.getAttribute('transform')).not.toBe(before[2]);
  document.body.classList.add('motion-paused');
  document.dispatchEvent(new Event('ngen:motionchange'));
  const paused = track.getAttribute('transform');
  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(track.getAttribute('transform')).toBe(paused);
  document.body.classList.remove('motion-paused');
  document.dispatchEvent(new Event('ngen:motionchange'));
  await vi.waitFor(() => expect(track.getAttribute('transform')).not.toBe(paused));
});

it('responds to reduced-motion changes and tab visibility without losing the scene', async () => {
  let change;
  const media = { matches: true, addEventListener: (_event, fn) => { change = fn; }, removeEventListener: vi.fn() };
  window.matchMedia.mockReturnValue(media);
  Space.init();
  const track = document.querySelector('.orbit-track');
  const still = track.getAttribute('transform');
  document.dispatchEvent(new Event('ngen:motionchange'));
  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(track.getAttribute('transform')).toBe(still);
  media.matches = false; change(); change(); // repeated notifications do not create extra timers
  await vi.waitFor(() => expect(track.getAttribute('transform')).not.toBe(still));
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  const hidden = track.getAttribute('transform');
  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(track.getAttribute('transform')).toBe(hidden);
  Space.destroy();
  expect(document.querySelectorAll('.space-field, .orbit-scene')).toHaveLength(0);
  expect(document.querySelector('.orbital-system').classList.contains('space-ready')).toBe(false);
  expect(media.removeEventListener).toHaveBeenCalled();
});

it('retains the original schematic if D3 or either scene mount is missing', () => {
  vi.stubGlobal('d3', undefined); Space.init();
  expect(document.querySelector('.orbital-art')).not.toBeNull();
  vi.stubGlobal('d3', d3); document.querySelector('.space-background').remove(); Space.init();
  document.body.innerHTML = '<div class="space-background"></div>'; Space.init();
  expect(document.querySelectorAll('svg')).toHaveLength(0);
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
