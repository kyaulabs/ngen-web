// $KYAULabs: visual-review.test.js kyau@aura.kyaulabs 2026/11/16 -0800 Exp $
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { expandVisualReviewCases, publishVisualReviewEvidence, validateVisualReviewConfig } from '../../visual_review.mjs';

function configuration() {
  return {
    schemaVersion: 1,
    baseUrl: 'http://127.0.0.1:4173',
    viewports: { mobile: { width: 390, height: 844 }, desktop: { width: 1920, height: 1080 } },
    cases: [{ id: 'branches', path: '/', readySelector: 'body.loaded', states: [
      { id: 'dark', colorScheme: 'dark', actions: [] },
      { id: 'offline-dark', colorScheme: 'dark', actions: [] },
    ] }],
  };
}

it('accepts a bounded component selector and carries it into every capture', () => {
  const input = configuration();
  input.cases[0].captureSelector = '#branches';
  const captures = expandVisualReviewCases(validateVisualReviewConfig(input));
  expect(captures).toHaveLength(6);
  expect(captures.every((capture) => capture.captureSelector === '#branches')).toBe(true);
});

it('selects a component, state and viewport without changing the shared definitions', () => {
  const input = configuration();
  input.cases.push({ ...input.cases[0], id: 'dashboard' });
  const config = validateVisualReviewConfig(input);
  const captures = expandVisualReviewCases(config, { cases: ['branches'], states: ['dark'], viewports: ['mobile'] });
  expect(captures.map((capture) => [capture.caseId, capture.stateId, capture.viewportId])).toEqual([['branches', 'dark', 'mobile']]);
  expect(expandVisualReviewCases(config)).toHaveLength(12);
});

it('publishes the component without relocating the prepared viewport and omits selectors from metadata', async () => {
  const input = configuration();
  input.cases[0].captureSelector = '#branches';
  const [capture] = expandVisualReviewCases(validateVisualReviewConfig(input));
  const component = readFileSync('brand/icons/app/ngen-app-dark-32.png');
  const fullPage = readFileSync('brand/icons/app/ngen-app-dark-128.png');
  // Browser boundary: element screenshots may scroll and lose a prepared hover.
  const page = {
    viewportSize: () => ({ width: 390, height: 844 }),
    screenshot: async (options) => options.clip ? component : fullPage,
    locator: () => ({
      screenshot: async () => fullPage,
      evaluate: async () => ({ x: 10, y: 20, width: 32, height: 32 }),
    }),
  };
  const directory = mkdtempSync(join(tmpdir(), 'ngen-visual-test-'));
  try {
    const paths = await publishVisualReviewEvidence(page, capture, { playwright: 'test', chromium: 'test' }, { head: null, dirty: true }, [], directory);
    expect(readFileSync(paths.image)).toEqual(component);
    const metadata = JSON.parse(readFileSync(paths.metadata, 'utf8'));
    expect(metadata.fullPage).toBe(false);
    expect(JSON.stringify(metadata)).not.toContain('#branches');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('rejects partial component captures instead of silently clipping outside the viewport', async () => {
  const input = configuration();
  input.cases[0].captureSelector = '#branches';
  const [capture] = expandVisualReviewCases(validateVisualReviewConfig(input));
  const directory = mkdtempSync(join(tmpdir(), 'ngen-visual-test-'));
  const page = {
    viewportSize: () => ({ width: 390, height: 844 }),
    screenshot: async () => Buffer.from('partial image'),
    locator: () => ({ evaluate: async () => ({ x: 0, y: 800, width: 390, height: 100 }) }),
  };
  try {
    await expect(publishVisualReviewEvidence(page, capture, {}, {}, [], directory)).rejects.toThrow('fit inside the viewport');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each(['', '\nbody', null, 'x'.repeat(257)])('rejects an invalid component selector (%j)', (selector) => {
  const input = configuration();
  input.cases[0].captureSelector = selector;
  expect(() => validateVisualReviewConfig(input)).toThrow('configuration is invalid');
});

it.each([
  { cases: ['unknown'] }, { viewports: ['huge'] }, { states: ['missing'] },
  { cases: 'branches' }, { cases: null }, { case: ['branches'] },
])('fails closed on unknown or malformed visual selections (%j)', (selection) => {
  expect(() => expandVisualReviewCases(validateVisualReviewConfig(configuration()), selection)).toThrow();
});

it('rejects an empty intersection rather than reporting a successful zero-test run', () => {
  const input = configuration();
  input.cases.push({ ...input.cases[0], id: 'dashboard', states: [{ id: 'hover', colorScheme: 'dark', actions: [] }] });
  expect(() => expandVisualReviewCases(validateVisualReviewConfig(input), { cases: ['branches'], states: ['hover'] })).toThrow('no matching');
});

it('lists selected component captures through the CLI without starting a browser', () => {
  const result = spawnSync(process.execPath, ['tools/visual-review.mjs', '--list', '--case', 'branches', '--viewport', 'mobile'], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout.trim().split('\n')).toEqual(['branches dark mobile', 'branches offline-dark mobile']);
  const invalid = spawnSync(process.execPath, ['tools/visual-review.mjs', '--list', '--case', 'unknown'], { encoding: 'utf8' });
  expect(invalid.status).toBe(1);
  expect(invalid.stderr).toContain('unknown or invalid');
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
