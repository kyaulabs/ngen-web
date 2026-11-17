// $KYAULabs: visual-evidence.spec.mjs kyau@aura.kyaulabs 2026/11/17 -0800 Exp $
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { controlNetwork } from '../network.mjs';
import { applyVisualReviewActions, publishVisualReviewEvidence } from '../../visual_review.mjs';

test('measures popup capture bounds after the opening transform settles', async ({ page }) => {
  await controlNetwork(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/loaded/);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.release-changelog').click();
  const selector = '#release-changelog-modal .pkg-modal';
  const screenshot = page.screenshot.bind(page);
  let clip, paintedBounds;
  page.screenshot = async (options) => {
    const image = await screenshot(options);
    clip = options.clip;
    paintedBounds = await page.locator(selector).boundingBox();
    return image;
  };
  const directory = await mkdtemp(join(tmpdir(), 'ngen-evidence-'));
  try {
    await publishVisualReviewEvidence(page, {
      caseId: 'release-changelog', stateId: 'dark', viewportId: 'desktop',
      viewport: page.viewportSize(), colorScheme: 'dark', captureSelector: selector,
    }, {}, {}, [], directory);
    for (const key of ['x', 'y', 'width', 'height']) {
      expect(Math.abs(clip[key] - paintedBounds[key]), key).toBeLessThanOrEqual(1);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('rejects component evidence obscured by the fixed ticker', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await controlNetwork(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/loaded/);
  const selector = '#milestones .roadmap-panel';
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.locator('.milestone-card:first-child summary').click();
  await page.locator('.milestone-item-list').waitFor();
  const directory = await mkdtemp(join(tmpdir(), 'ngen-evidence-'));
  try {
    await expect(publishVisualReviewEvidence(page, {
      caseId: 'roadmap', stateId: 'objectives-dark', viewportId: 'reflow',
      viewport: page.viewportSize(), colorScheme: 'dark', captureSelector: selector,
    }, {}, {}, [], directory)).rejects.toThrow('obscured');
    await applyVisualReviewActions(page, [{ type: 'scroll-into-view', selector }]);
    await expect(publishVisualReviewEvidence(page, {
      caseId: 'roadmap', stateId: 'objectives-dark', viewportId: 'reflow',
      viewport: page.viewportSize(), colorScheme: 'dark', captureSelector: selector,
    }, {}, {}, [], directory)).resolves.toHaveProperty('image');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
