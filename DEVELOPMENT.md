# Development

This is a static site adapted from `kyaulabs/prism-web` under AGPL-3.0. It uses vanilla JavaScript, Sass, and the reference site’s vendored D3 v7. nginx serves the built files directly; Node.js/npm are build/test tooling only, not the website’s runtime. There is no upstream application server. The complete NGEN brand pack is retained in `brand/`.

```sh
npm ci
npm run build
```

Use [NGINX.md](NGINX.md) to build and serve a checkout at `/nginx/git/ngen-web`. `npm run build` runs UglifyJS for the two application scripts and Sass with compressed output for `styles.scss`. The Sass entry point defines the supplied brand’s dark palette unconditionally and produces one `styles.min.css`; edit the SCSS source, never the generated CSS. Sass is a build-only dependency. The build also disables source maps and error stylesheets, and exits nonzero on invalid Sass.

`index.html` loads only minified scripts and CSS. Generated application scripts and CSS are ignored by Git, so every deployment must install build dependencies with `npm ci --include=dev` and run `npm run build`. nginx serves those outputs directly, with no source aliases or application server. Browser tests use the same generated files. There is no theme switch, preference manager, or theme bootstrap script; stored light preferences and OS color schemes do not affect the page. Original light assets remain only in the supplied brand pack, not in the active page or compiled stylesheet.

Application asset URLs carry the website version as a cache key so returning visitors cannot reuse the old light stylesheet or theme manager. When preparing a release, update their `?v=` values in `index.html` with the package version; browser tests enforce this.

```sh
npx playwright install chromium
npm run check
node_modules/.bin/playwright test visual_review.spec.mjs --workers=1 --output tests/Browser/Screenshots/.playwright --reporter=line
```

Playwright automatically starts the loopback-only `tests/server.mjs` helper for browser verification. That Node.js process is test infrastructure, not an application server or deployment target.

The check runs ESLint, Vitest with 95% aggregate coverage thresholds, the production build, and Chromium browser tests. Browser tests intercept all external traffic with controlled fixtures. Screenshots under `tests/Browser/Screenshots/` are ignored working evidence. See `DESIGN.md` for the user-approved reference and viewport matrix.

Repository metadata comes from the unauthenticated GitHub REST API, cached in session storage for ten minutes. On failure, counters use the dated public snapshot in `data/snapshot.json`, embedded in `app.js`; missing record feeds remain unavailable rather than simulated. Refresh both copies together. GitHub may return pending weekly statistics; the page marks them unavailable. Daily matrix cells estimate a distribution from weekly totals and are not exact daily observations.

`space.js` uses the existing vendored D3 to generate 900 stars, cyan/violet nebula clouds from density contours with fractal displacement/texture, and three rotating elliptical tracks with shaded orbiting globes behind the supplied N artwork. The near-black star/nebula backdrop is viewport-fixed behind the hero and dashboard throughout the dark-only site, ending visually at the opaque dark footer. Panels, section headings, and unboxed text use the dark brand palette. The N and orbital tracks remain inside the hero, and navigation always uses the dark-background wordmark. Browser-native animations move HTML layers around the star/nebula SVGs for visible drift and gentle cloud flow, independently of the 30 fps orbital timer. Cloud geometry and filter parameters do not change during animation. All motion pauses for reduced motion, hidden tabs, or the pause control. Without the native animation API, the backdrop remains static. The orbital timer ceiling is not a frame-rate guarantee. High-resolution headless profiling remains slow; hardware-accelerated desktop performance has not been measured. Site colors come from the dark brand tokens; no WebGL or new runtime dependency is required. `assets/ngen-orbital-core.svg` contains only the supplied N and its unfilled frame, so static orbit fragments cannot show through the transparent center beneath D3’s animated tracks. If D3 is unavailable, the full original schematic remains visible.

The public default branch can differ from local engine development. Language counters describe the public default branch, not the engine’s intended implementation language. No game projects have been announced for the directory. Absolute Open Graph image/URL metadata remains to be configured for the production origin.
