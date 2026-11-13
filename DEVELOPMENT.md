# Development

This is a static site adapted from `kyaulabs/prism-web` under AGPL-3.0. It uses vanilla JavaScript, CSS, and the reference site’s vendored D3 v7. There is no runtime package installation or server framework. The complete NGEN brand pack is retained in `brand/`.

```sh
npm ci
npx playwright install chromium
npm run build
node tests/server.mjs
```

Open `http://127.0.0.1:4173`. Build before serving: `index.html` loads generated `theme.min.js`, `space.min.js`, and `app.min.js`. Deploy those files with `index.html`, `styles.css`, `vendor/d3.min.js`, and `brand/`. Generated application scripts are ignored by Git.

```sh
npm run check
node_modules/.bin/playwright test visual_review.spec.mjs --workers=1 --output tests/Browser/Screenshots/.playwright --reporter=line
```

The check runs ESLint, Vitest with 95% aggregate coverage thresholds, the production build, and Chromium browser tests. Browser tests intercept all external traffic with controlled fixtures. Screenshots under `tests/Browser/Screenshots/` are ignored working evidence. See `DESIGN.md` for the user-approved reference and viewport matrix.

Repository metadata comes from the unauthenticated GitHub REST API, cached in session storage for ten minutes. On failure, counters use the dated public snapshot in `data/snapshot.json`, embedded in `app.js`; missing record feeds remain unavailable rather than simulated. Refresh both copies together. GitHub may return pending weekly statistics; the page marks them unavailable. Daily matrix cells estimate a distribution from weekly totals and are not exact daily observations.

`space.js` uses the existing vendored D3 to generate a 162-star background and three rotating elliptical tracks with shaded orbiting globes, behind the supplied N artwork. Its timer is capped at 30 fps and stops for reduced motion, hidden tabs, or the pause control. Theme colors come from the brand tokens; no WebGL or new runtime dependency is required. If D3 is unavailable, the original schematic remains visible.

The public default branch can differ from local engine development. Language counters describe the public default branch, not the engine’s intended implementation language. No game projects have been announced for the directory. A production origin was not supplied, so absolute Open Graph image/URL metadata must be added when deployment is configured.
