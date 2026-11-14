// $KYAULabs: app.js kyau@aura.kyaulabs 2026/11/13 -0800 Exp $
/* NGEN telemetry dashboard. Adapted from the KYAU Labs Prism dashboard (AGPL-3.0).
   Public GitHub data is untrusted; escape text and sanitize markdown links.
   Snapshot: data/snapshot.json. Missing record feeds remain empty. */
'use strict';

/* ----------------------------------------------------------------------------
 * CONFIG — compile-time constants.
 * ------------------------------------------------------------------------- */
const CONFIG = {
  owner: 'kyaulabs',          // GitHub organization
  repo: 'ngen',              // repository name
  repoId: 0x4e47454e,         // stable NGEN seed for the estimated daily matrix
  apiBase: 'https://api.github.com',
  cacheKey: 'ngen.telemetry.v1.',  // sessionStorage namespace prefix
  cacheTTLms: 10 * 60 * 1000,       // 10 minute cache lifetime
  perPage: { commits: 14, issues: 30, pulls: 12, releases: 8, branches: 100, contributors: 10 },
};

/* ----------------------------------------------------------------------------
 * SNAPSHOT — public repository metrics captured 2026-11-13 (UTC) via REST.
 * Used only when the live API cannot be reached; keeps the dashboard honest.
 * ------------------------------------------------------------------------- */
const SNAPSHOT = {
  "fetchedAt": "2026-11-13T01:05:03.505733+00:00",
  "repo": {
    "full_name": "kyaulabs/ngen",
    "description": null,
    "stargazers_count": 0,
    "forks_count": 0,
    "subscribers_count": 0,
    "open_issues_count": 0,
    "language": "JavaScript",
    "license": {
      "key": "agpl-3.0",
      "name": "GNU Affero General Public License v3.0",
      "spdx_id": "AGPL-3.0",
      "url": "https://api.github.com/licenses/agpl-3.0",
      "node_id": "MDc6TGljZW5zZTE="
    },
    "created_at": "2026-11-02T04:27:01Z",
    "pushed_at": "2026-11-13T00:21:07Z",
    "default_branch": "main",
    "html_url": "https://github.com/kyaulabs/ngen",
    "homepage": ""
  },
  "languages": {
    "JavaScript": 217
  },
  "weekly": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  "contributors": [
    {
      "login": "kyau",
      "id": 470450,
      "node_id": "MDQ6VXNlcjQ3MDQ1MA==",
      "avatar_url": "https://avatars.githubusercontent.com/u/470450?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/kyau",
      "html_url": "https://github.com/kyau",
      "followers_url": "https://api.github.com/users/kyau/followers",
      "following_url": "https://api.github.com/users/kyau/following{/other_user}",
      "gists_url": "https://api.github.com/users/kyau/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/kyau/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/kyau/subscriptions",
      "organizations_url": "https://api.github.com/users/kyau/orgs",
      "repos_url": "https://api.github.com/users/kyau/repos",
      "events_url": "https://api.github.com/users/kyau/events{/privacy}",
      "received_events_url": "https://api.github.com/users/kyau/received_events",
      "type": "User",
      "user_view_type": "public",
      "site_admin": false,
      "contributions": 1
    }
  ],
  "branches": [
    {
      "name": "develop",
      "sha": "4b554cccf9355ce36fa90e4896a694b4654279d6",
      "protected": true
    },
    {
      "name": "feat/kyau-023ba5-m3-flight",
      "sha": "62a984db10387c7e5721476ddee3abfaf0df2f2e",
      "protected": true
    },
    {
      "name": "main",
      "sha": "fde375bb74c523477a6ad8ee8b45b9782af6bb08",
      "protected": true
    }
  ],
  "counts": {
    "issuesOpen": 0,
    "issuesClosed": 0,
    "prsOpen": 0,
    "prsClosed": 9
  }
};

const Utils = {
  /** @type {boolean} True when the user prefers reduced motion. */
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  /**
   * Deterministic PRNG (mulberry32). Tiny, fast, and seedable so synthetic
   * data is stable between page loads.
   * @param {number} seed - Unsigned 32-bit seed.
   * @returns {() => number} Generator producing floats in [0, 1).
   */
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  /** Query a single element. @returns {Element|null} */
  $(sel, root = document) { return root.querySelector(sel); },

  /**
   * Escape user- or API-supplied text for safe HTML interpolation.
   * @param {string} s
   * @returns {string}
   */
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  /** Clamp `v` into [min, max]. */
  clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },

  /**
   * True for GitHub App logins of the form "dependabot[bot]". Regular user
   * accounts whose name merely ends in "-bot" (e.g. "kyaulabs-bot") pass.
   * @param {string} login
   * @returns {boolean}
   */
  isAppLogin(login) { return /\[bot\]$/i.test(String(login ?? '')); },

  /**
   * True for release maintenance branches of the form `release/X.Y.Z`.
   * @param {string} name
   * @returns {boolean}
   */
  isReleaseBranch(name) { return /^release\/\d+\.\d+\.\d+$/.test(String(name ?? '')); },

  /**
   * Debounce a function.
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  debounce(fn, ms) {
    let id = 0;
    return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
  },

  /** Format an integer with locale grouping: 1234 → "1,234". */
  fmtInt(n) { return Math.round(n).toLocaleString('en-US'); },

  /** Compact notation: 1234 → "1.2K" (via Intl). */
  fmtCompact(n) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  },

  /**
   * Human-readable byte volume.
   * @param {number} bytes
   * @returns {string} e.g. "992.8 KB" / "3.1 MB"
   */
  fmtBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = bytes, u = 0;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
  },

  /**
   * Relative timestamp: "just now", "4h ago", "3d ago", "5mo ago".
   * @param {string} iso - ISO-8601 date string.
   * @returns {string}
   */
  timeAgo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`;
    const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`;
    const d = h / 24; if (d < 30) return `${Math.floor(d)}d ago`;
    const mo = d / 30.44; if (mo < 12) return `${Math.floor(mo)}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  },

  /**
   * Long date for tooltips: "Mon, Jul 21 2026".
   * @param {Date} d
   * @returns {string}
   */
  fmtDate(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  },

  /** Short month-year: "Jul 2026". */
  fmtMonthYear(d) {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  },

  /**
   * Read a CSS custom property from :root (theme-aware chart palettes).
   * @param {string} name - e.g. '--accent'.
   * @returns {string} Trimmed value, '' when undefined.
   */
  cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  },

  /**
   * Parse a hex color (#rgb / #rrggbb) into RGB components.
   * @param {string} hex
   * @returns {{r:number,g:number,b:number}}
   */
  hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  },

  /**
   * Build an rgba() string from a hex color and alpha.
   * Falls back to a neutral gray when the input is not parseable hex.
   * @param {string} hex
   * @param {number} a - Alpha in [0, 1].
   * @returns {string}
   */
  rgba(hex, a) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return `rgba(128,148,178,${a})`;
    const { r, g, b } = Utils.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  },

  /**
   * Pick a readable text color (near-black or white) for a given hex fill.
   * Uses the WCAG relative-luminance threshold.
   * @param {string} hex
   * @returns {string}
   */
  contrastInk(hex) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return '#ffffff';
    const { r, g, b } = Utils.hexToRgb(hex);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.55 ? '#0b1424' : '#ffffff';
  },
};

/* ----------------------------------------------------------------------------
 * Markdown — dependency-free GitHub-flavored markdown → HTML renderer.
 * Renders release-note bodies. Source text is escaped FIRST; the formatter
 * then reintroduces a whitelisted set of tags, so no raw HTML (or script)
 * from upstream release bodies can ever reach the DOM.
 * ------------------------------------------------------------------------- */
const Markdown = {
  /**
   * Render markdown source to an HTML string.
   * @param {string} src
   * @returns {string}
   */
  render(src) {
    if (!src) return '';
    /* Strip HTML comments up front (git-cliff et al. stamp "auto-generated"
       banners into release bodies) — they must not surface as escaped text. */
    const lines = String(src).replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      /* Blank line — block separator. */
      if (!line.trim()) { i++; continue; }

      /* Fenced code block. */
      if (/^\s*```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // consume the closing fence (or run off the end of input)
        out.push(`<pre><code>${this._linkShas(Utils.esc(buf.join('\n')))}</code></pre>`);
        continue;
      }

      /* ATX heading. */
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const lvl = h[1].length;
        out.push(`<h${lvl}>${this._inline(h[2].trim())}</h${lvl}>`);
        i++; continue;
      }

      /* Thematic break. */
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      /* GFM table — a row containing pipes whose NEXT line is a delimiter
         row of dashes. Column counts must match (GFM rule), so prose lines
         that merely contain a pipe never false-positive. */
      if (line.includes('|') && i + 1 < lines.length) {
        const head = this._tableCells(line);
        if (this._isTableDelim(lines[i + 1], head.length)) {
          const aligns = this._tableAligns(lines[i + 1]);
          const align = (n) => (aligns[n] ? ` style="text-align:${aligns[n]}"` : '');
          const rows = [];
          i += 2;
          while (i < lines.length && lines[i].trim() && lines[i].includes('|')
                 && !/^(?:#{1,6}\s|```|\s*>|\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i])) {
            rows.push(this._tableCells(lines[i]));
            i++;
          }
          out.push(
            `<div class="md-table-wrap"><table><thead><tr>${head.map((c, n) => `<th${align(n)}>${this._inline(c)}</th>`).join('')}</tr></thead>`
            + (rows.length
              ? `<tbody>${rows.map((r) => `<tr>${r.map((c, n) => `<td${align(n)}>${this._inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
              : '')
            + '</table></div>',
          );
          continue;
        }
      }

      /* Blockquote — recurse on the de-quoted lines. */
      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push(`<blockquote>${this.render(buf.join('\n'))}</blockquote>`);
        continue;
      }

      /* List (unordered / ordered, indentation-nested). */
      if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
        const parsed = this._list(lines, i);
        out.push(parsed.html);
        i = parsed.next;
        continue;
      }

      /* Paragraph — consume until a blank line or the start of another block. */
      const buf = [];
      while (i < lines.length && lines[i].trim()
             && !/^(?:#{1,6}\s|```|\s*>|\s*(?:[-*+]|\d+[.)])\s|\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i])
             && !(lines[i].includes('|') && i + 1 < lines.length
                  && this._isTableDelim(lines[i + 1], this._tableCells(lines[i]).length))) {
        buf.push(lines[i]);
        i++;
      }
      out.push(`<p>${this._inline(buf.join('\n')).replace(/ {2,}\n/g, '<br>').replace(/\n/g, ' ')}</p>`);
    }
    return out.join('\n');
  },

  /**
   * Parse a (possibly indentation-nested) list starting at lines[start].
   * @param {string[]} lines
   * @param {number} start
   * @returns {{html: string, next: number}} HTML and the next unconsumed line.
   */
  _list(lines, start) {
    const baseIndent = /^\s*/.exec(lines[start])[0].length;
    const ordered = /^\s*\d+[.)]\s/.test(lines[start]);
    const tag = ordered ? 'ol' : 'ul';
    const items = [];
    let i = start;

    while (i < lines.length && lines[i].trim()) {
      const line = lines[i];
      const indent = /^\s*/.exec(line)[0].length;
      const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);

      if (item && indent === baseIndent) {
        /* GFM task-list marker (`- [ ]` / `- [x]`) — rendered as a fake
           checkbox (visual only, the popup has no forms). */
        const task = /^\[( |x|X)\]\s+/.exec(item[1]);
        items.push({
          text: task ? item[1].slice(task[0].length) : item[1],
          sub: '',
          task: task ? task[1].toLowerCase() === 'x' : null,
        });
        i++;
      } else if (item && indent > baseIndent && items.length) {
        /* Nested list — recurse and attach it to the previous item. */
        const sub = this._list(lines, i);
        items[items.length - 1].sub += sub.html;
        i = sub.next;
      } else if (!item && indent > baseIndent && items.length) {
        /* Lazy continuation line of the previous item. */
        items[items.length - 1].text += ` ${line.trim()}`;
        i++;
      } else break;
    }

    /* When a list contains task items its bullets are suppressed entirely
       (GitHub style) — checkboxes replace the markers. */
    const hasTask = items.some((it) => it.task !== null);
    const html = `<${tag}${hasTask ? ' class="contains-task-list"' : ''}>${items.map((it) => {
      if (it.task === null) return `<li>${this._inline(it.text)}${it.sub}</li>`;
      const box = `<span class="md-check${it.task ? ' checked' : ''}" role="img" aria-label="${it.task ? 'Completed' : 'Incomplete'} task"></span>`;
      return `<li class="task-item">${box}${this._inline(it.text)}${it.sub}</li>`;
    }).join('')}</${tag}>`;
    return { html, next: i };
  },

  /**
   * Split a GFM table row into trimmed cells (edge pipes dropped).
   * @param {string} line
   * @returns {string[]}
   */
  _tableCells(line) {
    return String(line).trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  },

  /**
   * Is `line` a GFM delimiter row with exactly `cols` columns?
   * @param {string} line
   * @param {number} cols - Column count the header row established.
   * @returns {boolean}
   */
  _isTableDelim(line, cols) {
    const cells = this._tableCells(line);
    return cells.length === cols && cells.every((c) => /^:?-+:?$/.test(c));
  },

  /**
   * Per-column alignment parsed from a delimiter row (`:---`, `---:`, `:---:`).
   * @param {string} line
   * @returns {string[]} '', 'left', 'center' or 'right' per column.
   */
  _tableAligns(line) {
    return this._tableCells(line).map((c) => {
      const l = c.startsWith(':'), r = c.endsWith(':');
      return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
    });
  },

  /**
   * Linkify commit SHAs inside already-escaped text: 7–40 hex chars with at
   * least one a–f digit, so plain decimal numbers never false-positive.
   * @param {string} html - Escaped HTML text.
   * @returns {string}
   */
  _linkShas(html) {
    return html.replace(/\b(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/gi,
      (sha) => `<a class="commit-ref" href="https://github.com/${CONFIG.owner}/${CONFIG.repo}/commit/${sha}" target="_blank" rel="noopener">${sha}</a>`);
  },

  /**
   * Render inline markdown (code spans, links, emphasis, mentions) for one
   * text run. Code spans are extracted BEFORE escaping so their contents
   * stay literal and cannot be re-interpreted as formatting.
   * @param {string} text
   * @returns {string}
   */
  _inline(text) {
    const codes = [];
    let t = String(text).replace(/`([^`\n]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
    t = Utils.esc(t);

    /* Images: ![alt](src) — https? sources only, anything else drops to alt. */
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, src) =>
      /^https?:\/\//i.test(src)
        ? `<img src="${src}" alt="${alt}" loading="lazy">`
        : alt);

    /* Links: [text](href) — https?/mailto targets only. */
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, txt, href) =>
      /^(?:https?:\/\/|mailto:)/i.test(href)
        ? `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`
        : txt);

    /* Bare URLs — trailing sentence punctuation stays outside the anchor. */
    t = t.replace(/(^|[\s(])((?:https?:\/\/)[^\s<]+)/g, (m, pre, url) => {
      const trail = /[.,;:!?)\]'"]+$/.exec(url)?.[0] || '';
      const clean = url.slice(0, url.length - trail.length);
      return `${pre}<a href="${clean}" target="_blank" rel="noopener">${clean}</a>${trail}`;
    });

    /* @mentions → GitHub profile links. */
    t = t.replace(/(^|[\s(])@([a-zA-Z0-9][a-zA-Z0-9-]*)/g,
      '$1<a href="https://github.com/$2" target="_blank" rel="noopener">@$2</a>');

    /* Emphasis. */
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1<em>$2</em>');
    t = t.replace(/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, '$1<em>$2</em>');
    t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    /* Restore literal code spans (escaped on the way back in). A span that
       is exactly a commit SHA links to that commit on GitHub — tracker
       bodies list commit signatures this way (e.g. COMMITS tabs). */
    t = t.replace(/\u0000(\d+)\u0000/g, (_, n) => {
      const code = codes[+n];
      return /^(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}$/i.test(code)
        ? `<a class="commit-ref" href="https://github.com/${CONFIG.owner}/${CONFIG.repo}/commit/${code}" target="_blank" rel="noopener"><code>${Utils.esc(code)}</code></a>`
        : `<code>${Utils.esc(code)}</code>`;
    });
    return t;
  },
};

