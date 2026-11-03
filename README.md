# JC Transporte

Pasajes de bus online con asiento elegido en un mapa en vivo, pago por transferencia y ubicación del bus en tiempo real.

```
jc-travel/
├── backend/    Express + Prisma + Socket.io   → Render   (ver backend/API.md)
├── frontend/   Next.js 15 + Tailwind v4       → Vercel
└── DEPLOY.md   Guía para publicar ($0/mes)
```

## Levantar todo en tu compu

Necesitás Node.js 20 o más. Usá **dos terminales**.

**La primera vez**, desde la carpeta principal:

```powershell
cd C:\jc-travel
npm install
copy frontend\.env.example frontend\.env.local
```

**Terminal 1 — backend:**

```powershell
cd C:\jc-travel\backend
npm run dev
```

**Terminal 2 — frontend:**

```powershell
cd C:\jc-travel\frontend
npm run dev
```

Abrí **http://localhost:3000**.

| Quién | Dónde entra |
|---|---|
| Pasajero | http://localhost:3000 (no necesita cuenta) |
| Admin | http://localhost:3000/login con `admin@jctransporte.com.py` (si tu base es de antes del cambio de nombre: `admin@jctravel.com.py`; cambialo en Admin → Usuarios → Editar) |
| Chofer | http://localhost:3000/login con `chofer@jctransporte.com.py` |

> La ubicación del chofer necesita **https**, así que en el celular se prueba con la app publicada (ver DEPLOY.md). En la compu, `localhost` sí funciona.

## Qué hace la app

**Pasajero:** busca viajes, ve cuántos lugares quedan (se actualiza en vivo), elige cuántos viajan, completa nombre y cédula de cada uno y recibe un boleto con los datos bancarios para copiar con un toque y un botón de WhatsApp con el mensaje listo. La página se actualiza sola cuando el pago se confirma. En "Mi reserva" puede volver a verla con su código y su teléfono.

**Portada con publicidad:** no hay buscador. La portada muestra las próximas salidas como tarjetas con imagen (flyer o logo, cuadrada o rectangular), título y texto. Se cargan en Admin → Viajes → (un viaje) → *Publicidad en la portada*. Los viajes nuevos de la misma ruta copian la imagen y los textos solos. La persona toca la tarjeta, reserva y paga como siempre.

**Viaje grupal personalizado:** la última tarjeta. Un grupo de 12 a 17 personas pide su destino y fecha (con 5 días de anticipación como mínimo). No paga nada todavía. En Admin → Grupales le escribís por WhatsApp, armás el viaje (queda *privado*, no sale en la portada) y le mandás el enlace para que cada uno reserve y pague. Las reglas se cambian en Ajustes.

**Sugerencias:** en la portada, "¿A dónde te gustaría viajar?". En Admin → Sugerencias se ven todas y los destinos más pedidos.

**Cuentas:** cada viaje tiene "Cuentas del viaje" (recaudado, gastos y ganancia) donde se carga el sueldo del chofer, insumos (agua, obsequios), reparaciones o imprevistos, combustible u otros. En el Panel se ven recaudado, gastos y ganancia del mes, los gastos generales, y se descarga un Excel con todos los movimientos y un resumen por viaje.

**Chofer:** el chofer responsable se puede elegir al crear el viaje o al "Confirmar viaje". En su celular ve solo el botón "Compartir ubicación" y la lista de pasajeros que pagaron.

**Todo por WhatsApp:** la app no usa email. El pasajero deja su WhatsApp al reservar, y desde el admin se le manda la confirmación, el recordatorio de pago o el aviso de cancelación con un toque.

**Admin:** panel con pagos pendientes, recaudación y ocupación; confirma o cancela reservas y avisa al pasajero por WhatsApp con el mensaje ya escrito; crea viajes, incluso una semana entera de una vez; **confirma el viaje** para cerrar las reservas aunque no esté lleno; descarga la **planilla Excel** de pasajeros pagados para imprimir y tildar; ve los buses en el mapa en vivo; carga los datos bancarios y los usuarios.

**Chofer:** ve sus viajes de hoy, toca **Compartir ubicación** (la pantalla queda encendida sola), verifica códigos y marca quién subió.

## Decisiones de diseño

**Sin asientos numerados, con cupo.** Cada bus tiene una cantidad de lugares por viaje (17 por defecto, se edita en Admin → Buses). Al reservar se bloquea el viaje en la base de datos (`SELECT … FOR UPDATE`): si dos personas reservan al mismo tiempo, la segunda espera y ve los lugares ya descontados, así nunca se vende de más. **Solo las reservas confirmadas (pagadas) ocupan lugar**: el lugar es del primero que paga. Al confirmar un pago se vuelve a bloquear el viaje y, si ya está completo, la app no deja confirmar y avisa. Las pendientes vencen solas a las 24 h.

**Confirmar viaje.** El admin puede cerrar las reservas de un viaje en cualquier momento. Se puede reabrir.

**Montos en guaraníes enteros.** Sin decimales, sin errores de redondeo.

**Login sin NextAuth.** El backend ya emite el JWT; el frontend lo guarda y lo manda en cada pedido. Hace lo mismo que NextAuth con un proveedor de credenciales, con menos piezas que configurar.

**Componentes propios en vez de shadcn/ui.** Botones, campos y ventanas están en `frontend/src/components/ui.tsx`, con el mismo diseño en toda la app y sin pasos de instalación extra.

**Gráfico sin Recharts.** El gráfico de recaudación es un SVG simple: liviano y sin problemas de compatibilidad con React 19.

**Opiniones de pasajeros.** La sección existe pero está vacía. Cargá opiniones **reales** en `frontend/src/components/landing.tsx` (lista `testimonials`) y aparece sola.

## Diseño visual

- **Cartel de destino LED** en la portada: el elemento que identifica a la marca.
- **Barlow Condensed** para títulos (inspirada en carteles de ruta) y **Atkinson Hyperlegible** para el texto (diseñada para leerse fácil).
- Colores: azul ruta `#12355B`, ámbar `#FFB000`, verde monte `#1F7A4D` (libre), tierra colorada `#B3412A` (ocupado).
- Los colores están en `frontend/src/app/globals.css`: cambiando esos valores cambia toda la app.

## Pruebas automáticas del backend

Con el backend corriendo:

```powershell
cd C:\jc-travel\backend
npm run test:reservas
npm run test:admin
```
