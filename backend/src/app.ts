import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { tripsRouter } from './modules/trips/trips.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { driverRouter } from './modules/driver/driver.routes.js';
import { groupRequestsRouter } from './modules/group-requests/group-requests.routes.js';
import { suggestionsRouter } from './modules/suggestions/suggestions.routes.js';
import { notifyChanged } from './realtime/socket.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render está detrás de un proxy
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  // Las fotos de los buses llegan en base64: solo esa ruta acepta pedidos grandes
  app.use('/api/admin/buses', express.json({ limit: '3mb' }));
  app.use('/api/admin/trips', express.json({ limit: '12mb' })); // imagen de publicidad y PDF del paquete
  app.use(express.json({ limit: '100kb' }));

  // Health check liviano: lo usa cron-job.org para que Render no duerma.
  // No toca la base, así Neon puede dormirse cuando nadie usa la app.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // Para revisar a mano que la base responde.
  app.get('/health/db', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  // Cada cambio que sale bien (crear, editar, confirmar, borrar…) avisa a las páginas abiertas.
  // No cuenta el login ni la ubicación del bus (esa va por su propio canal en vivo).
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && !req.path.startsWith('/auth') && !/^\/driver\/trips\/[^/]+\/location$/.test(req.path)) {
      res.on('finish', () => {
        if (res.statusCode < 400) notifyChanged();
      });
    }
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/trips', tripsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/group-requests', groupRequestsRouter);
  app.use('/api/suggestions', suggestionsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/driver', driverRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
