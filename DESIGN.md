# NGEN website brief

User direction: replicate `../prism-web` completely, using the supplied `brand/` pack and its orbital graphics as the animated background. Preserve the single-page dashboard, navigation, HUD, commit ticker, charts, branches, releases, tracker dialogs, contributor profiles, and theme switch.

- Use NGEN’s approved cyan/violet semantic palette and system sans/monospace typography. The user clarified that the hero shows only the animated N orbital schematic from `brand/graphics/`, not the NGEN wordmark. Remove “FIG. 01” and “TRANSFER GEOMETRY” from the hero artwork in both themes. Keep the wordmark in navigation and footer. Follow `brand/guide/ngen-brand-guide.pdf`; keep logos horizontal, proportional, unfiltered, and on quiet fields.
- Point telemetry and source links at `kyaulabs/ngen`.
- Replace Prism’s npm modules with games using the engine. The user selected an empty showcase: “No games announced yet.” Do not invent games.
- Include source cloning, but do not claim cloning builds or installs a runnable engine.
- The user additionally requested a D3 space simulation behind the N: a moving stellar field, three rotating orbit tracks, and shaded globes circling each orbit. Keep the supplied N upright; animate the surrounding geometry rather than the wordmark. Use the supplied dark/light schematics as the progressive-enhancement fallback. Honor reduced motion, pause while hidden, and offer a pause control.
- Verify 390×844 mobile, 1920×1080, 3840×2160, and 3840×2400 desktops in both color modes, plus 320px reflow. `visual_review.json` covers mobile, 1080p, reflow, offline, and dialogs; browser tests cover the two larger desktop sizes.

Quality targets: semantic HTML, WCAG 2.2 AA, visible keyboard focus, contained dialog focus, progressive enhancement, and responsive content without horizontal page overflow. Primary touch controls target 44×44 CSS pixels, stricter than AA’s 24×24 minimum with exceptions. Reduced-motion support is an additional motion-safety measure. Browser evidence is local, controlled test content—not a claim of full accessibility conformance or user visual approval.
