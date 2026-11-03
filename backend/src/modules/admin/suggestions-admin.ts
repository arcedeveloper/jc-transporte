import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';
import { IdParam } from '../../lib/validators.js';

/** Sugerencias de destinos. */
export const suggestionsAdminRouter = Router();

/** "Concepción ", "concepcion" → "concepcion" (para agrupar los más pedidos) */
const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

/** GET /api/admin/suggestions → lista + destinos más pedidos */
suggestionsAdminRouter.get('/', async (_req, res) => {
  const suggestions = await prisma.suggestion.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  const top = new Map<string, { destination: string; count: number }>();
  for (const s of suggestions) {
    const k = norm(s.destination);
    const t = top.get(k);
    if (t) t.count++;
    else top.set(k, { destination: s.destination.trim(), count: 1 });
  }
  res.json({
    suggestions,
    top: [...top.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    unread: suggestions.filter((s) => !s.isRead).length,
  });
});

/** POST /api/admin/suggestions/read-all → marcar todas como leídas */
suggestionsAdminRouter.post('/read-all', async (_req, res) => {
  const r = await prisma.suggestion.updateMany({ where: { isRead: false }, data: { isRead: true } });
  res.json({ updated: r.count });
});

/** POST /api/admin/suggestions/cleanup → borrar todas las leídas */
suggestionsAdminRouter.post('/cleanup', async (_req, res) => {
  const r = await prisma.suggestion.deleteMany({ where: { isRead: true } });
  res.json({ deleted: r.count });
});

/** DELETE /api/admin/suggestions/:id */
suggestionsAdminRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const r = await prisma.suggestion.deleteMany({ where: { id } });
  if (!r.count) throw notFound('Sugerencia no encontrada');
  res.json({ ok: true });
});
