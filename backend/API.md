# API del backend

## API de autenticación (paso 2)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Usuario de la sesión (header `Authorization: Bearer <token>`) |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` |

El login permite 10 intentos cada 15 minutos por IP.

## API pública de reservas (paso 3)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/trips/locations` | Ciudades de origen y destino |
| GET | `/api/trips/search?date=AAAA-MM-DD&origin=&destination=` | Viajes del día con asientos libres |
| GET | `/api/trips/:id` | Viaje + lugares (capacidad, ocupados, libres, cerrado) |
| POST | `/api/bookings` | `{ tripId, contactPhone, passengers[] }` reserva pendiente de pago |
| GET | `/api/bookings/:code?tel=` | Consulta una reserva (pide el teléfono de contacto) |

Evento Socket.io en la sala `trip:<id>`: `trip:places` (lugares libres en vivo).

Tarea automática: cada hora se cancelan las reservas impagas vencidas.

Prueba rápida: con `npm run dev` corriendo, ejecutá `npm run test:reservas`.

## Portada, viaje grupal y sugerencias (público)

| Ruta | Qué hace |
|---|---|
| `GET /api/trips/featured` | Próximos viajes publicados en la portada, con lugares libres y publicidad `{ layout, title, text, imageId }` |
| `GET /api/public/promo-images/:id` | Imagen de publicidad |
| `POST /api/group-requests` | Pedido de viaje grupal `{ origin, destination, date, returnDate?, preferredTime, passengers, fullName, contactPhone, notes? }`. Valida tamaño del grupo y anticipación |
| `POST /api/suggestions` | Sugerencia `{ destination, origin?, whenText?, message?, name?, contactPhone? }` |

## API del admin (paso 4) — requiere token de admin

| Ruta | Qué hace |
|---|---|
| `GET /api/admin/dashboard` | Viajes de hoy, reservas por estado, recaudación, gráficos |
| `/api/admin/buses` | Listar, crear, editar (nombre, chapa, lugares, descripción), fotos, borrar (si no tiene viajes próximos; se lleva sus viajes viejos) |
| `/api/admin/routes` | Listar, crear, editar, borrar |
| `/api/admin/trips` | Listar, ver, crear, editar, borrar · `POST /:id/close` (confirmar viaje) · `POST /:id/reopen` · `GET /:id/checklist.xlsx` · `POST /:id/cancel` · `POST /:id/complete` · `GET /:id/location` · `DELETE /:id` (pasado: con sus reservas; futuro: solo sin reservas activas) · `GET/POST /cleanup` (viajes pasados) |
| `/api/admin/bookings` | Listar con filtros y búsqueda · `POST /:id/confirm` · `POST /:id/cancel` · `DELETE /:id` (canceladas o de viajes que ya salieron) · `GET/POST /cleanup` |
| `/api/admin/settings` | Ver y guardar datos bancarios y WhatsApp |
| `/api/admin/users` | Listar, crear, editar y borrar admins/choferes |
| `/api/admin/trips/:id/promo…` | `PUT /promo` (mostrar en portada, formato, título, texto) · `POST /promo-image` · `DELETE /promo-image` · `POST /promo/apply-route` |
| `/api/admin/group-requests` | Listar · `GET /summary` · `PATCH /:id` (estado) · `POST /:id/trip` (viaje armado) · `POST /:id/notified` · `DELETE /:id` |
| `/api/admin/suggestions` | Listar con destinos más pedidos · `POST /read-all` · `POST /cleanup` · `DELETE /:id` |
| `/api/admin/expenses` | Gastos: `GET ?month=AAAA-MM` o `?tripId=` · `POST` `{ category, amount, description?, date?, tripId?, driverId? }` · `DELETE /:id` |
| `/api/admin/finance` | `GET /summary?month=` (recaudado, gastos, ganancia) · `GET /export.xlsx?month=` (movimientos + por viaje) |
| `PUT /api/admin/settings/groups` | Personas mínimas y máximas del viaje grupal, días de anticipación |

## API del chofer (paso 4) — requiere token de chofer

| Ruta | Qué hace |
|---|---|
| `GET /api/driver/trips` | Viajes de hoy asignados (y los que están en curso) |
| `GET /api/driver/trips/:id` | Lista de pasajeros |
| `POST /api/driver/trips/:id/location` | `{ lat, lng, speedMps }` — el primero pasa el viaje a "en curso" |
| `POST /api/driver/trips/:id/stop` | Dejar de compartir |
| `POST /api/driver/trips/:id/verify` | `{ code }` ¿el código es válido para este viaje? |
| `POST /api/driver/passengers/:id/board` | `{ boarded }` marcar que subió |

Socket.io: para recibir `bus:location`, el admin se conecta con `auth: { token }` y emite `tracking:join`.

Prueba rápida: con `npm run dev` corriendo, ejecutá `npm run test:admin`.
