// $KYAULabs: theme.test.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules(); localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#0E222C">';
});
it.each(['dark', 'light'])('applies the saved %s theme before application boot', async (theme) => {
  localStorage.setItem('ngen-theme', theme);
  await import('../../theme.js');
  expect(document.documentElement.dataset.theme).toBe(theme);
  expect(document.querySelector('meta').content).toBe(theme === 'dark' ? '#0E222C' : '#EAF8FB');
});
it.each([true, false])('uses the system preference when saved data is invalid: %s', async (light) => {
  localStorage.setItem('ngen-theme', 'invalid');
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: light });
  await import('../../theme.js');
  expect(document.documentElement.dataset.theme).toBe(light ? 'light' : 'dark');
});
it('remains usable when storage and optional chrome are unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  document.head.innerHTML = '';
  await import('../../theme.js');
  expect(document.documentElement.dataset.theme).toBe('dark');
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
