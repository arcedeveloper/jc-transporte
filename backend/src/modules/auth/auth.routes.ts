import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../lib/jwt.js';
import { badRequest, unauthorized } from '../../lib/http-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rate-limit.js';

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.email('Email inválido').transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

// Hash falso para comparar cuando el email no existe: así la respuesta tarda
// lo mismo y no se puede adivinar qué emails están registrados.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-no-real', 12);

const loginLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Demasiados intentos de inicio de sesión. Esperá 15 minutos.',
});

/**
 * POST /api/auth/login
 * body: { email, password }
 * → { token, user: { id, email, fullName, role } }
 */
authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok || !user.isActive) {
    throw unauthorized('Email o contraseña incorrectos');
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
});

/** GET /api/auth/me → usuario de la sesión actual */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/change-password
 * body: { currentPassword, newPassword }
 */
authRouter.post('/change-password', requireAuth, loginLimiter, async (req, res) => {
  const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('La contraseña actual no es correcta', 'WRONG_PASSWORD');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });
  res.json({ ok: true });
});
