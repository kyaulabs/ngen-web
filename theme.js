// $KYAULabs: theme.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
/* Apply the stored or system theme before first paint. */
(function () {
    'use strict';
    let theme = 'dark';
    try {
        const stored = localStorage.getItem('ngen-theme');
        theme = stored === 'light' || stored === 'dark' ? stored
            : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    } catch { /* Storage may be unavailable. */ }
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E222C' : '#EAF8FB');
})();
// vim: ft=javascript sts=4 sw=4 ts=4 et :
