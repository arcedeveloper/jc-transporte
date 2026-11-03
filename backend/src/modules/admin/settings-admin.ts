import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/http-error.js';

export const settingsAdminRouter = Router();

/** "@jctransporte_py", "instagram.com/jctransporte_py/" → "jctransporte_py" (vacío = sin red) */
const social = z
  .string()
  .trim()
  .max(100)
  .nullable()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const handle = v
      .replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i, '')
      .replace(/^@/, '')
      .split(/[/?#]/)[0]!
      .replace(/^@/, '');
    return handle || null;
  })
  .refine((v) => !v || /^[A-Za-z0-9._]{1,40}$/.test(v), 'Usuario inválido: solo letras, números, punto y guion bajo');

const SettingsSchema = z.object({
  instagram: social,
  tiktok: social,
  bankName: z.string().trim().min(2).max(80),
  bankAccount: z.string().trim().min(3).max(40),
  bankHolder: z.string().trim().min(2).max(100),
  bankRuc: z.string().trim().max(20).nullable().optional(),
  bankAlias: z.string().trim().max(60).nullable().optional(),
  // Formato internacional sin "+" ni espacios: 595981123456
  adminWhatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10,15}$/, 'WhatsApp inválido. Usá el formato 595981123456')),
  // Opcional: si se carga, aparece en el pie de página del sitio
  adminEmail: z
    .union([z.literal(''), z.email('Email inválido')])
    .nullable()
    .optional()
    .transform((v) => v || null),
});

/** GET /api/admin/settings */
settingsAdminRouter.get('/', async (_req, res) => {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  res.json({ settings });
});

/** PUT /api/admin/settings */
settingsAdminRouter.put('/', async (req, res) => {
  const data = SettingsSchema.parse(req.body);
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  res.json({ settings });
});

const SignSchema = z.object({
  signMessages: z
    .array(z.string().trim().min(1, 'Hay un mensaje vacío').max(30, 'Cada mensaje puede tener hasta 30 letras'))
    .max(10, 'Hasta 10 mensajes'),
  signShowRoutes: z.boolean(),
});

/** PUT /api/admin/settings/sign → mensajes del cartel de la portada */
settingsAdminRouter.put('/sign', async (req, res) => {
  const data = SignSchema.parse(req.body);
  if (!data.signShowRoutes && data.signMessages.length === 0) {
    throw badRequest('El cartel necesita al menos un mensaje o mostrar las rutas');
  }
  const r = await prisma.settings.updateMany({ where: { id: 1 }, data });
  if (r.count === 0) throw badRequest('Primero guardá los datos de la empresa');
  res.json({ ok: true });
});

const GroupRulesSchema = z
  .object({
    groupMinPeople: z.number().int().min(1, 'Mínimo 1 persona').max(80),
    groupMaxPeople: z.number().int().min(1).max(80),
    groupMinDays: z.number().int().min(0).max(60),
  })
  .refine((d) => d.groupMaxPeople >= d.groupMinPeople, { message: 'El máximo no puede ser menor que el mínimo', path: ['groupMaxPeople'] });

/** PUT /api/admin/settings/groups → reglas del viaje grupal a medida */
settingsAdminRouter.put('/groups', async (req, res) => {
  const data = GroupRulesSchema.parse(req.body);
  const r = await prisma.settings.updateMany({ where: { id: 1 }, data });
  if (r.count === 0) throw badRequest('Primero guardá los datos de la empresa');
  res.json({ ok: true });
});