/* ----------------------------------------------------------------------------
 * Tip — shared tooltip singleton for all D3 charts.
 * ------------------------------------------------------------------------- */
const Tip = {
  el: null,

  /** Capture the tooltip element. */
  init() { this.el = Utils.$('#chart-tip'); },

  /**
   * Show the tooltip with HTML content near a client-space point.
   * @param {string} html - Pre-sanitized markup.
   * @param {number} x - clientX.
   * @param {number} y - clientY.
   */
  show(html, x, y) {
    if (!this.el) return;
    this.el.innerHTML = html;
    this.el.classList.add('on');
    this.move(x, y);
  },

  /**
   * Reposition the tooltip, flipping horizontally near the right edge.
   * @param {number} x - clientX.
   * @param {number} y - clientY.
   */
  move(x, y) {
    if (!this.el) return;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let px = x + 16, py = y - h - 14;
    if (px + w > window.innerWidth - 10) px = x - w - 16;
    if (py < 10) py = y + 18;
    this.el.style.left = `${px}px`;
    this.el.style.top = `${py}px`;
  },

  /** Hide the tooltip. */
  hide() { this.el?.classList.remove('on'); },
};

/* ----------------------------------------------------------------------------
 * Synth — estimated daily allocation for the explicitly labeled matrix.
 * Never generates repository records.
 * ------------------------------------------------------------------------- */
const Synth = {
  /**
   * Distribute each week's commit total across its 7 days so the heatmap has
   * a plausible daily texture while preserving the *real* weekly totals.
   * Deterministic: seeded per week index.
   * @param {number[]} weekly - 52 weekly totals, oldest first.
   * @returns {Array<{date: Date, count: number, future: boolean}>} 364 day cells.
   */
  daysFromWeekly(weekly) {
    const DAY = 864e5;
    const now = new Date();
    const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const endSunday = utcToday - new Date(utcToday).getUTCDay() * DAY;
    const firstSunday = endSunday - (weekly.length - 1) * 7 * DAY;
    const weights = [0.35, 1.25, 1.3, 1.2, 1.1, 0.9, 0.45]; // Sun..Sat

    const days = [];
    for (let w = 0; w < weekly.length; w++) {
      const rng = Utils.mulberry32(CONFIG.repoId + w * 97);
      const jitter = weights.map((wt) => wt * (0.55 + rng() * 0.9));
      const sum = jitter.reduce((a, b) => a + b, 0) || 1;
      /* Largest-remainder integer allocation of this week's total. */
      const raw = jitter.map((j) => (j / sum) * weekly[w]);
      const ints = raw.map(Math.floor);
      let rest = weekly[w] - ints.reduce((a, b) => a + b, 0);
      const order = raw.map((r, i) => [r - ints[i], i]).sort((a, b) => b[0] - a[0]);
      for (let k = 0; k < order.length && rest > 0; k++, rest--) ints[order[k][1]]++;

      for (let d = 0; d < 7; d++) {
        const date = new Date(firstSunday + (w * 7 + d) * DAY);
        days.push({ date, count: ints[d], future: date.getTime() > utcToday });
      }
    }
    return days;
  },

};

/* ----------------------------------------------------------------------------
 * API — GitHub REST layer.
 *
 * Every getter is: live fetch → sessionStorage cache → SNAPSHOT/Synth.
 * loadAll() settles all requests in parallel and merges whatever succeeded.
 * ------------------------------------------------------------------------- */
