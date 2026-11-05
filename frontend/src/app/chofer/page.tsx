'use client';

import Link from 'next/link';
import { ChevronRight, RefreshCw, Users } from 'lucide-react';
import { Button, Empty, ErrorBox, Spinner, TripBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { dayLong, fromIsoPY, hhmm, todayPY } from '@/lib/format';
import { PayLine } from '@/components/driver/pay-line';
import { useQuery } from '@/lib/use-query';
import type { DriverTrip } from '@/lib/types';

export default function DriverHome() {
  const { data, error, loading, reload } = useQuery(() => api<{ trips: DriverTrip[] }>('/api/driver/trips', { auth: true }), [], { live: true });
  const today = todayPY();
  const trips = data?.trips ?? [];
  const now = trips.filter((t) => t.status === 'in_progress' || fromIsoPY(t.departureTime).date === today);
  const next = trips.filter((t) => !now.includes(t));

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold text-ruta">Tus viajes</h1>
          <p className="text-niebla">Hoy es {dayLong(`${today}T12:00:00-03:00`).toLowerCase()}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void reload()} aria-label="Actualizar">
          <RefreshCw className="size-5" />
        </Button>
      </div>

      <div className="mt-6">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error.message} onRetry={() => void reload()} />
        ) : !trips.length ? (
          <Empty title="No tenés viajes asignados">
            <p>Cuando la oficina te asigne un viaje, aparece acá.</p>
          </Empty>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-bold">Hoy</h2>
              {now.length ? <TripList trips={now} /> : <p className="rounded-2xl bg-white p-4 text-niebla">No tenés viajes hoy.</p>}
            </section>
            {next.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">Próximos viajes</h2>
                <TripList trips={next} showDate />
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function TripList({ trips, showDate }: { trips: DriverTrip[]; showDate?: boolean }) {
  return (
    <ul className="space-y-3">
      {trips.map((t) => (
        <li key={t.id}>
          <Link
            href={`/chofer/viaje?id=${t.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-linea bg-white p-5 transition hover:border-ruta"
          >
            <span>
              {showDate && <span className="block font-bold text-ambar-dark">{dayLong(t.departureTime)}</span>}
              <span className="font-display text-4xl font-bold">{hhmm(t.departureTime)}</span>
              <span className="block text-lg font-bold">
                {t.origin} › {t.destination}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-3 text-niebla">
                <TripBadge status={t.status} />
                <span className="flex items-center gap-1">
                  <Users className="size-4" aria-hidden /> {t.occupiedSeats ?? 0} pasajeros
                </span>
                <span>{t.busName}</span>
              </span>
              <PayLine pay={t.pay} />
            </span>
            <ChevronRight className="size-7 shrink-0 text-ruta" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

