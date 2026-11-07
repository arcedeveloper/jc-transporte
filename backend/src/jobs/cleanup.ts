import { prisma } from '../lib/prisma.js';
import { cancelBooking } from '../modules/bookings/bookings.service.js';
import { businessDayRange, businessToday } from '../config/business.js';
import { addDaysStr } from '../lib/group-rules.js';
import { notifyChanged, trackingEvents } from '../realtime/socket.js';

/*
 * Tarea automática: cancela las reservas pendientes cuyo plazo de pago venció,
 * así sus lugares vuelven a quedar libres. Corre una vez por hora para que
 * Neon (plan gratis) pueda "dormirse" cuando nadie usa la app.
 */

async function cancelUnpaidBookings() {
  const overdue = await prisma.booking.findMany({
    where: { status: 'pending', paymentDeadline: { lte: new Date() } },
    select: { id: true, bookingCode: true },
  });
  for (const b of overdue) {
    const ok = await cancelBooking(b.id, 'Pago no recibido a tiempo', { onlyIfPending: true });
    if (ok) {
      console.log(`⏰ Reserva ${b.bookingCode} cancelada por falta de pago`);
      notifyChanged();
    }
  }
}

/**
 * Pasada la medianoche del día del viaje, el viaje se da por hecho: queda "Finalizado" solo.
 * (Si no se canceló antes, se realizó.)
 */
async function completeFinishedTrips() {
  const todayStart = businessDayRange(businessToday()).start;
  const trips = await prisma.trip.findMany({
    where: { status: { in: ['scheduled', 'in_progress'] }, departureTime: { lt: todayStart }, arrivalTime: { lte: new Date() } },
    select: { id: true },
  });
  if (!trips.length) return;
  await prisma.trip.updateMany({
    where: { id: { in: trips.map((t) => t.id) } },
    data: { status: 'completed', completedAt: new Date() },
  });
  for (const t of trips) trackingEvents.status(t.id, 'completed');
  console.log(`✅ ${trips.length} viaje(s) marcados como finalizados`);
  notifyChanged();
}

/** Corre una tarea cada `ms` sin que se superpongan ejecuciones. */
function every(ms: number, name: string, fn: () => Promise<void>) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (e) {
      // Un corte momentáneo con la base no es grave: se reintenta en la próxima vuelta.
      const msg = e instanceof Error ? e.message.split('\n').filter(Boolean).pop() : String(e);
      console.error(`⚠️  Job "${name}" no pudo correr (se reintenta solo): ${msg}`);
    } finally {
      running = false;
    }
  };
  void run();
  setInterval(() => void run(), ms);
}

/**
 * Pedidos grupales de hace más de un mes → se borran.
 * Imágenes de publicidad que ya no usa ningún viaje → se borran.
 */
async function tidyUp() {
  const old = await prisma.groupRequest.deleteMany({ where: { date: { lt: addDaysStr(businessToday(), -30) } } });
  if (old.count) console.log(`🧹 ${old.count} pedido(s) grupales viejos borrados`);
  const images = await prisma.promoImage.deleteMany({
    where: { trips: { none: {} }, createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
  });
  if (images.count) console.log(`🧹 ${images.count} imagen(es) de publicidad sin usar borradas`);
}

export function startJobs() {
  every(60 * 60 * 1000, 'cancelar reservas impagas', cancelUnpaidBookings);
  every(60 * 60 * 1000, 'finalizar viajes pasados', completeFinishedTrips);
  every(6 * 60 * 60 * 1000, 'ordenar pedidos e imágenes', tidyUp);
}
