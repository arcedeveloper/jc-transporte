'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [creating, setCreating] = useState(false);

  useEffect(() => setToday(todayPY()), []);

  // Todos los próximos viajes juntos (un año para adelante). "Ver anteriores" suma los últimos 2 meses.
  const { data, error, loading, reload } = useQuery(
    async () => {
      if (!today) return { trips: [] as AdminTrip[] };
      const from = showPast ? addDaysStr(today, -60) : today;
      return api<{ trips: AdminTrip[] }>(`/api/admin/trips?from=${from}&to=${addDaysStr(today, 365)}`, { auth: true });
    },
    [today, showPast],
    { live: true },
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, AdminTrip[]>();
    for (const t of data?.trips ?? []) {
      const d = fromIsoPY(t.departureTime).date;
      groups.set(d, [...(groups.get(d) ?? []), t]);
    }
    return [...groups.entries()];
  }, [data]);

  return (
    <>
      <PageTitle title="Viajes">
        <PastTripsCleanup onDone={() => void reload(true)} />
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-5" aria-hidden /> Nuevo viaje
        </Button>
      </PageTitle>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-niebla">
          {showPast ? 'Viajes de los últimos 2 meses y todos los próximos.' : 'Todos los próximos viajes, ordenados por día.'}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setShowPast((v) => !v)}>
          {showPast ? 'Ocultar viajes anteriores' : 'Ver viajes anteriores'}
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} onRetry={() => void reload()} />
      ) : byDay.length === 0 ? (
        <Empty title="No hay viajes próximos">
          <p>Tocá “Nuevo viaje” para cargar horarios. Podés crear una semana entera de una vez.</p>
        </Empty>
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, trips]) => (
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
      )}

      <TripForm
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => void reload(true)}
      />
    </>
  );
}
