/**
 * Seed idempotente: se puede correr varias veces sin duplicar datos.
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, setHours, setMinutes, startOfDay, addMinutes } from 'date-fns';

const prisma = new PrismaClient();

async function upsertUser(email: string, password: string, fullName: string, role: UserRole) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: {}, // no pisamos la contraseña si ya existe
    create: { email, passwordHash, fullName, role },
  });
}

async function main() {
  // --- Usuarios ---
  const admin = await upsertUser(
    process.env.SEED_ADMIN_EMAIL ?? 'admin@jctransporte.com.py',
    process.env.SEED_ADMIN_PASSWORD ?? 'cambiame123',
    'Administrador JC',
    UserRole.admin,
  );
  const driver = await upsertUser(
    process.env.SEED_DRIVER_EMAIL ?? 'chofer@jctransporte.com.py',
    process.env.SEED_DRIVER_PASSWORD ?? 'cambiame123',
    'Chofer Bus 1',
    UserRole.driver,
  );

  // --- Bus 1: 17 lugares por viaje ---
  const bus = await prisma.bus.upsert({
    where: { plate: 'AAA 000' },
    update: {},
    create: { name: 'Bus 1', plate: 'AAA 000', capacity: 17 },
  });

  // --- Rutas de ejemplo (editables desde el admin) ---
  const routesData = [
    { origin: 'Asunción', destination: 'Encarnación', distanceKm: 370, durationMinutes: 330, basePrice: 120000 },
    { origin: 'Encarnación', destination: 'Asunción', distanceKm: 370, durationMinutes: 330, basePrice: 120000 },
  ];
  const routes = [];
  for (const r of routesData) {
    const existing = await prisma.route.findFirst({
      where: { origin: r.origin, destination: r.destination },
    });
    routes.push(existing ?? (await prisma.route.create({ data: r })));
  }

  // --- Viajes de ejemplo para los próximos 3 días (solo si no hay ninguno) ---
  if ((await prisma.trip.count()) === 0) {
    for (let d = 0; d < 3; d++) {
      const day = startOfDay(addDays(new Date(), d));
      // Ida a la mañana, vuelta a la tarde
      for (const [i, route] of routes.entries()) {
        const departure = setMinutes(setHours(day, i === 0 ? 7 : 16), 0);
        await prisma.trip.create({
          data: {
            busId: bus.id,
            routeId: route.id,
            driverId: driver.id,
            departureTime: departure,
            arrivalTime: addMinutes(departure, route.durationMinutes),
            price: route.basePrice,
          },
        });
      }
    }
  }

  // --- Ajustes (datos bancarios: reemplazar desde el admin) ---
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      bankName: 'Banco (completar)',
      bankAccount: '000000000',
      bankHolder: 'JC Transporte',
      bankRuc: null,
      bankAlias: null,
      adminWhatsapp: '595981000000',
      adminEmail: admin.email,
    },
  });

  console.log('✅ Seed listo');
  console.log(`   Admin:  ${admin.email}`);
  console.log(`   Chofer: ${driver.email}`);
  console.log('   ⚠️  Cambiá las contraseñas iniciales antes de producción.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
