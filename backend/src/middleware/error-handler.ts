import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', code: 'NOT_FOUND' });
};

function uniqueMessage(target: unknown) {
  const t = String(Array.isArray(target) ? target.join(',') : target ?? '');
  if (t.includes('plate')) return { error: 'Ya existe un bus con esa chapa', code: 'DUPLICATE' };
  if (t.includes('email')) return { error: 'Ya existe un usuario con ese email', code: 'DUPLICATE' };
  return { error: 'Ya existe un registro con esos datos', code: 'DUPLICATE' };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message ?? 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: unique repetido (ej: chapa o email ya usados)
    if (err.code === 'P2002') {
      res.status(409).json(uniqueMessage(err.meta?.target));
      return;
    }
    // P2003: no se puede borrar porque otros datos dependen de este
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'No se puede borrar porque tiene datos asociados', code: 'IN_USE' });
      return;
    }
    // P2025: el registro a modificar no existe
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'No encontrado', code: 'NOT_FOUND' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL' });
};
