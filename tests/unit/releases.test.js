// $KYAULabs: releases.test.js kyau@aura.kyaulabs 2026/11/16 -0800 Exp $
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { API, SNAPSHOT, UI, Markdown, ReleaseModal, Utils } from '../../app.js';

const base = 'https://github.com/kyaulabs/ngen';
const asset = { name: 'ngen-source.tar.gz', browser_download_url: `${base}/releases/download/v1/ngen-source.tar.gz` };
const release = { tag: 'v1', name: 'Controlled release', date: '2026-11-16T12:00:00Z', url: `${base}/releases/tag/v1`, latest: true, body: '## Downloads\n\n| File | Purpose |\n|---|---|\n| `ngen-source.tar.gz` | Source |\n| `missing.zip` | Unavailable asset |', assets: [{ name: asset.name, url: asset.browser_download_url }] };
let copyHandler;
beforeEach(() => {
  ReleaseModal.close();
  Utils.reducedMotion = true;
  sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('requestAnimationFrame', (callback) => { callback(); return 1; });
  document.body.innerHTML = '<div id="releases-list"></div><div id="release-changelog-modal" hidden><div class="pkg-modal" role="dialog" aria-modal="true" aria-labelledby="release-changelog-title" tabindex="-1"></div></div>';
  ReleaseModal.init();
});
afterEach(() => {
  ReleaseModal.close(); Utils.reducedMotion = true;
  if (copyHandler) document.removeEventListener('click', copyHandler);
  copyHandler = undefined;
  delete document.execCommand;
  vi.useRealTimers();
});

it('preserves actual asset filenames and download URLs from the release API', async () => {
  fetch.mockImplementation(async (input) => {
    const path = new URL(input).pathname;
    const data = path === '/repos/kyaulabs/ngen' ? SNAPSHOT.repo : path.endsWith('/releases')
      ? [{ tag_name: 'v1', name: release.name, body: release.body, published_at: release.date, html_url: release.url, assets: [asset] }] : [];
    return { ok: true, status: 200, json: async () => data, headers: { get: () => null } };
  });
  const data = await API.loadAll();
  expect(data.releases[0].assets).toEqual(release.assets);
});
it('links known download table filenames without inventing assets or changing code examples', () => {
  const body = `${release.body}\n\n## Example\n\n\`ngen-source.tar.gz\`\n\n\`\`\`text\nngen-source.tar.gz\n\`\`\``;
  UI.renderReleases({ releases: [{ ...release, body }] });
  const link = document.querySelector('.md-body td a');
  expect(link?.getAttribute('href')).toBe(asset.browser_download_url);
  expect(link.textContent).toBe(asset.name);
  expect(document.querySelectorAll('.md-body td a')).toHaveLength(1);
  expect(document.querySelectorAll('.md-body pre a, .md-body > p a')).toHaveLength(0);
  expect(document.querySelector('.md-body').textContent).toContain('missing.zip');
});
it.each([
  'javascript:alert(1)', 'https://evil.example/ngen-source.tar.gz',
  `${base}/releases/download/v2/ngen-source.tar.gz`, `${base}/releases/download/v1/another.zip`,
  'https://someone@github.com/kyaulabs/ngen/releases/download/v1/ngen-source.tar.gz',
  `${base}/releases/download/v1/%ZZ`,
])('keeps filenames literal when download metadata is unsafe or mismatched: %s', (url) => {
  UI.renderReleases({ releases: [{ ...release, assets: [{ name: asset.name, url }] }] });
  expect(document.querySelectorAll('.md-body td a')).toHaveLength(0);
  expect(document.querySelector('.md-body').textContent).toContain(asset.name);
});

