// $KYAULabs: dashboard.spec.mjs kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { test, expect } from '@playwright/test';
import { controlNetwork } from '../network.mjs';

const command = 'git clone --recurse-submodules https://github.com/kyaulabs/ngen.git';
test.beforeEach(async ({ page }) => { await controlNetwork(page); });

async function load(page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/loaded/);
}

test('preserves the dashboard with NGEN identity, live charts and an honest game directory', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await load(page);
  await expect(page).toHaveTitle('NGEN // Space Simulation Engine');
  await expect(page.locator('#hero img[src*="wordmark"]')).toHaveCount(0);
  await expect(page.locator('#hero .orbital-art:visible')).toHaveCount(1);
  await expect(page.locator('#feed-badge-text')).toHaveText('LIVE');
  await expect(page.locator('#hero-chips a')).toHaveCount(6);
  await expect(page.locator('.kpi-value')).toHaveCount(6);
  await expect(page.locator('#chart-activity svg')).toHaveCount(1);
  await expect(page.locator('#chart-langs svg')).toHaveCount(1);
  await expect(page.locator('rect.day')).toHaveCount(364);
  await expect(page.locator('#games')).toContainText('No games announced yet');
  await expect(page.locator('a[href*="github.com/kyaulabs/prism"]')).toHaveCount(1); // attribution only
  expect(errors).toEqual([]);
});

test('copies the source command and persists theme selection', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await load(page);
  await page.getByRole('button', { name: 'Copy source clone command' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  await expect(page.locator('#copy-status')).toHaveText('Source clone command copied.');
  const before = await page.locator('html').getAttribute('data-theme');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before);
  const next = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  await expect(page.locator('#hero .orbital-art:visible')).toHaveAttribute('src', `brand/graphics/ngen-orbital-schematic-${next}.svg`);
});

test('supports tracker tabs, safe markdown, modal focus containment and focus restoration', async ({ page }) => {
  await load(page);
  const tab = page.locator('#issues-tabs [data-state="closed"]');
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  const origin = page.locator('#issues-list .term-open').first();
  await origin.click();
  const modal = page.locator('#item-modal');
  await expect(modal).toBeVisible();
  await modal.getByRole('tab', { name: 'Verification' }).click();
  await expect(modal.locator('.pkg-tabpanel.active')).toContainText('<script>');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(modal.locator('a[href^="javascript:"]')).toHaveCount(0);
  await modal.locator('button:visible, a[href]:visible').last().focus();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Close issue details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden(); await expect(origin).toBeFocused();
  const contributor = page.locator('.contrib-card').first();
  await contributor.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#contrib-modal')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(contributor).toBeFocused();
});

test('expands releases and docks the ticker above the footer', async ({ page }) => {
  await load(page);
  const toggle = page.locator('.release-toggle').first();
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('body > .ticker')).toHaveClass(/docked/);
  expect(await page.locator('.ticker').evaluate((el) => {
    const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.width / 2, r.y + r.height / 2));
  })).toBe(true);
});

test('shows unavailable statistics and snapshot provenance when offline', async ({ page }) => {
  await page.unroute('**/*'); await controlNetwork(page, true);
  await load(page);
  await expect(page.locator('#feed-badge-text')).toHaveText('SNAPSHOT');
  await expect(page.locator('#data-note')).toContainText('snapshot from');
  await expect(page.locator('#chart-activity')).toContainText('unavailable');
  await expect(page.locator('#chart-heatmap')).toContainText('unavailable');
  await expect(page.locator('#releases-list .release-card')).toHaveCount(0);
  await expect(page.locator('#issues-list .term-open')).toHaveCount(0);
  await expect(page.locator('#prs-list')).toContainText('feed unavailable');
});

test('simulates stars and circling globes with D3, honoring reduced motion and pause', async ({ page }) => {
  await load(page);
  await expect(page.locator('.space-star')).toHaveCount(162);
  await expect(page.locator('.orbit-track')).toHaveCount(3);
  await expect(page.locator('.orbital-globe')).toHaveCount(3);
  const track = page.locator('.orbit-track').first();
  const globe = page.locator('.orbital-globe').first();
  const still = await track.getAttribute('transform');
  await page.waitForTimeout(120);
  await expect(track).toHaveAttribute('transform', still);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const oldPosition = await globe.getAttribute('cx');
  await expect.poll(() => track.getAttribute('transform')).not.toBe(still);
  await expect.poll(() => globe.getAttribute('cx')).not.toBe(oldPosition);
  await page.getByRole('button', { name: 'Pause background animation' }).click();
  const paused = await track.getAttribute('transform');
  await page.waitForTimeout(120); await expect(track).toHaveAttribute('transform', paused);
  await page.getByRole('button', { name: 'Resume background animation' }).click();
  await expect.poll(() => track.getAttribute('transform')).not.toBe(paused);
});

for (const [width, height] of [[390, 844], [320, 844], [1920, 1080], [3840, 2160], [3840, 2400]]) {
  for (const colorScheme of ['dark', 'light']) {
    test(`reflows at ${width}×${height} in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme });
      await load(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const brand = await page.locator('.nav-brand').boundingBox();
      const actions = await page.locator('.nav-actions').boundingBox();
      expect(brand.x + brand.width).toBeLessThanOrEqual(actions.x);
      if (width === 3840) await page.screenshot({ path: `tests/Browser/Screenshots/visual-review/wide-${height}-${colorScheme}.png`, animations: 'disabled' });
    });
  }
}
// vim: ft=javascript sts=4 sw=4 ts=4 et :
