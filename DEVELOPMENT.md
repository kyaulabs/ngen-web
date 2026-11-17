# Development

This static site adapts `kyaulabs/prism-web` under AGPL-3.0. It uses vanilla JavaScript, Sass and vendored D3 v7. nginx serves generated files directly; Node.js/npm are build/test tools, not production runtime. There is no application server, framework or database.

```sh
npm ci
npm run build
```

`npm run build` uses UglifyJS for `space.js` / `app.js` and compressed Sass for `styles.scss`. Edit sources, never ignored application bundles. Invalid Sass exits nonzero without an error stylesheet or source map. Every deployment needs `npm ci --include=dev && npm run build`; see [NGINX.md](NGINX.md).

The website is dark-only. Its Prism-derived palette uses #04060C page/backdrop/footer, 66% #0A101D panels, 55% #10182A headers, and 14% / 30% #7D9BD2 borders. Panel borders strengthen and the `::before` hairline appears on hover. Content remains opaque. Dialogs and tooltips use opaque panel solids. Preserve Prism’s neutral-link versus secondary-text hierarchy: links remain #A4B5CF, while `--ink-2` mixes 78% #637391 / 22% #A4B5CF (approximately #71829F). This is the minimum whole-percent mix toward muted ink clearing 4.5:1 on the three solid page/panel/header bases, not a guarantee over arbitrary imagery. The user separately selected primary/default `--ink-0` darkened 8% toward black (approximately #D7DFEB); raw brand pigments and accent-link colors remain unchanged. Stored light preferences and OS color schemes cannot activate a light website theme.

Neo Sans Pro and Operator Mono are self-hosted under `brand/web/fonts/`, copied unchanged from the user-provided Prism checkout. Their embedded licensing terms remain separate from the website license. Font Awesome Free **7.3.1** is a new vendored UI dependency: `vendor/fontawesome-icons.svg` contains 25 official, unmodified SVG paths grouped into local symbols. `vendor/fontawesome-LICENSE.txt` retains its notices; SVG icons are CC BY 4.0. There is no remote icon kit, CDN request or new npm/runtime dependency. Charts and space artwork remain SVG/D3, not icon replacements.

Shared controls retain Prism’s scoped styles: unframed yellow profile hints, compact copy/release controls, underlined selected tabs and gradient release tags. Do not restyle every native button with `.btn` properties: that previously capitalized tracker titles and framed unrelated hints/cards. Tracker rows remain borderless, with hover fill and inset focus. The contributor’s Font Awesome profile chevron is scoped to 0.67em with a -0.08em baseline offset, matching Prism’s text `»` ink geometry rather than a full-em UI icon. Popup close controls show the reference’s 10px traffic light inside a 24px hit target; the X appears on hover/keyboard focus. Scrolled header actions are transparent until hovered; pause/play retains intrinsic width and compact height.

The hero uses naturally sized grid rows. Mirrored `1fr` rows previously duplicated the tall lower block above the orbital N and pushed actions off a scaled laptop viewport. Test CSS viewport size separately from device scale: 3840×2078 physical pixels at 2× scaling is 1920×1039 CSS pixels. Do not compensate with CSS zoom or device-pixel-ratio scripts. Short/narrow layouts may scroll naturally; hero overflow must not clip actions.

Brand **1.4** refreshes both Prism-derived reference palettes, typography, colored masters and matching exports. Original paths, logo geometry and monochrome assets are preserved; the original supplied Graphite 1.2 archive is untouched. The active website stays dark-only even though the reference handoff supports both themes. Light cyan actions use dark ink and light status labels retain higher-contrast semantic colors.

Brand authoring is separate from deployment:

```sh
npm run build:brand
```

This optional command uses installed Playwright/Chromium, `rsvg-convert`, `pdftocairo` and ImageMagick (`magick`). Leave port 4173 free. Edit `brand/web/ngen-tokens.json`, affected SVG masters and `brand/guide/ngen-brand-guide.html`. The exporter derives reference CSS and both swatch sheets from JSON, includes the website’s font-face declarations, rebuilds colored raster/ICO counterparts at their existing dimensions, and exports the eleven-page guide to PDF/SVG/PNG. It uses task-local Fontconfig/cache files and never installs fonts globally. Monochrome exports are not regenerated. Commit versioned brand outputs; do not hand-edit generated CSS, swatch SVGs, PDF or guide page exports. Reference CSS/JS are not application source aliases; browser tests supply their actual bytes at that boundary.