const API = {
  /**
   * Read a cached payload (fresh entries only).
   * @param {string} key - Endpoint path used as cache key.
   * @returns {any|null}
   */
  _cacheGet(key) {
    try {
      const raw = sessionStorage.getItem(CONFIG.cacheKey + key);
      if (!raw) return null;
      const { t, d } = JSON.parse(raw);
      return (Date.now() - t < CONFIG.cacheTTLms) ? d : null;
    } catch (e) { return null; }
  },

  /** Write a payload to the cache (best-effort). */
  _cacheSet(key, data) {
    try {
      sessionStorage.setItem(CONFIG.cacheKey + key, JSON.stringify({ t: Date.now(), d: data }));
    } catch (e) { /* storage full / private mode — non-fatal */ }
  },

  /**
   * Fetch JSON from the GitHub API with caching.
   * @param {string} path - Path relative to the repository base, or an
   *                        absolute API path ('/search/…', '/users/…').
   * @returns {Promise<any>}
   * @throws {Error} On HTTP errors, including rate limiting (403/429).
   */
  async fetchJSON(path) {
    const hit = this._cacheGet(path);
    if (hit !== null) return hit;

    const url = /^\/(?:search|users)\//.test(path)
      ? `${CONFIG.apiBase}${path}`
      : `${CONFIG.apiBase}/repos/${CONFIG.owner}/${CONFIG.repo}${path}`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const err = new Error(`GitHub API ${res.status} for ${path}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    this._cacheSet(path, data);
    return data;
  },

  /**
   * Exact item counter via the Search API (`total_count`), with a Link-header
   * fallback and a final `null` so callers can fall back to the snapshot.
   * @param {'issue'|'pr'} kind
   * @param {'open'|'closed'} state
   * @returns {Promise<number|null>}
   */
  async fetchCount(kind, state) {
    const q = encodeURIComponent(`repo:${CONFIG.owner}/${CONFIG.repo} is:${kind} is:${state}`);
    try {
      const d = await this.fetchJSON(`/search/issues?q=${q}&per_page=1`);
      if (typeof d.total_count === 'number') return d.total_count;
    } catch (e) { /* fall through to Link-header strategy */ }

    try {
      const path = kind === 'pr' ? '/pulls' : '/issues';
      const url = `${CONFIG.apiBase}/repos/${CONFIG.owner}/${CONFIG.repo}${path}?state=${state}&per_page=1`;
      const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const link = res.headers.get('Link') || '';
      const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(link);
      if (m) return parseInt(m[1], 10);
      const arr = await res.json();
      return Array.isArray(arr) ? arr.length : null;
    } catch (e) { return null; }
  },

  /**
   * Normalize an issue/PR API object into the row shape the UI renders.
   * Carries every field the details popup can surface: identity + state,
   * author, all timestamps, labels, milestone, assignees, comment count,
   * the markdown body, and (for PRs) draft flag + head/base refs.
   * @param {object} it - Raw API item.
   * @param {'issue'|'pr'} kind
   * @returns {object} Normalized row.
   */
  normalizeRow(it, kind) {
    const isPr = kind === 'pr';
    return {
      number: it.number,
      title: it.title,
      url: it.html_url,
      state: it.state,
      merged: isPr ? Boolean(it.merged_at) : false,
      draft: isPr ? Boolean(it.draft) : false,
      labels: (it.labels || []).map((l) => ({ name: l.name, color: l.color || '8b9bb4' })),
      user: it.user?.login || 'ghost',
      userUrl: it.user?.html_url || '',
      avatar: it.user?.avatar_url || '',
      createdAt: it.created_at || '',
      updatedAt: it.updated_at || it.created_at || '',
      closedAt: it.closed_at || null,
      mergedAt: isPr ? (it.merged_at || null) : null,
      comments: typeof it.comments === 'number' ? it.comments : null,
      milestone: it.milestone?.title || '',
      assignees: (it.assignees || []).map((a) => a.login),
      head: isPr ? (it.head?.ref || '') : '',
      base: isPr ? (it.base?.ref || '') : '',
      body: String(it.body || '').replace(/\r\n?/g, '\n').trim(),
    };
  },

  /**
   * Extract a display-friendly message from a commit object: strips the
   * "Merge pull request #N ..." wrapper in favor of the PR title line.
   * @param {object} c - Commit object from /commits.
   * @returns {{sha:string,msg:string,date:string,url:string}}
   */
  normalizeCommit(c) {
    const lines = (c.commit?.message || '').split('\n').map((s) => s.trim()).filter(Boolean);
    let msg = lines[0] || 'commit';
    if (/^merge (pull request|branch)/i.test(msg) && lines[1]) msg = lines[1];
    return {
      sha: (c.sha || '').slice(0, 7),
      msg,
      date: c.commit?.author?.date || c.commit?.committer?.date,
      url: c.html_url,
    };
  },

  /** Safely unwrap a PromiseSettledResult. @returns {any|null} */
  _ok(r) { return r.status === 'fulfilled' ? r.value : null; },

  /**
   * Load every dataset in parallel and merge into the normalized DATA object
   * consumed by the renderers. Individual failures fall back to SNAPSHOT or
   * Synth content; `mode` reports whether the core feed is live.
   * @returns {Promise<object>} DATA
   */
  async loadAll() {
    const P = CONFIG.perPage;
    const jobs = {
      repo: this.fetchJSON(''),
      languages: this.fetchJSON('/languages'),
      contributors: this.fetchJSON(`/contributors?per_page=${P.contributors}`),
      branches: this.fetchJSON(`/branches?per_page=${P.branches}`),
      releases: this.fetchJSON(`/releases?per_page=${P.releases}`),
      participation: this.fetchJSON('/stats/participation'),
      commits: this.fetchJSON(`/commits?per_page=${P.commits}`),
      issuesOpen: this.fetchJSON(`/issues?state=open&per_page=${P.issues}&sort=updated&direction=desc`),
      issuesClosed: this.fetchJSON(`/issues?state=closed&per_page=${P.issues}&sort=updated&direction=desc`),
      pullsOpen: this.fetchJSON(`/pulls?state=open&per_page=${P.pulls}&sort=updated&direction=desc`),
      pullsClosed: this.fetchJSON(`/pulls?state=closed&per_page=${P.pulls}&sort=updated&direction=desc`),
      cIssuesOpen: this.fetchCount('issue', 'open'),
      cIssuesClosed: this.fetchCount('issue', 'closed'),
      cPrsOpen: this.fetchCount('pr', 'open'),
      cPrsClosed: this.fetchCount('pr', 'closed'),
    };
    const keys = Object.keys(jobs);
    const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
    const R = {};
    keys.forEach((k, i) => { R[k] = this._ok(settled[i]); });

    const live = Boolean(R.repo && R.repo.full_name);
    const repo = R.repo || SNAPSHOT.repo;

    /* Weekly commit totals (52, oldest first). */
    const activityAvailable = Array.isArray(R.participation?.all) && R.participation.all.length >= 52;
    const weekly = activityAvailable ? R.participation.all.slice(-52) : SNAPSHOT.weekly;

    /* Languages (bytes per language). */
    const languages = (R.languages && Object.keys(R.languages).length)
      ? R.languages : SNAPSHOT.languages;

    /* Contributors — GitHub Apps (login suffixed `[bot]`, or API type
       "Bot") are hidden; regular user accounts stay even when the login
       ends in `-bot` (e.g. kyaulabs-bot). */
    const contributors = ((Array.isArray(R.contributors) && R.contributors.length)
      ? R.contributors.map((c) => ({
          login: c.login, contributions: c.contributions,
          avatar_url: c.avatar_url, html_url: c.html_url, type: c.type,
        }))
      : SNAPSHOT.contributors)
      .filter((c) => c.type !== 'Bot' && !Utils.isAppLogin(c.login));

    /* Branches — `release/X.Y.Z` maintenance branches are hidden from the
       topology view by default; every other branch renders. */
    const branches = ((Array.isArray(R.branches) && R.branches.length)
      ? R.branches.map((b) => ({
          name: b.name, sha: b.commit?.sha || '', protected: Boolean(b.protected),
          isDefault: b.name === repo.default_branch,
        }))
      : SNAPSHOT.branches.map((b) => ({ ...b, isDefault: b.name === repo.default_branch })))
      .filter((b) => !Utils.isReleaseBranch(b.name));

    /* Preserve full release notes. Empty feeds remain empty; failures are labeled. */
    const liveReleases = Array.isArray(R.releases)
      ? R.releases.map((r, i) => ({
          tag: r.tag_name, name: r.name || r.tag_name,
          body: (r.body || '').replace(/\r\n?/g, '\n').trim(),
          date: r.published_at || r.created_at, url: r.html_url,
          latest: i === 0, synthetic: false,
        }))
      : null;
    const releases = liveReleases || [];

    /* Ticker commits. */
    const ticker = (Array.isArray(R.commits) && R.commits.length)
      ? R.commits.map((c) => API.normalizeCommit(c)).filter((c) => c.sha)
      : [];

    /* The issues endpoint interleaves PRs. Filter them without inventing
       replacement rows when lists fail or the current page contains only PRs. */
    const asIssues = (raw) => (Array.isArray(raw)
      ? raw.filter((it) => !it.pull_request).map((it) => API.normalizeRow(it, 'issue'))
      : null);
    const asPrs = (raw) => (Array.isArray(raw)
      ? raw.map((it) => API.normalizeRow(it, 'pr'))
      : null);
    const issueRows = { open: asIssues(R.issuesOpen) || [], closed: asIssues(R.issuesClosed) || [] };
    const prRows = { open: asPrs(R.pullsOpen) || [], closed: asPrs(R.pullsClosed) || [] };

    /* Exact counters (search API) → snapshot fallback. */
    const counts = {
      issuesOpen: R.cIssuesOpen ?? SNAPSHOT.counts.issuesOpen,
      issuesClosed: R.cIssuesClosed ?? SNAPSHOT.counts.issuesClosed,
      prsOpen: R.cPrsOpen ?? SNAPSHOT.counts.prsOpen,
      prsClosed: R.cPrsClosed ?? SNAPSHOT.counts.prsClosed,
    };

    return {
      mode: live ? 'live' : 'sim',
      activityAvailable,
      missingFeeds: keys.filter((key) => R[key] == null),
      repo, weekly, languages, contributors, branches, releases, ticker,
      issues: issueRows,
      pulls: prRows,
      counts,
      days: Synth.daysFromWeekly(weekly),
      releasesSynthetic: !liveReleases,
    };
  },
};

const Charts = {
  /**
   * Brand palette for chart chrome.
   * @returns {{accent:string,accent2:string,accent3:string,ink:string,ink2:string,
   *           grid:string,heat:string[]}}
   */
  palette() {
    const v = Utils.cssVar;
    return {
      accent: v('--accent') || '#22d3ee',
      accent2: v('--accent-2') || '#a78bfa',
      accent3: v('--accent-3') || '#f472b6',
      ink: v('--ink-0') || '#eaf2ff',
      ink2: v('--ink-2') || '#637391',
      grid: v('--grid-line') || 'rgba(148,163,184,0.1)',
      heat: [v('--heat-0'), v('--heat-1'), v('--heat-2'), v('--heat-3'), v('--heat-4')],
    };
  },

  /**
   * Build every chart from the loaded DATA object.
   * @param {object} data - DATA from API.loadAll().
   */
  buildAll(data) {
    if (!window.d3) {
      document.querySelectorAll('.chart-mount').forEach((el) => {
        el.innerHTML = '<p class="empty-note">// visualization engine offline — D3 failed to load</p>';
      });
      return;
    }
    if (data.activityAvailable !== false) this.activity(Utils.$('#chart-activity'), data);
    else if (Utils.$('#chart-activity')) Utils.$('#chart-activity').innerHTML = '<p class="empty-note">// weekly statistics unavailable or still being calculated by GitHub</p>';
    this.donut(Utils.$('#chart-langs'), Utils.$('#langs-legend'), data.languages);
    const iTotal = data.counts.issuesOpen + data.counts.issuesClosed;
    const pTotal = data.counts.prsOpen + data.counts.prsClosed;
    this.gauge(Utils.$('#gauge-issues'), iTotal ? data.counts.issuesClosed / iTotal : 0, 'RESOLVED');
    this.gauge(Utils.$('#gauge-prs'), pTotal ? data.counts.prsClosed / pTotal : 0, 'THROUGHPUT');
    if (data.activityAvailable !== false) this.heatmap(Utils.$('#chart-heatmap'), data.days);
    else if (Utils.$('#chart-heatmap')) Utils.$('#chart-heatmap').innerHTML = '<p class="empty-note">// matrix unavailable until weekly statistics arrive</p>';
  },

  /**
   * Weekly commit waveform — gradient area + signal line + hover crosshair.
   * @param {Element} el - Mount point.
   * @param {object} data - DATA (uses data.weekly).
   */
  activity(el, data) {
    if (!el) return;
    el.innerHTML = '';
    const pal = this.palette();
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const m = { t: 16, r: 16, b: 30, l: 44 };

    const DAY = 864e5;
    const now = new Date();
    const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const endSunday = utcToday - new Date(utcToday).getUTCDay() * DAY;
    const pts = data.weekly.map((v, i) => ({
      date: new Date(endSunday - (data.weekly.length - 1 - i) * 7 * DAY),
      v,
    }));

    const x = d3.scaleTime()
      .domain([pts[0].date, new Date(endSunday + 6 * DAY)])
      .range([m.l, W - m.r]);
    const y = d3.scaleLinear()
      .domain([0, d3.max(pts, (d) => d.v) * 1.12 || 10])
      .nice()
      .range([H - m.b, m.t]);

    const svg = d3.select(el).append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'none');

    /* Vertical + horizontal gridlines. */
    svg.append('g')
      .attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 120))).tickSize(-(H - m.t - m.b)).tickFormat(''))
      .call((g) => g.selectAll('line').attr('stroke', pal.grid))
      .call((g) => g.selectAll('.domain').remove());
    svg.append('g')
      .attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(''))
      .call((g) => g.selectAll('line').attr('stroke', pal.grid))
      .call((g) => g.selectAll('.domain').remove());

    /* Axis labels. */
    svg.append('g')
      .attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 120))).tickSize(0).tickPadding(9).tickFormat(d3.timeFormat('%b')))
      .call((g) => g.selectAll('text').attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono')).attr('font-size', 10))
      .call((g) => g.selectAll('.domain').remove());
    svg.append('g')
      .attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(8))
      .call((g) => g.selectAll('text').attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono')).attr('font-size', 10))
      .call((g) => g.selectAll('.domain').remove());

    /* Gradient definitions for the area fill and the signal line. */
    const defs = svg.append('defs');
    const gid = `ag${Math.floor(Math.random() * 1e6)}`;
    const grad = defs.append('linearGradient').attr('id', gid)
      .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%').attr('stop-color', pal.accent).attr('stop-opacity', 0.34);
    grad.append('stop').attr('offset', '100%').attr('stop-color', pal.accent).attr('stop-opacity', 0.01);
    const lid = `lg${Math.floor(Math.random() * 1e6)}`;
    const lgrad = defs.append('linearGradient').attr('id', lid)
      .attr('x1', 0).attr('y1', 0).attr('x2', 1).attr('y2', 0);
    lgrad.append('stop').attr('offset', '0%').attr('stop-color', pal.accent2);
    lgrad.append('stop').attr('offset', '100%').attr('stop-color', pal.accent);

    /* Average reference line. */
    const avg = d3.mean(pts, (d) => d.v) || 0;
    svg.append('line')
      .attr('x1', m.l).attr('x2', W - m.r)
      .attr('y1', y(avg)).attr('y2', y(avg))
      .attr('stroke', pal.ink2).attr('stroke-dasharray', '3 5').attr('stroke-opacity', 0.55);
    svg.append('text')
      .attr('x', W - m.r).attr('y', y(avg) - 5)
      .attr('text-anchor', 'end').attr('fill', pal.ink2)
      .attr('font-family', Utils.cssVar('--font-mono')).attr('font-size', 9)
      .text(`AVG ${Math.round(avg)}`);

    /* Area + line. */
    const area = d3.area().x((d) => x(d.date)).y0(H - m.b).y1((d) => y(d.v))
      .curve(d3.curveMonotoneX);
    const line = d3.line().x((d) => x(d.date)).y((d) => y(d.v))
      .curve(d3.curveMonotoneX);

    svg.append('path').datum(pts)
      .attr('d', area)
      .attr('fill', `url(#${gid})`)
      .attr('opacity', Utils.reducedMotion ? 1 : 0)
      .call((sel) => {
        if (!Utils.reducedMotion) sel.transition().duration(900).attr('opacity', 1);
      });

    const linePath = svg.append('path').datum(pts)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', `url(#${lid})`)
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round');

    /* Draw-on animation for the signal line. */
    if (!Utils.reducedMotion) {
      const len = linePath.node().getTotalLength();
      linePath
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition().duration(1300).ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
        .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });
    }

    /* Current-week end point with halo. */
    const last = pts[pts.length - 1];
    svg.append('circle').attr('cx', x(last.date)).attr('cy', y(last.v))
      .attr('r', 8).attr('fill', Utils.rgba(pal.accent, 0.22));
    svg.append('circle').attr('cx', x(last.date)).attr('cy', y(last.v))
      .attr('r', 3.4).attr('fill', pal.accent)
      .attr('stroke', Utils.cssVar('--panel-solid') || '#0a101d').attr('stroke-width', 1.5);

    /* Hover crosshair: rule + focus dot + tooltip. */
    const rule = svg.append('line')
      .attr('y1', m.t).attr('y2', H - m.b)
      .attr('stroke', pal.accent).attr('stroke-opacity', 0)
      .attr('stroke-dasharray', '2 3');
    const focus = svg.append('circle')
      .attr('r', 4).attr('fill', pal.accent)
      .attr('stroke', Utils.cssVar('--panel-solid') || '#0a101d')
      .attr('stroke-width', 2).attr('opacity', 0);
    const bisect = d3.bisector((d) => d.date).center;

    svg.append('rect')
      .attr('x', m.l).attr('y', m.t)
      .attr('width', W - m.l - m.r).attr('height', H - m.t - m.b)
      .attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [mx] = d3.pointer(ev);
        const i = bisect(pts, x.invert(mx));
        const d = pts[Utils.clamp(i, 0, pts.length - 1)];
        rule.attr('x1', x(d.date)).attr('x2', x(d.date)).attr('stroke-opacity', 0.6);
        focus.attr('cx', x(d.date)).attr('cy', y(d.v)).attr('opacity', 1);
        Tip.show(
          `<span class="tt-title">week of ${Utils.fmtMonthYear(d.date)} ${d.date.getUTCDate()}</span>` +
          `<span class="tt-val">${Utils.fmtInt(d.v)} commits</span>` +
          `<span class="tt-sub">${d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(d.date.getTime() + 6 * DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`,
          ev.clientX, ev.clientY,
        );
      })
      .on('pointerleave', () => {
        rule.attr('stroke-opacity', 0);
        focus.attr('opacity', 0);
        Tip.hide();
      });
  },

  /**
   * Language composition donut with DOM legend.
   * @param {Element} el - SVG mount.
   * @param {Element} legendEl - <ul> legend mount.
   * @param {Object<string, number>} languages - Language → bytes.
   */
  donut(el, legendEl, languages) {
    if (!el) return;
    el.innerHTML = '';
    if (legendEl) legendEl.innerHTML = '';
    const pal = this.palette();
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;

    const entries = Object.entries(languages)
      .map(([name, bytes]) => ({ name, bytes }))
      .sort((a, b) => b.bytes - a.bytes);
    const total = d3.sum(entries, (d) => d.bytes) || 1;
    /* Brand spectral ramp: slices are colored by rank along an
       accent → accent-2 → accent-3 interpolation (cyan → violet → pink),
       so the donut always matches the active theme's palette. */
    const ramp = d3.interpolateRgbBasis([pal.accent, pal.accent2, pal.accent3]);
    const colorOf = (name, i) => ramp(entries.length > 1 ? i / (entries.length - 1) : 0);

    const R = Math.min(W, H) / 2 - 6;
    const svg = d3.select(el).append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`);
    const g = svg.append('g').attr('transform', `translate(${W / 2},${H / 2})`);

    const pie = d3.pie().value((d) => d.bytes).sort(null).padAngle(0.018)(entries);
    const arc = d3.arc().innerRadius(R * 0.68).outerRadius(R).cornerRadius(3);
    const arcHover = d3.arc().innerRadius(R * 0.68).outerRadius(R + 7).cornerRadius(3);

    /* Center readout. */
    g.append('text').attr('text-anchor', 'middle').attr('y', -4)
      .attr('fill', pal.ink).attr('font-family', Utils.cssVar('--font-mono'))
      .attr('font-weight', 700).attr('font-size', 17)
      .text(Utils.fmtBytes(total));
    g.append('text').attr('text-anchor', 'middle').attr('y', 15)
      .attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono'))
      .attr('font-size', 8.5).attr('letter-spacing', 2.5)
      .text('SOURCE');

    const paths = g.selectAll('path').data(pie).join('path')
      .attr('fill', (d, i) => colorOf(d.data.name, i))
      .attr('stroke', 'none')
      .style('cursor', 'default')
      .on('pointerenter', function (ev, d) {
        d3.select(this).transition().duration(160).attr('d', arcHover);
        Tip.show(
          `<span class="tt-title">${Utils.esc(d.data.name)}</span>` +
          `<span class="tt-val">${Utils.fmtBytes(d.data.bytes)}</span>` +
          `<span class="tt-sub">${((d.data.bytes / total) * 100).toFixed(1)}% of source</span>`,
          ev.clientX, ev.clientY,
        );
      })
      .on('pointermove', (ev) => Tip.move(ev.clientX, ev.clientY))
      .on('pointerleave', function () {
        d3.select(this).transition().duration(160).attr('d', arc);
        Tip.hide();
      });

    /* Sweep-in animation (skipped for reduced motion). */
    if (Utils.reducedMotion) {
      paths.attr('d', arc);
    } else {
      paths.transition().duration(850).ease(d3.easeCubicOut)
        .attrTween('d', (d) => {
          const interp = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
          return (t) => arc(interp(t));
        });
    }

    /* Legend. */
    if (legendEl) {
      legendEl.innerHTML = entries.map((d, i) => `
        <li>
          <span class="legend-swatch" style="background:${colorOf(d.name, i)}"></span>
          <span class="legend-name">${Utils.esc(d.name)}</span>
          <span class="legend-val">${((d.bytes / total) * 100).toFixed(1)}%</span>
        </li>`).join('');
    }
  },

  /**
   * Radial resolution gauge (260° sweep).
   * @param {Element} el - Mount point.
   * @param {number} ratio - Value in [0, 1].
   * @param {string} caption - Word under the percentage.
   */
  gauge(el, ratio, caption) {
    if (!el) return;
    el.innerHTML = '';
    const pal = this.palette();
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const r = Utils.clamp(ratio, 0, 1);

    const R = Math.min(W, H * 1.35) / 2 - 10;
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
    const g = svg.append('g').attr('transform', `translate(${W / 2},${H / 2 + R * 0.14})`);

    const A0 = -Math.PI * (130 / 180), A1 = Math.PI * (130 / 180);
    const arcGen = d3.arc().innerRadius(R * 0.78).outerRadius(R).cornerRadius(R * 0.11);

    /* Track. */
    g.append('path')
      .attr('d', arcGen({ startAngle: A0, endAngle: A1 }))
      .attr('fill', Utils.rgba(pal.ink2, 0.16));

    /* Gradient for the value arc. */
    const gid = `gg${Math.floor(Math.random() * 1e6)}`;
    const grad = svg.append('defs').append('linearGradient')
      .attr('id', gid).attr('x1', 0).attr('y1', 0).attr('x2', 1).attr('y2', 1);
    grad.append('stop').attr('offset', '0%').attr('stop-color', pal.accent2);
    grad.append('stop').attr('offset', '100%').attr('stop-color', pal.accent);

    /* Value arc (tweened). */
    const value = g.append('path').attr('fill', `url(#${gid})`);
    if (Utils.reducedMotion) {
      value.attr('d', arcGen({ startAngle: A0, endAngle: A0 + (A1 - A0) * r }));
    } else {
      value.transition().duration(1100).ease(d3.easeCubicOut)
        .attrTween('d', () => {
          const interp = d3.interpolate(A0, A0 + (A1 - A0) * r);
          return (t) => arcGen({ startAngle: A0, endAngle: interp(t) });
        });
    }

    /* Quartile tick marks. */
    for (let i = 0; i <= 4; i++) {
      const a = A0 + ((A1 - A0) * i) / 4;
      const inner = R + 5, outer = R + 10;
      g.append('line')
        .attr('x1', Math.sin(a) * inner).attr('y1', -Math.cos(a) * inner)
        .attr('x2', Math.sin(a) * outer).attr('y2', -Math.cos(a) * outer)
        .attr('stroke', pal.ink2).attr('stroke-opacity', 0.5).attr('stroke-width', 1.4);
    }

    /* Center readout. */
    g.append('text').attr('text-anchor', 'middle').attr('y', R * -0.02)
      .attr('fill', pal.ink).attr('font-family', Utils.cssVar('--font-mono'))
      .attr('font-weight', 700).attr('font-size', 26)
      .text(`${Math.round(r * 100)}%`);
    g.append('text').attr('text-anchor', 'middle').attr('y', R * 0.16)
      .attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono'))
      .attr('font-size', 8.5).attr('letter-spacing', 3)
      .text(caption);
  },

  /**
   * Commit matrix — a 52×7 calendar heatmap.
   * Weekly totals are real; daily texture comes from Synth.daysFromWeekly.
   * @param {Element} el - Mount point.
   * @param {Array<{date:Date,count:number,future:boolean}>} days
   */
  heatmap(el, days) {
    if (!el) return;
    el.innerHTML = '';
    const pal = this.palette();
    const W = el.clientWidth;
    if (!W) return;

    const cols = Math.ceil(days.length / 7);
    const showAxis = W >= 560;
    const padL = showAxis ? 30 : 6, padT = 20, padR = 6, gap = 3;
    const cell = Math.max(8, Math.floor((W - padL - padR - gap * (cols - 1)) / cols));
    const H = padT + 7 * (cell + gap) + 26;

    /* Intensity buckets over non-zero days. */
    const nz = days.filter((d) => d.count > 0).map((d) => d.count).sort((a, b) => a - b);
    const q = (p) => nz.length ? nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] : 0;
    const stops = [0, q(0.4), q(0.65), q(0.85)];
    const bucket = (v) => {
      if (v <= 0) return 0;
      if (v <= stops[1]) return 1;
      if (v <= stops[2]) return 2;
      if (v <= stops[3]) return 3;
      return 4;
    };

    const svg = d3.select(el).append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', W).attr('height', H);

    /* Month labels along the top. */
    let prevMonth = -1;
    for (let c = 0; c < cols; c++) {
      const d0 = days[c * 7].date;
      if (d0.getUTCMonth() !== prevMonth) {
        prevMonth = d0.getUTCMonth();
        svg.append('text')
          .attr('x', padL + c * (cell + gap)).attr('y', 10)
          .attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono')).attr('font-size', 9.5)
          .text(d0.toLocaleDateString('en-US', { month: 'short' }));
      }
    }

    /* Weekday labels (Mon / Wed / Fri). */
    if (showAxis) {
      [['MON', 1], ['WED', 3], ['FRI', 5]].forEach(([txt, row]) => {
        svg.append('text')
          .attr('x', 0).attr('y', padT + row * (cell + gap) + cell * 0.78)
          .attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono')).attr('font-size', 8.5)
          .text(txt);
      });
    }

    /* Day cells. */
    const rects = svg.selectAll('rect.day').data(days).join('rect')
      .attr('class', 'day')
      .attr('x', (d, i) => padL + Math.floor(i / 7) * (cell + gap))
      .attr('y', (d, i) => padT + (i % 7) * (cell + gap))
      .attr('width', cell).attr('height', cell).attr('rx', 2.4)
      .attr('fill', (d) => (d.future ? 'transparent' : pal.heat[bucket(d.count)]))
      .attr('stroke', (d) => (d.future ? 'none' : Utils.rgba(pal.ink2, 0.10)))
      .attr('stroke-width', 1)
      .style('cursor', (d) => (d.future ? 'default' : 'crosshair'))
      .on('pointerenter', function (ev, d) {
        if (d.future) return;
        d3.select(this).attr('stroke', pal.accent).attr('stroke-width', 1.4);
        Tip.show(
          `<span class="tt-title">${Utils.fmtDate(d.date)}</span>` +
          `<span class="tt-val">${d.count ? `${Utils.fmtInt(d.count)} commit${d.count > 1 ? 's' : ''}` : 'no commits'}</span>`,
          ev.clientX, ev.clientY,
        );
      })
      .on('pointermove', (ev, d) => { if (!d.future) Tip.move(ev.clientX, ev.clientY); })
      .on('pointerleave', function (ev, d) {
        d3.select(this).attr('stroke', d.future ? 'none' : Utils.rgba(pal.ink2, 0.10)).attr('stroke-width', 1);
        Tip.hide();
      });

    /* Cascade-in animation. */
    if (!Utils.reducedMotion) {
      rects.attr('opacity', 0)
        .transition().delay((d, i) => i * 1.6).duration(280)
        .attr('opacity', 1);
    }

    /* Legend: LESS □□□□□ MORE */
    const lg = svg.append('g')
      .attr('transform', `translate(${W - padR - 132},${H - 14})`);
    lg.append('text').attr('x', 0).attr('y', 8)
      .attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono')).attr('font-size', 8.5)
      .text('LESS');
    pal.heat.forEach((c, i) => {
      lg.append('rect')
        .attr('x', 30 + i * 14).attr('y', 0).attr('width', 10).attr('height', 10).attr('rx', 2)
        .attr('fill', c).attr('stroke', Utils.rgba(pal.ink2, 0.12));
    });
    lg.append('text').attr('x', 104).attr('y', 8)
      .attr('fill', pal.ink2).attr('font-family', Utils.cssVar('--font-mono')).attr('font-size', 8.5)
      .text('MORE');
  },
};

