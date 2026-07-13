/**
 * useTimeOfDay — returns the current time-of-day period and a CSS class.
 *
 * morning   06:00–11:59 — warm amber light through windows
 * afternoon 12:00–16:59 — neutral, bright, high-contrast
 * evening   17:00–20:59 — golden hour, soft orange cast
 * night     21:00–05:59 — cool blue, deep shadow
 */
import { useState, useEffect } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export function getGreeting(): string {
  const t = getTimeOfDay();
  if (t === 'morning')   return 'Good Morning,';
  if (t === 'afternoon') return 'Good Afternoon,';
  if (t === 'evening')   return 'Good Evening,';
  return 'Good Night,';
}

export function useTimeOfDay(): TimeOfDay {
  const [tod, setTod] = useState<TimeOfDay>(getTimeOfDay);

  useEffect(() => {
    // Re-evaluate every minute in case the hour crosses over
    const id = setInterval(() => setTod(getTimeOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);

  return tod;
}
