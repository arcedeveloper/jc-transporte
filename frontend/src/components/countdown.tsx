'use client';

import { useEffect, useRef, useState } from 'react';

/** Cuenta regresiva mm:ss. Llama onExpire una sola vez al llegar a cero. */
export function useCountdown(until: string | null, onExpire?: () => void) {
  const [left, setLeft] = useState<number | null>(null);
  const fired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    fired.current = false;
    if (!until) {
      setLeft(null);
      return;
    }
    const end = new Date(until).getTime();
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      if (ms === 0 && !fired.current) {
        fired.current = true;
        cb.current?.();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);

  return left;
}

export function mmss(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "23 h 15 min" para plazos largos */
export function hoursLeft(ms: number) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
}
