'use client';

import type { ReactNode } from 'react';
import { cn } from '../ui';

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-4xl font-bold text-ruta">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-linea bg-white p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Barra de ocupación del bus */
export function Occupancy({ used, total }: { used: number; total: number }) {
  const pct = total ? Math.round((used / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2" title={`${used} de ${total} asientos`}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-papel" aria-hidden>
        <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-tierra' : 'bg-ruta')} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm tabular-nums text-niebla">
        {used}/{total}
      </span>
    </div>
  );
}

/** Pestañas tipo filtro */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-linea" role="tablist">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn('h-9 shrink-0 rounded-lg px-3.5 text-sm font-bold', value === v ? 'bg-ruta text-white' : 'text-ruta hover:bg-ruta-50')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
