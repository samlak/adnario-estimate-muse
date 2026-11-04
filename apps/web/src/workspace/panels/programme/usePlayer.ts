import { useEffect, useRef, useState } from 'react';

/** The 4D player: playing a number of days a second, stepping, and jumping to a date or today. */
export function usePlayer(days: Date[], day: number, setDay: (day: number) => void) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const last = days.length - 1;
  const current = useRef(day);
  current.current = day;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (current.current >= last) return setPlaying(false);
      setDay(current.current + 1);
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, speed]);

  const step = (by: number) => setDay(Math.min(last, Math.max(0, day + by)));
  const jump = (date: Date) => setDay(Math.max(0, Math.min(last, days.findIndex((each) => each >= date))));
  const today = () => { const now = new Date(); jump(now < days[0] ? days[0] : now > days[last] ? days[last] : now); };
  return { playing, setPlaying, speed, setSpeed, last, current, step, jump, today };
}
