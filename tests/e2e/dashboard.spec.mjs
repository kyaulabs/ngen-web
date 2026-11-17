// $KYAULabs: dashboard.spec.mjs kyau@aura.kyaulabs 2026/11/16 -0800 Exp $
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { controlNetwork } from '../network.mjs';

const command = 'git clone --recurse-submodules https://github.com/kyaulabs/ngen.git';
test.beforeEach(async ({ page }) => { await controlNetwork(page); });

async function load(page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/loaded/);
  await page.evaluate(() => document.fonts.ready);
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
  await expect(page.locator('.footer-legal')).not.toContainText('Adapted from');
  await expect(page.locator('.footer-legal')).toContainText('No cookies or tracking.');
  await expect(page.locator('.footer-line')).toContainText('Licensed AGPL-3.0.');
  await expect(page.locator('a[href*="github.com/kyaulabs/prism"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('omits the leading release logo without discarding rendered notes', async ({ page }) => {
  await load(page);
  const notes = page.locator('.release-body .md-body').first();
  await expect(notes.locator('h2').first()).toHaveText('Notes');
  await expect(notes).toContainText('Controlled release data for browser verification.');
  await expect(notes).not.toContainText('<picture>');
  await expect(notes).not.toContainText('ngen-wordmark');
  await expect(notes.locator('picture, img')).toHaveCount(0);
  const toggle = page.locator('.release-toggle').first();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(notes).toBeVisible();
});

test('sizes and aligns the profile chevron like Prism punctuation', async ({ page }) => {
  await load(page);
  const metrics = await page.locator('.contrib-card .pkg-cta').first().evaluate((hint) => {
    const context = document.createElement('canvas').getContext('2d');
    context.font = getComputedStyle(hint).font;
    const text = context.measureText('PROFILE');
    const reference = context.measureText('»');
    const range = document.createRange();
    range.selectNodeContents(hint.firstChild);
    const baseline = range.getBoundingClientRect().top + text.fontBoundingBoxAscent;
    const svg = hint.querySelector('svg');
    const box = svg.getBBox();
    const matrix = svg.getScreenCTM();
    const top = new DOMPoint(box.x, box.y).matrixTransform(matrix).y;
    const bottom = new DOMPoint(box.x, box.y + box.height).matrixTransform(matrix).y;
    return {
      referenceHeight: reference.actualBoundingBoxAscent + reference.actualBoundingBoxDescent,
      referenceCenter: baseline + (reference.actualBoundingBoxDescent - reference.actualBoundingBoxAscent) / 2,
      iconHeight: bottom - top,
      iconCenter: (top + bottom) / 2,
    };
  });
  expect(metrics.iconHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.referenceHeight + 1);
  expect(metrics.iconHeight).toBeGreaterThanOrEqual(metrics.referenceHeight - 1);
  expect(Math.abs(metrics.iconCenter - metrics.referenceCenter), JSON.stringify(metrics)).toBeLessThanOrEqual(1);
});

test('matches Prism primary text without changing neutral links', async ({ page }) => {
  await load(page);
  expect(await paintedColor(page.locator('body'), 'color')).toEqual([234, 242, 255, 255]);
  await expect(page.locator('.branch-meta a').first()).toHaveCSS('color', 'rgb(164, 181, 207)');
});

