import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';

export const busesRouter = Router();

export const MAX_PHOTOS_PER_BUS = 4;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB (después de achicar en el navegador suelen pesar ~150 KB)

const BusSchema = z.object({
  name: z.string().trim().min(1, 'Poné un nombre').max(50),
  plate: z.string().trim().toUpperCase().min(3, 'Chapa inválida').max(15),
  capacity: z.number().int().min(1, 'Mínimo 1 lugar').max(80, 'Máximo 80 lugares'),
  description: z
    .string()
    .trim()
    .max(200, 'Máximo 200 letras')
    .nullable()
    .optional()
    .transform((v) => v || null),
  isActive: z.boolean().optional(),
});

/** Solo los datos de las fotos que hacen falta para listarlas (sin la imagen). */
const photoMeta = { select: { id: true, position: true }, orderBy: { position: 'asc' } } as const;

/** GET /api/admin/buses */
busesRouter.get('/', async (_req, res) => {
  const buses = await prisma.bus.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { trips: true } }, photos: photoMeta },
  });
  res.json({ buses });
});

/** POST /api/admin/buses  { name, plate, capacity, description } */
busesRouter.post('/', async (req, res) => {
  const data = BusSchema.parse(req.body);
  const bus = await prisma.bus.create({ data });
  res.status(201).json({ bus });
});

/**
 * PATCH /api/admin/buses/:id
 * Si se baja la capacidad, no puede quedar por debajo de los lugares ya vendidos en viajes futuros.
 */
busesRouter.patch('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const data = BusSchema.partial().parse(req.body);

  if (data.capacity != null) {
    const rows = await prisma.booking.groupBy({
      by: ['tripId'],
      where: {
        status: { in: ['pending', 'confirmed'] },
        trip: { busId: id, departureTime: { gt: new Date() }, status: { not: 'cancelled' } },
      },
      _sum: { numberOfPassengers: true },
    });
    const max = Math.max(0, ...rows.map((r) => r._sum.numberOfPassengers ?? 0));
    if (data.capacity < max) {
      throw conflict(`Hay un viaje próximo con ${max} pasajeros reservados. La capacidad no puede ser menor.`, 'CAPACITY_TOO_LOW');
    }
  }

  const bus = await prisma.bus.update({ where: { id }, data });
  res.json({ bus });
});

/**
 * DELETE /api/admin/buses/:id
 * Se puede borrar si no tiene viajes próximos. Sus viajes viejos (y sus reservas) se borran con él.
 */
busesRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const bus = await prisma.bus.findUnique({ where: { id }, select: { id: true } });
  if (!bus) throw notFound('Bus no encontrado');
  const upcoming = await prisma.trip.count({
    where: { busId: id, status: { in: ['scheduled', 'in_progress'] }, arrivalTime: { gte: new Date() } },
  });
  if (upcoming > 0) {
    throw conflict(
      `Este bus tiene ${upcoming} viaje(s) próximo(s). Cambiales el bus o borralos primero, o desactivá el bus.`,
      'HAS_UPCOMING_TRIPS',
    );
  }
  const [b, t] = await prisma.$transaction([
    prisma.booking.deleteMany({ where: { trip: { busId: id } } }),
    prisma.trip.deleteMany({ where: { busId: id } }),
    prisma.bus.delete({ where: { id } }),
  ]);
  res.json({ ok: true, deletedTrips: t.count, deletedBookings: b.count });
});

// ---------- Fotos ----------

const PhotoSchema = z.object({
  /** "data:image/jpeg;base64,...." */
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'La imagen tiene que ser JPG, PNG o WEBP'),
});

/** POST /api/admin/buses/:id/photos  { dataUrl } */
busesRouter.post('/:id/photos', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { dataUrl } = PhotoSchema.parse(req.body);

  const bus = await prisma.bus.findUnique({ where: { id }, include: { photos: photoMeta } });
  if (!bus) throw notFound('Bus no encontrado');
  if (bus.photos.length >= MAX_PHOTOS_PER_BUS) throw badRequest(`Cada bus puede tener hasta ${MAX_PHOTOS_PER_BUS} fotos. Borrá una para subir otra.`);

  const [, mime, b64] = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl)!;
  const data = Buffer.from(b64!, 'base64');
  if (data.length > MAX_PHOTO_BYTES) throw badRequest('La foto es muy pesada (máximo 2 MB)');

  const position = (bus.photos.at(-1)?.position ?? -1) + 1;
  const photo = await prisma.busPhoto.create({
    data: { busId: id, mimeType: mime!, data, position },
    select: { id: true, position: true },
  });
  res.status(201).json({ photo });
});

const PhotoParams = z.object({ id: z.uuid(), photoId: z.uuid() });

/** DELETE /api/admin/buses/:id/photos/:photoId */
busesRouter.delete('/:id/photos/:photoId', async (req, res) => {
  const { id, photoId } = PhotoParams.parse(req.params);
  const r = await prisma.busPhoto.deleteMany({ where: { id: photoId, busId: id } });
  if (r.count === 0) throw notFound('Foto no encontrada');
  res.json({ ok: true });
});

/** POST /api/admin/buses/:id/photos/:photoId/first → usarla como foto principal */
busesRouter.post('/:id/photos/:photoId/first', async (req, res) => {
  const { id, photoId } = PhotoParams.parse(req.params);
  const photos = await prisma.busPhoto.findMany({ where: { busId: id }, ...photoMeta });
  if (!photos.some((p) => p.id === photoId)) throw notFound('Foto no encontrada');
  const order = [photoId, ...photos.map((p) => p.id).filter((x) => x !== photoId)];
  await prisma.$transaction(order.map((pid, i) => prisma.busPhoto.update({ where: { id: pid }, data: { position: i } })));
  res.json({ ok: true });
});
