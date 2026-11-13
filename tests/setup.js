// $KYAULabs: setup.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((media) => ({ matches: true, media, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
});

vi.stubGlobal('IntersectionObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
// vim: ft=javascript sts=4 sw=4 ts=4 et :
