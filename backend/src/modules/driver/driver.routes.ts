import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';
import { businessDayRange, businessToday } from '../../config/business.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { trackingEvents } from '../../realtime/socket.js';
import { occupiedByTrip } from '../../lib/capacity.js';

/** Vista del chofer. Un admin también puede usarla (para probar o reemplazar). */
export const driverRouter = Router();
driverRouter.use(requireAuth, requireRole('driver', 'admin'));

/** El chofer solo puede tocar los viajes que tiene asignados. */
async function getOwnTrip(req: Request, tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { route: true, bus: { select: { name: true, plate: true } } },
  });
  if (!trip) throw notFound('Viaje no encontrado');
  if (req.user!.role !== 'admin' && trip.driverId !== req.user!.id) throw forbidden('Este viaje no está asignado a vos');
  return trip;
}

/** Sueldo cargado por la oficina para el chofer en cada viaje (suma de gastos "Sueldo del chofer") */
async function driverPays(tripIds: string[], driverId?: string) {
  const map = new Map<string, number>();
  if (!tripIds.length) return map;
  const rows = await prisma.expense.groupBy({
    by: ['tripId'],
    where: { tripId: { in: tripIds }, category: 'driver', ...(driverId ? { driverId } : {}) },
    _sum: { amount: true },
  });
  for (const r of rows) if (r.tripId) map.set(r.tripId, r._sum.amount ?? 0);
  return map;
}

/** GET /api/driver/trips → viajes del chofer: los de hoy, los en curso y los próximos (60 días) */
driverRouter.get('/trips', async (req, res) => {
  const { start } = businessDayRange(businessToday());
  const until = new Date(start.getTime() + 61 * 24 * 3600_000);
  const mine = req.user!.role === 'admin' ? {} : { driverId: req.user!.id };

  const trips = await prisma.trip.findMany({
    where: {
      ...mine,
      status: { not: 'cancelled' },
      OR: [{ departureTime: { gte: start, lt: until }, status: { in: ['scheduled', 'in_progress'] } }, { status: 'in_progress' }],
    },
    orderBy: { departureTime: 'asc' },
    include: {
      route: true,
      bus: { select: { name: true, plate: true } },
    },
  });
  const occupied = await occupiedByTrip(trips.map((t) => t.id));
  const pays = await driverPays(trips.map((t) => t.id), req.user!.role === 'admin' ? undefined : req.user!.id);

  res.json({
    trips: trips.map((t) => ({
      id: t.id,
      origin: t.route.origin,
      destination: t.route.destination,
      departureTime: t.departureTime,
      arrivalTime: t.arrivalTime,
      status: t.status,
      busName: t.bus.name,
      busPlate: t.bus.plate,
      occupiedSeats: occupied.get(t.id) ?? 0,
      lastLocationAt: t.lastLocationAt,
      /** Lo que la oficina cargó como su sueldo en este viaje (null = todavía a confirmar) */
      pay: pays.get(t.id) ?? null,
    })),
  });
});

/** GET /api/driver/trips/:id → viaje + lista de pasajeros */
driverRouter.get('/trips/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await getOwnTrip(req, id);

  const bookings = await prisma.booking.findMany({
    where: { tripId: id, status: { in: ['pending', 'confirmed'] } },
    include: { passengers: true },
  });

  const passengers = bookings
    .flatMap((b) =>
      b.passengers.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        document: p.document,
        phone: p.phone,
        boarded: p.boarded,
        bookingCode: b.bookingCode,
        bookingStatus: b.status, // "pending" = todavía no pagó
      })),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

  res.json({
    trip: {
      id: trip.id,
      origin: trip.route.origin,
      destination: trip.route.destination,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      status: trip.status,
      busName: trip.bus.name,
      busPlate: trip.bus.plate,
      lastLocationAt: trip.lastLocationAt,
      pay: (await driverPays([trip.id], req.user!.role === 'admin' ? undefined : req.user!.id)).get(trip.id) ?? null,
    },
    passengers,
    summary: {
      total: passengers.length,
      boarded: passengers.filter((p) => p.boarded).length,
      unpaid: passengers.filter((p) => p.bookingStatus === 'pending').length,
    },
  });
});

