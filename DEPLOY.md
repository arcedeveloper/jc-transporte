# Publicar JC Transporte en internet (costo $0)

Orden: **Neon** (ya está) → **GitHub** → **Render** (backend) → **Vercel** (frontend) → **cron-job.org**.

Tiempo estimado: 45 minutos.

---

## 0. Antes de empezar

- [ ] El proyecto funciona en tu compu (backend en :4000 y frontend en :3000).
- [ ] Cambiaste la contraseña de Neon (Neon → *Branches* → *main* → *Roles* → `neondb_owner` → **Reset password**) y actualizaste tu `backend/.env`.
- [ ] Generaste un `JWT_SECRET` **nuevo** solo para producción:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  Guardalo en un lugar seguro (no lo pegues en ningún chat).

### Opcional: limpiar los datos de prueba

Si querés que la primera reserva real sea `JC-2026-001`, desde `C:\jc-travel\backend`:

```powershell
npx prisma migrate reset
```

Esto **borra todo** y vuelve a cargar el seed (bus, rutas, admin y chofer con `cambiame123`). Después entrá al admin y cambiá las contraseñas y los datos bancarios.

---

## 1. Subir el código a GitHub

En `C:\jc-travel`:

```powershell
git init
git add .
git status
```

Revisá que **no** aparezcan `backend/.env`, `frontend/.env.local` ni `node_modules`. Si está bien:

```powershell
git commit -m "JC Transporte: backend + frontend"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/jc-transporte.git
git push -u origin main
```

(El repo en GitHub tiene que ser **Private** y creado vacío, sin README.)

---

## 2. Backend en Render

1. Entrá a **render.com** con tu cuenta de GitHub.
2. **New +** → **Web Service** → elegí el repo `jc-transporte`.
3. Completá:

   | Campo | Valor |
   |---|---|
   | Name | `jc-transporte-api` |
   | Region | **Virginia (US East)**: la más cercana a la base de Neon en São Paulo |
   | Branch | `main` |
   | Root Directory | *(dejar vacío)* |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run build --workspace backend && npm run db:deploy --workspace backend` |
   | Start Command | `npm run start --workspace backend` |
   | Instance Type | **Free** |

4. **Environment Variables** → agregá una por una:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | tu URL de Neon **con** `-pooler` |
   | `DIRECT_URL` | tu URL de Neon **sin** `-pooler` |
   | `JWT_SECRET` | el secreto **nuevo** de producción |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CORS_ORIGINS` | `http://localhost:3000` (lo actualizamos en el paso 3) |
   | `SEAT_HOLD_MINUTES` | `10` |
   | `PENDING_BOOKING_HOURS` | `24` |

5. En **Advanced** → **Health Check Path**: `/health`
6. **Create Web Service**. Tarda unos 5 minutos.
7. Cuando diga **Live**, copiá la URL (algo como `https://jc-transporte-api.onrender.com`) y abrí `https://jc-transporte-api.onrender.com/health`. Tiene que decir `"ok":true`.

---

## 3. Frontend en Vercel

1. Entrá a **vercel.com** con tu cuenta de GitHub.
2. **Add New…** → **Project** → importá `jc-transporte`.
3. **Root Directory**: tocá *Edit* y elegí **`frontend`**. Framework: **Next.js** (lo detecta solo).
4. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | la URL de Render, **sin** barra al final |

5. **Deploy**. Cuando termine, copiá tu URL (ej: `https://jc-transporte.vercel.app`).
6. Volvé a **Render** → tu servicio → **Environment** → editá `CORS_ORIGINS`:
   ```
   https://jc-transporte.vercel.app,http://localhost:3000
   ```
   Guardá. Render se reinicia solo.

---

## 4. Que Render no se duerma (cron-job.org)

El plan gratis de Render apaga el servidor tras 15 minutos sin visitas, y la primera visita después tarda ~50 segundos. Para evitarlo:

1. Entrá a **cron-job.org** y creá una cuenta.
2. **Create cronjob**:
   - Title: `JC Transporte despierto`
   - URL: `https://jc-transporte-api.onrender.com/health`
   - Schedule: **Every 10 minutes**
3. Guardá.

> Render gratis da 750 horas por mes: alcanza justo para tener **un** servicio prendido todo el mes.

---

## 5. Prueba final

- [ ] Abrí tu URL de Vercel en el celular → buscá un viaje → reservá un asiento.
- [ ] Entrá a `/login` con el admin → **Reservas** → confirmá el pago.
- [ ] La página del pasajero cambia sola a "Confirmada" (en hasta 30 segundos).
- [ ] Entrá a `/login` con el chofer **desde otro celular** → tocá un viaje de hoy → **Compartir ubicación**.
- [ ] En el admin → **En vivo** → ves el bus en el mapa.
- [ ] En el admin → **Ajustes** → cargá los datos bancarios reales y el WhatsApp de la empresa.
- [ ] En el admin → **Usuarios** → cambiá la contraseña del chofer (sigue siendo `cambiame123`).

---

## Si algo falla

| Problema | Causa probable |
|---|---|
| Render: `Environment variables inválidas` | Falta `DATABASE_URL`, `DIRECT_URL` o `JWT_SECRET` (mínimo 32 caracteres) |
| Render: `P1001 Can't reach database` | `DIRECT_URL` mal copiada, o agregale `&connect_timeout=30` |
| La página carga pero dice "No pudimos conectar con el servidor" | `NEXT_PUBLIC_API_URL` mal escrita en Vercel (hay que hacer **Redeploy** después de cambiarla) o Render dormido |
| En la consola del navegador: error de **CORS** | La URL de Vercel no está en `CORS_ORIGINS` de Render |
| El chofer toca "Compartir ubicación" y no pasa nada | Tiene la ubicación del celular apagada, o le negó el permiso al navegador |
