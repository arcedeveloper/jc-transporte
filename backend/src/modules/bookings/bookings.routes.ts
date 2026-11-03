import { Router } from 'express';
import { z } from 'zod';
import { addHours, min } from 'date-fns';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { MAX_PASSENGERS_PER_BOOKING, businessYear, isBookable } from '../../config/business.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { availability, emitPlaces, occupiedFor } from '../../lib/capacity.js';
import { docClean, phoneKey } from '../../lib/format.js';
import { bookingInclude, nextBookingCode, toPublicBooking } from './bookings.service.js';

export const bookingsRouter = Router();

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{6,20}$/, 'Teléfono inválido');

const CreateBookingSchema = z.object({
  tripId: z.uuid(),
  contactPhone: phone,
  notes: z.string().trim().max(500).optional(),
  passengers: z
    .array(
      z.object({
        fullName: z.string().trim().min(3, 'Nombre muy corto').max(100),
        document: z.string().trim().min(3, 'Escribí la cédula').max(20).transform(docClean),
        phone,
      }),
    )
    .min(1, 'Agregá al menos un pasajero')
    .max(MAX_PASSENGERS_PER_BOOKING, `Hasta ${MAX_PASSENGERS_PER_BOOKING} pasajeros por reserva`),
});

const createLimiter = rateLimit({ max: 10, windowMs: 10 * 60 * 1000 });

/**
 * POST /api/bookings
 * Crea una reserva pendiente de pago. Los lugares quedan ocupados hasta que
 * se confirme el pago o venza el plazo.
 */
bookingsRouter.post('/', createLimiter, async (req, res) => {
  const input = CreateBookingSchema.parse(req.body);
  const { tripId } = input;
  const count = input.passengers.length;
  const now = new Date();

  const booking = await prisma.$transaction(async (tx) => {
    // Bloquea el viaje: si dos personas reservan al mismo tiempo, la segunda espera
    // a que termine la primera y ve los lugares ya descontados. Nunca se pasa del cupo.
    await tx.$queryRaw`SELECT id FROM "Trip" WHERE id = ${tripId} FOR UPDATE`;

    const trip = await tx.trip.findUnique({ where: { id: tripId }, include: { bus: { select: { capacity: true } } } });
    if (!trip) throw notFound('Viaje no encontrado');
    if (!isBookable(trip, now)) throw badRequest('Este viaje ya no acepta reservas', 'TRIP_CLOSED');
    if (trip.bookingClosed) throw badRequest('Las reservas de este viaje ya están cerradas', 'TRIP_CLOSED');

    const a = availability(trip, await occupiedFor(tripId, tx), now);
    if (a.available === 0) throw conflict('Este viaje ya está lleno', 'SOLD_OUT');
    if (count > a.available) {
      throw conflict(
        a.available === 1 ? 'Queda solo 1 lugar en este viaje' : `Quedan solo ${a.available} lugares en este viaje`,
        'NOT_ENOUGH_PLACES',
      );
    }

    const code = await nextBookingCode(tx, businessYear(now));
    return tx.booking.create({
      data: {
        tripId,
        bookingCode: code,
        contactPhone: input.contactPhone,
        notes: input.notes,
        numberOfPassengers: count,
        totalAmount: trip.price * count,
        paymentDeadline: min([addHours(now, env.PENDING_BOOKING_HOURS), trip.departureTime]),
        passengers: {
          create: input.passengers.map((p) => ({ fullName: p.fullName, document: p.document, phone: p.phone })),
        },
      },
      include: bookingInclude,
    });
  });

  void emitPlaces(tripId);
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  res.status(201).json({ booking: toPublicBooking(booking, settings) });
});

const lookupLimiter = rateLimit({ max: 30, windowMs: 10 * 60 * 1000 });
const LookupParams = z.object({ code: z.string().trim().toUpperCase().regex(/^JC-\d{4}-\d{3,}$/, 'Código inválido') });
const LookupQuery = z.object({ tel: z.string().trim().optional() });

/**
 * GET /api/bookings/JC-2026-001[?tel=0981123456]
 * Se busca solo con el código. Si además viene el teléfono correcto (por ejemplo desde
 * el celular donde se reservó) se muestra todo; si no, el teléfono y los apellidos van ocultos.
 */
bookingsRouter.get('/:code', lookupLimiter, async (req, res) => {
  const { code } = LookupParams.parse(req.params);
  const { tel } = LookupQuery.parse(req.query);

  const booking = await prisma.booking.findUnique({ where: { bookingCode: code }, include: bookingInclude });
  if (!booking) throw notFound('No encontramos una reserva con ese código');
  const owner = !!tel && phoneKey(booking.contactPhone) === phoneKey(tel);

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  res.json({ booking: toPublicBooking(booking, settings, !owner) });
});
