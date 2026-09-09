import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useToday } from './useToday';
afterEach(() => vi.useRealTimers());
it('rolls over at local midnight while the app remains open', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 11, 31, 23, 59, 50));
  const { result } = renderHook(useToday);
  expect(result.current).toBe('2025-12-31');
  act(() => {
    vi.advanceTimersByTime(30000);
  });
  expect(result.current).toBe('2026-01-01');
});
it('refreshes on resume after the device slept', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 0, 1, 12));
  const { result } = renderHook(useToday);
  vi.setSystemTime(new Date(2025, 0, 2, 9));
  act(() => window.dispatchEvent(new Event('focus')));
  expect(result.current).toBe('2025-01-02');
});