/* ----------------------------------------------------------------------------
 * UI — DOM renderers. Every renderer defensively escapes API strings.
 * ------------------------------------------------------------------------- */
const UI = {
  /** Inline SVG icon library (24 viewBox, stroke = currentColor). */
  ICONS: {
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8L12 3.2z"/></svg>',
    fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="5" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 7.2v3.1c0 2.2 2.6 3.4 6 3.4s6-1.2 6-3.4V7.2M12 13.7v3.1"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    issue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
    scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M5 21h14M12 5.5 6 7m6-1.5L18 7M6 7l-2.6 5.6a3 3 0 0 0 5.2 0L6 7zm12 0-2.6 5.6a3 3 0 0 0 5.2 0L18 7z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/></svg>',
    commit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2.6v6.4M12 15v6.4"/></svg>',
    pr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6.4" cy="5.4" r="2.2"/><circle cx="6.4" cy="18.6" r="2.2"/><circle cx="17.6" cy="8.5" r="2.2"/><path d="M6.4 7.6v8.8M17.6 10.7c0 4.4-4.2 3.4-6.8 5.4"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.1"/><path d="M3.4 19.4c.7-3.3 2.9-5 5.6-5s4.9 1.7 5.6 5M15.5 5.6a3.1 3.1 0 0 1 0 5.7M17.7 14.7c1.6.8 2.6 2.3 3 4.7"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6 2.8 12 8 18M16 6l5.2 6L16 18"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.4" y="5" width="17.2" height="15.6" rx="2.4"/><path d="M3.4 10h17.2M8 2.8V6.4M16 2.8V6.4"/></svg>',
    branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4v13"/><circle cx="7" cy="5" r="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="7" r="2"/><path d="M17 9c0 5-6.5 3.6-8.6 6.6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8 4.6 5.6v6c0 4.8 3.1 8.3 7.4 9.6 4.3-1.3 7.4-4.8 7.4-9.6v-6L12 2.8z"/><path d="M9 11.8l2.2 2.2 3.8-3.8"/></svg>',
  },

  /**
   * Render the hero statistic chips from repository metadata. Every chip is
   * a link to its corresponding GitHub page: stars and watchers open their
   * respective listings, forks opens the create-a-fork flow, and the rest
   * their relevant repository pages. License/commits resolve against the
   * repo's default branch.
   * @param {object} data
   */
  renderChips(data) {
    const el = Utils.$('#hero-chips');
    if (!el) return;
    const r = data.repo;
    const base = `https://github.com/${CONFIG.owner}/${CONFIG.repo}`;
    const branch = r.default_branch || 'develop';
    const chips = [
      [this.ICONS.star, Utils.fmtCompact(r.stargazers_count ?? 0), 'stars', `${base}/stargazers`, 'View stargazers on GitHub'],
      [this.ICONS.fork, Utils.fmtCompact(r.forks_count ?? 0), 'forks', `${base}/fork`, 'Fork the repository on GitHub'],
      [this.ICONS.eye, Utils.fmtCompact(r.subscribers_count ?? r.watchers_count ?? 0), 'watching', `${base}/watchers`, 'View watchers on GitHub'],
      [this.ICONS.issue, Utils.fmtCompact(data.counts.issuesOpen + data.counts.prsOpen), 'open items', `${base}/issues`, 'View open issues on GitHub'],
      [this.ICONS.scale, Utils.esc(r.license?.spdx_id || 'NOASSERTION'), 'license', `${base}/blob/${branch}/LICENSE`, 'View the license on GitHub'],
      [this.ICONS.clock, Utils.timeAgo(r.pushed_at), 'last push', `${base}/commits/${branch}`, 'View recent commits on GitHub'],
    ];
    el.innerHTML = chips.map(([ico, val, label, href, aria]) =>
      `<a class="chip" href="${href}" target="_blank" rel="noopener" aria-label="${aria}">${ico}<strong>${val}</strong>${label}</a>`).join('');
  },

  /**
   * Render the six KPI cards. Values carry data-* attributes consumed by the
   * count-up animator in Reveal.
   * @param {object} data
   */
  renderKpis(data) {
    const el = Utils.$('#kpi-grid');
    if (!el) return;
    const commitsTotal = data.contributors.reduce((a, c) => a + (c.contributions || 0), 0)
      || data.weekly.reduce((a, b) => a + b, 0);
    const thisWeek = data.weekly[data.weekly.length - 1] || 0;
    const prTotal = data.counts.prsOpen + data.counts.prsClosed;
    const isTotal = data.counts.issuesOpen + data.counts.issuesClosed;
    const bytes = Object.values(data.languages).reduce((a, b) => a + b, 0);
    const ageDays = Math.max(1, Math.floor((Date.now() - new Date(data.repo.created_at)) / 864e5));
    const lead = data.contributors[0]?.login || '—';

    const cards = [
      { ico: this.ICONS.commit, label: 'Commits', target: commitsTotal, fmt: 'int', delta: `<span class="up">+${Utils.fmtInt(thisWeek)}</span> this week` },
      { ico: this.ICONS.pr, label: 'Pull Requests', target: prTotal, fmt: 'int', delta: `<span class="accent">${data.counts.prsOpen} open</span> · ${data.counts.prsClosed} closed` },
      { ico: this.ICONS.issue, label: 'Issues', target: isTotal, fmt: 'int', delta: `<span class="accent">${data.counts.issuesOpen} open</span> · ${data.counts.issuesClosed} closed` },
      { ico: this.ICONS.users, label: 'Contributors', target: data.contributors.length, fmt: 'int', delta: `lead: <span class="accent">@${Utils.esc(lead)}</span>` },
      { ico: this.ICONS.code, label: 'Source Volume', target: bytes, fmt: 'bytes', delta: `${Object.keys(data.languages).length} languages tracked` },
      { ico: this.ICONS.calendar, label: 'Repo Age', target: ageDays, fmt: 'int', delta: `since ${Utils.fmtMonthYear(new Date(data.repo.created_at))}` },
    ];

    el.innerHTML = cards.map((c) => `
      <article class="panel kpi">
        <span class="kpi-label">${c.ico}${c.label}</span>
        <div class="kpi-value" data-target="${c.target}" data-format="${c.fmt}">0</div>
        <div class="kpi-delta">${c.delta}</div>
      </article>`).join('');
  },

  /**
   * Render the scrolling commit ticker. Content is duplicated once so the
   * CSS translateX(-50%) animation loops seamlessly.
   * @param {Array<{sha:string,msg:string,date:string,url:string}>} commits
   */
  renderTicker(commits) {
    const el = Utils.$('#ticker-track');
    if (!el) return;
    const items = commits.map((c) =>
      `<a class="ticker-item" href="${Utils.esc(c.url)}" target="_blank" rel="noopener">` +
      `<span class="sha">${Utils.esc(c.sha)}</span>${Utils.esc(c.msg)}<span class="ago">${Utils.timeAgo(c.date)}</span></a>`,
    );
    const sep = '<span class="ticker-sep" aria-hidden="true">◆</span>';
    const group = items.join(sep) + sep;
    el.innerHTML = commits.length ? group + group : '<span class="ticker-item">— commit feed unavailable —</span>'; // seamless loop
  },

  /**
   * Render branch topology cards.
   * @param {object} data
   */
  renderBranches(data) {
    const el = Utils.$('#branches-list');
    if (!el) return;
    const base = data.repo.html_url;
    el.innerHTML = data.branches.map((b) => `
      <article class="panel branch-card">
        <div class="branch-head">
          ${this.ICONS.branch}
          <span class="branch-name">${Utils.esc(b.name)}</span>
          <span class="branch-tags">
            ${b.isDefault ? '<span class="tag tag-default">default</span>' : ''}
            ${b.protected ? '<span class="tag tag-protected">protected</span>' : ''}
          </span>
        </div>
        <a class="branch-sha" href="${base}/commit/${Utils.esc(b.sha)}" target="_blank" rel="noopener" title="View HEAD commit">${Utils.esc(b.sha.slice(0, 7))}</a>
        <p class="branch-meta">
          HEAD pointer · branch protection status
          ${b.isDefault ? ` · pushed ${Utils.timeAgo(data.repo.pushed_at)}` : ''}
          · <a href="${base}/tree/${Utils.esc(b.name)}" target="_blank" rel="noopener">browse tree</a>
        </p>
      </article>`).join('') || '<p class="empty-note">// no branch data</p>';
  },

  /**
   * Render the release timeline; annotate unavailable or empty feeds. Each card
   * expands on click to reveal the full release notes, rendered from
   * markdown to HTML by the Markdown module. The current (latest) release
   * starts expanded.
   * @param {object} data
   */
  renderReleases(data) {
    const el = Utils.$('#releases-list');
    if (!el) return;
    const note = Utils.$('#releases-note');
    if (note) {
      note.textContent = data.releasesSynthetic
        ? 'Release feed unavailable. No release records have been invented.'
        : (data.releases.length ? 'Streamed live from the GitHub Releases feed.' : 'No GitHub releases published yet.');
    }
    const chevron = '<svg class="release-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    el.innerHTML = data.releases.map((r, i) => `
      <div class="release-item">
        <article class="panel release-card${r.latest ? ' expanded' : ''}">
          <div class="release-head">
            <a class="release-tag" href="${Utils.esc(r.url)}" target="_blank" rel="noopener">${Utils.esc(r.tag)}</a>
            <span class="release-title">${Utils.esc(r.name)}</span>
            ${r.latest ? '<span class="badge-latest">LATEST</span>' : ''}
            ${r.synthetic ? '<span class="tag">projected</span>' : ''}
            <span class="release-date">${Utils.fmtDate(new Date(r.date))}</span>
            <button class="release-toggle" type="button" aria-expanded="${r.latest ? 'true' : 'false'}"
                    aria-controls="release-body-${i}" aria-label="Toggle release notes for ${Utils.esc(r.tag)}">${chevron}</button>
          </div>
          <div class="release-body" id="release-body-${i}">
            <div class="release-body-inner">
              <div class="md-body">${Markdown.render(r.body)}</div>
            </div>
          </div>
        </article>
      </div>`).join('') || '<p class="empty-note">// no release records available</p>';

    /* Expand/collapse wiring. A click anywhere on the card toggles — except
       on links (they navigate) and inside the expanded notes body (so text
       selection never collapses the card). The chevron <button> gives
       keyboard users the same toggle for free (Enter/Space fire click). */
    el.querySelectorAll('.release-card').forEach((card) => {
      const toggle = card.querySelector('.release-toggle');
      card.addEventListener('click', (ev) => {
        if (ev.target.closest('a') || ev.target.closest('.release-body')) return;
        const open = card.classList.toggle('expanded');
        toggle?.setAttribute('aria-expanded', String(open));
      });
    });
  },

  /**
   * Render one tracker terminal window (issues or pull requests) as an
   * Open/Closed tabbed queue — the same tab language as the module popup
   * docs (.pkg-tabs/.pkg-tab). Tabs carry the exact search-API counters;
   * the list below shows the rows for the active state. The window
   * defaults to the Open tab unless the open queue is empty, in which
   * case Closed is preselected. Rows are buttons: activating one opens
   * ItemModal with the full record.
   * @param {'issue'|'pr'} kind
   * @param {{open: Array<object>, closed: Array<object>}} bucket - Rows by state.
   * @param {object} counts - Exact counters (data.counts).
   */
  renderTracker(kind, bucket, counts, unavailable = []) {
    const pfx = kind === 'pr' ? 'prs' : 'issues';
    const listEl = Utils.$(`#${pfx}-list`);
    const badgeEl = Utils.$(`#${pfx}-count-badge`);
    const tabsEl = Utils.$(`#${pfx}-tabs`);
    if (!listEl) return;

    const openN = kind === 'pr' ? counts.prsOpen : counts.issuesOpen;
    const closedN = kind === 'pr' ? counts.prsClosed : counts.issuesClosed;
    if (badgeEl) badgeEl.textContent = `${openN} OPEN`;

    /* Exact counters on the tabs themselves. */
    if (tabsEl) {
      [ ['open', openN], ['closed', closedN] ].forEach(([state, n]) => {
        const el = tabsEl.querySelector(`[data-state="${state}"] .tracker-tab-n`);
        if (el) el.textContent = Utils.fmtInt(n);
      });
    }

    /* Per-window tab state; default Open unless the open queue is empty. */
    this._tracker = this._tracker || {};
    this._tracker[kind] = {
      bucket, unavailable,
      state: bucket.open.length ? 'open' : 'closed',
      listEl, tabsEl,
    };

    /* Wire tab clicks + arrow-key navigation once per window. */
    if (tabsEl && !tabsEl.dataset.wired) {
      tabsEl.dataset.wired = '1';
      tabsEl.addEventListener('click', (ev) => {
        const tab = ev.target.closest('.tracker-tab');
        if (tab) this._setTrackerTab(kind, tab.dataset.state);
      });
      tabsEl.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        const tabs = [...tabsEl.querySelectorAll('.tracker-tab')];
        const i = tabs.indexOf(document.activeElement);
        if (!tabs.length || i === -1) return;
        ev.preventDefault();
        const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        this._setTrackerTab(kind, next.dataset.state);
      });
    }

    /* Row → ItemModal wiring, delegated once per list. */
    if (!listEl.dataset.wired) {
      listEl.dataset.wired = '1';
      listEl.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.term-open');
        if (!btn) return;
        const row = this._findTrackerRow(kind, Number(btn.dataset.num));
        if (row) ItemModal.open(row, kind);
      });
    }

    this._setTrackerTab(kind, this._tracker[kind].state);
  },

  /**
   * Switch a tracker window's active state tab and re-render its rows.
   * @param {'issue'|'pr'} kind
   * @param {'open'|'closed'} state
   */
  _setTrackerTab(kind, state) {
    const t = this._tracker?.[kind];
    if (!t) return;
    t.state = state;
    if (t.tabsEl) {
      t.tabsEl.querySelectorAll('.tracker-tab').forEach((tab) => {
        const on = tab.dataset.state === state;
        tab.classList.toggle('active', on);
        tab.setAttribute('aria-selected', String(on));
      });
    }
    const rows = t.bucket[state] || [];
    if (!rows.length) {
      if (t.unavailable.includes(state)) {
        t.listEl.innerHTML = '<li class="empty-note">// record feed unavailable — check the repository on GitHub</li>';
        return;
      }
      const noun = kind === 'pr' ? 'pull requests' : 'issues';
      t.listEl.innerHTML = `<li class="empty-note">// ${state === 'open'
        ? `queue clear — zero open ${noun}`
        : `no closed ${noun} on record`}</li>`;
      return;
    }
    t.listEl.innerHTML = rows.map((r) => this._trackerRowHtml(r, kind)).join('');
  },

  /**
   * Build one tracker row — a button that opens ItemModal on activation.
   * @param {object} r - Normalized row (API.normalizeRow).
   * @param {'issue'|'pr'} kind
   * @returns {string}
   */
  _trackerRowHtml(r, kind) {
    const stClass = r.merged ? 'st-merged' : (r.state === 'open' ? 'st-open' : 'st-closed');
    const stTitle = r.merged ? 'merged' : r.state;
    const labels = r.labels.slice(0, 4).map((l) => {
      const bg = `#${l.color}`;
      return `<span class="lbl" style="background:${Utils.rgba(bg, 0.16)};color:${bg};border-color:${Utils.rgba(bg, 0.4)}">${Utils.esc(l.name)}</span>`;
    }).join('');
    return `
      <li class="term-row">
        <button type="button" class="term-open" data-num="${r.number}" aria-haspopup="dialog"
                aria-label="Open ${kind === 'pr' ? 'pull request' : 'issue'} #${r.number}: ${Utils.esc(r.title)}">
          <span class="st ${stClass}" title="${stTitle}"></span>
          <span class="num">#${r.number}</span>
          <span class="t-title">${Utils.esc(r.title)}</span>
          <span class="t-meta">${labels}<span>@${Utils.esc(r.user)}</span><span>·</span><span>${Utils.timeAgo(r.updatedAt)}</span></span>
        </button>
      </li>`;
  },

  /**
   * Find a tracker row by number across both state buckets of a window.
   * @param {'issue'|'pr'} kind
   * @param {number} num
   * @returns {object|null}
   */
  _findTrackerRow(kind, num) {
    const tracker = this._tracker?.[kind];
    const b = tracker?.bucket;
    if (!b) return null;
    const states = tracker.state === 'closed' ? ['closed', 'open'] : ['open', 'closed'];
    return states.flatMap((state) => b[state] || []).find((r) => r.number === num) || null;
  },

  /**
   * Render contributor cards with contribution bars.
   * @param {object} data
   */
  renderContributors(data) {
    const el = Utils.$('#contributors-list');
    if (!el) return;
    const max = Math.max(1, ...data.contributors.map((c) => c.contributions || 0));
    el.innerHTML = data.contributors.map((c) => {
      const pct = Math.max(3, Math.round(((c.contributions || 0) / max) * 100));
      return `
      <article class="panel contrib-card" data-contrib="${Utils.esc(c.login)}" tabindex="0" role="button"
               aria-haspopup="dialog" aria-label="Open the contributor profile for @${Utils.esc(c.login)}">
        <div class="contrib-top">
          <img class="contrib-avatar" src="${Utils.esc(c.avatar_url)}" alt="${Utils.esc(c.login)} avatar" loading="lazy" />
          <div>
            <a class="contrib-login" href="${Utils.esc(c.html_url)}" target="_blank" rel="noopener">@${Utils.esc(c.login)}</a>
            <div class="contrib-role">maintainer</div>
          </div>
        </div>
        <div class="contrib-bar"><i style="width:${pct}%"></i></div>
        <div class="contrib-count"><strong>${Utils.fmtInt(c.contributions || 0)}</strong> commits on default branch</div>
        <span class="pkg-cta">profile »</span>
      </article>`;
    }).join('');

    /* Card → ContribModal wiring: click anywhere on the card (except the
       profile link), or Enter/Space for keyboard users. */
    el.querySelectorAll('.contrib-card[data-contrib]').forEach((card) => {
      card.querySelector('img')?.addEventListener('error', (event) => {
        const fallback = document.createElement('span');
        fallback.className = 'contrib-avatar contrib-avatar-fallback';
        fallback.textContent = card.dataset.contrib.slice(0, 2).toUpperCase();
        event.target.replaceWith(fallback);
      });
      const open = () => ContribModal.open(card.dataset.contrib);
      card.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) return;
        open();
      });
      card.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        open();
      });
    });
  },

  /** Fill the activity chart's meta row (total / average / peak). */
  renderActivityMeta(data) {
    if (data.activityAvailable === false) {
      ['#activity-total', '#activity-avg', '#activity-peak'].forEach((id) => {
        const el = Utils.$(id); if (el) el.textContent = '—';
      });
      return;
    }
    const total = data.weekly.reduce((a, b) => a + b, 0);
    const peak = Math.max(...data.weekly);
    const set = (id, html) => { const n = Utils.$(id); if (n) n.innerHTML = html; };
    set('#activity-total', Utils.fmtInt(total));
    set('#activity-avg', `${Utils.fmtInt(Math.round(total / data.weekly.length))}<em> /wk</em>`);
    set('#activity-peak', `${Utils.fmtInt(peak)}<em> /wk</em>`);
  },

  /** Fill gauge captions with exact counters. */
  renderGaugeCaptions(data) {
    const c = data.counts;
    const i = Utils.$('#gauge-issues-cap');
    if (i) i.innerHTML = `<strong>${Utils.fmtInt(c.issuesClosed)}</strong> of <strong>${Utils.fmtInt(c.issuesOpen + c.issuesClosed)}</strong> issues closed`;
    const p = Utils.$('#gauge-prs-cap');
    if (p) p.innerHTML = `<strong>${Utils.fmtInt(c.prsClosed)}</strong> of <strong>${Utils.fmtInt(c.prsOpen + c.prsClosed)}</strong> pull requests closed`;
  },

  /**
   * Update the nav feed badge to reflect the data mode.
   * @param {'live'|'sim'} mode
   */
  setFeedBadge(mode) {
    const badge = Utils.$('#feed-badge');
    const txt = Utils.$('#feed-badge-text');
    if (!badge || !txt) return;
    if (mode === 'live') {
      badge.classList.remove('badge-sim');
      badge.title = 'Streaming live from the GitHub REST API';
      txt.textContent = 'LIVE';
    } else {
      badge.classList.add('badge-sim');
      badge.title = 'GitHub API unavailable — showing the dated repository snapshot; missing feeds stay empty';
      txt.textContent = 'SNAPSHOT';
    }
  },

  /** Session identifier for the hero HUD corner. */
  renderHud() {
    const el = Utils.$('#hud-session');
    if (el) el.textContent = `0x${Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
  },

  /**
   * Copy-to-clipboard for every install-command button (.clone-copy beside
   * a <code>). Delegated on document so it also covers buttons rendered
   * later (e.g. the dynamically mounted package cards).
   */
  bindCloneCopy() {
    document.addEventListener('click', async (ev) => {
      const btn = ev.target.closest?.('.clone-copy');
      if (!btn) return;
      /* Copy only the displayed commands, excluding shell prompts. */
      const codes = btn.parentElement?.querySelectorAll('code');
      const text = codes && codes.length
        ? [...codes].map((c) => c.textContent.trim()).filter(Boolean).join('\n')
        : '';
      if (!text) return;
      const status = Utils.$('#copy-status');
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta);
        let copied = false;
        try { ta.select(); copied = document.execCommand('copy'); }
        catch { /* The legacy clipboard API can also be unavailable. */ }
        finally { ta.remove(); btn.focus(); }
        if (!copied) {
          if (status) status.textContent = 'Copy failed — select and copy the command manually.';
          return;
        }
      }
      if (status) status.textContent = 'Source clone command copied.';
      const prev = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>';
      setTimeout(() => { btn.innerHTML = prev; }, 1200);
    });
  },

  /** Update the footer's LAST SYNC line. */
  renderFooterSync() {
    const el = Utils.$('#footer-sync');
    if (el) el.textContent = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' });
  },

  /**
   * Master render pass — called once DATA is available.
   * @param {object} data
   */
  renderAll(data) {
    const note = Utils.$('#data-note');
    if (note) note.textContent = data.mode !== 'live'
      ? `GitHub is unavailable. Repository counters use the snapshot from ${SNAPSHOT.fetchedAt.slice(0, 10)}; record feeds are unavailable, not empty or simulated.`
      : (data.missingFeeds?.length ? 'Some feeds are unavailable. Counters may use the dated snapshot; missing records are not simulated.' : 'Metadata is live. Weekly statistics may take time to become available.');
    this.renderChips(data);
    this.renderKpis(data);
    this.renderTicker(data.ticker);
    this.renderBranches(data);
    this.renderReleases(data);
    const unavailable = (prefix) => ['open', 'closed'].filter((state) => data.mode !== 'live'
      || data.missingFeeds?.includes(prefix + state[0].toUpperCase() + state.slice(1)));
    this.renderTracker('issue', data.issues, data.counts, unavailable('issues'));
    this.renderTracker('pr', data.pulls, data.counts, unavailable('pulls'));
    this.renderContributors(data);
    this.renderActivityMeta(data);
    this.renderGaugeCaptions(data);
    this.setFeedBadge(data.mode);
    this.renderFooterSync();
  },
};

function trapDialogFocus(box) {
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...box.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')]
      .filter((el) => !el.closest('[hidden], .pkg-tabpanel:not(.active)'));
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); box.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === box)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
}

const Docs = {
  /**
   * Split a README into tab sections at its `##` headings. Content before
   * the first `##` becomes the "Overview" tab; a leading `#` title is
   * dropped (the modal header already names the module).
   * @param {string} md - Markdown source.
   * @returns {Array<{title:string, body:string[]}>}
   */
  _splitSections(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const sections = [];
    let cur = { title: 'Overview', body: [] };
    let h1Dropped = false;
    for (const line of lines) {
      if (!h1Dropped && /^#\s+/.test(line) && !cur.body.some((l) => l.trim())) {
        h1Dropped = true;
        continue;
      }
      const h2 = /^##\s+(.+?)\s*$/.exec(line);
      if (h2) {
        sections.push(cur);
        cur = { title: h2[1], body: [] };
        continue;
      }
      cur.body.push(line);
    }
    sections.push(cur);
    return sections.filter((s) => s.body.join('').trim());
  },

};

