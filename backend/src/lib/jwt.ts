import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env.js';

export interface TokenPayload {
  sub: string; // id del usuario
  role: UserRole;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Devuelve el payload o null si el token es inválido o venció. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      typeof decoded.sub === 'string' &&
      (decoded.role === 'admin' || decoded.role === 'driver')
    ) {
      return { sub: decoded.sub, role: decoded.role };
    }
    return null;
  } catch {
    return null;
  }
}
