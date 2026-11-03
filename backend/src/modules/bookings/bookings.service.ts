import type { Prisma, Settings } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { whatsappLink } from '../../lib/format.js';
import { emitPlaces } from '../../lib/capacity.js';

export const bookingInclude = {
  trip: { include: { route: true } },
  passengers: { orderBy: { fullName: 'asc' } },
} as const satisfies Prisma.BookingInclude;

export type BookingFull = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/** Genera JC-2026-001, JC-2026-002… El contador sube de forma atómica en Postgres. */
export async function nextBookingCode(tx: Prisma.TransactionClient, year: number) {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "BookingCounter" ("year", "lastValue") VALUES (${year}::int, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastValue" = "BookingCounter"."lastValue" + 1
    RETURNING "lastValue"`;
  const n = rows[0]?.lastValue;
  if (!n) throw new Error('No se pudo generar el código de reserva');
  return `JC-${year}-${String(n).padStart(3, '0')}`;
}

const receiptMessage = (code: string) => `Hola, adjunto comprobante de mi reserva ${code}`;

export function paymentInfo(code: string, settings: Settings | null) {
  if (!settings) return null;
  return {
    bankName: settings.bankName,
    bankAccount: settings.bankAccount,
    bankHolder: settings.bankHolder,
    bankRuc: settings.bankRuc,
    bankAlias: settings.bankAlias,
    whatsappUrl: whatsappLink(settings.adminWhatsapp, receiptMessage(code)),
  };
}

/** Lo que ve el pasajero (sin datos internos). */
/** "0983775018" → "0983 *** 018" */
const maskPhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  return d.length < 7 ? '***' : `${d.slice(0, 4)} *** ${d.slice(-3)}`;
};
/** "Matías Rodas Benítez" → "Matías R." */
const shortName = (n: string) => {
  const [first = '', second] = n.trim().split(/\s+/);
  return second ? `${first} ${second[0]}.` : first;
};

/**
 * Lo que ve el pasajero. Con `masked` (se buscó solo con el código) se ocultan
 * el teléfono y los apellidos, porque los códigos son correlativos y fáciles de adivinar.
 */
export function toPublicBooking(b: BookingFull, settings: Settings | null, masked = false) {
  return {
    code: b.bookingCode,
    status: b.status,
    contactPhone: masked ? maskPhone(b.contactPhone) : b.contactPhone,
    numberOfPassengers: b.numberOfPassengers,
    totalAmount: b.totalAmount,
    paymentDeadline: b.paymentDeadline,
    createdAt: b.createdAt,
    confirmedAt: b.confirmedAt,
    cancelledAt: b.cancelledAt,
    trip: {
      id: b.trip.id,
      origin: b.trip.route.origin,
      destination: b.trip.route.destination,
      departureTime: b.trip.departureTime,
      arrivalTime: b.trip.arrivalTime,
    },
    passengers: b.passengers.map((p) => ({ fullName: masked ? shortName(p.fullName) : p.fullName })),
    payment: b.status === 'pending' ? paymentInfo(b.bookingCode, settings) : null,
  };
}

/**
 * Cancela una reserva: sus lugares vuelven a quedar libres.
 * onlyIfPending=true se usa en el job automático: si el admin justo la confirmó, no la toca.
 * Devuelve false si no se canceló.
 */
export async function cancelBooking(bookingId: string, reason: string, opts: { onlyIfPending?: boolean } = {}) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { tripId: true } });
  if (!booking) return false;

  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: opts.onlyIfPending ? 'pending' : { in: ['pending', 'confirmed'] },
    },
    data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
  });
  if (updated.count === 0) return false;

  void emitPlaces(booking.tripId);
  return true;
}
