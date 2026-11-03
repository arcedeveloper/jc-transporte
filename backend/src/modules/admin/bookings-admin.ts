import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';
import { bookingInclude, cancelBooking } from '../bookings/bookings.service.js';
import { emitPlaces, occupiedFor } from '../../lib/capacity.js';

export const bookingsAdminRouter = Router();

const PAGE_SIZE = 30;

const ListQuery = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  q: z.string().trim().max(100).optional(), // código, teléfono, nombre o documento
  tripId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** GET /api/admin/bookings?status=&q=&tripId=&page= */
bookingsAdminRouter.get('/', async (req, res) => {
  const { status, tripId, page, q: rawQ } = ListQuery.parse(req.query);
  // "6.018.795" o "120.000": se busca sin puntos
  const q = rawQ && /^[\d.\s]+$/.test(rawQ) ? rawQ.replace(/\D/g, '') : rawQ;

  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : {}),
    ...(tripId ? { tripId } : {}),
    ...(q
      ? {
          OR: [
            { bookingCode: { contains: q, mode: 'insensitive' as const } },
            { contactEmail: { contains: q, mode: 'insensitive' as const } },
            { contactPhone: { contains: q } },
            {
              passengers: {
                some: { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { document: { contains: q } }] },
              },
            },
          ],
        }
      : {}),
  };

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: bookingInclude,
    }),
  ]);

  res.json({ bookings, total, page, pageSize: PAGE_SIZE, pages: Math.ceil(total / PAGE_SIZE) });
});

/* ------------------------------------------------------------------ */
/*  Borrar reservas (limpieza de la base)                              */
/* ------------------------------------------------------------------ */

/** Una reserva se puede borrar si está cancelada o si su viaje ya salió. */
function deletableWhere(now = new Date()): Prisma.BookingWhereInput {
  return { OR: [{ status: 'cancelled' }, { trip: { departureTime: { lt: now } } }] };
}

/** GET /api/admin/bookings/cleanup → cuántas se pueden borrar de cada tipo */
bookingsAdminRouter.get('/cleanup', async (_req, res) => {
  const now = new Date();
  const [cancelled, past] = await Promise.all([
    prisma.booking.count({ where: { status: 'cancelled' } }),
    prisma.booking.count({ where: { trip: { departureTime: { lt: now } } } }),
  ]);
  res.json({ cancelled, past });
});

/**
 * POST /api/admin/bookings/cleanup { scope }
 *   scope = 'cancelled' → borra todas las canceladas
 *   scope = 'past'      → borra todas las de viajes que ya salieron (también las pagadas)
 */
bookingsAdminRouter.post('/cleanup', async (req, res) => {
  const { scope } = z.object({ scope: z.enum(['cancelled', 'past']) }).parse(req.body ?? {});
  const where: Prisma.BookingWhereInput =
    scope === 'cancelled' ? { status: 'cancelled' } : { trip: { departureTime: { lt: new Date() } } };
  const { count } = await prisma.booking.deleteMany({ where });
  res.json({ deleted: count });
});

/** DELETE /api/admin/bookings/:id → solo canceladas o de viajes que ya salieron */
bookingsAdminRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { count } = await prisma.booking.deleteMany({ where: { id, ...deletableWhere() } });
  if (count === 0) {
    const exists = await prisma.booking.count({ where: { id } });
    if (!exists) throw notFound('Reserva no encontrada');
    throw conflict('Esta reserva está activa en un viaje que todavía no salió. Primero cancelala.', 'BOOKING_ACTIVE');
  }
  res.json({ ok: true });
});

/** GET /api/admin/bookings/:id */
bookingsAdminRouter.get('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) throw notFound('Reserva no encontrada');
  res.json({ booking });
});

/** POST /api/admin/bookings/:id/confirm → el pago llegó */
bookingsAdminRouter.post('/:id/confirm', async (req, res) => {
  const { id } = IdParam.parse(req.params);

  // El lugar es del primero que paga: se bloquea el viaje y se revisa que todavía haya lugar.
  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id }, select: { tripId: true, status: true, numberOfPassengers: true } });
    if (!b || b.status !== 'pending') return { count: 0 };
    await tx.$queryRaw`SELECT id FROM "Trip" WHERE id = ${b.tripId} FOR UPDATE`;
    const trip = await tx.trip.findUniqueOrThrow({ where: { id: b.tripId }, select: { bus: { select: { capacity: true } } } });
    const left = trip.bus.capacity - (await occupiedFor(b.tripId, tx));
    if (b.numberOfPassengers > left) {
      throw conflict(
        left <= 0
          ? `El viaje ya está completo (${trip.bus.capacity} de ${trip.bus.capacity} confirmados). No se puede confirmar esta reserva: avisale al pasajero y cancelala.`
          : `Quedan ${left} lugar(es) y esta reserva es de ${b.numberOfPassengers}. No entra completa: hablá con el pasajero.`,
        'NO_ROOM',
      );
    }
    return tx.booking.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
  });

  if (updated.count === 0) {
    const b = await prisma.booking.findUnique({ where: { id }, select: { status: true } });
    if (!b) throw notFound('Reserva no encontrada');
    if (b.status === 'confirmed') throw conflict('Esta reserva ya estaba confirmada', 'ALREADY_CONFIRMED');
    throw conflict(
      'Esta reserva está cancelada y sus lugares pudieron venderse. Creá una reserva nueva.',
      'BOOKING_CANCELLED',
    );
  }

  const booking = await prisma.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });
  void emitPlaces(booking.tripId);
  res.json({ booking });
});

/** POST /api/admin/bookings/:id/cancel { reason } → libera los asientos */
bookingsAdminRouter.post('/:id/cancel', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { reason } = z
    .object({ reason: z.string().trim().min(3).max(200).default('Cancelada por la empresa') })
    .parse(req.body ?? {});

  const ok = await cancelBooking(id, reason);
  if (!ok) {
    const exists = await prisma.booking.count({ where: { id } });
    if (!exists) throw notFound('Reserva no encontrada');
    throw conflict('Esta reserva ya estaba cancelada');
  }
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });
  res.json({ booking });
});
