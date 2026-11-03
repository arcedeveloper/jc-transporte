import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { conflict } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';

/** Rutas = recorridos (Asunción → Encarnación). */
export const routesAdminRouter = Router();

const RouteSchema = z.object({
  origin: z.string().trim().min(2, 'Origen inválido').max(60),
  destination: z.string().trim().min(2, 'Destino inválido').max(60),
  distanceKm: z.number().min(0).optional(), // opcional: al crear la ruta desde "Nuevo viaje" no se pide
  durationMinutes: z.number().int().positive('La duración debe ser mayor a 0'),
  basePrice: z.number().int().positive('El precio debe ser mayor a 0'),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

/** GET /api/admin/routes */
routesAdminRouter.get('/', async (_req, res) => {
  const routes = await prisma.route.findMany({
    orderBy: [{ origin: 'asc' }, { destination: 'asc' }],
    include: { _count: { select: { trips: true } } },
  });
  res.json({ routes });
});

/** POST /api/admin/routes */
routesAdminRouter.post('/', async (req, res) => {
  const data = RouteSchema.parse(req.body);
  if (data.origin.toLowerCase() === data.destination.toLowerCase()) {
    throw conflict('El origen y el destino no pueden ser iguales');
  }
  const route = await prisma.route.create({ data: { ...data, distanceKm: data.distanceKm ?? 0 } });
  res.status(201).json({ route });
});

/** PATCH /api/admin/routes/:id (cambiar el precio base no afecta viajes ya creados) */
routesAdminRouter.patch('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const data = RouteSchema.partial().parse(req.body);
  const route = await prisma.route.update({ where: { id }, data });
  res.json({ route });
});

/**
 * DELETE /api/admin/routes/:id[?force=true]
 * - Sin reservas o solo canceladas: borra la ruta, sus viajes y esas reservas.
 * - Con viajes ya hechos y pagados (historial de ventas): pide force=true.
 * - Nunca borra si hay reservas ACTIVAS en viajes que todavía no salieron:
 *   esos pasajeros tienen un pasaje válido; primero hay que cancelarlas (y avisarles).
 */
routesAdminRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const force = req.query.force === 'true';

  const activeFuture = await prisma.booking.count({
    where: { status: { in: ['pending', 'confirmed'] }, trip: { routeId: id, departureTime: { gt: new Date() } } },
  });
  if (activeFuture > 0) {
    throw conflict(
      `Hay ${activeFuture} reserva(s) activa(s) en viajes que todavía no salieron. Cancelalas primero en Reservas (así el pasajero recibe el aviso) o desactivá la ruta.`,
      'ACTIVE_BOOKINGS',
    );
  }

  // Reservas pagadas de viajes que ya pasaron = historial de ventas (recaudación del panel)
  const paidHistory = await prisma.booking.count({ where: { status: 'confirmed', trip: { routeId: id } } });
  if (paidHistory > 0 && !force) {
    throw conflict(
      `Esta ruta tiene ${paidHistory} reserva(s) pagadas de viajes ya realizados. Si la borrás, ese dinero deja de aparecer en la recaudación del panel.`,
      'HAS_BOOKINGS',
    );
  }

  const [deletedBookings, deletedTrips] = await prisma.$transaction([
    // Pasajeros y asientos de cada reserva se borran solos (cascade)
    prisma.booking.deleteMany({ where: { trip: { routeId: id } } }),
    prisma.trip.deleteMany({ where: { routeId: id } }),
    prisma.route.delete({ where: { id } }),
  ]);
  res.json({ ok: true, deletedTrips: deletedTrips.count, deletedBookings: deletedBookings.count });
});
