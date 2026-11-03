import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';
import { BUSINESS_UTC_OFFSET } from '../../config/business.js';
import { buildFinanceXlsx, currentMonth, monthMovements, monthRange } from '../../lib/finance.js';

const Month = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Mes inválido (AAAA-MM)')
  .optional()
  .transform((v) => v ?? currentMonth());

/* ------------------------------------------------------------------ */
/*  Gastos                                                             */
/* ------------------------------------------------------------------ */

export const expensesAdminRouter = Router();

const expenseInclude = {
  trip: { select: { id: true, departureTime: true, route: { select: { origin: true, destination: true } } } },
  driver: { select: { id: true, fullName: true } },
} as const;

/** GET /api/admin/expenses?month=2026-11  ó  ?tripId= */
expensesAdminRouter.get('/', async (req, res) => {
  const { tripId, month } = z.object({ tripId: z.uuid().optional(), month: Month }).parse(req.query);
  const where = tripId ? { tripId } : (() => {
    const { start, end } = monthRange(month);
    return { date: { gte: start, lt: end } };
  })();
  const expenses = await prisma.expense.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], include: expenseInclude });
  res.json({ expenses });
});

const ExpenseSchema = z.object({
  category: z.enum(['driver', 'supplies', 'repair', 'fuel', 'other']),
  description: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v || null),
  amount: z.number().int().positive('Poné el monto'),
  /** "2026-11-05" (si no viene: hoy) */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tripId: z.uuid().nullable().optional(),
  driverId: z.uuid().nullable().optional(),
});

/** POST /api/admin/expenses */
expensesAdminRouter.post('/', async (req, res) => {
  const { date, ...data } = ExpenseSchema.parse(req.body);
  if (data.category === 'driver' && !data.driverId) throw badRequest('Elegí el chofer');
  if (data.driverId) {
    const d = await prisma.user.findUnique({ where: { id: data.driverId }, select: { role: true } });
    if (!d || d.role !== 'driver') throw badRequest('Chofer inválido');
  }
  // Gasto de un viaje: la fecha es la del viaje (no hace falta elegirla)
  const trip = data.tripId ? await prisma.trip.findUnique({ where: { id: data.tripId }, select: { departureTime: true } }) : null;
  if (data.tripId && !trip) throw notFound('Viaje no encontrado');
  const expense = await prisma.expense.create({
    data: {
      ...data,
      tripId: data.tripId ?? null,
      driverId: data.category === 'driver' ? (data.driverId ?? null) : null,
      ...(trip ? { date: trip.departureTime } : date ? { date: new Date(`${date}T12:00:00${BUSINESS_UTC_OFFSET}`) } : {}),
    },
    include: expenseInclude,
  });
  res.status(201).json({ expense });
});

/** DELETE /api/admin/expenses/:id */
expensesAdminRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const r = await prisma.expense.deleteMany({ where: { id } });
  if (!r.count) throw notFound('Gasto no encontrado');
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Resumen y Excel                                                    */
/* ------------------------------------------------------------------ */

export const financeAdminRouter = Router();

/** GET /api/admin/finance/summary?month=2026-11 → recaudado, gastos y ganancia del mes */
financeAdminRouter.get('/summary', async (req, res) => {
  const { month } = z.object({ month: Month }).parse(req.query);
  const m = await monthMovements(month);
  res.json({ month, revenue: m.revenue, expenses: m.spent, profit: m.profit, byCategory: m.byCategory });
});

/** GET /api/admin/finance/export.xlsx?month=2026-11 */
financeAdminRouter.get('/export.xlsx', async (req, res) => {
  const { month } = z.object({ month: Month }).parse(req.query);
  const { buffer, filename } = await buildFinanceXlsx(month);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});
