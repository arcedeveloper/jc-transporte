/**
 * Prueba admin y chofer contra el servidor local: cupo, reservas simultáneas,
 * confirmar pago, confirmar viaje (cerrar reservas), planilla Excel, chofer y ubicación.
 * Al final cancela lo que creó para dejar todo limpio.
 *
 *   npm run dev          (en una terminal)
 *   npm run test:admin   (en otra)
 */
import { createInterface } from 'node:readline/promises';

const API = process.env.API_URL ?? 'http://localhost:4000';
let failed = 0;

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
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

async function ask(q: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question(q);
  rl.close();
  return a.trim();
}

const pax = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => ({ fullName: `${tag} ${i + 1}`, document: `9${i}0000${i}`, phone: '0981 000000' }));

async function main() {
  console.log(`\n🛠️  Probando admin y chofer contra ${API}\n`);

  const adminEmail = process.env.ADMIN_EMAIL || (await ask('Email del admin (Enter = admin@jctransporte.com.py): ')) || 'admin@jctransporte.com.py';
  const adminPass = process.env.ADMIN_PASSWORD ?? (await ask(`Contraseña de ${adminEmail}: `));
  const driverEmail = process.env.DRIVER_EMAIL || (await ask('Email del chofer (Enter = chofer@jctransporte.com.py): ')) || 'chofer@jctransporte.com.py';
  const driverPass = process.env.DRIVER_PASSWORD ?? 'cambiame123';
  console.log('');

  // --- Login y permisos ---
  const la = await call('POST', '/api/auth/login', { email: adminEmail, password: adminPass });
  check(la.status === 200, 'Login admin', la.data);
  const admin = la.data?.token as string;
  if (!admin) process.exit(1);
  const ld = await call('POST', '/api/auth/login', { email: driverEmail, password: driverPass });
  check(ld.status === 200, 'Login chofer', ld.data);
  const driver = ld.data?.token as string;
  if (!driver) process.exit(1);
  check((await call('GET', '/api/admin/dashboard')).status === 401, 'Sin sesión no se entra al admin');
  check((await call('GET', '/api/admin/dashboard', undefined, driver)).status === 403, 'El chofer no puede entrar al admin');

  // --- Lectura ---
  const dash = await call('GET', '/api/admin/dashboard', undefined, admin);
  check(dash.status === 200, `Dashboard: ${JSON.stringify(dash.data?.bookings)}`, dash.data);
  const buses = await call('GET', '/api/admin/buses', undefined, admin);
  check(typeof buses.data?.buses?.[0]?.capacity === 'number', `Bus: ${buses.data?.buses?.[0]?.name}, ${buses.data?.buses?.[0]?.capacity} lugares`);

  // --- Fotos del bus (sube una imagen de 1x1, la muestra y la borra) ---
  const bus0 = buses.data.buses[0];
  if (bus0.photos.length < 4) {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const up = await call('POST', `/api/admin/buses/${bus0.id}/photos`, { dataUrl: png }, admin);
    check(up.status === 201, 'Subir foto del bus', up.data);
    const img = await fetch(`${API}/api/public/bus-photos/${up.data?.photo?.id}`);
    check(img.status === 200 && (img.headers.get('content-type') ?? '').startsWith('image/'), 'La foto se ve desde el sitio público');
    const del = await call('DELETE', `/api/admin/buses/${bus0.id}/photos/${up.data?.photo?.id}`, undefined, admin);
    check(del.status === 200, 'Borrar la foto de prueba');
  }

  // --- Viaje de mañana ---
  const search = await call('GET', `/api/trips/search?date=${tomorrowPY()}`);
  const trip = search.data?.trips?.find((t: { bookable: boolean; availableSeats: number }) => t.bookable && t.availableSeats >= 2);
  if (!trip) {
    console.log('❌ No hay un viaje reservable mañana con al menos 2 lugares libres.');
    process.exit(1);
  }
  const A = (await call('GET', `/api/trips/${trip.id}`)).data.available as number;
  console.log(`   → Uso: ${trip.origin} → ${trip.destination}, ${A} lugares libres\n`);

  // --- Dos reservas que no entran juntas: el lugar es del primero que paga ---
  const n = Math.min(10, Math.floor(A / 2) + 1);
  const [r1, r2] = await Promise.all([
    call('POST', '/api/bookings', { tripId: trip.id, contactPhone: '0981 000000', passengers: pax(n, 'Prueba A') }),
    call('POST', '/api/bookings', { tripId: trip.id, contactPhone: '0981 000000', passengers: pax(n, 'Prueba B') }),
  ]);
  const ok = [r1, r2].filter((r) => r.status === 201);
  check(ok.length === 2, `Dos reservas de ${n} (pendientes de pago) → las dos se anotan`, [r1, r2]);
  const created = ok.map((r) => r.data.booking.code as string);
  const code = created[0]!;
  const afterPending = (await call('GET', `/api/trips/${trip.id}`)).data.available;
  check(afterPending === A, `Las pendientes no ocupan lugar: siguen ${afterPending} libres`);

  // --- Confirmar pago ---
  const found = await call('GET', `/api/admin/bookings?q=${code}`, undefined, admin);
  const booking = found.data?.bookings?.[0];
  check(booking?.bookingCode === code, `Admin encuentra ${code}`);
  const conf = await call('POST', `/api/admin/bookings/${booking.id}/confirm`, undefined, admin);
  check(conf.data?.booking?.status === 'confirmed', 'Admin confirma el pago');
  check((await call('POST', `/api/admin/bookings/${booking.id}/confirm`, undefined, admin)).status === 409, 'Confirmar dos veces → avisa');
  const afterPaid = (await call('GET', `/api/trips/${trip.id}`)).data.available;
  check(afterPaid === A - n, `Con el pago confirmado ocupa lugar: quedan ${afterPaid}`);
  if (created[1] && 2 * n > A) {
    const b2 = (await call('GET', `/api/admin/bookings?q=${created[1]}`, undefined, admin)).data?.bookings?.[0];
    const conf2 = await call('POST', `/api/admin/bookings/${b2.id}/confirm`, undefined, admin);
    check(conf2.status === 409, `Confirmar la segunda sin lugar → no deja ("${conf2.data?.error}")`);
  }

  // --- Confirmar viaje (cerrar reservas) ---
  const close = await call('POST', `/api/admin/trips/${trip.id}/close`, undefined, admin);
  check(close.status === 200, 'Admin confirma el viaje (cierra las reservas)');
  const closedView = (await call('GET', `/api/trips/${trip.id}`)).data;
  check(closedView.closed === true && closedView.bookable === false, 'El pasajero ve "Reservas cerradas"');
  const late = await call('POST', '/api/bookings', { tripId: trip.id, contactPhone: '0981 000000', passengers: pax(1, 'Tarde') });
  check(late.status === 400, `Reservar con el viaje cerrado → rechazado ("${late.data?.error}")`);
  const reopen = await call('POST', `/api/admin/trips/${trip.id}/reopen`, undefined, admin);
  check(reopen.status === 200 && (await call('GET', `/api/trips/${trip.id}`)).data.bookable === true, 'Admin reabre las reservas');

  // --- Planilla Excel ---
  const xlsx = await fetch(`${API}/api/admin/trips/${trip.id}/checklist.xlsx`, { headers: { Authorization: `Bearer ${admin}` } });
  const bytes = new Uint8Array(await xlsx.arrayBuffer());
  check(
    xlsx.status === 200 && (xlsx.headers.get('content-type') ?? '').includes('spreadsheetml') && bytes[0] === 0x50 && bytes[1] === 0x4b,
    `Planilla Excel descargada (${Math.round(bytes.length / 1024)} KB, ${xlsx.headers.get('content-disposition')?.split('filename=')[1]})`,
  );

  // --- Publicidad en la portada ---
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const before = (await call('GET', `/api/admin/trips/${trip.id}`, undefined, admin)).data?.trip;
  const promoPut = await call(
    'PUT',
    `/api/admin/trips/${trip.id}/promo`,
    { showOnHome: true, promoLayout: 'wide', promoTitle: 'Prueba de publicidad', promoText: 'Texto de prueba' },
    admin,
  );
  check(promoPut.status === 200, 'Guardar la publicidad del viaje (rectangular, con título)', promoPut.data);
  // Solo prueba la imagen si el viaje no tiene una propia (para no pisar la tuya)
  const img = before?.promoImageId ? null : await call('POST', `/api/admin/trips/${trip.id}/promo-image`, { dataUrl: png }, admin);
  if (img) check(img.status === 201 && !!img.data?.imageId, 'Subir imagen de publicidad', img.data);
  const featured = await call('GET', '/api/trips/featured');
  const card = featured.data?.trips?.find((t: { id: string }) => t.id === trip.id);
  check(card?.promo?.layout === 'wide' && card?.promo?.title === 'Prueba de publicidad', 'La salida aparece en la portada con su publicidad');
  const imageId = img?.data?.imageId ?? before?.promoImageId;
  if (imageId) {
    const pic = await fetch(`${API}/api/public/promo-images/${imageId}`);
    check(pic.status === 200 && (pic.headers.get('content-type') ?? '').startsWith('image/'), 'La imagen se ve desde el sitio público');
  }
  await call('PUT', `/api/admin/trips/${trip.id}/promo`, { showOnHome: false, promoLayout: 'square', promoTitle: null, promoText: null }, admin);
  const hidden = (await call('GET', '/api/trips/featured')).data?.trips?.some((t: { id: string }) => t.id === trip.id);
  check(!hidden, 'Viaje privado: no aparece en la portada');
  // Dejar la publicidad como estaba
  if (img) await call('DELETE', `/api/admin/trips/${trip.id}/promo-image`, undefined, admin);
  await call(
    'PUT',
    `/api/admin/trips/${trip.id}/promo`,
    { showOnHome: before?.showOnHome ?? true, promoLayout: before?.promoLayout ?? 'square', promoTitle: before?.promoTitle ?? null, promoText: before?.promoText ?? null },
    admin,
  );

  // --- Viaje grupal personalizado ---
  const info = (await call('GET', '/api/public/info')).data;
  check(typeof info?.groupMinPeople === 'number', `Grupal: de ${info?.groupMinPeople} a ${info?.groupMaxPeople} personas, ${info?.groupMinDays} días antes`);
  const later = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date(Date.now() + (info.groupMinDays + 2) * 864e5));
  const small = await call('POST', '/api/group-requests', {
    origin: 'Prueba Origen', destination: 'Prueba Destino', date: later, passengers: 2, fullName: 'Prueba Grupo', contactPhone: '0981 999999',
  });
  check(small.status === 400, `Grupo de 2 personas → rechazado ("${small.data?.error}")`);
  const soon = await call('POST', '/api/group-requests', {
    origin: 'Prueba Origen', destination: 'Prueba Destino', date: tomorrowPY(), passengers: info.groupMinPeople, fullName: 'Prueba Grupo', contactPhone: '0981 999999',
  });
  if (info.groupMinDays > 1) check(soon.status === 400, 'Grupo para mañana → rechazado (falta anticipación)');
  const gr = await call('POST', '/api/group-requests', {
    origin: 'Prueba Origen', destination: 'Prueba Destino', date: later, passengers: info.groupMinPeople, fullName: 'Prueba Grupo', contactPhone: '0981 999999',
  });
  check(gr.status === 201, `Pedido grupal de ${info.groupMinPeople} personas → recibido`, gr.data);
  const grList = await call('GET', '/api/admin/group-requests', undefined, admin);
  check(grList.data?.requests?.some((r: { id: string }) => r.id === gr.data?.id), 'Admin ve el pedido en "Grupales"');
  if (gr.data?.id) check((await call('DELETE', `/api/admin/group-requests/${gr.data.id}`, undefined, admin)).status === 200, 'Borrar el pedido grupal de prueba');

  // --- Sugerencias ---
  const sg = await call('POST', '/api/suggestions', { destination: 'Prueba Sugerencia', whenText: 'diciembre' });
  check(sg.status === 201, 'Mandar una sugerencia', sg.data);
  const sgList = await call('GET', '/api/admin/suggestions', undefined, admin);
  const mineSg = sgList.data?.suggestions?.find((x: { destination: string }) => x.destination === 'Prueba Sugerencia');
  check(!!mineSg, 'Admin ve la sugerencia');
  if (mineSg) await call('DELETE', `/api/admin/suggestions/${mineSg.id}`, undefined, admin);

  // --- Gastos y cuentas ---
  const exp = await call('POST', '/api/admin/expenses', { category: 'supplies', description: 'Prueba: cajas de agua', amount: 45000, tripId: trip.id }, admin);
  check(exp.status === 201, 'Cargar un gasto del viaje (insumos)', exp.data);
  const tripExp = await call('GET', `/api/admin/expenses?tripId=${trip.id}`, undefined, admin);
  check(tripExp.data?.expenses?.some((e: { id: string }) => e.id === exp.data?.expense?.id), 'El gasto aparece en las cuentas del viaje');
  const sum = await call('GET', '/api/admin/finance/summary', undefined, admin);
  check(typeof sum.data?.profit === 'number', `Resumen del mes: recaudado ${sum.data?.revenue}, gastos ${sum.data?.expenses}, ganancia ${sum.data?.profit}`);
  const fx = await fetch(`${API}/api/admin/finance/export.xlsx`, { headers: { Authorization: `Bearer ${admin}` } });
  const fb = new Uint8Array(await fx.arrayBuffer());
  check(fx.status === 200 && fb[0] === 0x50 && fb[1] === 0x4b, `Excel de movimientos del mes (${Math.round(fb.length / 1024)} KB)`);
  if (exp.data?.expense?.id) await call('DELETE', `/api/admin/expenses/${exp.data.expense.id}`, undefined, admin);

  // --- Chofer ---
  const dTrip = await call('GET', `/api/driver/trips/${trip.id}`, undefined, driver);
  const p1 = dTrip.data?.passengers?.find((p: { bookingCode: string }) => p.bookingCode === code);
  check(!!p1, `Chofer ve a "${p1?.fullName}" en la lista`, dTrip.data);
  const v1 = await call('POST', `/api/driver/trips/${trip.id}/verify`, { code }, driver);
  check(v1.data?.valid === true, `Verificar ${code} → válido (${v1.data?.passengers?.length} pasajeros)`);
  const board = await call('POST', `/api/driver/passengers/${p1.id}/board`, { boarded: true }, driver);
  check(board.data?.passenger?.boarded === true, 'Chofer marca que subió');

  const loc = await call('POST', `/api/driver/trips/${trip.id}/location`, { lat: -25.2637, lng: -57.5759, speedMps: 15 }, driver);
  check(loc.status === 200, 'Chofer comparte ubicación');
  const aLoc = await call('GET', `/api/admin/trips/${trip.id}/location`, undefined, admin);
  check(aLoc.data?.status === 'in_progress' && aLoc.data?.location?.lat === -25.2637, `Admin ve el bus en el mapa (${aLoc.data?.location?.speed} km/h)`);
  await call('POST', `/api/driver/trips/${trip.id}/stop`, undefined, driver);

  // --- Limpieza ---
  await call('POST', `/api/driver/passengers/${p1.id}/board`, { boarded: false }, driver);
  const busy = await call('DELETE', `/api/admin/trips/${trip.id}`, undefined, admin);
  check(busy.status === 409, 'Un viaje próximo con reservas activas no se puede borrar');
  const testIds: string[] = [];
  for (const c of created) {
    const b = (await call('GET', `/api/admin/bookings?q=${c}`, undefined, admin)).data?.bookings?.[0];
    if (!b) continue;
    testIds.push(b.id);
    if (c === created[0]) {
      const early = await call('DELETE', `/api/admin/bookings/${b.id}`, undefined, admin);
      check(early.status === 409, 'Una reserva activa no se puede borrar (primero se cancela)');
    }
    await call('POST', `/api/admin/bookings/${b.id}/cancel`, { reason: 'Prueba automática' }, admin);
  }
  const final = (await call('GET', `/api/trips/${trip.id}`)).data.available;
  check(final === A, `Reservas de prueba canceladas: vuelven a quedar ${final} lugares`);

  // --- Borrar (limpieza) ---
  const cleanup = await call('GET', '/api/admin/trips/cleanup', undefined, admin);
  check(typeof cleanup.data?.trips === 'number', `Limpieza: ${cleanup.data?.trips} viaje(s) pasado(s) para borrar`);
  let deleted = 0;
  for (const bid of testIds) if ((await call('DELETE', `/api/admin/bookings/${bid}`, undefined, admin)).status === 200) deleted++;
  check(deleted === testIds.length, `Reservas de prueba borradas de la base (${deleted})`);

  console.log(failed ? `\n❌ ${failed} prueba(s) fallaron\n` : '\n🎉 Admin y chofer funcionan\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
