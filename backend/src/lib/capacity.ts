import type { Prisma, PrismaClient, TripStatus } from '@prisma/client';
import { prisma } from './prisma.js';
import { isBookable } from '../config/business.js';
import { getIO } from '../realtime/socket.js';

/**
 * Reservas que ocupan lugar: solo las CONFIRMADAS (pago recibido).
 * Las pendientes no ocupan: el lugar es del primero que paga. Por eso, al confirmar
 * un pago se vuelve a revisar que haya lugar (ver bookings-admin → confirm).
 */
export const ACTIVE_STATUSES = ['confirmed'] as const;

type Db = PrismaClient | Prisma.TransactionClient;

/** Lugares ocupados por viaje (suma de pasajeros de reservas confirmadas). */
export async function occupiedByTrip(tripIds: string[], db: Db = prisma) {
  const map = new Map<string, number>();
  if (!tripIds.length) return map;
  const rows = await db.booking.groupBy({
    by: ['tripId'],
    where: { tripId: { in: tripIds }, status: { in: [...ACTIVE_STATUSES] } },
    _sum: { numberOfPassengers: true },
  });
  for (const r of rows) map.set(r.tripId, r._sum.numberOfPassengers ?? 0);
  return map;
}

export async function occupiedFor(tripId: string, db: Db = prisma) {
  return (await occupiedByTrip([tripId], db)).get(tripId) ?? 0;
}

export interface Availability {
  capacity: number;
  occupied: number;
  available: number;
  soldOut: boolean;
  /** El admin confirmó el viaje y cerró las reservas */
  closed: boolean;
  /** Se puede reservar ahora mismo */
  bookable: boolean;
}

export function availability(
  trip: { status: TripStatus; departureTime: Date; bookingClosed: boolean; bus: { capacity: number } },
  occupied: number,
  now = new Date(),
): Availability {
  const capacity = trip.bus.capacity;
  const available = Math.max(0, capacity - occupied);
  return {
    capacity,
    occupied,
    available,
    soldOut: available === 0,
    closed: trip.bookingClosed,
    bookable: isBookable(trip, now) && !trip.bookingClosed && available > 0,
  };
}

/** Avisa en vivo a quienes miran ese viaje cuántos lugares quedan. */
export async function emitPlaces(tripId: string) {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { status: true, departureTime: true, bookingClosed: true, bus: { select: { capacity: true } } },
    });
    if (!trip) return;
    const a = availability(trip, await occupiedFor(tripId));
    getIO().to(`trip:${tripId}`).emit('trip:places', { tripId, available: a.available, closed: a.closed, bookable: a.bookable });
  } catch (e) {
    console.error('No se pudo avisar los lugares en vivo:', e);
  }
}
