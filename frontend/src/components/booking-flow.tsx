'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Clock, Minus, Plus, Users } from 'lucide-react';
import { z } from 'zod';
import { ApiError, api, errorMessage } from '@/lib/api';
import { saveBooking } from '@/lib/browser';
import { dayLong, docClean, docInput, duration, gs, hhmm } from '@/lib/format';
import { getPublicSocket, joinRoom } from '@/lib/socket';
import type { PublicBooking, TripDetailResponse } from '@/lib/types';
import { toast } from '@/store/toast';
import { BusCard } from './bus-info';
import { LedSign } from './led-sign';
import { PromoImage } from './promos';
import { Button, ErrorBox, Input, Spinner, buttonClass, cn } from './ui';

const MAX_PER_BOOKING = 10;

const phoneRe = /^\+?[\d\s-]{6,20}$/;
const ContactSchema = z.object({
  phone: z.string().trim().regex(phoneRe, 'Escribí un teléfono válido, por ejemplo 0981 123 456'),
});
const PassengerSchema = z.object({
  fullName: z.string().trim().min(3, 'Escribí nombre y apellido'),
  document: z.string().trim().min(3, 'Escribí la cédula'),
  phone: z.union([z.literal(''), z.string().trim().regex(phoneRe, 'Teléfono inválido')]),
});

interface Pax {
  fullName: string;
  document: string;
  phone: string;
}
const emptyPax = (): Pax => ({ fullName: '', document: '', phone: '' });

function loadContact() {
  try {
    return JSON.parse(localStorage.getItem('jc-contact') ?? 'null') as { phone?: string } | null;
  } catch {
    return null;
  }
}

