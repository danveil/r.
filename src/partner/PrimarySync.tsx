import { useEffect, useRef } from 'react';
import type { AppData } from '../types';
import { partnerDB } from './storage';
export function PrimarySync({ data, today }: { data: AppData; today: string }) {
  const latest = useRef(data);
  latest.current = data;
  const firstOpen = useRef(true);
  useEffect(() => {
    const sync = async (force: boolean) => {
      if (!(await partnerDB.primary.get('primary'))) return;
      const { syncPrimary } = await import('./service');
      await syncPrimary(force, latest.current);
    };
    void sync(firstOpen.current).catch(() => {});
    firstOpen.current = false;
    const foreground = () => {
      if (document.visibilityState === 'visible') void sync(true).catch(() => {});
    };
    window.addEventListener('online', foreground);
    document.addEventListener('visibilitychange', foreground);
    return () => {
      window.removeEventListener('online', foreground);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [data, today]);
  return null;
}
