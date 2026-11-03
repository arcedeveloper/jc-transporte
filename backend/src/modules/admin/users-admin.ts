import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';

/** Usuarios del sistema: admins y choferes (los clientes no tienen cuenta). */
export const usersAdminRouter = Router();

const publicUser = { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true } as const;

/** GET /api/admin/users?role=driver */
usersAdminRouter.get('/', async (req, res) => {
  const { role } = z.object({ role: z.enum(['admin', 'driver']).optional() }).parse(req.query);
  const users = await prisma.user.findMany({
    where: role ? { role } : {},
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    select: publicUser,
  });
  res.json({ users });
});

const UserCreate = z.object({
  email: z.email('Email inválido').transform((e) => e.trim().toLowerCase()),
  fullName: z.string().trim().min(3).max(100),
  role: z.enum(['admin', 'driver']),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

/** POST /api/admin/users */
usersAdminRouter.post('/', async (req, res) => {
  const { password, ...data } = UserCreate.parse(req.body);
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
    select: publicUser,
  });
  res.status(201).json({ user });
});

const UserUpdate = z.object({
  fullName: z.string().trim().min(3).max(100).optional(),
  email: z.email('Email inválido').transform((e) => e.trim().toLowerCase()).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(), // resetear clave
});

/** PATCH /api/admin/users/:id */
usersAdminRouter.patch('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { password, ...data } = UserUpdate.parse(req.body);
  if (id === req.user!.id && data.isActive === false) throw badRequest('No podés desactivar tu propio usuario');

  if (data.email && (await prisma.user.count({ where: { email: data.email, id: { not: id } } }))) {
    throw conflict('Ya hay otro usuario con ese email', 'EMAIL_TAKEN');
  }
  const user = await prisma.user.update({
    where: { id },
    data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select: publicUser,
  });
  res.json({ user });
});

/**
 * DELETE /api/admin/users/:id
 * No podés borrarte a vos mismo ni al último admin. Un chofer con viajes próximos
 * asignados no se borra: primero cambiá el chofer de esos viajes.
 */
usersAdminRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  if (id === req.user!.id) throw badRequest('No podés borrar tu propio usuario');
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user) throw notFound('Usuario no encontrado');
  if (user.role === 'admin' && (await prisma.user.count({ where: { role: 'admin' } })) <= 1) {
    throw conflict('Tiene que quedar al menos un administrador', 'LAST_ADMIN');
  }
  const upcoming = await prisma.trip.count({
    where: { driverId: id, status: { in: ['scheduled', 'in_progress'] }, arrivalTime: { gte: new Date() } },
  });
  if (upcoming > 0) {
    throw conflict(`Este chofer tiene ${upcoming} viaje(s) próximo(s). Asigná otro chofer a esos viajes primero.`, 'HAS_UPCOMING_TRIPS');
  }
  await prisma.user.delete({ where: { id } }); // en sus viajes viejos el chofer queda vacío
  res.json({ ok: true });
});