it('preserves existing markdown download links and tolerates missing asset metadata', () => {
  const body = release.body.replace('`ngen-source.tar.gz`', '[`ngen-source.tar.gz`](https://github.com/kyaulabs/ngen/releases/tag/v1)');
  UI.renderReleases({ releases: [{ ...release, body }] });
  expect(document.querySelector('.md-body td a').getAttribute('href')).toBe(release.url);
  expect(document.querySelectorAll('.md-body a a')).toHaveLength(0);
  UI.renderReleases({ releases: [{ ...release, assets: null }] });
  expect(document.querySelectorAll('.md-body td a')).toHaveLength(0);
});
it('moves only the changelog section out of the main release notes', () => {
  const body = '## Notes\nKeep the release summary.\n\n## 📜 Changelog\n### Fixes\nHistory-only entry.\n\n## Security\nKeep the security notice.';
  const html = Markdown.renderRelease(body);
  expect(html).toContain('Keep the release summary.');
  expect(html).toContain('Keep the security notice.');
  expect(html).not.toContain('History-only entry.');
  expect(Markdown.splitRelease(body).changelog).toBe('### Fixes\nHistory-only entry.');
});
it('preserves literal comments, markup and whitespace inside copyable fenced code', () => {
  const code = '  <!-- keep this comment -->\n<script>not executed</script>\n\n\tvalue  ';
  UI.renderReleases({ releases: [{ ...release, body: `<!-- prose comment -->\n\n\`\`\`html\n${code}\n\`\`\`` }] });
  expect(document.querySelector('.release-code code').textContent).toBe(code);
  expect(document.querySelectorAll('.md-body script')).toHaveLength(0);
  expect(document.querySelector('.md-body').textContent).not.toContain('prose comment');
});
it.each([
  '## Notes\n\n```md\n## Changelog\nAn example.\n```',
  '## Notes\n\n<!--\n## Changelog\nHidden comment.\n-->',
  '## Notes\n\n## Changelog\n',
  '## Notes\n\n> ## Changelog\n> Quoted example.',
])('does not create a changelog action for literal, commented or empty headings', (body) => {
  UI.renderReleases({ releases: [{ ...release, body }] });
  expect(document.querySelector('.release-changelog')).toBeNull();
});

it('separates real history after a fenced example and tolerates absent notes', () => {
  const body = '```md\n## Changelog\nExample only.\n```\n\n## CHANGELOG\nReal history.';
  expect(Markdown.splitRelease(body).changelog).toBe('Real history.');
  expect(Markdown.splitRelease(body).notes).toContain('Example only.');
  expect(Markdown.splitRelease(null)).toEqual({ notes: '', changelog: '' });
});

it('opens history for a non-latest release without expanding it, and restores focus on dismissal', () => {
  const body = '## Notes\nSummary.\n\n## Changelog\n- **fix:** Keep history.\n\n```sh\nprintf "<safe>"\n```';
  UI.renderReleases({ releases: [{ ...release, body, latest: false }] });
  const trigger = document.querySelector('.release-changelog'); trigger.focus(); trigger.click();
  expect(document.querySelector('.badge-latest')).toBeNull();
  expect(document.querySelector('.release-card').classList.contains('expanded')).toBe(false);
  expect(document.querySelector('.release-body').textContent).not.toContain('Keep history.');
  expect(ReleaseModal.el.hidden).toBe(false);
  expect(ReleaseModal.box.textContent).toContain('Keep history.');
  expect(ReleaseModal.box.querySelector('.release-code code').textContent).toBe('printf "<safe>"');
  expect(document.activeElement).toBe(ReleaseModal.box.querySelector('button'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(ReleaseModal.el.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
  trigger.click(); ReleaseModal.box.querySelector('button').click();
  expect(ReleaseModal._open).toBe(false);
  trigger.click(); ReleaseModal.el.click();
  expect(ReleaseModal._open).toBe(false);
});

it('does not let an old fade-out hide a newly reopened changelog', () => {
  vi.useFakeTimers(); Utils.reducedMotion = false;
  ReleaseModal.open(release, '## History\nFirst open.');
  ReleaseModal.close();
  ReleaseModal.open(release, '## History\nReopened.');
  vi.advanceTimersByTime(300);
  expect(ReleaseModal.el.hidden).toBe(false);
  expect(ReleaseModal.box.textContent).toContain('Reopened.');
  ReleaseModal.close(); vi.advanceTimersByTime(300);
  expect(ReleaseModal.el.hidden).toBe(true);
});

it('copies full code through the fallback and never reports failed copying as success', async () => {
  UI.renderReleases({ releases: [{ ...release, body: '```text\n  first\n\nlast  \n```\n\n```text\n```' }] });
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => { if (type === 'click') copyHandler = listener; add(type, listener, options); });
  UI.bindCloneCopy();
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  document.execCommand = vi.fn(() => false);
  const button = document.querySelector('.release-code button'); button.click();
  await vi.waitFor(() => expect(document.querySelector('.code-copy-status').textContent).toContain('Copy failed'));
  expect(button.querySelector('use').getAttribute('href')).toContain('#copy');
  expect(document.querySelectorAll('textarea')).toHaveLength(0);
  document.execCommand = vi.fn(() => true); button.click();
  await vi.waitFor(() => expect(document.querySelector('.code-copy-status').textContent).toBe('Code block copied.'));
  expect(document.querySelectorAll('.release-code button')[1].disabled).toBe(true);
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
