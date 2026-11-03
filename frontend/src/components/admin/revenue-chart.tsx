'use client';

import { useState } from 'react';
import { gs } from '@/lib/format';

/** Barras simples de recaudación por día (SVG, sin librerías). */
export function RevenueChart({ data }: { data: { day: string; total: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.total), 1);
  const W = 600;
  const H = 180;
  const gap = 3;
  const bw = W / data.length - gap;
  const label = (day: string) => `${Number(day.slice(8))}/${Number(day.slice(5, 7))}`;
  const active = hover != null ? data[hover] : null;

  return (
    <div>
      <p className="mb-3 text-sm text-niebla">
        {active
          ? `${label(active.day)}: ${gs(active.total)}, ${active.count} reserva(s) confirmada(s)`
          : 'Últimos 30 días. Pasá el mouse (o tocá) una barra para ver el día.'}
      </p>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="Recaudación por día, últimos 30 días">
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--color-linea)" />
        {data.map((d, i) => {
          const h = d.total ? Math.max(3, (d.total / max) * (H - 8)) : 0;
          const x = i * (bw + gap);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
              <rect
                x={x}
                y={H - h}
                width={bw}
                height={h}
                rx={3}
                fill={hover === i ? 'var(--color-ambar)' : 'var(--color-ruta)'}
              >
                <title>{`${label(d.day)}: ${gs(d.total)}`}</title>
              </rect>
              {i % 5 === 0 && (
                <text x={x + bw / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="var(--color-niebla)">
                  {label(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
