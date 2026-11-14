// $KYAULabs: dashboard.spec.mjs kyau@aura.kyaulabs 2026/11/13 -0800 Exp $
import { readFile } from 'node:fs/promises';
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
  await expect(page.locator('#hero .orbital-core:visible')).toHaveCount(1);
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

test('serves generated minified assets rather than source aliases', async ({ page }) => {
  await load(page);
  const assets = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') || node.getAttribute('href')));
  for (const file of assets) {
    expect(file).toMatch(/\.min\.(?:js|css)$/);
    const response = await page.request.get(`/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(file.endsWith('.css') ? /text\/css/ : /(?:application|text)\/javascript/);
    expect(await response.body()).toEqual(await readFile(file));
  }
});

test('does not expose source styles, scripts, or development files', async ({ page }) => {
  for (const path of ['/styles.scss', '/styles.css', '/brand/web/ngen-theme.css', '/app.js', '/package.json', '/tests/server.mjs', '/.git/HEAD']) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
});

test('copies the source command', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await load(page);
  await page.getByRole('button', { name: 'Copy source clone command' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  await expect(page.locator('#copy-status')).toHaveText('Source clone command copied.');
  await expect(page.locator('#hero .orbital-core:visible')).toHaveAttribute('src', 'assets/ngen-orbital-core.svg');
});

test('ignores saved light mode and system color preferences without exposing a theme control', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('ngen-theme', 'light'));
  await load(page);
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('#theme-toggle')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(221, 243, 248)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/loaded/);
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
});

test('keeps viewport-sized space behind the dashboard with an opaque footer', async ({ page }) => {
  await load(page);
  const background = page.locator('.space-background');
  const original = await background.boundingBox();
  await expect(background).toHaveCSS('position', 'fixed');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('#hero .orbital-core:visible')).toHaveAttribute('src', 'assets/ngen-orbital-core.svg');
  await expect(page.locator('.nav .brand-mark')).toBeVisible();
  await page.locator('#activity').scrollIntoViewIfNeeded();
  expect(await background.boundingBox()).toEqual(original);
  await expect(page.locator('.nav')).not.toHaveClass(/over-hero/);
  await expect(page.locator('.nav .brand-mark')).toHaveAttribute('src', 'brand/logos/svg/ngen-wordmark-dark.svg');
  const colors = await page.evaluate(() => ({
    heading: getComputedStyle(document.querySelector('#activity h2')).color,
    panelText: getComputedStyle(document.querySelector('#activity .panel')).color,
    footer: getComputedStyle(document.querySelector('.footer')).backgroundColor,
  }));
  expect(colors.heading).toBe('rgb(221, 243, 248)');
  expect(colors.panelText).toBe('rgb(221, 243, 248)');
  expect(colors.footer).toBe('rgb(27, 64, 80)');
  await page.locator('.footer').scrollIntoViewIfNeeded();
  expect(await background.boundingBox()).toEqual(original);
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
  expect(await page.locator('.space-star').count()).toBeGreaterThan(500);
  await expect(page.locator('.space-nebula')).toHaveCount(1);
  await expect(page.locator('.orbit-track')).toHaveCount(3);
  await expect(page.locator('.orbital-globe')).toHaveCount(3);
  const track = page.locator('.orbit-track').first();
  const globe = page.locator('.orbital-globe').first();
  const stars = page.locator('.space-star-field');
  const nebula = page.locator('.space-field');
  const still = await track.getAttribute('transform');
  const stillStars = await stars.boundingBox();
  const stillClouds = await nebula.boundingBox();
  await page.waitForTimeout(120);
  await expect(track).toHaveAttribute('transform', still);
  expect(await stars.boundingBox()).toEqual(stillStars);
  expect(await nebula.boundingBox()).toEqual(stillClouds);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const oldPosition = await globe.getAttribute('cx');
  await expect.poll(() => track.getAttribute('transform')).not.toBe(still);
  await expect.poll(() => globe.getAttribute('cx')).not.toBe(oldPosition);
  await expect.poll(async () => {
    const box = await stars.boundingBox();
    return Math.hypot(box.x - stillStars.x, box.y - stillStars.y);
  }, { timeout: 2000 }).toBeGreaterThan(2);
  await expect.poll(async () => {
    const box = await nebula.boundingBox();
    return Math.hypot(box.x - stillClouds.x, box.y - stillClouds.y);
  }, { timeout: 2000 }).toBeGreaterThan(0.5);
  await page.getByRole('button', { name: 'Pause background animation' }).click();
  const paused = await track.getAttribute('transform');
  const backgroundPaused = await page.locator('.space-background').evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.ready));
    return animations.length > 0 && animations.every((animation) => animation.playState === 'paused');
  });
  expect(backgroundPaused).toBe(true);
  const pausedStars = await stars.boundingBox();
  const pausedClouds = await nebula.boundingBox();
  await page.waitForTimeout(120);
  await expect(track).toHaveAttribute('transform', paused);
  expect(await stars.boundingBox()).toEqual(pausedStars);
  expect(await nebula.boundingBox()).toEqual(pausedClouds);
  await page.getByRole('button', { name: 'Resume background animation' }).click();
  await expect.poll(() => track.getAttribute('transform')).not.toBe(paused);
});

for (const [width, height] of [[390, 844], [320, 844], [1920, 1080], [3840, 2160], [3840, 2400]]) {
  test(`reflows at ${width}×${height} in dark mode`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await load(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const background = await page.locator('.space-background').boundingBox();
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(background).toEqual({ x: 0, y: 0, width: viewportWidth, height });
    const brand = await page.locator('.nav-brand').boundingBox();
    const actions = await page.locator('.nav-actions').boundingBox();
    expect(brand.x + brand.width).toBeLessThanOrEqual(actions.x);
    if (width === 3840) await page.screenshot({ path: `tests/Browser/Screenshots/visual-review/wide-${height}-dark.png`, animations: 'disabled' });
    await page.locator('#activity').scrollIntoViewIfNeeded();
    expect(await page.locator('.space-background').boundingBox()).toEqual(background);
    if (width === 390 || width === 1920) await page.screenshot({ path: `tests/Browser/Screenshots/visual-review/space-${width}-dark-dashboard.png`, animations: 'disabled' });
    await page.locator('.footer').scrollIntoViewIfNeeded();
    expect(await page.locator('.space-background').boundingBox()).toEqual(background);
    if (width === 390 || width === 1920) await page.screenshot({ path: `tests/Browser/Screenshots/visual-review/space-${width}-dark-footer.png`, animations: 'disabled' });
  });
}
// vim: ft=javascript sts=4 sw=4 ts=4 et :
