'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, CircleCheck, Copy, Landmark, TriangleAlert } from 'lucide-react';
import { WhatsAppIcon } from './whatsapp-icon';
import { api } from '@/lib/api';
import { copyText, saveBooking } from '@/lib/browser';
import { dayLong, gs, hhmm } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { PublicBooking } from '@/lib/types';
import { toast } from '@/store/toast';
import { hoursLeft, useCountdown } from './countdown';
import { BookingBadge, ButtonLink, ErrorBox, Spinner, buttonClass, cn } from './ui';

export function BookingTicket({ code, phone, isNew }: { code: string; phone: string; isNew: boolean }) {
  const { data, error, loading, reload } = useQuery(
    () => api<{ booking: PublicBooking }>(`/api/bookings/${encodeURIComponent(code)}${phone ? `?tel=${encodeURIComponent(phone)}` : ''}`),
    [code, phone],
    { live: true },
  );
  const booking = data?.booking;

  // Cuando confirmás el pago en el admin, esta página se actualiza sola (aviso del servidor)

  useEffect(() => {
    // Solo se guarda en "Reservas hechas desde este celular" si es del dueño (vino con su teléfono)
    if (booking && phone) {
      saveBooking({
        code: booking.code,
        phone,
        label: `${booking.trip.origin} › ${booking.trip.destination}`,
        departureTime: booking.trip.departureTime,
      });
    }
  }, [booking, phone]);

  if (loading) return <Spinner label="Cargando tu reserva…" />;
  if (error || !booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <ErrorBox message={error?.message ?? 'No encontramos la reserva.'} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {isNew && booking.status === 'pending' && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center gap-2 rounded-2xl bg-monte-50 p-4 font-bold text-monte"
        >
          <CircleCheck className="size-6 shrink-0" aria-hidden />
          ¡Listo! Tu reserva quedó anotada. Pagá para asegurar tu lugar.
        </motion.p>
      )}

      <Ticket booking={booking} />

      {booking.status === 'pending' && booking.payment && <PaymentSteps booking={booking} />}

      {booking.status === 'confirmed' && (
        <div className="mt-6 rounded-2xl border-2 border-monte/30 bg-monte-50 p-5">
          <p className="flex items-center gap-2 text-lg font-bold text-monte">
            <CircleCheck className="size-6" aria-hidden /> Pago recibido. ¡Buen viaje!
          </p>
          <p className="mt-2">
            Al subir al bus mostrá el código <strong>{booking.code}</strong> y tu documento. Te recomendamos llegar unos minutos antes de la salida.
          </p>
        </div>
      )}

      {booking.status === 'cancelled' && (
        <div className="mt-6 rounded-2xl border-2 border-tierra/30 bg-tierra-50 p-5">
          <p className="flex items-center gap-2 text-lg font-bold text-tierra">
            <TriangleAlert className="size-6" aria-hidden /> Esta reserva fue cancelada
          </p>
          <p className="mt-2">Los lugares se liberaron. Si ya habías pagado, escribinos por WhatsApp con tu código.</p>
          <ButtonLink href="/#salidas" className="mt-4">
            Hacer una reserva nueva
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

function Ticket({ booking: b }: { booking: PublicBooking }) {
  async function copyCode() {
    if (await copyText(b.code)) toast.success('Código copiado');
  }
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_-16px_rgb(11_36_64/0.35)]" aria-label={`Boleto ${b.code}`}>
      <div className="bg-ruta px-6 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-xl font-bold text-ambar">JC TRANSPORTE</span>
          <BookingBadge status={b.status} />
        </div>
        <p className="mt-5 text-sm text-white/60">Código de reserva</p>
        <div className="flex items-center gap-3">
          <p className="font-display text-5xl font-bold tracking-wide">{b.code}</p>
          <button onClick={copyCode} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Copiar código">
            <Copy className="size-5" />
          </button>
        </div>
      </div>

      <div className="ticket-cut -mt-[10px] bg-white" aria-hidden />

      <div className="px-6 pb-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="font-display text-4xl font-bold">{hhmm(b.trip.departureTime)}</p>
            <p className="font-bold">{b.trip.origin}</p>
          </div>
          <span className="text-2xl text-ambar-dark" aria-hidden>
            ›
          </span>
          <div className="text-right">
            <p className="font-display text-4xl font-bold text-niebla">{hhmm(b.trip.arrivalTime)}</p>
            <p className="font-bold">{b.trip.destination}</p>
          </div>
        </div>
        <p className="mt-2 text-niebla">{dayLong(b.trip.departureTime)}</p>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-dashed border-linea pt-5">
          <div>
            <dt className="text-sm text-niebla">Pasajeros</dt>
            <dd className="font-display text-2xl font-bold">{b.numberOfPassengers}</dd>
          </div>
          <div>
            <dt className="text-sm text-niebla">Total</dt>
            <dd className="font-display text-2xl font-bold text-ruta">{gs(b.totalAmount)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-sm text-niebla">{b.passengers.length === 1 ? 'Pasajero' : 'Pasajeros'}</dt>
            <dd>
              <ul>
                {b.passengers.map((p, i) => (
                  <li key={`${p.fullName}-${i}`}>
                    {p.fullName}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    if (await copyText(value)) {
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-sm text-niebla">{label}</dt>
        <dd className="break-all text-lg font-bold">{value}</dd>
      </div>
      <button
        onClick={copy}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-bold transition-colors',
          done ? 'border-monte bg-monte text-white' : 'border-linea text-ruta hover:border-ruta',
        )}
        aria-label={`Copiar ${label}`}
      >
        {done ? <Check className="size-4" /> : <Copy className="size-4" />}
        {done ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

function PaymentSteps({ booking: b }: { booking: PublicBooking }) {
  const pay = b.payment!;
  const left = useCountdown(b.paymentDeadline);

  return (
    <section className="mt-8" aria-labelledby="pagar">
      <h2 id="pagar" className="font-display text-4xl font-bold text-ruta">
        Cómo pagar
      </h2>
      {left != null && left > 0 && (
        <p className="mt-1 text-niebla">
          Tenés <strong className="text-tinta">{hoursLeft(left)}</strong> para pagar. Después la reserva se cancela sola.
        </p>
      )}

      <ol className="mt-6 space-y-6">
        <li className="grid grid-cols-[2.5rem_1fr] gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-ambar font-display text-xl font-bold text-ruta-dark" aria-hidden>
            1
          </span>
          <div>
            <h3 className="text-lg font-bold">Transferí {gs(b.totalAmount)}</h3>
            <dl className="mt-3 divide-y divide-linea rounded-2xl border border-linea bg-white px-4">
              <div className="flex items-center gap-2 py-3 text-ruta">
                <Landmark className="size-5" aria-hidden />
                <span className="font-bold">{pay.bankName}</span>
              </div>
              <CopyRow label="Número de cuenta" value={pay.bankAccount} />
              {pay.bankAlias && <CopyRow label="Alias" value={pay.bankAlias} />}
              <CopyRow label="Titular" value={pay.bankHolder} />
              {pay.bankRuc && <CopyRow label="RUC / CI" value={pay.bankRuc} />}
              <CopyRow label="Monto exacto" value={String(b.totalAmount)} />
            </dl>
          </div>
        </li>

        <li className="grid grid-cols-[2.5rem_1fr] gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-ambar font-display text-xl font-bold text-ruta-dark" aria-hidden>
            2
          </span>
          <div>
            <h3 className="text-lg font-bold">Mandanos el comprobante</h3>
            <p className="text-niebla">El mensaje ya va escrito con tu código. Solo adjuntá la foto o captura de la transferencia.</p>
            <a href={pay.whatsappUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('whatsapp', 'lg', 'mt-3 w-full')}>
              <WhatsAppIcon className="size-6" aria-hidden />
              Enviar comprobante por WhatsApp
            </a>
          </div>
        </li>

        <li className="grid grid-cols-[2.5rem_1fr] gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-ambar font-display text-xl font-bold text-ruta-dark" aria-hidden>
            3
          </span>
          <div>
            <h3 className="text-lg font-bold">Te confirmamos</h3>
            <p className="text-niebla">
              <strong className="text-tinta">Tu lugar queda asegurado cuando confirmamos tu pago</strong> (los lugares son para los primeros que
              pagan). Te avisamos por WhatsApp al <strong className="text-tinta">{b.contactPhone}</strong> y
              esta página se actualiza sola.
            </p>
          </div>
        </li>
      </ol>

      <p className="mt-8 rounded-2xl bg-ruta-50 p-4 text-ruta">
        Guardá tu código <strong>{b.code}</strong>. Para volver a esta página entrá a{' '}
        <Link href="/mi-reserva" className="font-bold underline">
          Mi reserva
        </Link>
        .
      </p>
    </section>
  );
}
