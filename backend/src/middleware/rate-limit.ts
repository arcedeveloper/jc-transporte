import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';

/**
 * Limitador simple en memoria (alcanza para un solo servidor en Render).
 * Frena a quien intente adivinar contraseñas.
 */
export function rateLimit(opts: { max: number; windowMs: number; message?: string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Limpieza periódica para que el Map no crezca sin límite
  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.resetAt <= now) hits.delete(key);
  }, opts.windowMs).unref();

  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      throw new HttpError(
        429,
        opts.message ?? 'Demasiados intentos. Probá de nuevo en unos minutos.',
        'RATE_LIMITED',
      );
    }
    next();
  };
}
