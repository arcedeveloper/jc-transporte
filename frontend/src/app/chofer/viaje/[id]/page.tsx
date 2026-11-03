'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BatteryCharging, Navigation, TriangleAlert, WifiOff } from 'lucide-react';
import { useNow } from '@/components/admin/use-tracking';
import { useLocationSharing } from '@/components/driver/use-location-sharing';
import { PayLine } from '@/components/driver/pay-line';
import { Button, ErrorBox, Spinner, TripBadge, cn } from '@/components/ui';
import { api } from '@/lib/api';
import { ago, dayLong, fromIsoPY, hhmm, todayPY } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { DriverPassenger, DriverTrip } from '@/lib/types';
import { toast } from '@/store/toast';

const LiveMap = dynamic(() => import('@/components/live-map'), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-ruta-50" />,
});

interface TripData {
  trip: DriverTrip;
  passengers: DriverPassenger[];
  summary: { total: number; boarded: number; unpaid: number };
}

export default function DriverTripPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useQuery(() => api<TripData>(`/api/driver/trips/${id}`, { auth: true }), [id]);
  const sharing = useLocationSharing(id, (msg) => {
    toast.error(msg);
    void reload(true);
  });
  const now = useNow();

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error?.message ?? 'Error'} onRetry={() => void reload()} />;

  const { trip, passengers } = data;
  const paid = passengers.filter((p) => p.bookingStatus === 'confirmed');
  const closed = trip.status === 'completed' || trip.status === 'cancelled';
  const notToday = trip.status !== 'in_progress' && fromIsoPY(trip.departureTime).date !== todayPY();

  return (
    <>
      <Link href="/chofer" className="inline-flex items-center gap-1.5 font-bold text-ruta">
        <ArrowLeft className="size-4" /> Mis viajes
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-5xl font-bold">{hhmm(trip.departureTime)}</p>
          <h1 className="text-xl font-bold">
            {trip.origin} › {trip.destination}
          </h1>
          <p className="text-niebla">
            {trip.busName} ({trip.busPlate})
          </p>
        </div>
        <TripBadge status={sharing.state === 'on' ? 'in_progress' : trip.status} />
      </div>

      <div className="mt-4">
        <PayLine pay={trip.pay} big />
      </div>

      {/* ---- Compartir ubicación ---- */}
      <section className="mt-6" aria-label="Ubicación del bus">
        {closed ? (
          <p className="rounded-2xl bg-papel p-5 text-center font-bold text-niebla">Este viaje ya terminó.</p>
        ) : notToday && sharing.state !== 'on' ? (
          <p className="rounded-2xl bg-ambar-50 p-5 text-center font-bold text-ambar-dark">
            Este viaje es el {dayLong(trip.departureTime).toLowerCase()}. El botón para compartir la ubicación aparece ese día.
          </p>
        ) : sharing.state === 'on' ? (
          <div className="rounded-3xl bg-monte p-5 text-white">
            <p className="flex items-center gap-3 text-xl font-bold">
              <span className="relative flex size-4">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex size-4 rounded-full bg-white" />
              </span>
              Compartiendo ubicación
            </p>
            <p className="mt-2 text-lg">Mantené esta pantalla abierta.</p>
            <p className="mt-1 text-white/80">
              {sharing.lastSent ? `Último envío ${ago(sharing.lastSent, now)}` : 'Enviando…'}
              {sharing.pos?.speedMps != null && `, ${Math.round(sharing.pos.speedMps * 3.6)} km/h`}
            </p>
            {sharing.netProblem && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/15 p-3 font-bold">
                <WifiOff className="size-5" /> Sin internet. Seguimos intentando, no cierres la página.
              </p>
            )}
            {sharing.wakeLockOk === false && (
              <p className="mt-3 rounded-xl bg-white/15 p-3 text-sm">
                Este celular no deja mantener la pantalla encendida sola. Subí el tiempo de bloqueo de pantalla en Ajustes.
              </p>
            )}
            {sharing.pos && (
              <div className="mt-4 overflow-hidden rounded-2xl">
                <LiveMap markers={[{ id: 'me', lat: sharing.pos.lat, lng: sharing.pos.lng }]} variant="me" className="h-56 w-full" />
              </div>
            )}
            <Button variant="outline" size="lg" className="mt-4 w-full border-white/40 bg-transparent text-white hover:bg-white/10" onClick={sharing.stop}>
              Detener
            </Button>
          </div>
        ) : (
          <div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={sharing.start}
              disabled={sharing.state === 'starting'}
              className="flex h-24 w-full items-center justify-center gap-3 rounded-3xl bg-ambar font-display text-3xl font-bold text-ruta-dark shadow-[0_12px_30px_-10px_rgb(255_176_0/0.7)] disabled:opacity-80"
            >
              <Navigation className={cn('size-8', sharing.state === 'starting' && 'animate-pulse')} aria-hidden />
              {sharing.state === 'starting' ? 'Buscando GPS…' : 'Compartir ubicación'}
            </motion.button>
            <p className="mt-3 flex items-center gap-2 text-niebla">
              <BatteryCharging className="size-5 shrink-0" aria-hidden />
              Mantené esta pantalla abierta y el celular cargando.
            </p>
            {sharing.error && (
              <p className={cn('mt-3 flex items-start gap-2 rounded-2xl p-4 font-bold', sharing.state === 'error' ? 'bg-tierra-50 text-tierra' : 'bg-ambar-50 text-ambar-dark')} role="alert">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" /> {sharing.error}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ---- Pasajeros (solo los que pagaron) ---- */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Pasajeros ({paid.length})</h2>
        {paid.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-niebla">Todavía no hay pasajeros confirmados en este viaje.</p>
        ) : (
          <ul className="space-y-2">
            {paid.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-linea bg-white p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ruta font-display text-xl font-bold text-white">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-bold">{p.fullName}</span>
                  <a href={`tel:${p.phone}`} className="text-sm text-niebla underline">{p.phone}</a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