test('preserves Prism neutral link hierarchy without whitening links or dimming metadata below base contrast', async ({ page }) => {
  await load(page);
  const pairs = [
    ['.branch-meta a', '.branch-meta'],
    ['.footer-meta a', '.footer-meta'],
    ['.ticker-item', '.ticker-item .ago'],
  ];
  await page.locator('.contrib-card').first().click();
  await expect(page.locator('.contrib-commit').first()).toBeVisible();
  await page.mouse.move(0, 0);
  pairs.push(['.contrib-commit .cmsg', '.contrib-commit .ago']);
  for (const [linkSelector, metadataSelector] of pairs) {
    const link = await paintedColor(page.locator(linkSelector).first(), 'color');
    const metadata = await paintedColor(page.locator(metadataSelector).first(), 'color');
    expect(link, linkSelector).toEqual([164, 181, 207, 255]); // Prism --ink-1, unchanged.
    expect(metadata.slice(0, 3).every((channel, index) => channel < link[index]), metadataSelector).toBe(true);
    expect(contrastRatio(link, metadata), metadataSelector).toBeGreaterThan(1.5);
    for (const base of [[4, 6, 12], [10, 16, 29], [16, 24, 42]]) {
      expect(contrastRatio(metadata, base), metadataSelector).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.branch-sha').first()).toHaveCSS('color', 'rgb(34, 211, 238)');
  await expect(page.locator('.footer-line a')).toHaveCSS('color', 'rgb(34, 211, 238)');
  const footerLink = page.locator('.footer-meta a').first();
  await footerLink.hover();
  await expect(footerLink).toHaveCSS('color', 'rgb(34, 211, 238)');
  await footerLink.focus();
  await expect(footerLink).toHaveCSS('outline-width', '2px');
});

for (const width of [1920, 390, 320]) {
  test(`shows branch-specific commit times after browse tree at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
    await page.clock.setFixedTime(new Date('2026-11-17T00:15:16Z'));
    await load(page);
    const main = page.locator('.branch-card').filter({ has: page.locator('.branch-name', { hasText: /^main$/ }) });
    const develop = page.locator('.branch-card').filter({ has: page.locator('.branch-name', { hasText: /^develop$/ }) });
    await expect(main.locator('.branch-meta')).toHaveText('browse tree · committed 14d ago');
    await expect(develop.locator('.branch-meta')).toHaveText('browse tree · committed 1h ago');
    await expect(main.locator('.tag-default')).toHaveText('default');
    for (const card of [main, develop]) {
      await expect(card.locator('.tag-protected')).toHaveText('protected');
      const meta = card.locator('.branch-meta');
      await expect(meta).not.toContainText('HEAD pointer');
      await expect(meta).not.toContainText('branch protection status');
      await expect(meta.locator('a')).toHaveAttribute('href', /\/tree\/(?:main|develop)$/);
      await card.locator('.branch-sha').focus();
      await page.keyboard.press('Tab');
      await expect(meta.locator('a')).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const [width, height, scale] of [[1920, 1039, 2], [2560, 1385, 1.5], [3440, 1440, 1]]) {
  test(`fits hero actions at ${width}×${height} CSS pixels and ${scale}× device scale`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await controlNetwork(page);
      await page.goto('http://127.0.0.1:4173/');
      await expect(page.locator('body')).toHaveClass(/loaded/);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => devicePixelRatio)).toBe(scale);
      for (const selector of ['.hero-cta', '.hero-scroll']) {
        const box = await page.locator(selector).boundingBox();
        expect(box.y + box.height, selector).toBeLessThanOrEqual(height);
      }
      expect((await page.locator('.orbital-system').boundingBox()).width).toBeCloseTo(520, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    } finally { await context.close(); }
  });
}

test('keeps hero actions reachable in short and narrow CSS viewports', async ({ page }) => {
  for (const [width, height] of [[1366, 768], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await load(page);
    await page.evaluate(() => document.fonts.ready);
    const action = page.locator('.hero-cta a').last();
    await action.scrollIntoViewIfNeeded();
    const box = await action.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(await action.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
  }
});

test('preserves Prism typography and record casing without framing profile hints', async ({ page }) => {
  await load(page);
  const title = page.locator('#issues-list .t-title').first();
  await expect(title).toHaveText('Review orbital navigation');
  await expect(title).toHaveCSS('text-transform', 'none');
  await expect(title).toHaveCSS('font-weight', '400');
  await expect(title).toHaveCSS('letter-spacing', 'normal');
  await expect(title).toHaveCSS('font-family', /Neo Sans Pro/);
  await expect(page.locator('#issues-list .num').first()).toHaveCSS('font-family', /Operator Mono/);
  const hint = page.locator('.contrib-card .pkg-cta').first();
  await expect(hint).toHaveCSS('padding', '0px');
  await expect(hint).toHaveCSS('border-top-width', '0px');
  await expect(hint).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => {
    const loaded = [...document.fonts].filter((face) => face.status === 'loaded');
    return ['Neo Sans Pro', 'Operator Mono'].map((family) => loaded.some((face) => face.family.includes(family)));
  })).toEqual([true, true]);
  for (const [file, type] of [['NeoSansPro-Regular.ttf', 'font/ttf'], ['OperatorMonoLigNerdFont-Regular.otf', 'font/otf']]) {
    const response = await page.request.get(`/brand/web/fonts/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(type);
  }
});

test('uses Prism colors and translucent materials throughout dark mode', async ({ page }) => {
  await load(page);
  const tokens = await page.locator('html').evaluate((element) => {
    const style = getComputedStyle(element);
    return ['bg', 'surface', 'panel-header', 'surface-alt'].map((key) => style.getPropertyValue(`--ngen-${key}`).trim().toUpperCase());
  });
  expect(tokens).toEqual(['#04060C', '#0A101D', '#10182A', '#10182A']);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#04060c');
  for (const [selector, expected] of [
    ['body', [4, 6, 12, 255]],
    ['.space-background', [4, 6, 12, 255]],
    ['#install', [10, 16, 29, 168]],
    ['#install .term-bar', [16, 24, 42, 140]],
    ['.footer', [4, 6, 12, 255]],
  ]) {
    const color = await paintedColor(page.locator(selector));
    for (let channel = 0; channel < 4; channel++) expect(Math.abs(color[channel] - expected[channel]), selector).toBeLessThanOrEqual(2);
  }
  for (const selector of ['#motion-toggle', '#install', '.footer']) {
    const border = await paintedColor(page.locator(selector), 'borderTopColor');
    // Low-alpha canvas unpremultiplication quantizes RGB more than alpha.
    for (const [channel, expected] of [125, 155, 210, 36].entries()) expect(Math.abs(border[channel] - expected), selector).toBeLessThanOrEqual(channel === 3 ? 1 : 4);
  }
});

test('keeps scrolled header actions unfilled until hovered', async ({ page }) => {
  await load(page);
  await page.locator('#vitals').scrollIntoViewIfNeeded();
  await expect(page.locator('.nav')).toHaveClass(/scrolled/);
  for (const action of await page.locator('.nav-actions > *').all()) {
    await page.mouse.move(0, 100);
    await expect.poll(async () => (await paintedColor(action))[3]).toBe(0);
    await expect.poll(async () => (await paintedColor(action, 'borderTopColor'))[3]).toBe(0);
    await action.hover();
    await expect.poll(async () => (await paintedColor(action))[3]).toBeGreaterThan(0);
    await expect.poll(async () => (await paintedColor(action, 'borderTopColor'))[3]).toBeGreaterThan(0);
  }
  await page.mouse.move(0, 100);
  await page.locator('#motion-toggle').focus();
  await expect(page.locator('#motion-toggle')).toHaveCSS('outline-width', '2px');
});

test('reveals Prism panel borders and the top hairline on hover', async ({ page }) => {
  await load(page);
  const panel = page.locator('#install');
  await panel.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 100);
  expect((await paintedColor(panel, 'borderTopColor'))[3]).toBe(36);
  expect(await panel.evaluate((element) => getComputedStyle(element, '::before').opacity)).toBe('0');
  await expect(panel).not.toHaveCSS('box-shadow', /inset/);
  await panel.hover();
  expect((await paintedColor(panel, 'borderTopColor'))[3]).toBe(77);
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element, '::before').opacity)).toBe('0.85');
});

