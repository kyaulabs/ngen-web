// $KYAULabs: helpers.test.js kyau@aura.kyaulabs 2026/11/13 -0800 Exp $
import { FixtureSynth as Synth } from '../fixtures.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Utils, Markdown, Tip, Docs } from '../../app.js';

afterEach(() => { vi.useRealTimers(); });

describe('formatting and safety helpers', () => {
  it('generates repeatable random numbers bounded to [0, 1)', () => {
    const a = Utils.mulberry32(42), b = Utils.mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const n = a();
      expect(n).toBe(b());
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
  it('escapes HTML and treats nullish values as empty', () => {
    expect(Utils.esc('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(Utils.esc(null)).toBe('');
    expect(Utils.esc(undefined)).toBe('');
    expect(Utils.clamp(-1, 0, 10)).toBe(0);
    expect(Utils.clamp(11, 0, 10)).toBe(10);
    expect(Utils.clamp(5, 0, 10)).toBe(5);
  });
  it.each([['dependabot[bot]', true], ['App[BOT]', true], ['kyaulabs-bot', false], [null, false]])('classifies app login %s', (login, expected) => {
    expect(Utils.isAppLogin(login)).toBe(expected);
  });
  it.each([['release/1.2.3', true], ['release/1.2', false], ['main', false], [null, false]])('classifies release branch %s', (name, expected) => {
    expect(Utils.isReleaseBranch(name)).toBe(expected);
  });
  it('debounces with the most recent arguments', () => {
    vi.useFakeTimers();
    const fn = vi.fn(), debounced = Utils.debounce(fn, 100);
    debounced(1); debounced(2);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
  });
  it('formats counts, volumes, dates and colors', () => {
    expect(Utils.fmtInt(1234.6)).toBe('1,235');
    expect(Utils.fmtCompact(1200)).toBe('1.2K');
    expect(Utils.fmtBytes(1)).toBe('1.0 B');
    expect(Utils.fmtBytes(1024)).toBe('1.0 KB');
    expect(Utils.fmtBytes(1024 * 100)).toBe('100 KB');
    expect(Utils.fmtBytes(1024 ** 4)).toBe('1024 GB');
    expect(Utils.fmtDate(new Date('2026-01-01T12:00:00Z'))).toContain('2026');
    expect(Utils.fmtMonthYear(new Date('2026-01-01T12:00:00Z'))).toBe('Jan 2026');
    expect(Utils.hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(Utils.hexToRgb('#010203')).toEqual({ r: 1, g: 2, b: 3 });
    expect(Utils.rgba('#010203', 0.5)).toBe('rgba(1,2,3,0.5)');
    expect(Utils.rgba('invalid', 1)).toBe('rgba(128,148,178,1)');
    expect(Utils.contrastInk('#fff')).toBe('#0b1424');
    expect(Utils.contrastInk('#000')).toBe('#ffffff');
    expect(Utils.contrastInk('invalid')).toBe('#ffffff');
    document.documentElement.style.setProperty('--test', '  red  ');
    expect(Utils.cssVar('--test')).toBe('red');
  });
  it.each([[0, 'just now'], [120, '2m ago'], [7200, '2h ago'], [172800, '2d ago'], [86400 * 61, '2mo ago'], [86400 * 800, '2y ago']])('formats relative age %s', (seconds, text) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    expect(Utils.timeAgo(new Date(Date.now() - seconds * 1000).toISOString())).toBe(text);
  });
});

describe('safe Markdown rendering', () => {
  it.each([
    ['', ''], ['<!-- hidden -->', ''], ['# Title', '<h1>Title</h1>'],
    ['---', '<hr>'], ['> Quote', '<blockquote><p>Quote</p></blockquote>'],
    ['hello\r\nworld', '<p>hello world</p>'], ['hello  \nworld', '<p>hello<br>world</p>'],
    ['```js\n<x>\n```', '<pre><code>&lt;x&gt;</code></pre>'],
    ['```\nunclosed', '<pre><code>unclosed</code></pre>'],
    ['<script>alert(1)</script>', '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'],
    ['**bold** __also__ *italic* _also_ ~~gone~~', '<p><strong>bold</strong> <strong>also</strong> <em>italic</em> <em>also</em> <del>gone</del></p>'],
    ['`<b>`', '<p><code>&lt;b&gt;</code></p>'],
  ])('renders %s', (source, expected) => expect(Markdown.render(source)).toBe(expected));
  it('renders nested lists, continuations, ordered lists and task states', () => {
    const result = Markdown.render('- parent\n  - child\n    continued\n- [x] done\n- [ ] todo\n\n1. first\n2. second');
    expect(result).toContain('<ul><li>child continued</li></ul>');
    expect(result).toContain('aria-label="Completed task"');
    expect(result).toContain('aria-label="Incomplete task"');
    expect(result).toContain('<ol><li>first</li><li>second</li></ol>');
  });
  it('renders aligned tables and rejects mismatched delimiters', () => {
    const result = Markdown.render('| L | C | R | N |\n| :-- | :-: | --: | -- |\n| a | b | c | d |\n\nnext');
    expect(result).toContain('text-align:left');
    expect(result).toContain('text-align:center');
    expect(result).toContain('text-align:right');
    expect(result).toContain('<td>d</td>');
    expect(Markdown.render('A | B\n-- | --')).not.toContain('<tbody>');
    expect(Markdown.render('A | B\n--')).not.toContain('<table>');
    expect(Markdown.render('prose\nA | B\n-- | --')).toContain('<p>prose</p>');
  });
  it('allows safe links/images, rejects unsafe schemes and keeps code literal', () => {
    const result = Markdown.render('[safe](https://example.com) [mail](mailto:a@example.com) [bad](javascript:evil) ![image](https://example.com/a.png) ![bad](data:evil) @kyau https://example.com. `**literal**` `abcdef0` 1234567');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('href="mailto:a@example.com"');
    expect(result).not.toMatch(/javascript:|data:evil/);
    expect(result).toContain('loading="lazy"');
    expect(result).toContain('href="https://github.com/kyau"');
    expect(result).toContain('<code>**literal**</code>');
    expect(result).toContain('/commit/abcdef0');
    expect(result).not.toContain('/commit/1234567');
    expect(Markdown.render('```\nabcdef0 1234567\n```')).toContain('/commit/abcdef0');
    expect(Markdown.render('https://example.com/path')).toContain('>https://example.com/path</a>');
  });
});

describe('synthetic data invariants', () => {
  it('preserves weekly totals and stable daily allocations', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-07T12:00:00Z'));
    const weekly = [0, 1, 57];
    const days = Synth.daysFromWeekly(weekly);
    expect(days).toEqual(Synth.daysFromWeekly(weekly));
    expect(days).toHaveLength(21);
    weekly.forEach((total, i) => expect(days.slice(i * 7, i * 7 + 7).reduce((sum, d) => sum + d.count, 0)).toBe(total));
    expect(days.some((d) => d.future)).toBe(true);
    expect(Synth.daysFromWeekly([])).toEqual([]);
  });
  it.each(['issue', 'pr'])('builds bounded, structured %s rows', (kind) => {
    for (const state of ['open', 'closed']) {
      const rows = Synth.trackerRows(kind, state, 99);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(8);
      for (const row of rows) {
        expect(row.state).toBe(state);
        expect(row.body).toContain('## ');
        expect(row.url).toContain('github.com/kyaulabs/ngen/');
        expect(row.closedAt !== null).toBe(state === 'closed');
      }
    }
    expect(Synth.trackerRows(kind, 'open', 0)).toEqual([]);
  });
  it('marks projected releases and creates bounded commit SHAs', () => {
    const releases = Synth.releases();
    expect(releases.every((r) => r.synthetic)).toBe(true);
    expect(releases.filter((r) => r.latest)).toHaveLength(1);
    for (const c of Synth.tickerCommits()) expect(c.sha).toMatch(/^[a-f0-9]{7}$/);
  });
});

describe('tooltips and docs tabs', () => {
  it('positions, flips and hides tooltips, tolerating missing markup', () => {
    document.body.innerHTML = '<div id="chart-tip"></div>';
    Tip.init(); Tip.show('<b>tip</b>', 40, 50);
    expect(Tip.el.classList.contains('on')).toBe(true);
    expect(Tip.el.style.left).toBe('56px');
    Tip.move(window.innerWidth, 0);
    expect(Tip.el.style.left).toBe(`${window.innerWidth - 16}px`);
    expect(Tip.el.style.top).toBe('18px');
    Tip.hide(); expect(Tip.el.classList.contains('on')).toBe(false);
    document.body.innerHTML = ''; Tip.init(); Tip.show('', 0, 0); Tip.move(0, 0); Tip.hide();
  });
  it('splits markdown into sections without dropping content', () => {
    expect(Docs._splitSections(null)).toEqual([]);
    const md = '# Title\r\n\r\nIntro\r\n## Usage\r\nUse it\r\n## License\r\nMIT';
    expect(Docs._splitSections(md)).toHaveLength(3);
    expect(Docs._splitSections(md).map((section) => section.title)).toEqual(['Overview', 'Usage', 'License']);
  });
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
