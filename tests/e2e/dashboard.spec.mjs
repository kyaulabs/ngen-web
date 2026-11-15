// $KYAULabs: dashboard.spec.mjs kyau@aura.kyaulabs 2026/11/15 -0800 Exp $
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { controlNetwork } from '../network.mjs';

const command = 'git clone --recurse-submodules https://github.com/kyaulabs/ngen.git';
test.beforeEach(async ({ page }) => { await controlNetwork(page); });

async function load(page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/loaded/);
}

async function paintedColor(locator, property = 'backgroundColor') {
  return locator.evaluate((element, key) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = getComputedStyle(element)[key];
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  }, property);
}

function contrastRatio(first, second) {
  const luminance = (rgb) => rgb.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
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

test('uses the Graphite 1.2 page, panel and Slate header colors in dark mode', async ({ page }) => {
  await load(page);
  const tokens = await page.locator('html').evaluate((element) => {
    const style = getComputedStyle(element);
    return ['bg', 'surface', 'panel-header', 'surface-alt'].map((key) => style.getPropertyValue(`--ngen-${key}`).trim().toUpperCase());
  });
  expect(tokens).toEqual(['#202124', '#2A2B2F', '#3A414E', '#3A414E']);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#202124');
  for (const [selector, expected] of [
    ['body', [32, 33, 36, 255]],
    ['.space-background', [32, 33, 36, 255]],
    ['#install', [42, 43, 47, 224]],
    ['#install .term-bar', [58, 65, 78, 217]],
  ]) {
    const color = await paintedColor(page.locator(selector));
    for (let channel = 0; channel < 4; channel++) expect(Math.abs(color[channel] - expected[channel]), selector).toBeLessThanOrEqual(2);
  }
});

test('keeps the orbital fallback label-free and transparent without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'light', viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await controlNetwork(page);
    await page.goto('http://127.0.0.1:4173/');
    await expect(page.locator('.orbital-art')).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    const source = await page.locator('.orbital-art').getAttribute('src');
    const response = await page.request.get(`http://127.0.0.1:4173/${source}`);
    expect(response.status()).toBe(200);
    const artwork = await page.evaluate((markup) => {
      const svg = new DOMParser().parseFromString(markup, 'image/svg+xml');
      return { captions: [...svg.querySelectorAll('text')].map((text) => text.textContent), frame: svg.querySelector('rect').getAttribute('fill') };
    }, await response.text());
    expect(artwork.captions).toEqual([]);
    expect(artwork.frame).toBe('none');
    await page.screenshot({ path: 'tests/Browser/Screenshots/visual-review/graphite-fallback-mobile.png' });
  } finally {
    await context.close();
  }
});