Application CSS/JS URLs carry the website version as `?v=`. Update these with the package version for a release; browser tests enforce equality. Website, engine and brand versions are independent.

```sh
npx playwright install chromium
npm run check
npm run test:visual -- --case branches
```

Checks run ESLint, Vitest with ≥95% aggregate coverage, production builds and Chromium tests. Playwright starts the allowlisted, loopback-only `tests/server.mjs`; it is not a deployment server. Browser tests intercept external traffic with controlled fixtures. Ignored captures under `tests/Browser/Screenshots/` are working evidence, not user approval or full accessibility/performance certification. See `DESIGN.md` for the approved reference and viewport/state matrix.

Visual review is component-based tooling, separate from behavioral regression tests. `visual_review.json` defines reusable component cases, states and selectors; the generic runner shares the configured viewports, actions, network fixtures and contained evidence publisher. Add or update a case instead of writing a temporary capture script.

```sh
npm run test:visual -- --list
npm run test:visual -- --case branches
npm run test:visual -- --case branches --state dark --viewport mobile
npm run test:visual
```

The command builds fresh application assets before capture. `--list` only lists cases; it does not build or launch Chromium. Repeat filters to include multiple values. Unknown filters and empty selections fail, rather than reporting a successful zero-test run. With no filters, run the full matrix. For localized changes, inspect the affected component's required states at mobile, desktop and 320px reflow; use the full matrix for shared tooling or cross-cutting changes.

Reusable cases cover branches, footer/ticker links, contributor commit links and contributor cards. A case can set `"captureSelector": "#branches"` to capture one unique component directly. A component created or revealed by actions, such as a modal, is captured after those actions; pre-position only already-visible components. Component captures clip the prepared viewport without re-scrolling or full-document resizing that could lose hover. The selected component must fit inside the viewport; oversized/offscreen targets fail rather than publish a partial crop. Use a smaller component or omit the selector for a full-page case. Omit it for the existing full-page capture. Both modes retain loopback-only navigation, controlled fixtures, page-error checks and the same safe evidence publication. Metadata records `fullPage: false` for component captures without storing raw selectors. No crop helper or new dependency is needed. Evidence remains ignored; user visual acceptance is separate from passing checks.

GitHub REST metadata is cached in session storage for ten minutes. Failure uses the dated public snapshot in `data/snapshot.json`, embedded in `app.js`; refresh both together. Missing feeds remain unavailable, not simulated. Pending weekly statistics are marked unavailable. Daily matrix cells estimate distributions from weekly totals, not exact daily observations. Public languages describe the public default branch, not necessarily the engine’s intended implementation language. The game showcase remains empty until projects are announced.

Branch cards use each HEAD commit’s committer timestamp, labelled “committed”, not repository-wide `pushed_at`. Reuse matching commits from the existing feed; fetch missing HEAD metadata by SHA through the same cache. Failed or invalid metadata leaves the time absent without hiding the branch or substituting another branch’s activity. Offline snapshot branches have no inferred times. “browse tree” comes first; SHA links and default/protected badges remain.

`space.js` remains unchanged by the palette/template refresh. It generates 900 temperature-varied stars, an irregular five-color textured nebula and three rotating tracks with miniature stellar cores/coronas. Preserve the approved nebula’s geometry, spectrum, texture, opacity and native wrapper motion. The fixed field stays behind scrolling content until the opaque footer; the upright N and orbits remain hero-local. Reduced motion, hidden tabs and manual pause stop motion; cleanup cancels animations and timers. Missing animation APIs leave a static field. The 30fps timer cap is not an accelerated frame-rate guarantee; hardware-accelerated desktop performance remains unmeasured.

Stars use seven approximate blackbody tints from 3,000–20,000 K. NASA’s [stellar spectra explanation](https://science.nasa.gov/asset/webb/continuous-spectra-blackbody-curves-of-stars/) and [star types reference](https://science.nasa.gov/universe/stars/types/) inform the illustration. A faint-heavy sample uses logarithmic flux, compressed exposure and sparse bloom. Apparent sizes represent point-spread/exposure, not stellar diameters. There is no artificial twinkling, catalog/calibrated photometry or claim that camera drift represents physical stellar motion.

`assets/ngen-orbital-core.svg` contains the supplied N and unfilled frame; the fallback derives from the brand schematic without captions or a central fill. Keep these website-specific variants outside the brand masters. Absolute Open Graph image/URL metadata remains a separate follow-up.
