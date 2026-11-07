'use client';

import { useEffect, useMemo, useState } from 'react';
import { monthLabel, thisMonth } from '@/components/admin/finance';
import Link from 'next/link';
import { EyeOff, Plus, Radio } from 'lucide-react';
import { Occupancy, PageTitle } from '@/components/admin/bits';
import { PastTripsCleanup } from '@/components/admin/past-trips-cleanup';
import { TripForm } from '@/components/admin/trip-form';
import { Button, Empty, ErrorBox, Spinner, TripBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { addDaysStr, dateStrLong, fromIsoPY, gs, hhmm, todayPY } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { AdminTrip } from '@/lib/types';

export default function TripsAdmin() {
  const [today, setToday] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [pastMonth, setPastMonth] = useState(thisMonth);
  const [creating, setCreating] = useState(false);

  useEffect(() => setToday(todayPY()), []);

  // Todos los próximos viajes juntos (un año para adelante)
  const { data, error, loading, reload } = useQuery(
    async () => {
      if (!today) return { trips: [] as AdminTrip[] };
      return api<{ trips: AdminTrip[] }>(`/api/admin/trips?from=${today}&to=${addDaysStr(today, 365)}`, { auth: true });
    },
    [today],
    { live: true },
  );

  // Viajes anteriores: de a un mes, solo los días que ya pasaron
  const past = useQuery(
    async () => {
      if (!today || !showPast) return { trips: [] as AdminTrip[] };
      const [y, m] = pastMonth.split('-').map(Number) as [number, number];
      const first = `${pastMonth}-01`;
      const last = `${pastMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      const yesterday = addDaysStr(today, -1);
      const to = last < yesterday ? last : yesterday;
      if (to < first) return { trips: [] as AdminTrip[] };
      return api<{ trips: AdminTrip[] }>(`/api/admin/trips?from=${first}&to=${to}`, { auth: true });
    },
    [today, showPast, pastMonth],
    { live: true },
  );

  const byDay = useMemo(() => groupByDay(data?.trips ?? []), [data]);
  // Los anteriores, del más reciente al más viejo
  const pastByDay = useMemo(() => groupByDay(past.data?.trips ?? []).reverse(), [past.data]);

  return (
    <>
      <PageTitle title="Viajes">
        <PastTripsCleanup onDone={() => void reload(true)} />
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-5" aria-hidden /> Nuevo viaje
        </Button>
      </PageTitle>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-niebla">Todos los próximos viajes, ordenados por día.</p>
        <Button variant="ghost" size="sm" onClick={() => setShowPast((v) => !v)}>
          {showPast ? 'Ocultar viajes anteriores' : 'Ver viajes anteriores'}
        </Button>
      </div>

      {showPast && (
        <section className="mb-8 rounded-2xl border-2 border-linea bg-papel p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-tinta">Viajes anteriores de {monthLabel(pastMonth)}</h2>
            <label className="flex items-center gap-2 text-sm font-bold text-niebla">
              Mes
              <input
                type="month"
                value={pastMonth}
                max={thisMonth()}
                onChange={(e) => e.target.value && setPastMonth(e.target.value)}
                className="h-10 rounded-xl border-2 border-linea bg-white px-3 text-tinta focus:border-ruta focus:outline-none"
              />
            </label>
          </div>
          {past.loading ? (
            <Spinner />
          ) : past.error ? (
            <ErrorBox message={past.error.message} onRetry={() => void past.reload()} />
          ) : pastByDay.length === 0 ? (
            <p className="text-niebla">No hubo viajes en {monthLabel(pastMonth)}.</p>
          ) : (
            <TripDays days={pastByDay} />
          )}
        </section>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} onRetry={() => void reload()} />
      ) : byDay.length === 0 ? (
        <Empty title="No hay viajes próximos">
          <p>Tocá “Nuevo viaje” para cargar horarios. Podés crear una semana entera de una vez.</p>
        </Empty>
      ) : (
        <TripDays days={byDay} />
      )}

      <TripForm
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => void reload(true)}
      />
    </>
  );
}

function groupByDay(trips: AdminTrip[]) {
  const groups = new Map<string, AdminTrip[]>();
  for (const t of trips) {
    const d = fromIsoPY(t.departureTime).date;
    groups.set(d, [...(groups.get(d) ?? []), t]);
  }
  return [...groups.entries()];
}

/** Lista de viajes agrupada por día */
function TripDays({ days }: { days: [string, AdminTrip[]][] }) {
  return (
    <div className="space-y-6">
      {days.map(([day, trips]) => (
        <section key={day}>
          <h2 className="mb-2 font-display text-2xl font-bold text-tinta">{dateStrLong(day)}</h2>
          <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
            {trips.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <Link href={`/admin/viajes/detalle?id=${t.id}`} className="min-w-0 hover:underline">
                  <span className="font-display text-2xl font-bold">{hhmm(t.departureTime)}</span>{' '}
                  <span className="font-bold">
                    {t.route.origin} › {t.route.destination}
                  </span>
                  <span className="block text-sm text-niebla">
                    {t.bus.name}, {t.driver?.fullName ?? 'sin chofer'}, {gs(t.price)}
                  </span>
                </Link>
                <div className="flex items-center gap-3">
                  <Occupancy used={t.occupied} total={t.bus.capacity} />
                  {t.status === 'in_progress' ? (
                    <Link href={`/admin/viajes/mapa?id=${t.id}`} className="flex items-center gap-1.5 rounded-full bg-monte px-3 py-1 text-sm font-bold text-white">
                      <Radio className="size-4" aria-hidden /> Mapa
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2">
                      {!t.showOnHome && t.status === 'scheduled' && (
                        <span className="flex items-center gap-1 rounded-full bg-papel px-2.5 py-0.5 text-sm font-bold text-niebla" title="No aparece en la portada">
                          <EyeOff className="size-3.5" aria-hidden /> Privado
                        </span>
                      )}
                      {t.bookingClosed && t.status === 'scheduled' && (
                        <span className="rounded-full bg-ruta px-2.5 py-0.5 text-sm font-bold text-white">Cerrado</span>
                      )}
                      <TripBadge status={t.status} />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
