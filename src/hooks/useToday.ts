import { useEffect, useState } from 'react';
import { todayKey } from '../lib/dates';
export function useToday() {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const update = () => setToday(todayKey());
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
