import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/http-error.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { addDaysStr, groupRules } from '../../lib/group-rules.js';
import { docClean } from '../../lib/format.js';

/** Viaje grupal a medida (público): un grupo pide su propio viaje. */
export const groupRequestsRouter = Router();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

const Schema = z.object({
  origin: z.string().trim().min(2, 'Escribí desde dónde salen').max(80),
  destination: z.string().trim().min(2, 'Escribí a dónde van').max(80),
  date: dateStr,
  returnDate: dateStr.optional(),
  preferredTime: z.enum(['morning', 'afternoon', 'night', 'any']).default('any'),
  passengers: z.number().int().min(1).max(80),
  fullName: z.string().trim().min(3, 'Escribí tu nombre y apellido').max(100),
  document: z.string().trim().min(3, 'Escribí tu cédula').max(20).transform(docClean),
  contactPhone: z.string().trim().regex(/^\+?[\d\s-]{6,20}$/, 'WhatsApp inválido'),
  notes: z.string().trim().max(500).optional(),
});

const limiter = rateLimit({ max: 5, windowMs: 10 * 60 * 1000 });

/** POST /api/group-requests */
groupRequestsRouter.post('/', limiter, async (req, res) => {
  const input = Schema.parse(req.body);
  const rules = await groupRules();
  if (input.passengers < rules.minPeople || input.passengers > rules.maxPeople) {
    throw badRequest(`Los viajes grupales son de ${rules.minPeople} a ${rules.maxPeople} personas`, 'GROUP_SIZE');
  }
  if (input.date < rules.earliestDate) {
    throw badRequest(`Pedilo con al menos ${rules.minDays} días de anticipación (desde el ${rules.earliestDate})`, 'TOO_SOON');
  }
  if (input.date > addDaysStr(rules.earliestDate, 365)) throw badRequest('Esa fecha está muy lejos todavía');
  if (input.returnDate && input.returnDate < input.date) throw badRequest('La vuelta tiene que ser después de la ida');

  const request = await prisma.groupRequest.create({ data: { ...input, notes: input.notes || null, returnDate: input.returnDate ?? null } });
  res.status(201).json({ ok: true, id: request.id });
});
