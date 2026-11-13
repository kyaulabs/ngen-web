// $KYAULabs: charts.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Charts, Synth, Tip, Utils, SNAPSHOT } from '../../app.js';

const d3 = createRequire(`${process.cwd()}/package.json`)('./vendor/d3.min.js');
const data = { weekly: SNAPSHOT.weekly, languages: SNAPSHOT.languages, counts: SNAPSHOT.counts, days: Synth.daysFromWeekly(SNAPSHOT.weekly) };
const dimensions = (el, width = 640, height = 240) => {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
};
const pointer = (el, event) => el.dispatchEvent(new MouseEvent(event, { clientX: 100, clientY: 100 }));

beforeEach(() => {
  document.body.innerHTML = readFileSync('index.html', 'utf8');
  vi.stubGlobal('d3', d3);
  Utils.reducedMotion = true;
  Tip.init();
  document.querySelectorAll('.chart-mount, #gauge-issues, #gauge-prs').forEach((el) => dimensions(el));
  for (let i = 0; i < 5; i++) document.documentElement.style.setProperty(`--heat-${i}`, '#123456');
});
afterEach(() => { Utils.reducedMotion = true; });

it('renders every visualization using real D3 and responds to pointer interactions', () => {
  Charts.buildAll(data);
  expect(document.querySelectorAll('#chart-activity svg')).toHaveLength(1);
  expect(document.querySelectorAll('#langs-legend li')).toHaveLength(Object.keys(data.languages).length);
  expect(document.querySelectorAll('rect.day')).toHaveLength(364);
  const hover = document.querySelector('#chart-activity svg > rect');
  pointer(hover, 'pointermove');
  expect(Tip.el.textContent).toContain('commits');
  pointer(hover, 'pointerleave');
  expect(Tip.el.classList.contains('on')).toBe(false);
  const slice = document.querySelector('#chart-langs path');
  pointer(slice, 'pointerenter'); pointer(slice, 'pointermove');
  expect(Tip.el.textContent).toContain('% of source');
  pointer(slice, 'pointerleave');
  for (const day of document.querySelectorAll('rect.day')) {
    pointer(day, 'pointerenter'); pointer(day, 'pointermove'); pointer(day, 'pointerleave');
  }
  expect(document.querySelector('#gauge-issues').textContent).toContain('RESOLVED');
});

it('handles absent mounts, zero-size layouts, missing D3 and empty totals', () => {
  Charts.activity(null, data); Charts.donut(null, null, {}); Charts.gauge(null, 0, ''); Charts.heatmap(null, []);
  const el = document.createElement('div');
  Charts.activity(el, data); Charts.donut(el, null, {}); Charts.gauge(el, 0, ''); Charts.heatmap(el, []);
  expect(el.innerHTML).toBe('');
  vi.stubGlobal('d3', undefined);
  Charts.buildAll(data);
  expect(document.querySelector('.chart-mount').textContent).toContain('engine offline');
  vi.stubGlobal('d3', d3);
  Charts.buildAll({ ...data, counts: { issuesOpen: 0, issuesClosed: 0, prsOpen: 0, prsClosed: 0 } });
  expect(document.querySelector('#gauge-prs').textContent).toContain('0%');
});

it('handles single-language, zero-activity, narrow and all-zero heatmaps', () => {
  const el = document.querySelector('#chart-activity');
  Charts.activity(el, { weekly: Array(52).fill(0) });
  expect(el.textContent).toContain('AVG 0');
  Charts.donut(el, null, { JavaScript: 0 });
  expect(el.querySelectorAll('path')).toHaveLength(1);
  dimensions(el, 400);
  const days = Array.from({ length: 7 }, (_, i) => ({ date: new Date(2026, 0, i + 1), count: 0, future: false }));
  Charts.heatmap(el, days);
  expect(el.textContent).not.toContain('MON');
  pointer(el.querySelector('rect.day'), 'pointerenter');
  expect(Tip.el.textContent).toContain('no commits');
  Charts.heatmap(el, days.map((d, i) => ({ ...d, count: i + 1 })));
  pointer(el.querySelector('rect.day'), 'pointerenter');
  expect(Tip.el.textContent).toContain('1 commit');
  expect(Tip.el.textContent).not.toContain('1 commits');
});

it('completes chart animations when reduced motion is disabled', async () => {
  Utils.reducedMotion = false;
  SVGElement.prototype.getTotalLength = () => 100;
  Charts.buildAll(data);
  await new Promise((resolve) => setTimeout(resolve, 1450));
  expect(document.querySelector('#chart-activity path[stroke-dashoffset]').getAttribute('stroke-dashoffset')).toBe('0');
  expect([...document.querySelectorAll('#chart-langs path')].every((el) => el.getAttribute('d'))).toBe(true);
  expect([...document.querySelectorAll('rect.day')].every((el) => el.getAttribute('opacity') === '1')).toBe(true);
  delete SVGElement.prototype.getTotalLength;
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
