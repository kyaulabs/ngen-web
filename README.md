<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/ngen-wordmark-dark.svg" />
  <img src="brand/logos/svg/ngen-wordmark-light.svg" alt="NGEN" width="360" />
</picture>

[KYAU Labs](https://kyaulabs.com/)

[![Contributor Covenant](https://img.shields.io/badge/contributor%20covenant-2.1-4baaaa.svg?logo=open-source-initiative&logoColor=4baaaa)](CODE_OF_CONDUCT.md) &nbsp; [![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-fe5196?style=flat&logo=conventionalcommits)](https://www.conventionalcommits.org/en/v1.0.0/) &nbsp; [![License](https://img.shields.io/github/license/kyaulabs/ngen-web?logo=creativecommons)](LICENSE)

[![Website release](https://img.shields.io/github/v/release/kyaulabs/ngen-web?include_prereleases&logo=semver&sort=semver&label=website%20release)](https://github.com/kyaulabs/ngen-web/releases) &nbsp; [![Discord](https://img.shields.io/discord/88713030895943680?logo=discord&color=blue&logoColor=white)](https://discord.gg/DSvUNYm)

## About

[NGEN](https://github.com/kyaulabs/ngen) is a C++20 game engine for space simulators, with a focus on space MMOs.

**This repository contains NGEN’s website, not the engine implementation.** Engine source, prerequisites, and build documentation live in [`kyaulabs/ngen`](https://github.com/kyaulabs/ngen). Website releases version this site independently of the engine.

## Website

The site combines NGEN’s visual identity with a public repository dashboard adapted from [Prism Web](https://github.com/kyaulabs/prism-web).

- A D3 space scene with a dense star field, organic cyan/violet nebulae, rotating orbital tracks, and globes circling the N mark.
- A dark hero in both color modes, with theme-aware navigation and dashboard panels below it.
- Repository counters, commit activity, language composition, estimated daily activity, branches, releases, issues, pull requests, and contributor profiles from `kyaulabs/ngen`.
- A source-clone command and a Games directory, currently showing “No games announced yet.”
- Keyboard-operable dialogs, reduced-motion support, and an animation pause control.

GitHub’s unauthenticated API can be unavailable or rate-limited. Counters then use a dated public snapshot; missing record feeds are marked unavailable rather than simulated. The commit matrix estimates daily distribution from weekly totals—it is not an exact daily history.

## Local development

Requirements on the build/test machine: Node.js 24+ and npm.

```sh
npm ci
npm run build
```

Serve the built files with nginx using [NGINX.md](NGINX.md). Rebuild after changing JavaScript: the page loads generated `theme.min.js`, `space.min.js`, and `app.min.js`. Node.js is build/test tooling, not the website’s runtime.

## Verification

Install Chromium once, then run the full gate:

```sh
npx playwright install chromium
npm run check
```

This runs ESLint, Vitest with 95% aggregate coverage thresholds, the production build, and Chromium behavior and visual-capture checks. Browser tests use controlled fixtures instead of live external services.

The viewport matrix covers 390×844 mobile, 320px reflow, 1920×1080, 3840×2160, and 3840×2400, including both themes. Working screenshots remain ignored under `tests/Browser/Screenshots/`.

## Deployment

Build from source with `npm ci && npm run build`, or use the static-site archive attached to a [website release](https://github.com/kyaulabs/ngen-web/releases). Release archives include SHA-256 checksums.

Follow [NGINX.md](NGINX.md) for static-file deployment, HTTPS, configuration validation, and reload instructions. nginx serves these files directly; it must not proxy to a Node.js application:

```text
index.html
styles.css
theme.min.js
space.min.js
app.min.js
vendor/d3.min.js
assets/
brand/
```

No Node.js runtime, PHP application, or database is required on the production server. A production origin has not been configured in this repository; absolute Open Graph image and page URLs should be set when deploying.

## Documentation

- [nginx deployment](NGINX.md): production file layout, server configuration, and HTTPS.
- [Development notes](DEVELOPMENT.md): data behavior, build output, preview tooling, and known verification limits.
- [Visual brief](DESIGN.md): approved branding, motion, and viewport requirements.
- [Brand guide](brand/guide/ngen-brand-guide.pdf) and [asset index](brand/README.txt).
- [Changelog](CHANGELOG.md).

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

The website is licensed under [AGPL-3.0](LICENSE). Its dashboard was adapted from the KYAU Labs Prism website; the NGEN identity assets are included in `brand/`.
