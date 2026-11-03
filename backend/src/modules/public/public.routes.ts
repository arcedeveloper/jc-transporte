import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';

export const publicRouter = Router();

/**
 * GET /api/public/info → datos de contacto para el sitio (botón de WhatsApp, footer).
 * No incluye datos bancarios: esos solo se muestran después de reservar.
 */
publicRouter.get('/info', async (_req, res) => {
  const s = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { adminWhatsapp: true, adminEmail: true, instagram: true, tiktok: true, signMessages: true, signShowRoutes: true, groupMinPeople: true, groupMaxPeople: true, groupMinDays: true },
  });
  res.set('Cache-Control', 'no-store'); // los cambios de Ajustes se ven enseguida
  res.json({
    whatsapp: s?.adminWhatsapp ?? null,
    email: s?.adminEmail ?? null,
    instagram: s?.instagram ?? null,
    tiktok: s?.tiktok ?? null,
    signMessages: s?.signMessages ?? [],
    signShowRoutes: s?.signShowRoutes ?? true,
    groupMinPeople: s?.groupMinPeople ?? 12,
    groupMaxPeople: s?.groupMaxPeople ?? 17,
    groupMinDays: s?.groupMinDays ?? 5,
  });
});

/** GET /api/public/bus-photos/:id → la imagen (se guarda en caché: nunca cambia, si se reemplaza tiene otro id) */
publicRouter.get('/bus-photos/:id', async (req, res) => {
  const { id } = z.object({ id: z.uuid() }).parse(req.params);
  const photo = await prisma.busPhoto.findUnique({ where: { id }, select: { mimeType: true, data: true } });
  if (!photo) throw notFound('Foto no encontrada');
  res.set('Content-Type', photo.mimeType);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // para que el sitio (otro dominio) pueda mostrarla
  res.send(Buffer.from(photo.data));
});

/** GET /api/public/promo-images/:id → imagen de publicidad de un viaje (si se cambia, tiene otro id) */
publicRouter.get('/promo-images/:id', async (req, res) => {
  const { id } = z.object({ id: z.uuid() }).parse(req.params);
  const img = await prisma.promoImage.findUnique({ where: { id }, select: { mimeType: true, data: true } });
  if (!img) throw notFound('Imagen no encontrada');
  res.set('Content-Type', img.mimeType);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(Buffer.from(img.data));
});