/* ----------------------------------------------------------------------------
 * ItemModal — issue / pull-request details popup for the Tracker section.
 *
 * Opened by activating any tracker row. Shows every applicable field of the
 * record (author, timestamps, labels, milestone, assignees, comment count
 * and, for pull requests, head/base branches + merge/draft state) and the
 * body rendered by the Markdown module as a tabbed docs interface — one tab
 * per `##` section, using the shared terminal dialog chrome and tab classes.
 * ------------------------------------------------------------------------- */
const ItemModal = {
  el: null,        // overlay element (#item-modal)
  box: null,       // dialog element (.pkg-modal)
  _open: false,
  _lastFocus: null,

  /** Capture the overlay and wire dismissal + tab interactions. */
  init() {
    this.el = Utils.$('#item-modal');
    if (!this.el) return;
    this.box = this.el.querySelector('.pkg-modal');
    trapDialogFocus(this.box);

    this.el.addEventListener('click', (ev) => {
      if (ev.target === this.el) { this.close(); return; } // backdrop
      if (ev.target.closest?.('.term-dot-close')) { this.close(); return; }
      const tab = ev.target.closest?.('.pkg-tab');
      if (tab) this._activateTab(tab);
    });

    document.addEventListener('keydown', (ev) => {
      if (!this._open) return;
      if (ev.key === 'Escape') { ev.preventDefault(); this.close(); }
    });

    /* Arrow-key navigation across the body tablist. */
    this.el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const tabs = [...this.el.querySelectorAll('.pkg-tab')];
      const i = tabs.indexOf(document.activeElement);
      if (!tabs.length || i === -1) return;
      ev.preventDefault();
      const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      this._activateTab(next);
    });
  },

  /**
   * Open the modal for a normalized tracker row.
   * @param {object} row - Row from API.normalizeRow / Synth.trackerRows.
   * @param {'issue'|'pr'} kind
   */
  open(row, kind) {
    if (!this.el) return;
    this._lastFocus = document.activeElement;
    const isPr = kind === 'pr';

    const ico = isPr ? UI.ICONS.pr : UI.ICONS.issue;
    const stateTxt = row.merged ? 'MERGED' : row.draft ? 'DRAFT' : String(row.state || '').toUpperCase();
    const stateCls = row.merged ? 'item-state-merged'
      : row.draft ? 'item-state-draft'
      : row.state === 'open' ? 'item-state-open' : 'item-state-closed';

    /* Timestamps — rendered only when the record actually carries them. */
    const when = (iso) => `${Utils.fmtDate(new Date(iso))} · ${Utils.timeAgo(iso)}`;
    const authorHtml = `
      <span class="item-author">
        ${row.avatar ? `<img class="item-avatar" src="${Utils.esc(row.avatar)}" alt="" loading="lazy">` : ''}
        ${row.userUrl
          ? `<a href="${Utils.esc(row.userUrl)}" target="_blank" rel="noopener">@${Utils.esc(row.user)}</a>`
          : `@${Utils.esc(row.user)}`}
      </span>`;

    /* Field grid — every applicable record field; absent data adds no row. */
    const fields = [['AUTHOR', authorHtml]];
    if (row.createdAt) fields.push(['OPENED', when(row.createdAt)]);
    if (row.updatedAt) fields.push(['UPDATED', when(row.updatedAt)]);
    if (row.merged && row.mergedAt) fields.push(['MERGED', when(row.mergedAt)]);
    else if (row.closedAt) fields.push(['CLOSED', when(row.closedAt)]);
    if (typeof row.comments === 'number') fields.push(['COMMENTS', Utils.fmtInt(row.comments)]);
    if (isPr && (row.head || row.base)) {
      fields.push(['BRANCHES', `<span class="item-refs">${Utils.esc(row.head || '?')} <span class="item-refs-arrow">→</span> ${Utils.esc(row.base || '?')}</span>`]);
    }
    if (row.milestone) fields.push(['MILESTONE', Utils.esc(row.milestone)]);
    if (row.assignees?.length) {
      fields.push(['ASSIGNEES', row.assignees.map((a) => `@${Utils.esc(a)}`).join(' ')]);
    }
    if (row.labels.length) {
      const chips = row.labels.map((l) => {
        const bg = `#${l.color}`;
        return `<span class="lbl" style="background:${Utils.rgba(bg, 0.16)};color:${bg};border-color:${Utils.rgba(bg, 0.4)}">${Utils.esc(l.name)}</span>`;
      }).join('');
      fields.push(['LABELS', `<span class="item-labels">${chips}</span>`, true]);
    }

    this.box.innerHTML = `
      <div class="term-bar pkg-modal-bar">
        <button class="term-dot term-dot-close" type="button" aria-label="Close ${isPr ? 'pull request' : 'issue'} details">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button><span class="term-dot"></span><span class="term-dot"></span>
        <span class="term-title">${isPr ? 'pr' : 'issue'}://${CONFIG.owner}/${CONFIG.repo}#${row.number}</span>
      </div>
      <div class="pkg-modal-body">
        <div class="item-head">
          <span class="item-state ${stateCls}">${ico}${stateTxt}</span>
          <h3 class="item-title" id="item-modal-title">${Utils.esc(row.title)} <span class="item-num">#${row.number}</span></h3>
        </div>
        <div class="item-fields">
          ${fields.map(([label, val, fw]) => `
            <div class="item-field${fw ? ' item-field-fw' : ''}">
              <span class="f-label">${label}</span>
              <span class="f-value">${val}</span>
            </div>`).join('')}
        </div>
        <div class="item-actions">
          <a class="btn btn-ghost" href="${Utils.esc(row.url)}" target="_blank" rel="noopener">
            View on GitHub
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
        <h4 class="pkg-modal-h">${isPr ? 'Pull Request' : 'Issue'} Body <span class="h-sub">// markdown</span></h4>
        <div class="pkg-modal-docs">${this._docsHtml(row.body)}</div>
      </div>`;

    /* Show (transition in on the next frame), lock page scroll, focus. */
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('on'));
    document.body.classList.add('pkg-modal-open');
    this._open = true;
    this.box.querySelector('.term-dot-close')?.focus();
  },

  /** Dismiss the modal and restore focus to the originating row. */
  close() {
    if (!this._open) return;
    this._open = false;
    this.el.classList.remove('on');
    document.body.classList.remove('pkg-modal-open');
    const done = () => { this.el.hidden = true; };
    if (Utils.reducedMotion) done(); else setTimeout(done, 300);
    this._lastFocus?.focus?.();
  },

  /**
   * Split a body into tab sections at its `##` headings (reuses the module
   * popup's parser); the preamble becomes the "Description" tab. Unlike
   * PkgModal no sections are dropped — issue/PR bodies keep everything.
   * @param {string} md - Markdown source.
   * @returns {Array<{title:string, body:string[]}>}
   */
  _sections(md) {
    const sections = Docs._splitSections(md);
    if (sections.length && sections[0].title === 'Overview') {
      sections[0] = { ...sections[0], title: 'Description' };
    }
    /* Boilerplate guard — a section whose entire content is a "nothing was
       recorded" note (e.g. an empty ARCHITECT CONDITIONS) earns no tab. */
    return sections.filter((s) => !/^no architect conditions recorded\.?$/i.test(s.body.join('\n').trim()));
  },

  /**
   * Build the body area HTML: a single rendered body when the source has no
   * usable `##` sections, otherwise a tablist + one tabpanel per section —
   * the same docs interface as the module popup.
   * @param {string} md - Markdown source.
   * @returns {string}
   */
  _docsHtml(md) {
    const sections = this._sections(md);
    if (!sections.length) return '<p class="empty-note">// no description provided</p>';
    if (sections.length === 1) {
      return `<div class="md-body">${Markdown.render(sections[0].body.join('\n'))}</div>`;
    }
    const tabs = sections.map((s, i) =>
      `<button class="pkg-tab${i ? '' : ' active'}" type="button" role="tab" aria-selected="${i === 0}" data-tab="${i}">${Utils.esc(s.title)}</button>`,
    ).join('');
    const panels = sections.map((s, i) =>
      `<div class="pkg-tabpanel${i ? '' : ' active'}" role="tabpanel" data-panel="${i}"><div class="md-body">${Markdown.render(s.body.join('\n'))}</div></div>`,
    ).join('');
    return `<div class="pkg-tabs" role="tablist" aria-label="Body sections">${tabs}</div>${panels}`;
  },

  /**
   * Switch the active body tab (click or arrow-key driven).
   * @param {Element} tab - The .pkg-tab button to activate.
   */
  _activateTab(tab) {
    const root = tab.closest('.pkg-modal-docs');
    if (!root) return;
    root.querySelectorAll('.pkg-tab').forEach((t) => {
      const on = t === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    root.querySelectorAll('.pkg-tabpanel').forEach((p) => {
      p.classList.toggle('active', p.dataset.panel === tab.dataset.tab);
    });
  },
};

/* ----------------------------------------------------------------------------
 * ContribModal — contributor "operator profile" popup for the Contributors
 * section.
 *
 * Opened by activating any contributor card. Everything computable from
 * already-loaded repository data renders instantly (commit count + share of
 * the tracked default-branch commits, leaderboard rank, issues/PRs authored
 * inside the tracked tracker windows); the GitHub profile (/users/{login})
 * and the contributor's recent commits (/commits?author=) then hydrate
 * lazily through the shared API cache, so a rate-limited or offline session
 * still shows a complete local profile. Shares the module popup's overlay
 * chrome (.pkg-modal-overlay / .pkg-modal) and the item popup's field grid.
 * ------------------------------------------------------------------------- */
const ContribModal = {
  el: null,        // overlay element (#contrib-modal)
  box: null,       // dialog element (.pkg-modal)
  _open: false,
  _req: 0,         // monotonic token — stale lazy fills are discarded
  _lastFocus: null,

  /** Capture the overlay and wire dismissal. */
  init() {
    this.el = Utils.$('#contrib-modal');
    if (!this.el) return;
    this.box = this.el.querySelector('.pkg-modal');
    trapDialogFocus(this.box);

    this.el.addEventListener('click', (ev) => {
      if (ev.target === this.el) { this.close(); return; } // backdrop
      if (ev.target.closest?.('.term-dot-close')) { this.close(); return; }
    });

    document.addEventListener('keydown', (ev) => {
      if (!this._open) return;
      if (ev.key === 'Escape') { ev.preventDefault(); this.close(); }
    });
  },

  /**
   * Open the profile popup for a contributor login.
   * @param {string} login - GitHub login from STATE.data.contributors.
   */
  open(login) {
    if (!this.el || !STATE.data) return;
    const list = STATE.data.contributors || [];
    const c = list.find((x) => x.login === login);
    if (!c) return;
    this._lastFocus = document.activeElement;
    const req = ++this._req;

    /* Leaderboard rank + share of every tracked default-branch commit. */
    const ranked = [...list].sort((a, b) => (b.contributions || 0) - (a.contributions || 0));
    const rank = ranked.findIndex((x) => x.login === login) + 1;
    const total = Math.max(1, list.reduce((a, x) => a + (x.contributions || 0), 0));
    const share = Math.max(1, Math.round(((c.contributions || 0) / total) * 100));

    /* Issues/PRs authored inside the tracked tracker windows. */
    const authored = (bucket) => [...(bucket?.open || []), ...(bucket?.closed || [])]
      .filter((r) => r.user === login).length;
    const tracked = authored(STATE.data.issues) + authored(STATE.data.pulls);

    const initials = Utils.esc(login.slice(0, 2).toUpperCase());
    const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const stats = [
      ['commits', Utils.fmtInt(c.contributions || 0)],
      ['share', `${share}%`],
      ['rank', `#${rank || '—'}`],
      ['tracked items', Utils.fmtInt(tracked)],
    ];

    this.box.innerHTML = `
      <div class="term-bar pkg-modal-bar">
        <button class="term-dot term-dot-close" type="button" aria-label="Close contributor profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button><span class="term-dot"></span><span class="term-dot"></span>
        <span class="term-title">operator://${Utils.esc(login)}</span>
      </div>
      <div class="pkg-modal-body">
        <div class="contrib-hero">
          <img class="contrib-avatar contrib-hero-avatar" src="${Utils.esc(c.avatar_url || '')}" alt="${Utils.esc(login)} avatar" loading="lazy"
               onerror="this.outerHTML='<div class=\\'contrib-avatar contrib-hero-avatar contrib-avatar-fallback\\'>${initials}</div>'" />
          <div class="contrib-hero-id">
            <h3 class="pkg-modal-name" id="contrib-modal-title">@${Utils.esc(login)}</h3>
            <div class="contrib-role">${rank === 1 ? 'lead maintainer' : 'maintainer'}</div>
          </div>
          <span class="tag contrib-rank">rank&nbsp;#${rank || '—'}</span>
        </div>
        <p class="contrib-bio" data-fill="bio" hidden></p>
        <div class="contrib-stats">
          ${stats.map(([label, val]) => `
            <div class="contrib-stat">
              <span class="s-label">${label}</span>
              <span class="s-value">${val}</span>
            </div>`).join('')}
        </div>
        <h4 class="pkg-modal-h">Commit Share <span class="h-sub">// default branch</span></h4>
        <div class="contrib-bar contrib-share-bar" role="img" aria-label="${share}% of tracked default-branch commits"><i style="width:${share}%"></i></div>
        <h4 class="pkg-modal-h">Recent Commits <span class="h-sub">// by @${Utils.esc(login)}</span></h4>
        <div class="contrib-commits" data-fill="commits"><p class="contrib-loading">// syncing commit history…</p></div>
        <div data-fill="profile"></div>
        <div class="item-actions">
          <a class="btn btn-ghost" href="${Utils.esc(c.html_url)}" target="_blank" rel="noopener">
            View on GitHub
            ${arrow}
          </a>
          <a class="btn btn-ghost" href="https://github.com/${CONFIG.owner}/${CONFIG.repo}/commits?author=${encodeURIComponent(login)}" target="_blank" rel="noopener">
            Commits by @${Utils.esc(login)}
            ${arrow}
          </a>
        </div>
      </div>`;

    /* Show (transition in on the next frame), lock page scroll, focus. */
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('on'));
    document.body.classList.add('pkg-modal-open');
    this._open = true;
    this.box.querySelector('.term-dot-close')?.focus();

    this._fill(login, req);
  },

  /**
   * Lazily hydrate the GitHub-only fields (profile + recent commits). Both
   * endpoints run through the shared sessionStorage cache; failures degrade
   * quietly — the local stats are the floor, never an empty popup.
   * @param {string} login
   * @param {number} req - Request token captured by open().
   */
  async _fill(login, req) {
    const [profile, commits] = await Promise.allSettled([
      API.fetchJSON(`/users/${encodeURIComponent(login)}`),
      API.fetchJSON(`/commits?author=${encodeURIComponent(login)}&per_page=6`),
    ]);
    if (req !== this._req || !this._open) return; // superseded or dismissed

    /* Recent commits — the ticker's mono language, in list form. */
    const cbox = this.box.querySelector('[data-fill="commits"]');
    const rows = commits.status === 'fulfilled' && Array.isArray(commits.value) ? commits.value : [];
    if (cbox) {
      cbox.innerHTML = rows.length
        ? rows.map((raw) => API.normalizeCommit(raw)).filter((cm) => cm.sha).map((cm) => `
            <a class="contrib-commit" href="${Utils.esc(cm.url)}" target="_blank" rel="noopener">
              <span class="sha">${Utils.esc(cm.sha)}</span>
              <span class="cmsg">${Utils.esc(cm.msg)}</span>
              <span class="ago">${Utils.timeAgo(cm.date)}</span>
            </a>`).join('')
        : '<p class="contrib-loading">// commit history unavailable</p>';
    }

    /* Profile — only fields GitHub actually returned earn a row. */
    const p = profile.status === 'fulfilled' ? profile.value : null;
    const pbox = this.box.querySelector('[data-fill="profile"]');
    if (!pbox || !p || p.message) return;
    const fields = [];
    if (p.name) fields.push(['NAME', Utils.esc(p.name)]);
    if (p.company) fields.push(['COMPANY', Utils.esc(p.company)]);
    if (p.location) fields.push(['LOCATION', Utils.esc(p.location)]);
    if (p.blog) {
      const href = /^https?:\/\//i.test(p.blog) ? p.blog : `https://${p.blog}`;
      fields.push(['WEBSITE', `<a href="${Utils.esc(href)}" target="_blank" rel="noopener">${Utils.esc(p.blog)}</a>`]);
    }
    if (p.created_at) fields.push(['MEMBER SINCE', Utils.fmtDate(new Date(p.created_at))]);
    if (typeof p.followers === 'number') fields.push(['FOLLOWERS', Utils.fmtInt(p.followers)]);
    if (typeof p.public_repos === 'number') fields.push(['PUBLIC REPOS', Utils.fmtInt(p.public_repos)]);

    const bio = this.box.querySelector('[data-fill="bio"]');
    if (bio && p.bio) { bio.textContent = p.bio; bio.hidden = false; }
    if (!fields.length) return;
    pbox.innerHTML = `
      <h4 class="pkg-modal-h">Profile <span class="h-sub">// github</span></h4>
      <div class="item-fields contrib-profile">
        ${fields.map(([label, val]) => `
          <div class="item-field">
            <span class="f-label">${label}</span>
            <span class="f-value">${val}</span>
          </div>`).join('')}
      </div>`;
  },

  /** Dismiss the modal and restore focus to the originating card. */
  close() {
    if (!this._open) return;
    this._open = false;
    this.el.classList.remove('on');
    document.body.classList.remove('pkg-modal-open');
    const done = () => { this.el.hidden = true; };
    if (Utils.reducedMotion) done(); else setTimeout(done, 300);
    this._lastFocus?.focus?.();
  },
};

