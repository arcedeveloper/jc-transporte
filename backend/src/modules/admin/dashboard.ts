import { Router } from 'express';
import { addDays } from 'date-fns';
import { prisma } from '../../lib/prisma.js';
import { businessDayRange, businessToday } from '../../config/business.js';
import { occupiedByTrip } from '../../lib/capacity.js';

export const dashboardRouter = Router();

/** GET /api/admin/dashboard */
dashboardRouter.get('/', async (_req, res) => {
  const now = new Date();
  const today = businessToday(now);
  const { start, end } = businessDayRange(today);
  const since = addDays(start, -29); // últimos 30 días

  const [todayTrips, statusCounts, revenue, revenueRows, upcoming] = await Promise.all([
    prisma.trip.findMany({
      where: { departureTime: { gte: start, lt: end } },
      orderBy: { departureTime: 'asc' },
      include: {
        route: true,
        bus: { select: { name: true, capacity: true } },
        driver: { select: { fullName: true } },
      },
    }),
    prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.booking.aggregate({ where: { status: 'confirmed' }, _sum: { totalAmount: true } }),
    prisma.$queryRaw<{ day: string; total: number; count: number }[]>`
      SELECT to_char(("confirmedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Asuncion', 'YYYY-MM-DD') AS day,
             SUM("totalAmount")::int AS total,
             COUNT(*)::int AS count
      FROM "Booking"
      WHERE status = 'confirmed' AND "confirmedAt" >= ${since}
      GROUP BY day ORDER BY day`,
    prisma.trip.findMany({
      where: { departureTime: { gte: now, lt: addDays(now, 14) }, status: { not: 'cancelled' } },
      orderBy: { departureTime: 'asc' },
      take: 20,
      include: { route: true, bus: { select: { capacity: true } } },
    }),
  ]);

  const occupied = await occupiedByTrip([...todayTrips, ...upcoming].map((t) => t.id));

  const bookings = { pending: 0, confirmed: 0, cancelled: 0 };
  for (const c of statusCounts) bookings[c.status] = c._count._all;

  // Completa con 0 los días sin ventas para que el gráfico no tenga huecos
  const byDay = new Map(revenueRows.map((r) => [r.day, r]));
  const revenueByDay = Array.from({ length: 30 }, (_, i) => {
    const day = businessToday(addDays(since, i));
    const r = byDay.get(day);
    return { day, total: r?.total ?? 0, count: r?.count ?? 0 };
  });

  res.json({
    today,
    bookings,
    revenueTotal: revenue._sum.totalAmount ?? 0,
    revenueByDay,
    todayTrips: todayTrips.map((t) => ({
      id: t.id,
      origin: t.route.origin,
      destination: t.route.destination,
      departureTime: t.departureTime,
      status: t.status,
      busName: t.bus.name,
      driverName: t.driver?.fullName ?? null,
      bookingClosed: t.bookingClosed,
      occupiedSeats: occupied.get(t.id) ?? 0,
      totalSeats: t.bus.capacity,
    })),
    upcomingOccupancy: upcoming.map((t) => ({
      id: t.id,
      label: `${t.route.origin} › ${t.route.destination}`,
      departureTime: t.departureTime,
      bookingClosed: t.bookingClosed,
      occupiedSeats: occupied.get(t.id) ?? 0,
      totalSeats: t.bus.capacity,
    })),
  });
});
