NGEN VISUAL IDENTITY 1.3
KYAU Labs

NGEN is a C++20 game engine for space simulators, with a focus on space MMOs.
Balanced is the approved visual identity. Its stepped N and paired violet
wake lines appear in the wordmark and in the standalone icon.

START HERE

  guide/ngen-brand-guide.pdf
      Eleven-page guide to the identity, clear space, sizing, color, type,
      artwork, and website integration. Editable HTML source sits alongside
      the PDF. Page PNGs and SVGs are in guide/pages/.

  identity/
      Combined identity board plus dark and light presentation variants.
      Each board is available as PNG and SVG.

  logos/svg/ and logos/png/
      Integrated NGEN wordmark and descriptor signature. Use the "dark" files
      on dark surfaces and "light" files on light surfaces. Mono white and
      black assets are provided for single-color use. The vector lettering is
      outlined. Transparent PNGs are supplied at 640 and/or 1280 px wide.

  icons/
      Transparent standalone mark, opaque app tile, and rounded favicon.
      App tile PNGs are 32, 64, 128, 256, 512, and 1024 px. Favicons are
      available as fixed-theme SVG and PNG, theme-adaptive SVG, and ICO
      containing 16, 32, and 48 px images for each mode.

  social/
      Open Graph cards at 1200 x 630 px, banners at 1500 x 500 px, and
      circle-safe avatars at 1024 x 1024 px. Use PNG for publishing and SVG
      for editing or scaling. Choose a dark or light card for each page.

  graphics/
      Transparent orbital schematic in dark and light SVG and PNG.

  web/
      ngen-theme.css follows the system theme. Set data-theme on the html
      element to "light" or "dark" to override it. ngen-tokens.json separates
      base theme colors from the five component material expressions. CSS
      exposes base colors as --ngen-* and material aliases as --bg-0, --panel,
      --panel-2, --line and --line-strong. Open palette-preview.html locally to inspect the tokens
      and try both modes. The palettes/ folder has PNG and SVG swatch sheets.
      open-graph.example.html is a starting point for sharing metadata.

ASSET USE

  Keep the custom N inside the wordmark. Use the standalone N by itself in
  favicons, app icons, and avatars. Preserve one N upright of clear space.
  Measure the recommended minimum widths from the visible artwork.

  Wordmark       144 px
  Signature      220 px
  Standalone N    24 px canvas
  Favicon         16 px tile

  The SVG favicon follows the system theme where the browser supports it.
  For an explicit site theme, select the matching fixed-theme favicon.
  Point Open Graph metadata to one hosted PNG using an absolute URL.

  The dark page, space backdrop, header/footer base and opaque exports use
  #191919. Panel materials use 70% #191919; secondary/header materials use
  65% #27303a. Both line aliases use 35% #7899A6. These are background and
  border alpha, not reduced text or whole-element opacity. surface-alt shares
  the panel-header base color. Light reference materials remain unchanged.
  Keep bright focus rings and labeled controls; faint borders are decorative.
  Guide contrast ratios use alpha composited over the reference page, not
  arbitrary imagery, and do not establish full accessibility conformance.

REVISION AND EXPORTS

  Revision 1.3 is a user-authorized update of the supplied Graphite 1.2 pack.
  It refreshes dark materials, swatches, previews, the guide, affected dark
  presentation artwork and matching raster exports. All original asset paths,
  logo geometry, accent colors, monochrome artwork and light-specific logo,
  icon, social and schematic assets are retained. Mixed-mode boards and guide
  pages show updated dark references; the light swatch sheet changes only its
  revision label. Light colors and artwork geometry are unchanged.
  The original supplied archive is not modified. Website and brand versions
  are independent; the website remains dark-only.

  In the website source checkout, npm run build:brand rebuilds reference CSS,
  the dark swatch SVG, affected PNG/ICO exports, PDF and guide page exports.
  Inputs are web/ngen-tokens.json, affected SVG masters and the guide HTML.
  It uses installed Playwright/Chromium, rsvg-convert, pdftocairo and ImageMagick
  (magick), with Noto Sans and Adwaita Sans/Mono installed to retain the supplied
  typography. Port 4173 must be free. No new npm dependency or production server
  is required; ordinary website builds/deployments do not run this command.