const locationLimiter = rateLimit({ max: 40, windowMs: 60 * 1000 });

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Velocidad tal cual la da el navegador (metros por segundo). Puede venir null. */
  speedMps: z.number().min(0).max(100).nullable().optional(),
});

/**
 * POST /api/driver/trips/:id/location { lat, lng, speedMps }
 * El celular del chofer lo manda cada ~5 segundos.
 * El primer envío pasa el viaje a "en curso" automáticamente.
 */
driverRouter.post('/trips/:id/location', locationLimiter, async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { lat, lng, speedMps } = LocationSchema.parse(req.body);
  const trip = await getOwnTrip(req, id);

  if (trip.status === 'cancelled' || trip.status === 'completed') {
    throw badRequest('Este viaje ya terminó o fue cancelado', 'TRIP_CLOSED');
  }

  const now = new Date();
  const speed = speedMps != null ? Math.round(speedMps * 3.6) : null; // km/h
  const starting = trip.status === 'scheduled';

  await prisma.trip.update({
    where: { id },
    data: {
      currentLat: lat,
      currentLng: lng,
      currentSpeed: speed,
      lastLocationAt: now,
      ...(starting ? { status: 'in_progress' as const, startedAt: trip.startedAt ?? now } : {}),
    },
  });

  trackingEvents.location(id, { lat, lng, speed, at: now });
  if (starting) trackingEvents.status(id, 'in_progress');

  res.json({ ok: true, status: 'in_progress' });
});

/** POST /api/driver/trips/:id/stop → el chofer dejó de compartir */
driverRouter.post('/trips/:id/stop', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await getOwnTrip(req, id);

  if (trip.status === 'in_progress') {
    await prisma.trip.update({ where: { id }, data: { status: 'scheduled' } });
    trackingEvents.status(id, 'scheduled');
  }
  res.json({ ok: true });
});

/** POST /api/driver/trips/:id/verify { code } → ¿este código es válido para este viaje? */
driverRouter.post('/trips/:id/verify', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { code } = z.object({ code: z.string().trim().toUpperCase().min(3).max(20) }).parse(req.body);
  await getOwnTrip(req, id);

  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    include: { passengers: { orderBy: { fullName: 'asc' } } },
  });

  const base = { code };
  if (!booking) return void res.json({ ...base, valid: false, reason: 'El código no existe' });
  if (booking.tripId !== id) return void res.json({ ...base, valid: false, reason: 'Este código es de otro viaje' });
  if (booking.status === 'cancelled') return void res.json({ ...base, valid: false, reason: 'La reserva está cancelada' });

  const passengers = booking.passengers.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    document: p.document,
    boarded: p.boarded,
  }));
  if (booking.status === 'pending') {
    return void res.json({ ...base, valid: false, reason: 'El pago todavía no fue confirmado', passengers });
  }
  res.json({ ...base, valid: true, passengers });
});

/** POST /api/driver/passengers/:id/board { boarded } → marcar que subió (o deshacer) */
driverRouter.post('/passengers/:id/board', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { boarded } = z.object({ boarded: z.boolean().default(true) }).parse(req.body ?? {});

  const passenger = await prisma.passenger.findUnique({
    where: { id },
    include: { booking: { select: { status: true, tripId: true } } },
  });
  if (!passenger) throw notFound('Pasajero no encontrado');
  await getOwnTrip(req, passenger.booking.tripId);
  if (boarded && passenger.booking.status !== 'confirmed') {
    throw conflict('La reserva no está confirmada: el pago todavía no se recibió', 'NOT_CONFIRMED');
  }

  const updated = await prisma.passenger.update({
    where: { id },
    data: { boarded, boardedAt: boarded ? new Date() : null },
  });
  res.json({ passenger: { id: updated.id, boarded: updated.boarded, boardedAt: updated.boardedAt } });
});
