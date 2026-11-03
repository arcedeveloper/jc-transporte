'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { PageTitle } from '@/components/admin/bits';
import { useNow, useTracking } from '@/components/admin/use-tracking';
import { Empty, ErrorBox, Spinner, cn } from '@/components/ui';
import { api } from '@/lib/api';
import { ago, hhmm } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { AdminTrip } from '@/lib/types';

const LiveMap = dynamic(() => import('@/components/live-map'), {
  ssr: false,
  loading: () => <div className="h-[50dvh] animate-pulse rounded-2xl bg-ruta-50" />,
});

export default function LiveOverview() {
  const { data, error, loading, reload } = useQuery(() => api<{ trips: AdminTrip[] }>('/api/admin/trips?status=in_progress', { auth: true }));
  const trips = data?.trips ?? [];
  const { positions, statuses } = useTracking(trips.map((t) => t.id));
  const now = useNow();

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void reload()} />;

  const live = trips
    .filter((t) => (statuses[t.id] ?? t.status) === 'in_progress')
    .map((t) => {
      const p = positions[t.id];
      const lat = p?.lat ?? t.currentLat;
      const lng = p?.lng ?? t.currentLng;
      const at = p?.at ?? t.lastLocationAt;
      return { trip: t, lat, lng, at };
    });
  const markers = live.flatMap((l) =>
    l.lat != null && l.lng != null ? [{ id: l.trip.id, lat: l.lat, lng: l.lng, label: `${l.trip.bus.name}, ${hhmm(l.trip.departureTime)}` }] : [],
  );

  return (
    <>
      <PageTitle title="Buses en viaje" />
      {live.length === 0 ? (
        <Empty title="Ningún bus está en viaje ahora">
          <p>Cuando un chofer toque “Compartir ubicación”, el bus aparece acá.</p>
        </Empty>
      ) : (
        <>
          {markers.length > 0 && <LiveMap markers={markers} className="h-[50dvh] w-full rounded-2xl" />}
          <ul className="mt-5 divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
            {live.map(({ trip: t, at }) => {
              const silent = at ? now - new Date(at).getTime() > 2 * 60 * 1000 : true;
              return (
                <li key={t.id}>
                  <Link href={`/admin/viajes/${t.id}/mapa`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-ruta-50">
                    <span>
                      <span className="font-bold">
                        {t.route.origin} › {t.route.destination}
                      </span>
                      <span className="block text-sm text-niebla">
                        {t.bus.name}, salió {hhmm(t.departureTime)}, {t.driver?.fullName ?? 'sin chofer'}
                      </span>
                    </span>
                    <span className={cn('flex items-center gap-1.5 text-sm font-bold', silent ? 'text-tierra' : 'text-monte')}>
                      {silent && <TriangleAlert className="size-4" />}
                      {at ? ago(at, now) : 'Sin ubicación'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
