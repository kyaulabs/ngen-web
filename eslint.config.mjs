import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['vendor/**', '**/*.min.js', 'coverage/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] },
  },
  {
    files: ['app.js', 'space.js'],
    languageOptions: { sourceType: 'script', globals: { d3: 'readonly' } },
    rules: { 'no-control-regex': 'off' },
  },
];
