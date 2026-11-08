'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from './ui';

/**
 * Cartel de destino como el del frente del bus: texto ámbar con puntitos LED.
 * Si recibe varias líneas, las va rotando.
 */
export function LedSign({ lines, className, size = 'lg' }: { lines: string[]; className?: string; size?: 'md' | 'lg' }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const list = lines.length ? lines : ['JC TRANSPORTE'];

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 3600);
    return () => clearInterval(t);
  }, [list.length]);

  const text = list[i % list.length];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-4 border-[#050d17] bg-[#0a1726] shadow-[inset_0_2px_12px_rgb(0_0_0/0.6)]',
        size === 'lg' ? 'h-20 sm:h-24' : 'h-14',
        className,
      )}
      role="img"
      aria-label={`Cartel: ${text}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={text}
          className={cn(
            'led-text absolute inset-0 flex items-center justify-center whitespace-nowrap px-4 font-display font-bold uppercase',
            size === 'lg' ? 'text-3xl sm:text-5xl' : 'text-2xl',
          )}
          initial={reduce ? { opacity: 0 } : { y: '100%' }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: '-100%' }}
          transition={{ duration: 0.45, ease: [0.3, 0, 0.2, 1] }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
      <div className="led-dots pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );
}
