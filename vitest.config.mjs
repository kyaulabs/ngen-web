import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [{
    name: 'dashboard-test-exports',
    transform(code, id) {
      if (id === new URL('./space.js', import.meta.url).pathname) return { code: `${code}\nexport { Space };`, map: null };
      if (id === new URL('./app.js', import.meta.url).pathname) {
        return { code: `${code}\nexport { CONFIG, SNAPSHOT, Utils, Markdown, Theme, Tip, Synth, API, Charts, UI, Docs, ItemModal, ContribModal, Reveal, STATE, boot };`, map: null };
      }
    },
  }],
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    testTimeout: 15000,
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['app.js', 'theme.js', 'space.js'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
});
