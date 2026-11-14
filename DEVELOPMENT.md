# Development

This is a static site adapted from `kyaulabs/prism-web` under AGPL-3.0. It uses vanilla JavaScript, CSS, and the reference site’s vendored D3 v7. nginx serves the built files directly; Node.js/npm are build/test tooling only, not the website’s runtime. There is no upstream application server. The complete NGEN brand pack is retained in `brand/`.

```sh
npm ci
npm run build
```

Use [NGINX.md](NGINX.md) to serve a checkout directly from `/nginx/git/ngen-web`, without installing Node.js or building on the webserver. `index.html` requests `theme.min.js`, `space.min.js`, and `app.min.js`; the checkout nginx configuration aliases these URLs to tracked source files. The commands above generate actual minified scripts for browser tests and release archives. Those generated application scripts are ignored by Git.

```sh
npx playwright install chromium
npm run check
node_modules/.bin/playwright test visual_review.spec.mjs --workers=1 --output tests/Browser/Screenshots/.playwright --reporter=line
```

Playwright automatically starts the loopback-only `tests/server.mjs` helper for browser verification. That Node.js process is test infrastructure, not an application server or deployment target.

The check runs ESLint, Vitest with 95% aggregate coverage thresholds, the production build, and Chromium browser tests. Browser tests intercept all external traffic with controlled fixtures. Screenshots under `tests/Browser/Screenshots/` are ignored working evidence. See `DESIGN.md` for the user-approved reference and viewport matrix.

Repository metadata comes from the unauthenticated GitHub REST API, cached in session storage for ten minutes. On failure, counters use the dated public snapshot in `data/snapshot.json`, embedded in `app.js`; missing record feeds remain unavailable rather than simulated. Refresh both copies together. GitHub may return pending weekly statistics; the page marks them unavailable. Daily matrix cells estimate a distribution from weekly totals and are not exact daily observations.

`space.js` uses the existing vendored D3 to generate 900 stars, cyan/violet nebula clouds from density contours with fractal displacement/texture, and three rotating elliptical tracks with shaded orbiting globes behind the supplied N artwork. This near-black space treatment stays inside the hero in both modes; the dashboard retains its regular theme. Navigation branding switches when the header leaves the hero. Orbit updates are capped at 30 fps; the sub-pixel stellar drift refreshes once per second, on a separate SVG layer from the static nebula. The timer stops for reduced motion, hidden tabs, or the pause control. A local headless Chromium sample observed about 26 orbit updates/s at 1080p and 11 at 3840×2400; the timer ceiling is not a frame-rate guarantee, and hardware-accelerated desktop performance was not measured. Theme colors come from the brand tokens; no WebGL or new runtime dependency is required. `assets/ngen-orbital-core.svg` contains only the supplied N and its unfilled frame, so static orbit fragments cannot show through the transparent center beneath D3’s animated tracks. If D3 is unavailable, the full original schematic remains visible.

The public default branch can differ from local engine development. Language counters describe the public default branch, not the engine’s intended implementation language. No game projects have been announced for the directory. A production origin was not supplied, so absolute Open Graph image/URL metadata must be added when deployment is configured.
