import { useEffect, useState } from 'react';
import { istToday } from '../api/client';

export function useToday(): string {
  const [today, setToday] = useState(istToday);
  useEffect(() => {
    const update = () => {
      const next = istToday();
      setToday((current) => (current === next ? current : next));
    };
    const minuteTimer = window.setInterval(update, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(minuteTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return today;
}
