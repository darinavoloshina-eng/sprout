// useToday.ts
// "Now", refreshed whenever the calendar day changes on the phone's own
// clock (so in the user's own time zone).
//
// Home and Calendar used to capture `new Date()` once, when the screen
// mounted. iOS keeps an app suspended in memory for hours or days, so
// opening it the next morning resumed the old screen still showing
// yesterday's tasks, including the ones already crossed off. This hook
// moves to the new day at local midnight while the app is open, and on
// coming back to the foreground after a day boundary.

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { dateKey } from '../engines/taskEngine';

function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refreshIfNewDay = () => {
      const now = new Date();
      setToday((prev) => (dateKey(prev) === dateKey(now) ? prev : now));
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfNewDay();
    });
    const timer = setTimeout(refreshIfNewDay, msUntilNextMidnight(today));
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [today]);

  return today;
}