export function BookingFlow({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [data, setData] = useState<TripDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [count, setCount] = useState(1);
  const [pax, setPax] = useState<Pax[]>([emptyPax()]);
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<TripDetailResponse>(`/api/trips/${tripId}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [tripId]);

  useEffect(() => {
    void load();
    const saved = loadContact();
    if (saved?.phone) setPhone(saved.phone);
  }, [load]);

  // Lugares libres en vivo: si otra persona reserva, se actualiza solo
  useEffect(() => {
    const socket = getPublicSocket();
    const leave = joinRoom(socket, 'trip:join', 'trip:leave', tripId);
    const onPlaces = (p: { tripId: string; available: number; closed: boolean; bookable: boolean }) => {
      if (p.tripId !== tripId) return;
      setData((d) => (d ? { ...d, available: p.available, closed: p.closed, bookable: p.bookable, soldOut: p.available === 0 } : d));
    };
    const onReconnect = () => void load();
    socket.on('trip:places', onPlaces);
    socket.io.on('reconnect', onReconnect);
    return () => {
      leave();
      socket.off('trip:places', onPlaces);
      socket.io.off('reconnect', onReconnect);
    };
  }, [tripId, load]);

  const maxCount = Math.max(1, Math.min(MAX_PER_BOOKING, data?.available ?? 1));

  // Si bajan los lugares disponibles, achicamos la cantidad elegida
  useEffect(() => {
    if (count > maxCount) changeCount(maxCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxCount]);

  function changeCount(n: number) {
    const next = Math.min(Math.max(1, n), maxCount);
    setCount(next);
    setPax((list) => (next > list.length ? [...list, ...Array.from({ length: next - list.length }, emptyPax)] : list.slice(0, next)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;

    const errs: Record<string, string> = {};
    const c = ContactSchema.safeParse({ phone });
    if (!c.success) errs['contact.phone'] = c.error.issues[0]?.message ?? 'Teléfono inválido';
    pax.forEach((p, i) => {
      const r = PassengerSchema.safeParse(p);
      if (!r.success) for (const issue of r.error.issues) errs[`${i}.${String(issue.path[0])}`] = issue.message;
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Revisá los datos marcados en rojo.');
      document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const contactPhone = phone.trim();
      const { booking } = await api<{ booking: PublicBooking }>('/api/bookings', {
        method: 'POST',
        body: {
          tripId,
          contactPhone,
          passengers: pax.map((p) => ({ fullName: p.fullName.trim(), document: docClean(p.document), phone: p.phone.trim() || contactPhone })),
        },
      });
      try {
        localStorage.setItem('jc-contact', JSON.stringify({ phone: contactPhone }));
      } catch {
        /* sin almacenamiento */
      }
      saveBooking({
        code: booking.code,
        phone: contactPhone,
        label: `${booking.trip.origin} › ${booking.trip.destination}`,
        departureTime: booking.trip.departureTime,
      });
      router.push(`/reserva?code=${encodeURIComponent(booking.code)}&tel=${encodeURIComponent(contactPhone)}&nueva=1`);
    } catch (err) {
      setSubmitting(false);
      toast.error(errorMessage(err));
      if (err instanceof ApiError && ['NOT_ENOUGH_PLACES', 'SOLD_OUT', 'TRIP_CLOSED'].includes(err.code ?? '')) void load();
    }
  }

  // ---- Render ----
  if (loadError && !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <ErrorBox message={loadError} onRetry={() => void load()} />
      </div>
    );
  }
  if (!data) return <Spinner label="Cargando el viaje…" />;

  const { trip } = data;
  const total = trip.price * count;
  const pct = data.capacity ? Math.round(((data.capacity - data.available) / data.capacity) * 100) : 0;
  const few = data.bookable && data.available <= 4;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <Link href="/#salidas" className="inline-flex items-center gap-1.5 font-bold text-ruta hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Otras salidas
      </Link>

      {trip.promo?.imageId && (
        <PromoImage
          imageId={trip.promo.imageId}
          title={trip.promo.title || `${trip.origin} › ${trip.destination}`}
          layout={trip.promo.layout}
          className="mt-4 rounded-2xl"
        />
      )}

      <div className="mt-4">
        {/* Con título de publicidad no repetimos la ruta en el cartel */}
        {trip.promo?.title ? (
          <>
            <h1 className="font-display text-4xl font-bold leading-tight text-ruta">{trip.promo.title}</h1>
            <p className="font-bold text-niebla">
              {trip.origin} › {trip.destination}
            </p>
          </>
        ) : (
          <LedSign lines={[`${trip.origin}  ›  ${trip.destination}`]} size="md" />
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-niebla">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden /> {dayLong(trip.departureTime)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden /> Sale {hhmm(trip.departureTime)}, llega {hhmm(trip.arrivalTime)} ({duration(trip.durationMinutes)})
          </span>
        </div>
        {trip.promo?.text && <p className="mt-3 whitespace-pre-line text-lg">{trip.promo.text}</p>}
      </div>

      {/* Lugares libres */}
      <div className="mt-6 rounded-2xl border border-linea bg-white p-5" aria-live="polite">
        <div className="flex items-end justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-bold">
            <Users className="size-5 text-ruta" aria-hidden />
            {data.closed
              ? 'Reservas cerradas'
              : data.soldOut
                ? 'Viaje completo'
                : data.available === 1
                  ? 'Queda 1 lugar'
                  : `Quedan ${data.available} lugares`}
          </p>
          <span className="text-sm text-niebla">de {data.capacity}</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-papel" aria-hidden>
          <motion.div
            className={cn('h-full rounded-full', few || data.soldOut ? 'bg-tierra' : 'bg-monte')}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', damping: 25 }}
          />
        </div>
      </div>

      <div className="mt-4">
        <BusCard bus={trip.bus} />
      </div>

      {!data.bookable ? (
        <div className="mt-6 rounded-2xl bg-papel p-6 text-center">
          <p className="font-display text-3xl font-bold text-ruta">
            {data.closed ? 'Este viaje ya está confirmado' : data.soldOut ? 'No quedan lugares' : 'Este viaje ya no acepta reservas'}
          </p>
          <p className="mt-2 text-niebla">Buscá otro horario o escribinos por WhatsApp.</p>
          <Link href="/#salidas" className={buttonClass('primary', 'md', 'mt-5')}>
            Buscar otro viaje
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8">
          <h1 className="font-display text-4xl font-bold text-ruta">Reservá tu lugar</h1>

          {/* Cantidad */}
          <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-linea bg-white p-5" aria-labelledby="cuantos">
            <div>
              <h2 id="cuantos" className="text-lg font-bold">
                ¿Cuántos viajan?
              </h2>
              <p className="text-sm text-niebla">{gs(trip.price)} por persona</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => changeCount(count - 1)}
                disabled={count <= 1}
                className="grid size-12 place-items-center rounded-xl border-2 border-linea text-ruta hover:border-ruta disabled:opacity-30"
                aria-label="Un pasajero menos"
              >
                <Minus className="size-5" />
              </button>
              <span className="w-10 text-center font-display text-4xl font-bold tabular-nums" aria-live="polite">
                {count}
              </span>
              <button
                type="button"
                onClick={() => changeCount(count + 1)}
                disabled={count >= maxCount}
                className="grid size-12 place-items-center rounded-xl border-2 border-linea text-ruta hover:border-ruta disabled:opacity-30"
                aria-label="Un pasajero más"
              >
                <Plus className="size-5" />
              </button>
            </div>
          </section>

          {/* Pasajeros */}
          <AnimatePresence initial={false}>
            {pax.map((p, i) => {
              const set = (patch: Partial<Pax>) => setPax((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <motion.section
                  key={i}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                  aria-label={`Pasajero ${i + 1}`}
                >
                  <div className="mt-4 rounded-2xl border border-linea bg-white p-5">
                    <h2 className="flex items-center gap-3 text-lg font-bold">
                      <span className="grid size-9 place-items-center rounded-lg bg-ruta font-display text-xl text-white">{i + 1}</span>
                      Pasajero {i + 1}
                    </h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <Input
                          label="Nombre y apellido"
                          autoComplete={i === 0 ? 'name' : 'off'}
                          value={p.fullName}
                          onChange={(e) => set({ fullName: e.target.value })}
                          error={errors[`${i}.fullName`]}
                        />
                      </div>
                      <Input
                        label="Cédula"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ej: 4.567.890"
                        value={p.document}
                        onChange={(e) => set({ document: docInput(e.target.value) })}
                        error={errors[`${i}.document`]}
                      />

                      {i === 0 ? (
                        <Input
                          label="WhatsApp"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="0981 123 456"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          error={errors['contact.phone']}
                          hint="Por acá te confirmamos el pago. Con este número ves tu reserva después."
                        />
                      ) : (
                        <Input
                          label="Teléfono (opcional)"
                          type="tel"
                          inputMode="tel"
                          placeholder="Si no tiene, usamos el WhatsApp del pasajero 1"
                          value={p.phone}
                          onChange={(e) => set({ phone: e.target.value })}
                          error={errors[`${i}.phone`]}
                        />
                      )}
                    </div>
                  </div>
                </motion.section>
              );
            })}
          </AnimatePresence>

          {/* Total */}
          <div className="mt-6 rounded-2xl bg-ruta p-5 text-white">
            <p className="text-white/70">
              {count} {count === 1 ? 'pasaje' : 'pasajes'} × {gs(trip.price)}
            </p>
            <p className="font-display text-4xl font-bold">{gs(total)}</p>
            <Button type="submit" variant="accent" size="lg" className="mt-5 w-full" loading={submitting}>
              Confirmar reserva
            </Button>
            <p className="mt-3 text-center text-sm text-white/70">En el próximo paso te mostramos cómo pagar por transferencia.</p>
          </div>
        </form>
      )}
    </div>
  );
}
