/**
 * Prueba el flujo de reserva del pasajero contra el servidor local.
 *
 *   npm run dev            (en una terminal)
 *   npm run test:reservas  (en otra)
 *
 * Deja una reserva pendiente de 1 pasajero (se cancela sola si no se paga).
 * La prueba de cupo y "dos reservas al mismo tiempo" está en test:admin, que limpia lo que crea.
 */
const API = process.env.API_URL ?? 'http://localhost:4000';
let failed = 0;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json().catch(() => null);
  return { status: res.status, data };
}

function check(ok: boolean, msg: string, extra?: unknown) {
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
  if (!ok) {
    failed++;
    if (extra) console.log('   ', JSON.stringify(extra));
  }
}

function tomorrowPY() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date(Date.now() + 864e5));
}

async function main() {
  console.log(`\n🚌 Probando contra ${API}\n`);

  const loc = await call('GET', '/api/trips/locations');
  check(loc.status === 200 && loc.data.origins.length > 0, `Ciudades: ${loc.data?.origins?.join(', ')}`);

  const date = tomorrowPY();
  const search = await call('GET', `/api/trips/search?date=${date}`);
  check(search.status === 200, `Búsqueda del ${date}: ${search.data?.trips?.length ?? 0} viajes`, search.data);
  const trip = search.data?.trips?.find((t: { bookable: boolean }) => t.bookable);
  if (!trip) {
    console.log('❌ No hay viajes reservables mañana. Creá uno desde Admin → Viajes.');
    process.exit(1);
  }
  console.log(`   → Uso: ${trip.origin} → ${trip.destination}, ${trip.availableSeats} de ${trip.capacity} lugares libres`);

  const before = await call('GET', `/api/trips/${trip.id}`);
  check(before.status === 200 && typeof before.data.available === 'number', `Detalle del viaje: quedan ${before.data?.available}`);

  // Pedir más lugares de los que quedan (solo si quedan menos de 10, el máximo por reserva)
  if (before.data.available < 10) {
    const tooMany = await call('POST', '/api/bookings', {
      tripId: trip.id,
      contactPhone: '0981 123456',
      passengers: Array.from({ length: before.data.available + 1 }, (_, i) => ({
        fullName: `Pasajero ${i + 1}`,
        document: `100000${i}`,
        phone: '0981 123456',
      })),
    });
    check(tooMany.status === 409, `Pedir más lugares de los que quedan → rechazado ("${tooMany.data?.error}")`);
  }

  const book = await call('POST', '/api/bookings', {
    tripId: trip.id,
    contactPhone: '0981 123456',
    passengers: [{ fullName: 'Juan Prueba', document: '1234567', phone: '0981 123456' }],
  });
  check(book.status === 201, `Reserva de 1 pasajero → código ${book.data?.booking?.code}`, book.data);
  const code = book.data?.booking?.code;
  if (book.data?.booking) {
    console.log(`   → Total: ${book.data.booking.totalAmount} Gs`);
    console.log(`   → WhatsApp: ${book.data.booking.payment?.whatsappUrl}`);
  }

  const after = await call('GET', `/api/trips/${trip.id}`);
  check(after.data?.available === before.data.available - 1, `Ahora quedan ${after.data?.available} lugares (uno menos)`);

  if (code) {
    const ok = await call('GET', `/api/bookings/${code}?tel=${encodeURIComponent('+595 981 123-456')}`);
    check(ok.status === 200 && ok.data.booking.status === 'pending', `Consultar ${code} con el teléfono (escrito distinto) → pendiente de pago`);
    const bad = await call('GET', `/api/bookings/${code}?tel=0991000000`);
    check(bad.status === 404, 'Consultar con otro teléfono → no la muestra');
  }

  console.log(failed ? `\n❌ ${failed} prueba(s) fallaron\n` : '\n🎉 Todo funciona\n');
  if (code) console.log(`ℹ️  La reserva ${code} queda pendiente. Se cancela sola si no se paga a tiempo.\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('❌ No pude conectarme. ¿Está corriendo "npm run dev"?\n', e.message);
  process.exit(1);
});
