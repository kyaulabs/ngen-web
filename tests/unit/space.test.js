// $KYAULabs: space.test.js kyau@aura.kyaulabs 2026/11/15 -0800 Exp $
import { createRequire } from 'node:module';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Space } from '../../space.js';
const d3 = createRequire(`${process.cwd()}/package.json`)('./vendor/d3.min.js');
const originalAnimate = Element.prototype.animate;

beforeEach(() => {
  document.body.innerHTML = '<div class="space-background"></div><span class="orbital-system"><img class="orbital-art" /></span>';
  vi.stubGlobal('d3', d3);
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, writable: true, value: vi.fn(() => ({
    playState: 'idle', currentTime: 0,
    play: vi.fn(function () { this.playState = 'running'; }),
    pause: vi.fn(function () { this.playState = 'paused'; }),
    cancel: vi.fn(function () { this.playState = 'idle'; }),
  })) });
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => {
  Space.destroy();
  if (originalAnimate) Element.prototype.animate = originalAnimate;
  else delete Element.prototype.animate;
});

it('generates the stellar field and three orbital tracks with a luminous star on every track', () => {
  Space.init();
  expect(document.querySelectorAll('.space-background .space-field')).toHaveLength(1);
  expect(document.querySelectorAll('.space-star').length).toBeGreaterThan(80);
  expect(document.querySelectorAll('.orbit-track')).toHaveLength(3);
  expect(document.querySelectorAll('.orbit-track .orbital-globe')).toHaveLength(3);
  expect(document.querySelectorAll('.orbit-track .orbital-corona')).toHaveLength(3);
  expect(document.querySelector('.orbital-system').classList.contains('space-ready')).toBe(true);
});
it('generates a dense star field and textured nebula clouds behind the page', () => {
  Space.init();
  expect(document.querySelectorAll('.space-star').length).toBeGreaterThan(500);
  expect(document.querySelectorAll('.space-nebula path').length).toBeGreaterThan(5);
  expect(document.querySelectorAll('.space-nebula ellipse')).toHaveLength(0);
  expect(document.querySelector('.space-field defs feDisplacementMap')).not.toBeNull();
  expect(document.querySelector('.space-star').closest('svg')).not.toBe(document.querySelector('.space-nebula').closest('svg'));
  expect(document.querySelector('.space-nebula feTurbulence, .space-field defs feTurbulence')).not.toBeNull();
});

it('renders mostly faint stellar points with a sparse bright tail and a wide apparent size range', () => {
  Space.init();
  const stars = [...document.querySelectorAll('.space-star')].map((star) => ({
    radius: Number(star.getAttribute('r')), opacity: Number(star.getAttribute('opacity')),
  }));
  expect(stars.filter((star) => star.opacity < 0.5).length).toBeGreaterThan(stars.length * 0.75);
  const prominent = stars.filter((star) => star.radius > 1.2);
  expect(prominent.length).toBeGreaterThan(3);
  expect(prominent.length).toBeLessThan(stars.length * 0.05);
  expect(Math.max(...stars.map((star) => star.radius)) / Math.min(...stars.map((star) => star.radius))).toBeGreaterThan(7);
  expect(stars.every((star) => star.radius > 0 && star.opacity > 0 && star.opacity <= 1)).toBe(true);
});

it('mixes warm orange, neutral white and hot blue-white stellar light without saturated rainbow stars', () => {
  Space.init();
  const fills = [...document.querySelectorAll('.space-star')].map((star) => star.getAttribute('fill'));
  expect(new Set(fills).size).toBeGreaterThanOrEqual(6);
  const colors = fills.map((fill) => d3.color(fill).rgb());
  expect(colors.filter(({ r, b }) => r > b + 40).length).toBeGreaterThan(30);
  expect(colors.filter(({ r, g, b }) => Math.max(r, g, b) - Math.min(r, g, b) < 20).length).toBeGreaterThan(30);
  expect(colors.filter(({ r, b }) => b > r + 20).length).toBeGreaterThan(30);
  expect(colors.every(({ r, g, b }) => Math.min(r, g, b) / Math.max(r, g, b) > 0.3 && g <= Math.max(r, b))).toBe(true);
});

