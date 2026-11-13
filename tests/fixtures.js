// $KYAULabs: fixtures.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
// Controlled fixture records adapted from the Prism tests. Never used by the site.
import { CONFIG, Utils } from '../app.js';
export const FixtureSynth = {
  /** Label vocabulary aligned with the KYAU Labs TPS labeling system. */
  LABELS: {
    feature: '#41d6c3', patch: '#41d6c3', bug: '#ff5050', documentation: '#c0e6ff',
    performance: '#41d6c3', refactor: '#ffa572', style: '#ffa572', test: '#ffd791',
    'ci/cd': '#ffd791', chore: '#ffd791', security: '#ff5050', critical: '#800000',
    high: '#c11c00', medium: '#f39a4d', low: '#8cd211', 'in progress': '#fbca04',
    done: '#0e8a16',
  },

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

  /**
   * Offline release summary. Marked synthetic in the UI because the live
   * release feed was unavailable; copy reflects the verified 1.2.0 release.
   * @returns {Array<{tag:string,name:string,body:string,date:string,url:string,latest:boolean,synthetic:boolean}>}
   */
  releases() {
    const base = 'https://github.com/kyaulabs/ngen';
    const mk = (tag, name, date, body, latest = false) => ({
      tag, name, date, body, latest, synthetic: true, url: `${base}/releases/tag/${tag}`,
    });
    return [
      mk('v1.2.0', 'Prism 1.2.0', '2026-11-03T15:50:00Z',
        '### Highlights\n\n- Ordinary Pi packages: global Core and project-local PHP/web and C++ modules\n- Skills guide engineering; native project tools enforce configured checks\n- C++20 skills, /check-cpp [scope] and Linux Clang native acceptance\n- Tested Pi host 1.5.0; Prism and Pi versions are separate', true),
    ];
  },

  /**
   * Synthetic tracker rows (used only if list endpoints fail).
   * @param {'issue'|'pr'} kind
   * @param {'open'|'closed'} state
   * @param {number} n - Row count.
   * @returns {Array<object>} Normalized row objects (see API.normalizeRow).
   */
  trackerRows(kind, state, n) {
    const L = FixtureSynth.LABELS;
    const lbl = (name) => ({ name, color: (L[name] || '#8b9bb4').replace('#', '') });
    const pool = kind === 'issue'
      ? [
          ['feat(skills): clarify native project verification', ['feature', 'medium'], 'kyau'],
          ['bug(build): scss sourcemaps missing in watch mode', ['bug', 'high'], 'kyau'],
          ['security(deps): rotate semgrep ruleset to p/ci', ['security', 'critical'], 'kyaulabs-bot'],
          ['docs(readme): document behavior-focused TDD guidance', ['documentation', 'low'], 'kyau'],
          ['test(harness): expand commitlint fixture matrix', ['test', 'in progress'], 'kyaulabs-bot'],
          ['refactor(cli): unify flag parsing across commands', ['refactor', 'medium'], 'kyau'],
          ['ci/cd: cache semgrep baseline between runs', ['ci/cd', 'high'], 'kyaulabs-bot'],
          ['chore(release): automate git-cliff changelog PR', ['chore', 'low'], 'kyau'],
        ]
      : [
          ['feat(skills): add project-local C++20 guidance', ['feature', 'high'], 'kyau'],
          ['fix(security): clarify secret-protection limits', ['security', 'critical'], 'kyaulabs-bot'],
          ['perf(build): parallelize scss compilation', ['performance', 'medium'], 'kyau'],
          ['feat(tdd): refine test-first engineering guidance', ['feature', 'high'], 'kyau'],
          ['docs: add architecture decision records', ['documentation', 'low'], 'kyaulabs-bot'],
          ['refactor(hooks): extract shared git helpers', ['refactor', 'medium'], 'kyau'],
        ];
    const rng = Utils.mulberry32(CONFIG.repoId + (kind === 'issue' ? 11 : 23) + (state === 'open' ? 0 : 7));
    const base = 'https://github.com/kyaulabs/ngen';
    const rows = [];
    for (let i = 0; i < Math.min(n, pool.length); i++) {
      const [title, labels, user] = pool[i];
      const num = 238 - i * (1 + Math.floor(rng() * 4));
      const isPr = kind === 'pr';
      const merged = isPr && state === 'closed' && i % 3 !== 1;
      const createdAt = new Date(Date.now() - (i + 2) * 36e5 * (30 + rng() * 90)).toISOString();
      const closedAt = state === 'closed'
        ? new Date(Date.now() - (i + 1) * 36e5 * (10 + rng() * 30)).toISOString()
        : null;
      const scope = /^\w+\(([^)]+)\)/.exec(title)?.[1]
        || title.split(':')[0].replace(/\W+/g, '-').toLowerCase();
      rows.push({
        number: num,
        title,
        url: `${base}/${isPr ? 'pull' : 'issues'}/${num}`,
        state,
        merged,
        draft: isPr && state === 'open' && i === 0,
        labels: labels.map(lbl),
        user,
        userUrl: `https://github.com/${user}`,
        avatar: '',
        createdAt,
        updatedAt: new Date(Date.now() - (i + 1) * 36e5 * (6 + rng() * 40)).toISOString(),
        closedAt,
        mergedAt: merged ? closedAt : null,
        comments: Math.floor(rng() * 9),
        milestone: i % 4 === 0 ? 'v1.1.0 — telemetry polish' : '',
        assignees: i % 3 === 0 ? [user] : [],
        head: isPr ? `feat/${scope}-${num}` : '',
        base: isPr ? 'develop' : '',
        body: FixtureSynth._trackerBody(kind, title),
      });
    }
    return rows;
  },

  /**
   * Synthetic markdown body for tracker rows — structured with `##`
   * sections so the ItemModal docs tabs render in simulation mode too.
   * @param {'issue'|'pr'} kind
   * @param {string} title
   * @returns {string}
   */
  _trackerBody(kind, title) {
    return [
      `## ${kind === 'pr' ? 'Summary' : 'Problem'}`,
      '',
      `Synthetic record for **${title}** — rendered while the live GitHub`,
      'API is unreachable, so the details popup never shows empty.',
      '',
      `## ${kind === 'pr' ? 'Test Plan' : 'Acceptance Criteria'}`,
      '',
      '- Reproducible against the current `develop` branch',
      '- Covered by the TDD gate (failing test first, then green)',
      '- Passes the Semgrep + Gitleaks security scans',
    ].join('\n');
  },

  /**
   * Synthetic ticker commits (used only if the commits endpoint fails).
   * @returns {Array<{sha:string,msg:string,date:string,url:string}>}
   */
  tickerCommits() {
    const rng = Utils.mulberry32(CONFIG.repoId + 5);
    const hex = () => Array.from({ length: 7 }, () => '0123456789abcdef'[Math.floor(rng() * 16)]).join('');
    const msgs = [
      'fix(security): harden agent permission model and add git-commit gating validator',
      'feat(harness): wire TDD gate into the commit pipeline',
      'chore(deps): bump semgrep ruleset to latest',
      'docs: refresh agent catalog and permission matrix',
      'refactor(build): streamline scss incremental pipeline',
      'test: add commitlint fixture coverage for breaking changes',
      'ci: cache gitleaks baseline between workflow runs',
      'feat(agents): scoped permission profiles per role',
    ];
    return msgs.map((msg, i) => ({
      sha: hex(), msg, url: 'https://github.com/kyaulabs/ngen/commits/develop',
      date: new Date(Date.now() - i * 36e5 * 9).toISOString(),
    }));
  },
};
// vim: ft=javascript sts=4 sw=4 ts=4 et :
