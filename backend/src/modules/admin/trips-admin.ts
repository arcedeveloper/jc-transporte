import { Router } from 'express';
import { z } from 'zod';
import { addMinutes } from 'date-fns';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { IdParam, dateStr } from '../../lib/validators.js';
import { formatDateTime } from '../../lib/format.js';
import { businessDayRange, businessToday } from '../../config/business.js';
import { trackingEvents } from '../../realtime/socket.js';
import { availability, emitPlaces, occupiedByTrip, occupiedFor } from '../../lib/capacity.js';
import { buildChecklist } from '../../lib/checklist-xlsx.js';
import { cancelBooking } from '../bookings/bookings.service.js';

export const tripsAdminRouter = Router();

const tripListInclude = {
  route: true,
  bus: { select: { id: true, name: true, plate: true, capacity: true } },
  driver: { select: { id: true, fullName: true } },
} as const satisfies Prisma.TripInclude;

/** Un bus no puede estar en dos viajes que se superponen. */
async function assertBusFree(busId: string, dep: Date, arr: Date, excludeTripId?: string) {
  const clash = await prisma.trip.findFirst({
    where: {
      busId,
      status: { not: 'cancelled' },
      departureTime: { lt: arr },
      arrivalTime: { gt: dep },
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
    include: { route: true },
  });
  if (clash) {
    throw conflict(
      `El bus ya tiene un viaje en ese horario: ${clash.route.origin} › ${clash.route.destination}, ${formatDateTime(clash.departureTime)}`,
      'BUS_BUSY',
    );
  }
}

async function assertDriver(driverId: string | null | undefined) {
  if (!driverId) return;
  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver || driver.role !== 'driver' || !driver.isActive) throw badRequest('Chofer inválido');
}

const ListQuery = z.object({
  from: dateStr.optional(), // por defecto: hoy
  to: dateStr.optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
});

/** GET /api/admin/trips?from=&to=&status= */
tripsAdminRouter.get('/', async (req, res) => {
  const q = ListQuery.parse(req.query);
  const where: Prisma.TripWhereInput = {};

  if (q.status === 'in_progress') {
    where.status = 'in_progress'; // los viajes en curso se muestran sin importar la fecha
  } else {
    where.departureTime = {
      gte: businessDayRange(q.from ?? businessToday()).start,
      ...(q.to ? { lt: businessDayRange(q.to).end } : {}),
    };
    if (q.status) where.status = q.status;
  }

  const trips = await prisma.trip.findMany({ where, orderBy: { departureTime: 'asc' }, take: 500, include: tripListInclude });
  const occupied = await occupiedByTrip(trips.map((t) => t.id));
  res.json({ trips: trips.map((t) => ({ ...t, occupied: occupied.get(t.id) ?? 0 })) });
});

/** GET /api/admin/trips/cleanup → cuántos viajes pasados (y sus reservas) se pueden borrar */
tripsAdminRouter.get('/cleanup', async (_req, res) => {
  const where = pastTripWhere();
  const [trips, bookings] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.booking.count({ where: { trip: where } }),
  ]);
  res.json({ trips, bookings });
});

/** POST /api/admin/trips/cleanup → borra todos los viajes pasados con sus reservas */
tripsAdminRouter.post('/cleanup', async (_req, res) => {
  const where = pastTripWhere();
  const ids = (await prisma.trip.findMany({ where, select: { id: true } })).map((t) => t.id);
  const [b, t] = await prisma.$transaction([
    prisma.booking.deleteMany({ where: { tripId: { in: ids } } }),
    prisma.trip.deleteMany({ where: { id: { in: ids } } }),
  ]);
  res.json({ deletedTrips: t.count, deletedBookings: b.count });
});

/** GET /api/admin/trips/:id → detalle + lugares + reservas */
tripsAdminRouter.get('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      ...tripListInclude,
      bookings: {
        orderBy: { createdAt: 'desc' },
        include: { passengers: { orderBy: { fullName: 'asc' } } },
      },
    },
  });
  if (!trip) throw notFound('Viaje no encontrado');
  const occupied = await occupiedFor(id);
  res.json({ trip: { ...trip, occupied }, availability: availability(trip, occupied) });
});