/* ----------------------------------------------------------------------------
 * Reveal — IntersectionObserver scroll reveals + KPI count-up animation.
 * ------------------------------------------------------------------------- */
const Reveal = {
  /** Observe all .reveal elements; adds .in with a light stagger. */
  init() {
    const els = document.querySelectorAll('.reveal');
    if (Utils.reducedMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 55}ms`;
      io.observe(el);
    });
  },

  /**
   * Animate a single KPI value from 0 to its target.
   * @param {Element} el - .kpi-value element with data-target / data-format.
   */
  _countUp(el) {
    const target = parseFloat(el.dataset.target || '0');
    const fmt = el.dataset.format || 'int';
    const render = (v) => {
      el.textContent = fmt === 'bytes' ? Utils.fmtBytes(v) : Utils.fmtInt(v);
    };
    if (Utils.reducedMotion || target <= 0) { render(target); return; }

    const dur = 1350, t0 = performance.now();
    /** @param {number} t rAF timestamp */
    const frame = (t) => {
      const p = Utils.clamp((t - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      render(target * eased);
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  /** Observe KPI values and trigger the count-up on first visibility. */
  watchCounters() {
    const els = document.querySelectorAll('.kpi-value[data-target]');
    if (Utils.reducedMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => this._countUp(el));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        this._countUp(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  },
};

/* ----------------------------------------------------------------------------
 * STATE + boot orchestration.
 * ------------------------------------------------------------------------- */
const STATE = { data: null };

/**
 * Application entry point. Boots static chrome immediately (motion controls,
 * reveals), then hydrates the dashboard from the GitHub API and renders all
 * data-driven sections + charts.
 */
async function boot() {
  Tip.init();
  Reveal.init();
  UI.renderHud();
  UI.bindCloneCopy();
  const motionToggle = Utils.$('#motion-toggle');
  motionToggle?.addEventListener('click', () => {
    const paused = document.body.classList.toggle('motion-paused');
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.setAttribute('aria-label', `${paused ? 'Resume' : 'Pause'} background animation`);
    motionToggle.textContent = paused ? '▶' : 'Ⅱ';
    document.dispatchEvent(new Event('ngen:motionchange'));
  });
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('page-hidden', document.hidden);
    document.dispatchEvent(new Event('ngen:motionchange'));
  });
  ItemModal.init();
  ContribModal.init();

  /* Dock the HEAD FEED ticker as a sticky footer the instant the user
   * scrolls at all; undock when the page returns to the very top. A spacer
   * preserves its original flow position. While fixed, portal the ticker to
   * <body>: leaving it inside main traps z-index:40 in main's z-index:1
   * stacking context, where the later footer can paint over it and create a
   * disappearance zone near the bottom of the page. */
  const ticker = Utils.$('.ticker');
  let tickerSpacer = null;
  const dockTicker = (docked) => {
    if (!ticker || docked === Boolean(tickerSpacer)) return; // already in target state
    if (docked) {
      const h = ticker.offsetHeight;
      document.documentElement.style.setProperty('--ticker-h', `${h}px`);
      tickerSpacer = document.createElement('div');
      tickerSpacer.className = 'ticker-spacer';
      tickerSpacer.style.height = `${h}px`;
      tickerSpacer.setAttribute('aria-hidden', 'true');
      ticker.parentNode.insertBefore(tickerSpacer, ticker);
      document.body.appendChild(ticker); // escape main's stacking context
      ticker.classList.add('docked');
      document.body.classList.add('ticker-docked');
    } else {
      ticker.classList.remove('docked');
      tickerSpacer.replaceWith(ticker); // restore the exact in-flow position
      tickerSpacer = null;
      document.body.classList.remove('ticker-docked');
    }
  };

  /* Solidify the nav + dock the ticker on scroll. Run once immediately too,
   * so browser-restored scroll positions start in the correct state. */
  const nav = Utils.$('.nav');
  const syncScrollChrome = () => {
    nav?.classList.toggle('scrolled', window.scrollY > 12);
    const hero = Utils.$('#hero');
    nav?.classList.toggle('over-hero', Boolean(hero && hero.getBoundingClientRect().bottom > nav.offsetHeight));
    dockTicker(window.scrollY > 0);
  };
  window.addEventListener('scroll', syncScrollChrome, { passive: true });
  syncScrollChrome();

  /* Debounced rebuild keeps chart geometry honest across resizes. */
  window.addEventListener('resize', Utils.debounce(() => {
    syncScrollChrome();
    if (STATE.data) Charts.buildAll(STATE.data);
  }, 220));

  try {
    /* Individual GitHub feeds settle independently. */
    STATE.data = await API.loadAll();
  } catch (err) {
    /* loadAll is designed to never throw; this is belt-and-suspenders. */
    console.error('[ngen] telemetry load failed, full fallback engaged', err);
    STATE.data = {
      mode: 'sim',
      activityAvailable: false,
      repo: SNAPSHOT.repo,
      weekly: SNAPSHOT.weekly,
      languages: SNAPSHOT.languages,
      contributors: SNAPSHOT.contributors.filter((c) => !Utils.isAppLogin(c.login)),
      branches: SNAPSHOT.branches.map((b) => ({ ...b, isDefault: true })),
      releases: [],
      releasesSynthetic: true,
      ticker: [],
      issues: { open: [], closed: [] },
      pulls: { open: [], closed: [] },
      counts: SNAPSHOT.counts,
      days: Synth.daysFromWeekly(SNAPSHOT.weekly),
    };
  }

  UI.renderAll(STATE.data);
  Charts.buildAll(STATE.data);
  Reveal.watchCounters();
  syncScrollChrome();
  document.body.classList.add('loaded');
}

document.addEventListener('DOMContentLoaded', boot);

// vim: ft=javascript sts=4 sw=4 ts=4 et :
