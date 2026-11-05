# Publicar JC Transporte en internet (costo $0)

Orden: **Neon** (ya está) → **GitHub** → **Render** (backend) → **GitHub Pages** (la página) → **cron-job.org**.

Tiempo estimado: 45 minutos.

---

## 0. Antes de empezar

- [ ] Corriste la última migración (la de la cédula del pedido grupal), desde `C:\jc-transporte\backend`:
  ```powershell
  npx prisma migrate dev --name cedula_grupal
  ```
- [ ] **Probá que todo compila** igual que en el servidor. Desde `C:\jc-transporte`:
  ```powershell
  npm run build --workspace backend
  npm run build --workspace frontend
  ```
  Si alguno tira error, copiámelo antes de seguir: es mejor arreglarlo acá que en Render.
- [ ] Cambiaste la contraseña de Neon (Neon → *Branches* → *main* → *Roles* → `neondb_owner` → **Reset password**) y actualizaste las dos URLs de tu `backend/.env`.
- [ ] Generaste un `JWT_SECRET` **nuevo** solo para producción:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  Guardalo en un lugar seguro (no lo pegues en ningún chat).

### Limpiar los datos de prueba

La base de Neon que usaste para probar es la misma que va a usar la página. Antes de lanzar, borrá lo de prueba **desde el admin**: Reservas (canceladas → borrar), Viajes (borrar viajes de prueba), Panel → gastos de prueba. Así mantenés tus buses, rutas, usuarios y ajustes.

---

## 1. Subir el código a GitHub

En `C:\jc-transporte`:

```powershell
git init
git add .
git status
```

Revisá que **no** aparezcan `backend/.env`, `frontend/.env.local` ni `node_modules`, y que **sí** aparezca la carpeta `backend/prisma/migrations` (Render la necesita). Si está bien:

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

## 3. La página en GitHub Pages

1. En GitHub → repo `jc-transporte` → **Settings → General** → abajo de todo, **Danger Zone** → **Change visibility → Public**.
2. **Settings → Secrets and variables → Actions** → pestaña **Variables** → **New repository variable**:
   - Name: `API_URL`
   - Value: la URL de Render, **sin** barra al final (ej: `https://jc-transporte-api.onrender.com`)
3. **Settings → Pages** → en **Source** elegí **GitHub Actions**.
4. Pestaña **Actions** → **Publicar página** → **Run workflow**. Tarda unos 3 minutos.
5. Tu página queda en `https://arcedeveloper.github.io/jc-transporte/`
6. Volvé a **Render** → tu servicio → **Environment** → editá `CORS_ORIGINS`:
   ```
   https://arcedeveloper.github.io,http://localhost:3000
   ```
   Guardá. Render se reinicia solo.

Login del admin y del chofer: `https://arcedeveloper.github.io/jc-transporte/login/`

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

- [ ] Abrí `https://arcedeveloper.github.io/jc-transporte/` en el celular → tocá una salida → reservá un lugar.
- [ ] Entrá a `/login` con el admin → **Reservas** → confirmá el pago. La página del pasajero cambia sola a "Confirmada".
- [ ] Entrá a `/login` con el chofer **desde otro celular** → tocá el viaje de hoy → **Compartir ubicación**.
- [ ] En el admin → **En vivo** → ves el bus en el mapa.
- [ ] **Ajustes → Empresa**: datos bancarios reales, WhatsApp, Instagram y TikTok.
- [ ] **Ajustes → Usuarios**: cambiá correo y contraseña del admin y del chofer.

---

## Cuando cambies algo después

Cada vez que hagas cambios en tu compu:

```powershell
cd C:\jc-transporte
git add .
git commit -m "lo que cambiaste"
git push
```

Render y GitHub Pages se actualizan solos en unos minutos. Si el cambio trae migración nueva, Render la aplica sola al publicar.

---

## Si algo falla

| Problema | Causa probable |
|---|---|
| Render: `Environment variables inválidas` | Falta `DATABASE_URL`, `DIRECT_URL` o `JWT_SECRET` (mínimo 32 caracteres) |
| Render: `P1001 Can't reach database` | `DIRECT_URL` mal copiada, o agregale `&connect_timeout=30` |
| La página carga pero dice "No pudimos conectar con el servidor" | La variable `API_URL` de GitHub está mal escrita (después de corregirla: **Actions → Publicar página → Run workflow**) o Render dormido |
| En la consola del navegador: error de **CORS** | Falta `https://arcedeveloper.github.io` en `CORS_ORIGINS` de Render |
| El chofer toca "Compartir ubicación" y no pasa nada | Tiene la ubicación del celular apagada, o le negó el permiso al navegador |
