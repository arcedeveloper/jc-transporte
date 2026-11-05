'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock, Gauge, TriangleAlert, Wifi, WifiOff } from 'lucide-react';
import { useNow, useTracking } from '@/components/admin/use-tracking';
import { ErrorBox, Spinner, TripBadge, cn } from '@/components/ui';
import { api } from '@/lib/api';
import { ago, hhmm } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { TripLocation } from '@/lib/types';

const LiveMap = dynamic(() => import('@/components/live-map'), {
  ssr: false,
  loading: () => <div className="h-[60dvh] animate-pulse rounded-2xl bg-ruta-50" />,
});

const NO_SIGNAL_MS = 2 * 60 * 1000;

function TripMapPageInner() {
  const id = useSearchParams().get('id') ?? '';
  const { data, error, loading, reload } = useQuery(() => api<TripLocation>(`/api/admin/trips/${id}/location`, { auth: true }), [id]);
  const { positions, statuses, connected } = useTracking([id]);
  const now = useNow();

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error?.message ?? 'Error'} onRetry={() => void reload()} />;

  const pos = positions[id] ?? data.location;
  const status = statuses[id] ?? data.status;
  const silentFor = pos ? now - new Date(pos.at).getTime() : 0;
  const noSignal = !!pos && status === 'in_progress' && silentFor > NO_SIGNAL_MS;

  return (
    <>
      <Link href={`/admin/viajes/detalle?id=${id}`} className="inline-flex items-center gap-1.5 font-bold text-ruta hover:underline">
        <ArrowLeft className="size-4" /> Detalle del viaje
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold text-ruta">{data.label}</h1>
          <p className="text-niebla">
            Salida {hhmm(data.departureTime)}, {data.busName} ({data.busPlate}), {data.driverName ?? 'sin chofer'}
          </p>
        </div>
        <TripBadge status={status} />
      </div>

      <div className="relative mt-5">
        {pos ? (
          <LiveMap markers={[{ id, lat: pos.lat, lng: pos.lng, label: data.busName }]} className="h-[60dvh] w-full rounded-2xl" />
        ) : (
          <div className="grid h-[40dvh] place-items-center rounded-2xl border-2 border-dashed border-linea bg-white p-6 text-center">
            <div>
              <p className="font-display text-3xl font-bold text-ruta">El chofer aún no compartió su ubicación</p>
              <p className="mt-2 text-niebla">El mapa aparece solo cuando toque “Compartir ubicación” en su celular.</p>
            </div>
          </div>
        )}
      </div>

      {noSignal && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-tierra-50 p-4 font-bold text-tierra" role="alert">
          <TriangleAlert className="size-5" /> Sin señal hace {Math.floor(silentFor / 60000)} min. Puede que el celular del chofer se haya quedado sin batería o
          sin internet.
        </p>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-linea bg-white p-4">
          <dt className="flex items-center gap-1.5 text-sm text-niebla">
            <Clock className="size-4" /> Última actualización
          </dt>
          <dd className={cn('font-display text-2xl font-bold', noSignal && 'text-tierra')}>{pos ? ago(pos.at, now) : 'Sin datos'}</dd>
        </div>
        <div className="rounded-2xl border border-linea bg-white p-4">
          <dt className="flex items-center gap-1.5 text-sm text-niebla">
            <Gauge className="size-4" /> Velocidad
          </dt>
          <dd className="font-display text-2xl font-bold">{pos?.speed != null ? `${pos.speed} km/h` : 'Sin datos'}</dd>
        </div>
        <div className="rounded-2xl border border-linea bg-white p-4">
          <dt className="flex items-center gap-1.5 text-sm text-niebla">
            {connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />} Conexión del panel
          </dt>
          <dd className={cn('font-display text-2xl font-bold', connected ? 'text-monte' : 'text-tierra')}>{connected ? 'En vivo' : 'Reconectando…'}</dd>
        </div>
      </dl>
    </>
  );
}

export default function TripMapPage() {
  return (
    <Suspense>
      <TripMapPageInner />
    </Suspense>
  );
}