const TripCreate = z.object({
  busId: z.uuid(),
  routeId: z.uuid(),
  driverId: z.uuid().nullable().optional(),
  departureTime: z.coerce.date(),
  arrivalTime: z.coerce.date().optional(), // si no viene: salida + duración de la ruta
  price: z.number().int().positive().optional(), // si no viene: precio base de la ruta
  /** false = viaje privado (ej. grupal a medida): no sale en la portada */
  showOnHome: z.boolean().optional(),
});

/** POST /api/admin/trips */
tripsAdminRouter.post('/', async (req, res) => {
  const data = TripCreate.parse(req.body);
  const [bus, route] = await Promise.all([
    prisma.bus.findUnique({ where: { id: data.busId } }),
    prisma.route.findUnique({ where: { id: data.routeId } }),
  ]);
  if (!bus || !bus.isActive) throw badRequest('Bus inválido o desactivado');
  if (!route || !route.isActive) throw badRequest('Ruta inválida o desactivada');
  await assertDriver(data.driverId);

  const arrivalTime = data.arrivalTime ?? addMinutes(data.departureTime, route.durationMinutes);
  if (arrivalTime <= data.departureTime) throw badRequest('La llegada debe ser después de la salida');
  if (data.departureTime <= new Date()) throw badRequest('La salida debe ser en el futuro');
  await assertBusFree(bus.id, data.departureTime, arrivalTime);

  // La publicidad (imagen, formato y textos) se copia del último viaje de la misma ruta,
  // así no hay que subir la imagen cada vez.
  const last = await prisma.trip.findFirst({
    where: { routeId: route.id, OR: [{ promoImageId: { not: null } }, { promoTitle: { not: null } }] },
    orderBy: { createdAt: 'desc' },
    select: { promoImageId: true, promoLayout: true, promoTitle: true, promoText: true },
  });

  const trip = await prisma.trip.create({
    data: {
      busId: bus.id,
      routeId: route.id,
      driverId: data.driverId ?? null,
      departureTime: data.departureTime,
      arrivalTime,
      price: data.price ?? route.basePrice,
      showOnHome: data.showOnHome ?? true,
      ...(last ?? {}),
    },
    include: tripListInclude,
  });
  res.status(201).json({ trip });
});

/** PATCH /api/admin/trips/:id (el precio nuevo aplica solo a reservas nuevas) */
tripsAdminRouter.patch('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const data = TripCreate.omit({ routeId: true }).partial().parse(req.body);

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) throw notFound('Viaje no encontrado');
  if (trip.status === 'cancelled' || trip.status === 'completed') throw badRequest('Este viaje ya terminó o fue cancelado');
  if (data.busId && data.busId !== trip.busId) {
    const [newBus, occupied] = await Promise.all([prisma.bus.findUnique({ where: { id: data.busId } }), occupiedFor(id)]);
    if (!newBus || !newBus.isActive) throw badRequest('Bus inválido o desactivado');
    if (newBus.capacity < occupied) {
      throw conflict(`El bus nuevo tiene ${newBus.capacity} lugares y el viaje ya tiene ${occupied} pasajeros`, 'CAPACITY_TOO_LOW');
    }
  }
  await assertDriver(data.driverId);

  const dep = data.departureTime ?? trip.departureTime;
  const arr = data.arrivalTime ?? trip.arrivalTime;
  if (arr <= dep) throw badRequest('La llegada debe ser después de la salida');
  await assertBusFree(data.busId ?? trip.busId, dep, arr, id);

  const updated = await prisma.trip.update({ where: { id }, data, include: tripListInclude });
  void emitPlaces(id);
  res.json({ trip: updated });
});

/**
 * POST /api/admin/trips/:id/close → "Confirmar viaje": se cierran las reservas.
 * Nadie más puede reservar, esté lleno o no. Las reservas pendientes se pueden seguir confirmando.
 */
tripsAdminRouter.post('/:id/close', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  // Al confirmar el viaje se puede elegir (o cambiar) el chofer responsable
  const { driverId } = z.object({ driverId: z.uuid().nullable().optional() }).parse(req.body ?? {});
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) throw notFound('Viaje no encontrado');
  if (trip.status === 'cancelled') throw conflict('El viaje está cancelado');
  await assertDriver(driverId);

  await prisma.trip.update({
    where: { id },
    data: { bookingClosed: true, closedAt: new Date(), ...(driverId !== undefined ? { driverId } : {}) },
  });
  void emitPlaces(id);
  res.json({ ok: true });
});

