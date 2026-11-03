import { PrismaClient } from '@prisma/client';

/**
 * Neon (plan gratis) se "duerme" y tarda unos segundos en despertar.
 * Si la URL no trae estos ajustes, se los agregamos para que el backend espere
 * en vez de tirar "Timed out fetching a new connection" (P2024).
 */
function withPoolDefaults(raw: string | undefined) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const p = url.searchParams;
    if (url.hostname.includes('-pooler') && !p.has('pgbouncer')) p.set('pgbouncer', 'true');
    if (!p.has('connect_timeout')) p.set('connect_timeout', '30');
    if (!p.has('pool_timeout')) p.set('pool_timeout', '30');
    if (!p.has('connection_limit')) p.set('connection_limit', '5');
    return url.toString();
  } catch {
    return raw;
  }
}

// Una sola instancia por proceso (tsx watch recarga módulos en dev).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withPoolDefaults(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
