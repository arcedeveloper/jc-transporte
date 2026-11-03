import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';
import { forbidden, unauthorized } from '../lib/http-error.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Exige el header "Authorization: Bearer <token>".
 * Consulta la base en cada request: si el admin desactiva a un usuario,
 * pierde el acceso al instante aunque su token siga vigente.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized('Falta iniciar sesión');

  const payload = verifyToken(token);
  if (!payload) throw unauthorized('Sesión inválida o vencida');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, fullName: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw unauthorized('Usuario inexistente o desactivado');

  req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  next();
};

/** Usar después de requireAuth. */
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
