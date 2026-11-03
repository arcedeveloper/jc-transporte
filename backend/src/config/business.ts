import { addDays } from 'date-fns';
import type { TripStatus } from '@prisma/client';

/** Paraguay usa UTC−3 todo el año. El servidor (Render) corre en UTC. */
export const BUSINESS_TZ = 'America/Asuncion';
export const BUSINESS_UTC_OFFSET = '-03:00';

export const MAX_PASSENGERS_PER_BOOKING = 10;

/** "2026-10-25" → desde las 00:00 hasta las 24:00 de ese día en Paraguay. */
export function businessDayRange(date: string) {
  const start = new Date(`${date}T00:00:00${BUSINESS_UTC_OFFSET}`);
  return { start, end: addDays(start, 1) };
}

export function businessYear(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en', { timeZone: BUSINESS_TZ, year: 'numeric' }).format(now));
}

/** Se puede reservar si el viaje está programado y todavía no salió. */
export function isBookable(trip: { status: TripStatus; departureTime: Date }, now = new Date()) {
  return trip.status === 'scheduled' && trip.departureTime > now;
}

/** Fecha de hoy en Paraguay, formato AAAA-MM-DD */
export function businessToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(now);
}
