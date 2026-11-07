import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';
import { businessDayRange } from '../../config/business.js';
import { availability, occupiedByTrip, occupiedFor } from '../../lib/capacity.js';

export const tripsRouter = Router();

/** GET /api/trips/locations → orígenes y destinos para el buscador */
tripsRouter.get('/locations', async (_req, res) => {
  const routes = await prisma.route.findMany({
    where: { isActive: true },
    select: { origin: true, destination: true, durationMinutes: true, basePrice: true, imageUrl: true },
    orderBy: [{ origin: 'asc' }, { destination: 'asc' }],
  });
  const sort = (a: string[]) => [...new Set(a)].sort((x, y) => x.localeCompare(y, 'es'));
  res.json({
    origins: sort(routes.map((r) => r.origin)),
    destinations: sort(routes.map((r) => r.destination)),
    routes, // pares válidos, para filtrar destinos según el origen elegido
  });
});

const SearchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)'),
  origin: z.string().trim().min(1).optional(),
  destination: z.string().trim().min(1).optional(),
});

const tripPublic = {
  route: true,
  pdf: { select: { id: true, fileName: true } },
  bus: {
    select: {
      name: true,
      capacity: true,
      description: true,
      photos: { select: { id: true }, orderBy: { position: 'asc' } },
    },
  },
} as const;

const promoPublic = (t: { promoLayout: 'square' | 'wide'; promoTitle: string | null; promoText: string | null; promoImageId: string | null }) => ({
  layout: t.promoLayout,
  title: t.promoTitle,
  text: t.promoText,
  imageId: t.promoImageId,
});

const busPublic = (b: { name: string; capacity: number; description: string | null; photos: { id: string }[] }) => ({
  name: b.name,
  capacity: b.capacity,
  description: b.description,
  photoIds: b.photos.map((p) => p.id),
});

/**
 * GET /api/trips/search?date=2026-10-25&origin=Asunción&destination=Encarnación
 * → viajes de ese día con lugares disponibles
 */
tripsRouter.get('/search', async (req, res) => {
  const { date, origin, destination } = SearchSchema.parse(req.query);
  const { start, end } = businessDayRange(date);
  const now = new Date();

  const trips = await prisma.trip.findMany({
    where: {
      departureTime: { gte: start, lt: end },
      status: { not: 'cancelled' },
      bus: { isActive: true },
      route: {
        isActive: true,
        ...(origin ? { origin: { equals: origin, mode: 'insensitive' as const } } : {}),
        ...(destination ? { destination: { equals: destination, mode: 'insensitive' as const } } : {}),
      },
    },
    orderBy: { departureTime: 'asc' },
    include: tripPublic,
  });
  const occupied = await occupiedByTrip(trips.map((t) => t.id));

  res.json({
    trips: trips.map((t) => {
      const a = availability(t, occupied.get(t.id) ?? 0, now);
      return {
        id: t.id,
        origin: t.route.origin,
        destination: t.route.destination,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        durationMinutes: t.route.durationMinutes,
        price: t.price,
        busName: t.bus.name,
        bus: busPublic(t.bus),
        capacity: a.capacity,
        availableSeats: a.available,
        soldOut: a.soldOut,
        closed: a.closed,
        bookable: a.bookable,
      };
    }),
  });
});

/**
 * GET /api/trips/featured → la "publicidad" de la portada: próximos viajes publicados,
 * con imagen y lugares libres. Los agotados o cerrados se muestran unos días más (con su cartel).
 */
tripsRouter.get('/featured', async (_req, res) => {
  const now = new Date();
  const trips = await prisma.trip.findMany({
    where: { showOnHome: true, status: 'scheduled', departureTime: { gt: now } },
    orderBy: { departureTime: 'asc' },
    take: 24,
    include: tripPublic,
  });
  const occupied = await occupiedByTrip(trips.map((t) => t.id));
  res.set('Cache-Control', 'no-store');
  res.json({
    trips: trips.map((t) => {
      const a = availability(t, occupied.get(t.id) ?? 0, now);
      return {
        id: t.id,
        origin: t.route.origin,
        destination: t.route.destination,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        durationMinutes: t.route.durationMinutes,
        price: t.price,
        busName: t.bus.name,
        bus: busPublic(t.bus),
        capacity: a.capacity,
        availableSeats: a.available,
        soldOut: a.soldOut,
        closed: a.closed,
        bookable: a.bookable,
        promo: promoPublic(t),
      };
    }),
  });
});

const TripParams = z.object({ id: z.uuid('Viaje inválido') });

/** GET /api/trips/:id → datos del viaje y lugares libres */
tripsRouter.get('/:id', async (req, res) => {
  const { id } = TripParams.parse(req.params);
  const trip = await prisma.trip.findUnique({ where: { id }, include: tripPublic });
  if (!trip) throw notFound('Viaje no encontrado');
  const a = availability(trip, await occupiedFor(id));

  res.json({
    trip: {
      id: trip.id,
      origin: trip.route.origin,
      destination: trip.route.destination,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      returnTime: trip.returnTime,
      durationMinutes: trip.route.durationMinutes,
      price: trip.price,
      status: trip.status,
      pdf: trip.pdf ? { id: trip.pdf.id, fileName: trip.pdf.fileName } : null,
      busName: trip.bus.name,
      bus: busPublic(trip.bus),
      promo: promoPublic(trip),
    },
    ...a,
  });
});
