import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { rateLimit } from '../../middleware/rate-limit.js';

/** Sugerencias (público): a dónde y cuándo le gustaría viajar a la gente. */
export const suggestionsRouter = Router();

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const Schema = z.object({
  destination: z.string().trim().min(2, 'Escribí a dónde te gustaría viajar').max(80),
  origin: opt(80),
  whenText: opt(80),
  message: opt(500),
  name: opt(100),
  contactPhone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^\+?[\d\s-]{6,20}$/.test(v), 'WhatsApp inválido'),
});

const limiter = rateLimit({ max: 5, windowMs: 10 * 60 * 1000 });

/** POST /api/suggestions */
suggestionsRouter.post('/', limiter, async (req, res) => {
  const data = Schema.parse(req.body);
  await prisma.suggestion.create({ data });
  res.status(201).json({ ok: true });
});