/** POST /api/admin/trips/:id/reopen → vuelve a abrir las reservas */
tripsAdminRouter.post('/:id/reopen', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) throw notFound('Viaje no encontrado');
  if (trip.status !== 'scheduled') throw conflict('Solo se pueden reabrir viajes que todavía no salieron');

  await prisma.trip.update({ where: { id }, data: { bookingClosed: false, closedAt: null } });
  void emitPlaces(id);
  res.json({ ok: true });
});

/** GET /api/admin/trips/:id/checklist.xlsx → planilla para imprimir con los pasajeros que pagaron */
tripsAdminRouter.get('/:id/checklist.xlsx', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      route: true,
      bus: { select: { name: true, plate: true } },
      driver: { select: { fullName: true } },
      bookings: {
        where: { status: 'confirmed' },
        include: { passengers: true },
      },
    },
  });
  if (!trip) throw notFound('Viaje no encontrado');

  const { buffer, filename } = await buildChecklist(trip);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

/**
 * POST /api/admin/trips/:id/cancel { reason } → cancela el viaje y todas sus reservas.
 * Devuelve los contactos para avisarles por WhatsApp desde el panel.
 */
tripsAdminRouter.post('/:id/cancel', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { reason } = z
    .object({ reason: z.string().trim().min(3).max(200).default('Viaje cancelado por la empresa') })
    .parse(req.body ?? {});

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) throw notFound('Viaje no encontrado');
  if (trip.status === 'cancelled') throw conflict('El viaje ya estaba cancelado');

  await prisma.trip.update({ where: { id }, data: { status: 'cancelled', bookingClosed: true, closedAt: new Date() } });
  trackingEvents.status(id, 'cancelled');

  const active = await prisma.booking.findMany({
    where: { tripId: id, status: { in: ['pending', 'confirmed'] } },
    select: {
      id: true,
      bookingCode: true,
      status: true,
      contactPhone: true,
      numberOfPassengers: true,
      passengers: { select: { fullName: true }, orderBy: { fullName: 'asc' }, take: 1 },
    },
  });
  for (const b of active) await cancelBooking(b.id, reason);

  res.json({
    ok: true,
    reason,
    cancelledBookings: active.length,
    contacts: active.map((b) => ({
      code: b.bookingCode,
      wasPaid: b.status === 'confirmed',
      phone: b.contactPhone,
      name: b.passengers[0]?.fullName ?? '',
      passengers: b.numberOfPassengers,
    })),
  });
});

/** POST /api/admin/trips/:id/complete → marcar como finalizado */
tripsAdminRouter.post('/:id/complete', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) throw notFound('Viaje no encontrado');
  if (trip.status === 'cancelled') throw conflict('El viaje está cancelado');

  const updated = await prisma.trip.update({
    where: { id },
    data: { status: 'completed', completedAt: new Date() },
  });
  trackingEvents.status(id, 'completed');
  res.json({ trip: updated });
});

/**
 * Un viaje "pasado" ya terminó: completado, cancelado, o con la hora de llegada vencida.
 * Nunca se toca un viaje que está en curso.
 */
function pastTripWhere(now = new Date()): Prisma.TripWhereInput {
  return {
    status: { not: 'in_progress' },
    OR: [{ status: { in: ['completed', 'cancelled'] } }, { arrivalTime: { lt: now } }],
  };
}

/**
 * DELETE /api/admin/trips/:id
 *  - viaje pasado (terminado o cancelado) → se borra con todas sus reservas
 *  - viaje futuro → solo si no tiene reservas activas (las canceladas se borran con él)
 */
tripsAdminRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await prisma.trip.findUnique({ where: { id }, select: { status: true, arrivalTime: true } });
  if (!trip) throw notFound('Viaje no encontrado');
  if (trip.status === 'in_progress') throw conflict('El viaje está en curso. Esperá a que termine para borrarlo.', 'IN_PROGRESS');
  const isPast = trip.status !== 'scheduled' || trip.arrivalTime < new Date();
  if (!isPast) {
    const active = await prisma.booking.count({ where: { tripId: id, status: { in: ['pending', 'confirmed'] } } });
    if (active > 0) {
      throw conflict(
        `Este viaje todavía no salió y tiene ${active} reserva(s) activa(s). Cancelá el viaje primero (así avisás a los pasajeros) y después borralo.`,
        'ACTIVE_BOOKINGS',
      );
    }
  }
  const [deletedBookings] = await prisma.$transaction([
    prisma.booking.deleteMany({ where: { tripId: id } }),
    prisma.trip.delete({ where: { id } }),
  ]);
  res.json({ ok: true, deletedBookings: deletedBookings.count });
});