test('uses pronounced filled controls and a primary action without losing keyboard focus', async ({ page }) => {
  await load(page);
  const live = page.locator('#feed-badge');
  const badgeBox = await live.boundingBox();
  for (const selector of ['#motion-toggle', '.nav-gh']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.height).toBeCloseTo(badgeBox.height, 1);
    expect(box.width).toBeCloseTo(badgeBox.width, 1);
  }
  const controls = page.locator('.nav-actions > *, .hero-cta .btn:not(.btn-primary), .hero-chips .chip, .clone-copy, .release-toggle, .release-tag, .branch-sha, .pkg-tab, .term-open');
  for (const control of await controls.all()) {
    expect((await paintedColor(control))[3]).toBeGreaterThan(25);
    await expect(control).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    await expect(control).toHaveCSS('border-top-left-radius', '10px');
  }
  const primary = page.locator('.hero-cta .btn-primary');
  await expect(primary).toHaveCSS('background-image', /^linear-gradient/);
  await expect(primary).toHaveCSS('color', 'rgb(8, 33, 43)');
  expect((await primary.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await primary.hover();
  await expect(page.locator('.ticker')).toHaveClass(/docked/);
  await expect(page.locator('.ticker')).toHaveCSS('transform', 'none');
  const actionBox = await primary.boundingBox();
  const tickerBox = await page.locator('.ticker').boundingBox();
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(tickerBox.y);
  const pause = page.locator('#motion-toggle');
  await pause.hover();
  await expect(pause).toHaveCSS('border-top-color', 'rgb(99, 221, 248)');
  expect((await paintedColor(pause))[3]).toBeGreaterThan(25);
  await page.mouse.move(0, 0);
  await pause.focus();
  await expect(pause).toHaveCSS('outline-style', 'solid');
  await expect(pause).toHaveCSS('outline-width', '2px');
  await expect(pause).toHaveCSS('border-top-color', 'rgb(120, 153, 166)');
  await page.locator('#issues-list .term-open').first().click();
  const close = page.getByRole('button', { name: 'Close issue details' });
  expect((await paintedColor(close))[3]).toBeGreaterThan(25);
  await expect(close).toHaveCSS('border-top-left-radius', '10px');
  await expect(close.locator('svg')).toHaveCSS('opacity', '1');
  const box = await close.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
  await close.click();
  await expect(page.locator('#item-modal')).toBeHidden();
});

test('separates solid Graphite panels and Slate titlebars with readable boundaries', async ({ page }) => {
  await load(page);
  async function checkSurfaces() {
    for (const surface of await page.locator('.panel:visible, .term-bar:visible, .tracker-tabs:visible, .item-fields:visible, .contrib-stat:visible').all()) {
      const alpha = (await paintedColor(surface))[3] / 255;
      expect(alpha).toBeGreaterThanOrEqual(0.85 - 1 / 255);
      await expect(surface).toHaveCSS('opacity', '1');
    }
    for (const panel of await page.locator('.panel:visible').all()) {
      const border = await paintedColor(panel, 'borderTopColor');
      expect(contrastRatio(border, [42, 43, 47])).toBeGreaterThanOrEqual(3);
    }
  }
  await checkSurfaces();
  await page.locator('#issues-list .term-open').first().click();
  await checkSurfaces();
  await page.keyboard.press('Escape');
  await page.locator('.contrib-card').first().click();
  await checkSurfaces();
});

test('uses an opaque dark neutral footer with readable text', async ({ page }) => {
  await load(page);
  await page.locator('.footer').scrollIntoViewIfNeeded();
  const background = await paintedColor(page.locator('.footer'));
  expect(background[3]).toBe(255);
  expect(Math.max(...background.slice(0, 3))).toBeLessThanOrEqual(36);
  expect(Math.max(...background.slice(0, 3)) - Math.min(...background.slice(0, 3))).toBeLessThanOrEqual(12);
  for (const text of await page.locator('.footer-line, .footer-meta, .footer-legal, .footer a').all()) {
    const foreground = await paintedColor(text, 'color');
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  }
});

test('serves generated minified assets rather than source aliases', async ({ page }) => {
  await load(page);
  const assets = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') || node.getAttribute('href')));
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  for (const file of assets) {
    const url = new URL(file, page.url());
    expect(url.pathname).toMatch(/\.min\.(?:js|css)$/);
    if (url.pathname !== '/vendor/d3.min.js') expect(url.searchParams.get('v')).toBe(version);
    const response = await page.request.get(`/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(url.pathname.endsWith('.css') ? /text\/css/ : /(?:application|text)\/javascript/);
    expect(await response.body()).toEqual(await readFile(url.pathname.slice(1)));
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

test('bypasses cached light-theme styles and scripts when upgrading the site', async ({ page }) => {
  const reused = [];
  // Model the previous one-hour cache entries for unversioned application URLs.
  await page.route(/\/(?:styles\.min\.css|app\.min\.js|space\.min\.js)$/, async (route) => {
    const css = route.request().url().endsWith('.css');
    reused.push(route.request().url());
    await route.fulfill({
      contentType: css ? 'text/css' : 'text/javascript',
      body: css ? 'html{color-scheme:light}body{background:white;color:black}' : 'document.documentElement.dataset.theme = "light";',
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('body')).toHaveClass(/loaded/);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(reused).toEqual([]);
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
  }));
  expect(colors.heading).toBe('rgb(221, 243, 248)');
  expect(colors.panelText).toBe('rgb(221, 243, 248)');
  expect((await paintedColor(page.locator('.footer')))[3]).toBe(255);
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

test('renders vivid blue, cyan, purple, magenta and pink nebula light', async ({ page }) => {
  await load(page);
  await expect(page.locator('.space-nebula-light')).toBeVisible();
  const stops = page.locator('.space-field linearGradient stop');
  expect(await stops.count()).toBeGreaterThanOrEqual(5);
  const hues = [];
  for (const stop of await stops.all()) {
    const rgb = (await paintedColor(stop, 'stopColor')).slice(0, 3);
    const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
    expect(delta).toBeGreaterThanOrEqual(100);
    const hue = max === rgb[0] ? (rgb[1] - rgb[2]) / delta : max === rgb[1] ? 2 + (rgb[2] - rgb[0]) / delta : 4 + (rgb[0] - rgb[1]) / delta;
    hues.push((hue * 60 + 360) % 360);
  }
  for (const [low, high] of [[180, 210], [211, 245], [260, 290], [295, 315], [320, 345]]) {
    expect(hues.some((hue) => hue >= low && hue <= high)).toBe(true);
  }
  const opacity = await page.locator('.space-nebula path').evaluateAll((paths) => Math.max(...paths.map((path) => Number(path.getAttribute('opacity')))));
  expect(opacity).toBeGreaterThanOrEqual(0.1);
});

test('paints background star cores with warm, neutral and blue-white temperature colors', async ({ page }) => {
  await load(page);
  const colors = await page.locator('.space-star').evaluateAll((stars) => [...new Set(stars.map((star) => getComputedStyle(star).fill))]
    .map((color) => color.match(/\d+/g).slice(0, 3).map(Number)));
  expect(colors.length).toBeGreaterThanOrEqual(6);
  expect(colors.some(([r, _g, b]) => r > b + 40)).toBe(true);
  expect(colors.some((rgb) => Math.max(...rgb) - Math.min(...rgb) < 20)).toBe(true);
  expect(colors.some(([r, _g, b]) => b > r + 20)).toBe(true);
});

test('renders orbiters as bright stellar cores with larger centered fading coronas', async ({ page }) => {
  await load(page);
  await expect(page.locator('.orbital-corona')).toHaveCount(3);
  for (const track of await page.locator('.orbit-track').all()) {
    const core = track.locator('.orbital-globe');
    const corona = track.locator('.orbital-corona');
    expect((await paintedColor(core, 'fill')).slice(0, 3).every((channel) => channel >= 220)).toBe(true);
    await expect(core).toHaveCSS('stroke', 'none');
    const small = await core.boundingBox(), large = await corona.boundingBox();
    expect(large.width).toBeGreaterThan(small.width * 3);
    expect(large.x + large.width / 2).toBeCloseTo(small.x + small.width / 2, 1);
    expect(large.y + large.height / 2).toBeCloseTo(small.y + small.height / 2, 1);
    const id = (await corona.getAttribute('fill')).slice(5, -1);
    const gradient = page.locator(`[id="${id}"]`);
    await expect(gradient).toHaveAttribute('cx', '50%');
    await expect(gradient).toHaveAttribute('cy', '50%');
    await expect(gradient.locator('stop').last()).toHaveAttribute('stop-opacity', '0');
  }
});

test('uses warm, neutral and blue-white temperatures for the orbiting stellar halos', async ({ page }) => {
  await load(page);
  const colors = [];
  for (const halo of await page.locator('.orbital-corona').all()) {
    const id = (await halo.getAttribute('fill')).slice(5, -1);
    colors.push((await paintedColor(page.locator(`[id="${id}"] stop`).nth(1), 'stopColor')).slice(0, 3));
  }
  expect(colors.some(([r, _g, b]) => r > b + 40)).toBe(true);
  expect(colors.some((rgb) => Math.max(...rgb) - Math.min(...rgb) < 20)).toBe(true);
  expect(colors.some(([r, _g, b]) => b > r + 20)).toBe(true);
  expect(colors.every(([r, g, b]) => (r >= g && g >= b) || (r <= g && g <= b))).toBe(true);
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