test('renders local Font Awesome UI icons while retaining accessible control names', async ({ page }) => {
  await load(page);
  const sprite = await page.request.get('/vendor/fontawesome-icons.svg');
  expect(sprite.status()).toBe(200);
  expect(sprite.headers()['content-type']).toContain('image/svg+xml');
  for (const selector of ['#motion-toggle svg', '.nav-gh svg', '.hero-cta svg', '.clone-copy svg', '.kpi-label svg', '.branch-head svg', '.release-chevron']) {
    const icon = page.locator(selector).first();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(icon.locator('use')).toHaveAttribute('href', /^vendor\/fontawesome-icons\.svg#/);
    await expect.poll(() => icon.locator('use').evaluate((element) => element.getBBox().width)).toBeGreaterThan(0);
  }
  await expect(page.getByRole('button', { name: /background animation/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Copy source clone command' })).toHaveCount(1);
});

test('uses traffic-light close controls with visible focus and a full hit target', async ({ page }) => {
  await load(page);
  for (const trigger of ['#issues-list .term-open', '.contrib-card']) {
    await page.locator(trigger).first().focus();
    await page.locator(trigger).first().press('Enter');
    const close = page.locator('.pkg-modal-overlay.on .term-dot-close');
    await expect(close).toBeFocused();
    await expect(close).toHaveCSS('outline-width', '2px');
    await expect(close).toHaveCSS('border-top-width', '0px');
    await expect(close).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const box = await close.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(await close.evaluate((element) => getComputedStyle(element, '::before').backgroundColor)).toBe('rgb(251, 113, 133)');
    await close.press('Tab');
    await page.mouse.move(0, 0);
    await expect(close.locator('svg')).toHaveCSS('opacity', '0');
    await close.hover();
    await expect(close.locator('svg')).toHaveCSS('opacity', '1');
    await close.click();
    await expect(page.locator('.pkg-modal-overlay.on')).toHaveCount(0);
  }
});

test('renders both Prism-derived brand palettes with readable action labels', async ({ page }) => {
  // Reference sources are not application assets; supply their actual bytes at the file boundary.
  await page.route(/\/brand\/web\/(?:ngen-theme\.css|palette-preview\.js)$/, async (route) => {
    const filename = new URL(route.request().url()).pathname.endsWith('.css') ? 'ngen-theme.css' : 'palette-preview.js';
    await route.fulfill({ contentType: filename.endsWith('.css') ? 'text/css' : 'text/javascript', body: await readFile(`brand/web/${filename}`, 'utf8') });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/brand/web/palette-preview.html');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(4, 6, 12)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(237, 240, 248)');
  await page.locator('#theme').selectOption('dark');
  const tokens = JSON.parse(await readFile('brand/web/ngen-tokens.json', 'utf8'));
  expect(tokens.version).toBe('1.4');
  for (const [selector, color] of [
    ['body', [4, 6, 12, 255]],
    ['.panel', [10, 16, 29, 168]],
    ['.panel-title', [16, 24, 42, 140]],
  ]) {
    const rendered = await paintedColor(page.locator(selector));
    for (const [channel, expected] of color.entries()) expect(Math.abs(rendered[channel] - expected)).toBeLessThanOrEqual(2);
  }
  await expect.poll(async () => (await paintedColor(page.locator('.panel'), 'borderTopColor'))[3]).toBe(36);
  await expect.poll(async () => (await paintedColor(page.locator('#theme'), 'borderTopColor'))[3]).toBe(77);
  await page.locator('#theme').selectOption('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(237, 240, 248)');
  expect((await paintedColor(page.locator('.panel')))[3]).toBe(199);
  expect((await paintedColor(page.locator('.panel-title')))[3]).toBe(217);
  await expect.poll(async () => (await paintedColor(page.locator('.panel'), 'borderTopColor'))[3]).toBe(31);
  await expect(page.locator('body')).toHaveCSS('font-family', /Neo Sans Pro/);
  for (const mode of ['dark', 'light']) {
    await page.locator('#theme').selectOption(mode);
    expect(contrastRatio(await paintedColor(page.locator('.action'), 'color'), await paintedColor(page.locator('.action')))).toBeGreaterThanOrEqual(4.5);
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

test('restores compact reference tabs, copy actions, row hover and solid tooltips', async ({ page }) => {
  await load(page);
  const tab = page.locator('#issues-tabs .pkg-tab').first();
  await expect(tab).toHaveCSS('font-family', /Operator Mono/);
  await expect(tab).toHaveCSS('border-bottom-width', '2px');
  await expect(tab).toHaveCSS('border-bottom-color', 'rgb(34, 211, 238)');
  const copy = page.locator('.clone-copy');
  const box = await copy.boundingBox();
  expect(box.width).toBe(26);
  expect(box.height).toBe(26);
  await expect(copy).toHaveCSS('border-top-left-radius', '6px');
  expect((await paintedColor(page.locator('.chart-tip')))[3]).toBe(255);
  const row = page.locator('#issues-list .term-open').first();
  await row.hover();
  await expect.poll(async () => (await paintedColor(row))[3]).toBe(26);
});

test('retains Prism component-specific controls and a prominent primary action', async ({ page }) => {
  await load(page);
  const badgeBox = await page.locator('#feed-badge').boundingBox();
  for (const selector of ['#motion-toggle', '.nav-gh']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.height).toBeCloseTo(badgeBox.height, 1);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
  for (const control of await page.locator('.hero-cta .btn:not(.btn-primary), .hero-chips .chip, .clone-copy').all()) {
    expect((await paintedColor(control))[3] / 255).toBeCloseTo(0.66, 2);
    await expect(control).toHaveCSS('opacity', '1');
    const radius = await control.evaluate((element) => element.classList.contains('clone-copy') ? '6px' : '10px');
    await expect(control).toHaveCSS('border-top-left-radius', radius);
  }
  const primary = page.locator('.hero-cta .btn-primary');
  await expect(primary).toHaveCSS('background-image', /^linear-gradient/);
  await expect(primary).toHaveCSS('color', 'rgb(4, 18, 26)');
  expect((await primary.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.release-tag').first()).toHaveCSS('background-image', /^linear-gradient/);
  await expect(page.locator('.release-tag').first()).toHaveCSS('border-top-left-radius', '7px');
  await expect(page.locator('.release-toggle').first()).toHaveCSS('width', '30px');
  await expect(page.locator('.branch-sha').first()).toHaveCSS('text-transform', 'none');
  const pause = page.locator('#motion-toggle');
  await pause.hover();
  await expect(pause).toHaveCSS('border-top-color', 'rgb(34, 211, 238)');
  await page.mouse.move(0, 0);
  await pause.press('Space');
  await expect(pause).toHaveCSS('outline-style', 'solid');
  await expect(pause).toHaveCSS('outline-width', '2px');
});

test('fits the header motion button to its icon in both playback states', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [width, height] of [[390, 844], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await load(page);
    const pause = page.locator('#motion-toggle');
    for (const pressed of ['true', 'false']) {
      await pause.press('Space');
      await expect(pause).toHaveAttribute('aria-pressed', pressed);
      const size = await pause.evaluate((element) => {
        const style = getComputedStyle(element);
        const glyph = document.createRange();
        glyph.selectNodeContents(element);
        return {
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          intrinsic: glyph.getBoundingClientRect().width
            + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
            + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth),
        };
      });
      expect(size.width).toBeCloseTo(size.intrinsic, 0);
      expect(size.width).toBeGreaterThanOrEqual(24);
      expect(size.height).toBeGreaterThanOrEqual(24);
      await expect(pause).toHaveCSS('outline-width', '2px');
    }
  }
});

test('uses Prism translucent panels, opaque dialogs and unfaded content', async ({ page }) => {
  await load(page);
  async function checkSurfaces() {
    for (const [selector, expected] of [
      ['.panel:visible:not(.pkg-modal)', 0.66],
      ['.pkg-modal:visible', 1],
      ['.term-bar:visible, .tracker-tabs:visible, .item-fields:visible, .contrib-stat:visible', 0.55],
    ]) {
      for (const surface of await page.locator(selector).all()) {
        expect((await paintedColor(surface))[3] / 255).toBeCloseTo(expected, 2);
        await expect(surface).toHaveCSS('opacity', '1');
      }
    }
    for (const panel of await page.locator('.panel:visible').all()) {
      const border = await paintedColor(panel, 'borderTopColor');
      const opacity = await panel.evaluate((element) => element.matches(':hover') ? 0.30 : 0.14);
      expect(border[3] / 255).toBeCloseTo(opacity, 2); // decorative boundary, not a focus indicator
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
  expect(await paintedColor(page.locator('body'), 'color')).toEqual([234, 242, 255, 255]);
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
  expect(await paintedColor(page.locator('#activity h2'), 'color')).toEqual([234, 242, 255, 255]);
  expect(await paintedColor(page.locator('#activity .panel'), 'color')).toEqual([234, 242, 255, 255]);
  expect((await paintedColor(page.locator('.footer')))[3]).toBe(255);
  await page.locator('.footer').scrollIntoViewIfNeeded();
  expect(await background.boundingBox()).toEqual(original);
});

for (const width of [1920, 390, 320]) {
  test(`keeps issue and PR rows borderless while retaining keyboard activation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
    await page.route(/https:\/\/api\.github\.com\/repos\/kyaulabs\/ngen\/(?:issues|pulls)\?/, async (route) => {
      const url = new URL(route.request().url());
      const pr = url.pathname.endsWith('/pulls');
      await route.fulfill({ json: Array.from({ length: 2 }, (_, index) => ({
        number: (pr ? 201 : 101) + index, title: `Controlled ${pr ? 'pull request' : 'issue'} ${index + 1}`,
        state: url.searchParams.get('state'), html_url: `https://github.com/kyaulabs/ngen/${pr ? 'pull' : 'issues'}/${(pr ? 201 : 101) + index}`,
        user: { login: 'kyau', html_url: 'https://github.com/kyau' }, labels: [],
        created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-12T00:00:00Z', body: 'Controlled tracker details.',
      })) });
    });
    await page.route('https://api.github.com/search/issues?**', (route) => route.fulfill({ json: { total_count: 2 } }));
    await load(page);
    for (const prefix of ['issues', 'prs']) {
      const list = page.locator(`#${prefix}-list`);
      await expect(list.locator('..')).toHaveCSS('border-top-width', '1px');
      for (const state of ['open', 'closed']) {
        const tab = page.locator(`#${prefix}-tabs [data-state="${state}"]`);
        await tab.click();
        const rows = list.locator('.term-row');
        await expect(rows).toHaveCount(2);
        for (const row of await rows.all()) {
          await expect(row).toHaveCSS('border-bottom-width', '0px');
          const button = row.locator('.term-open');
          await expect(button).toHaveCSS('border-width', '0px');
          await expect(button).toHaveCSS('border-radius', '0px');
        }
        const first = rows.first().locator('.term-open');
        const resting = await first.evaluate((element) => getComputedStyle(element).backgroundColor);
        await first.hover();
        await expect(first).toHaveCSS('border-width', '0px');
        await expect(first).not.toHaveCSS('background-color', resting);
        await page.mouse.move(0, 0);
        await tab.focus(); await page.keyboard.press('Tab'); await first.focus();
        await expect(first).toHaveCSS('outline-style', 'solid');
        await expect(first).toHaveCSS('outline-width', '2px');
        await expect(first).toHaveCSS('outline-offset', '-3px');
        await first.press('Enter');
        await expect(page.locator('#item-modal')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(first).toBeFocused();
      }
    }
    await page.evaluate(() => document.activeElement.blur());
    await page.mouse.move(0, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#tracker .grid-tracker').screenshot({ path: `tests/Browser/Screenshots/visual-review/tracker-rows-${width}.png`, animations: 'disabled' });
  });
}

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