/* ------------------------------------------------------------------ */
/*  Publicidad en la portada                                           */
/* ------------------------------------------------------------------ */

const PromoSchema = z.object({
  showOnHome: z.boolean(),
  promoLayout: z.enum(['square', 'wide']),
  promoTitle: z.string().trim().max(60, 'Título de hasta 60 letras').nullable().transform((v) => v || null),
  promoText: z.string().trim().max(300, 'Texto de hasta 300 letras').nullable().transform((v) => v || null),
  /** Para usar una imagen ya subida (ej. al crear varios días seguidos) */
  promoImageId: z.uuid().nullable().optional(),
});

/** PUT /api/admin/trips/:id/promo → mostrar en la portada, formato y textos */
tripsAdminRouter.put('/:id/promo', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const data = PromoSchema.parse(req.body);
  if (data.promoImageId && !(await prisma.promoImage.count({ where: { id: data.promoImageId } }))) {
    throw badRequest('Imagen no encontrada');
  }
  const r = await prisma.trip.updateMany({ where: { id }, data });
  if (!r.count) throw notFound('Viaje no encontrado');
  res.json({ ok: true });
});

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ImageSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'La imagen tiene que ser JPG, PNG o WEBP'),
});

/** POST /api/admin/trips/:id/promo-image { dataUrl } → sube o reemplaza la imagen */
tripsAdminRouter.post('/:id/promo-image', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { dataUrl } = ImageSchema.parse(req.body);
  const [, mime, b64] = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl)!;
  const data = Buffer.from(b64!, 'base64');
  if (data.length > MAX_IMAGE_BYTES) throw badRequest('La imagen es muy pesada (máximo 2 MB)');
  const trip = await prisma.trip.findUnique({ where: { id }, select: { id: true } });
  if (!trip) throw notFound('Viaje no encontrado');
  const image = await prisma.promoImage.create({ data: { mimeType: mime!, data }, select: { id: true } });
  await prisma.trip.update({ where: { id }, data: { promoImageId: image.id } });
  res.status(201).json({ imageId: image.id });
});

/** DELETE /api/admin/trips/:id/promo-image → saca la imagen (queda la tarjeta con el nombre del destino) */
tripsAdminRouter.delete('/:id/promo-image', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const r = await prisma.trip.updateMany({ where: { id }, data: { promoImageId: null } });
  if (!r.count) throw notFound('Viaje no encontrado');
  res.json({ ok: true });
});

/** POST /api/admin/trips/:id/promo/apply-route → copia esta publicidad a los próximos viajes de la misma ruta */
tripsAdminRouter.post('/:id/promo/apply-route', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const t = await prisma.trip.findUnique({
    where: { id },
    select: { routeId: true, promoImageId: true, promoLayout: true, promoTitle: true, promoText: true },
  });
  if (!t) throw notFound('Viaje no encontrado');
  const { routeId, ...promo } = t;
  const r = await prisma.trip.updateMany({
    where: { routeId, id: { not: id }, status: 'scheduled', departureTime: { gt: new Date() } },
    data: promo,
  });
  res.json({ updated: r.count });
});

/** GET /api/admin/trips/:id/location → última posición conocida del bus */
tripsAdminRouter.get('/:id/location', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { route: true, bus: { select: { name: true, plate: true } }, driver: { select: { fullName: true } } },
  });
  if (!trip) throw notFound('Viaje no encontrado');

  res.json({
    tripId: trip.id,
    status: trip.status,
    label: `${trip.route.origin} › ${trip.route.destination}`,
    departureTime: trip.departureTime,
    busName: trip.bus.name,
    busPlate: trip.bus.plate,
    driverName: trip.driver?.fullName ?? null,
    location:
      trip.currentLat != null && trip.currentLng != null && trip.lastLocationAt
        ? { lat: trip.currentLat, lng: trip.currentLng, speed: trip.currentSpeed, at: trip.lastLocationAt }
        : null,
  });
});
