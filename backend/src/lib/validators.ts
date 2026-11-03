import { z } from 'zod';

export const IdParam = z.object({ id: z.uuid('ID inválido') });

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{6,20}$/, 'Teléfono inválido');

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');
