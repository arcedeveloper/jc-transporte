import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';

/** Pedidos de viaje grupal a medida. */
export const groupRequestsAdminRouter = Router();

const Status = z.enum(['new', 'contacted', 'accepted', 'dismissed']);

const include = {
  trip: { select: { id: true, departureTime: true, price: true, status: true, route: { select: { origin: true, destination: true } } } },
} as const;

/** GET /api/admin/group-requests?status= (sin status: nuevos y contactados) */
groupRequestsAdminRouter.get('/', async (req, res) => {
  const { status } = z.object({ status: Status.optional() }).parse(req.query);
  const requests = await prisma.groupRequest.findMany({
    where: status ? { status } : { status: { in: ['new', 'contacted'] } },
    orderBy: (status === 'accepted' || status === 'dismissed'
      ? [{ date: 'desc' }]
      : [{ date: 'asc' }, { createdAt: 'asc' }]) satisfies Prisma.GroupRequestOrderByWithRelationInput[],
    include,
    take: 300,
  });
  res.json({ requests });
});

/** GET /api/admin/group-requests/summary → para el aviso del panel */
groupRequestsAdminRouter.get('/summary', async (_req, res) => {
  const [newGroups, unreadSuggestions] = await Promise.all([
    prisma.groupRequest.count({ where: { status: 'new' } }),
    prisma.suggestion.count({ where: { isRead: false } }),
  ]);
  res.json({ newGroups, unreadSuggestions });
});

/** PATCH /api/admin/group-requests/:id { status } */
groupRequestsAdminRouter.patch('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { status } = z.object({ status: Status }).parse(req.body);
  const r = await prisma.groupRequest.updateMany({
    where: { id },
    data: { status, ...(status === 'new' || status === 'contacted' ? { tripId: null } : {}) },
  });
  if (!r.count) throw notFound('Pedido no encontrado');
  res.json({ ok: true });
});

/** POST /api/admin/group-requests/:id/trip { tripId } → se armó el viaje para el grupo */
groupRequestsAdminRouter.post('/:id/trip', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { tripId } = z.object({ tripId: z.uuid() }).parse(req.body);
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { status: true } });
  if (!trip) throw notFound('Viaje no encontrado');
  if (trip.status === 'cancelled') throw badRequest('Ese viaje está cancelado');
  const r = await prisma.groupRequest.updateMany({ where: { id }, data: { status: 'accepted', tripId } });
  if (!r.count) throw notFound('Pedido no encontrado');
  const request = await prisma.groupRequest.findUniqueOrThrow({ where: { id }, include });
  res.json({ request });
});

/** POST /api/admin/group-requests/:id/notified → ya se le mandó el enlace por WhatsApp */
groupRequestsAdminRouter.post('/:id/notified', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const r = await prisma.groupRequest.updateMany({ where: { id }, data: { notifiedAt: new Date() } });
  if (!r.count) throw notFound('Pedido no encontrado');
  res.json({ ok: true });
});

/** DELETE /api/admin/group-requests/:id */
groupRequestsAdminRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const r = await prisma.groupRequest.deleteMany({ where: { id } });
  if (!r.count) throw notFound('Pedido no encontrado');
  res.json({ ok: true });
});