it('gives only a few bright background stars centered fading halos and small exposed cores', () => {
  Space.init();
  const stars = [...document.querySelectorAll('.space-star')];
  const halos = [...document.querySelectorAll('.space-star-glow')];
  expect(halos.length).toBeGreaterThan(3);
  expect(halos.length).toBeLessThan(stars.length * 0.05);
  expect(document.querySelectorAll('.space-star-highlight')).toHaveLength(halos.length);
  for (const halo of halos) {
    const star = stars.find((point) => point.getAttribute('cx') === halo.getAttribute('cx') && point.getAttribute('cy') === halo.getAttribute('cy'));
    expect(Number(halo.getAttribute('r'))).toBeGreaterThan(Number(star.getAttribute('r')) * 3);
    const gradient = document.getElementById(halo.getAttribute('fill').slice(5, -1));
    expect(gradient.getAttribute('cx')).toBe('50%');
    expect(gradient.getAttribute('cy')).toBe('50%');
    expect(gradient.lastElementChild.getAttribute('stop-opacity')).toBe('0');
  }
});

it('animates nebula flow, star drift and orbits together, freezing every layer when paused', async () => {
  window.matchMedia.mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
  Space.init();
  const track = document.querySelector('.orbit-track');
  const globe = document.querySelector('.orbital-globe');
  const animations = Element.prototype.animate.mock.results.map(({ value }) => value);
  expect(animations).toHaveLength(2);
  expect(animations.every((animation) => animation.playState === 'running')).toBe(true);
  const corona = document.querySelector('.orbital-corona');
  const pose = () => [track.getAttribute('transform'), globe.getAttribute('cx'), corona.getAttribute('cx')];
  expect(corona.getAttribute('cx')).toBe(globe.getAttribute('cx'));
  expect(corona.getAttribute('cy')).toBe(globe.getAttribute('cy'));
  const before = pose();
  await vi.waitFor(() => expect(track.getAttribute('transform')).not.toBe(before[0]));
  for (let i = 1; i < before.length; i++) expect(pose()[i]).not.toBe(before[i]);
  document.body.classList.add('motion-paused');
  document.dispatchEvent(new Event('ngen:motionchange'));
  const paused = pose();
  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(pose()).toEqual(paused);
  expect(animations.every((animation) => animation.playState === 'paused')).toBe(true);
  document.body.classList.remove('motion-paused');
  document.dispatchEvent(new Event('ngen:motionchange'));
  await vi.waitFor(() => expect(track.getAttribute('transform')).not.toBe(paused[0]));
  for (let i = 1; i < paused.length; i++) expect(pose()[i]).not.toBe(paused[i]);
  expect(animations.every((animation) => animation.playState === 'running')).toBe(true);
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
  const animations = Element.prototype.animate.mock.results.map(({ value }) => value);
  Space.destroy();
  expect(animations.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true);
  expect(document.querySelectorAll('.space-cloud-layer, .space-star-layer, .space-field, .space-star-field, .orbit-scene')).toHaveLength(0);
  expect(document.querySelector('.orbital-system').classList.contains('space-ready')).toBe(false);
  expect(media.removeEventListener).toHaveBeenCalled();
});

it('retains a static space field when native animations are unavailable', () => {
  Element.prototype.animate = undefined;
  Space.init();
  expect(document.querySelectorAll('.space-star')).toHaveLength(900);
  expect(document.querySelectorAll('.space-nebula')).toHaveLength(1);
});

it('retains the original schematic if D3 or either scene mount is missing', () => {
  vi.stubGlobal('d3', undefined); Space.init();
  expect(document.querySelector('.orbital-art')).not.toBeNull();
  vi.stubGlobal('d3', d3); document.querySelector('.space-background').remove(); Space.init();
  document.body.innerHTML = '<div class="space-background"></div>'; Space.init();
  expect(document.querySelectorAll('svg')).toHaveLength(0);
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
