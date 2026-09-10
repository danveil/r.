// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { isStandalone } from './display-mode';
afterEach(() => vi.unstubAllGlobals());
it('defaults to browser without window', () => expect(isStandalone()).toBe(false));
it('recognizes the standalone media query', () => {
  const matchMedia = vi.fn(() => ({ matches: true }));
  vi.stubGlobal('window', { matchMedia, navigator: {} });
  expect(isStandalone()).toBe(true);
  expect(matchMedia).toHaveBeenCalledWith('(display-mode: standalone)');
});
it('recognizes iOS navigator.standalone without matchMedia', () => {
  vi.stubGlobal('window', { navigator: { standalone: true } });
  expect(isStandalone()).toBe(true);
});
it('does not confuse an ordinary browser with installed mode', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), navigator: { standalone: false } });
  expect(isStandalone()).toBe(false);
});
