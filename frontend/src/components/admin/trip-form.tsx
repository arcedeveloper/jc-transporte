'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button, Field, Input, Modal, NumberInput, Select, cn } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { addDaysStr, fromIsoPY, numberToInput, parseNumber, toIsoPY, todayPY } from '@/lib/format';
import { resizeImage } from '@/lib/image';
import type { AdminBus, AdminRoute, AdminTrip, AdminUser, PromoLayout } from '@/lib/types';
import { toast } from '@/store/toast';
import { RouteInline } from './route-inline';

const NEW_ROUTE = '__new';

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

type Form = {
  routeId: string;
  origin: string;
  destination: string;
  hours: string;
  minutes: string;
  busId: string;
  driverId: string;
  date: string;
  time: string;
  price: string;
  days: string;
  showOnHome: boolean;
  promoLayout: PromoLayout;
  promoTitle: string;
  promoText: string;
};

/**
 * Crear o editar un viaje. Al crear se hace todo de una vez:
 * ruta (existente o nueva), datos del viaje y publicidad para la portada (imagen, formato, textos).
 */
export function TripForm({
  open,
  onClose,
  onSaved,
  trip,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** @deprecated ya no se usa: la publicidad se carga en el mismo formulario */
  onCreated?: (tripId: string) => void;
  trip?: AdminTrip | null;
}) {
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [buses, setBuses] = useState<AdminBus[]>([]);
  const [drivers, setDrivers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<Form>(blank());
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setImage(null);
    void Promise.all([
      api<{ routes: AdminRoute[] }>('/api/admin/routes', { auth: true }),
      api<{ buses: AdminBus[] }>('/api/admin/buses', { auth: true }),
      api<{ users: AdminUser[] }>('/api/admin/users?role=driver', { auth: true }),
    ])
      .then(([r, b, d]) => {
        const activeRoutes = r.routes.filter((x) => x.isActive || x.id === trip?.routeId);
        const activeBuses = b.buses.filter((x) => x.isActive || x.id === trip?.busId);
        setRoutes(activeRoutes);
        setBuses(activeBuses);
        setDrivers(d.users.filter((u) => u.isActive));
        if (trip) {
          const { date, time } = fromIsoPY(trip.departureTime);
          setForm({
            ...blank(),
            routeId: trip.routeId,
            busId: trip.busId,
            driverId: trip.driverId ?? '',
            date,
            time,
            price: numberToInput(trip.price),
            showOnHome: trip.showOnHome,
          });
        } else {
          const first = activeRoutes[0];
          setForm({
            ...blank(),
            routeId: first?.id ?? NEW_ROUTE,
            busId: activeBuses[0]?.id ?? '',
            driverId: d.users.find((u) => u.isActive)?.id ?? '',
            date: addDaysStr(todayPY(), 1),
            price: first ? numberToInput(first.basePrice) : '',
          });
        }
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, [open, trip]);

  // Liberar la vista previa de la imagen
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const isNewRoute = form.routeId === NEW_ROUTE;
  const route = routes.find((r) => r.id === form.routeId);
  const places = useMemo(
    () => [...new Set(routes.flatMap((r) => [r.origin, r.destination]))].sort((a, b) => a.localeCompare(b, 'es')),
    [routes],
  );
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function setRoute(routeId: string) {
    const r = routes.find((x) => x.id === routeId);
    setForm((f) => ({ ...f, routeId, price: r ? numberToInput(r.basePrice) : f.price }));
  }

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('El archivo no es una imagen');
    setImage({ file, url: URL.createObjectURL(file) });
    if (fileInput.current) fileInput.current.value = '';
  }

  /** Ruta elegida o creada en el momento (si ya existe con ese nombre, se usa esa). */
  async function resolveRoute(price: number): Promise<{ id: string; durationMinutes: number } | null> {
    if (!isNewRoute) return route ? { id: route.id, durationMinutes: route.durationMinutes } : null;
    const origin = form.origin.trim();
    const destination = form.destination.trim();
    if (origin.length < 2 || destination.length < 2) {
      toast.error('Escribí el origen y el destino de la ruta nueva');
      return null;
    }
    const existing = routes.find((r) => norm(r.origin) === norm(origin) && norm(r.destination) === norm(destination));
    if (existing) return { id: existing.id, durationMinutes: existing.durationMinutes };
    const durationMinutes = Number(form.hours || 0) * 60 + Number(form.minutes || 0);
    if (durationMinutes <= 0) {
      toast.error('Poné cuánto dura el viaje (horas y minutos)');
      return null;
    }
    const r = await api<{ route: AdminRoute }>('/api/admin/routes', {
      method: 'POST',
      auth: true,
      body: { origin, destination, durationMinutes, basePrice: price },
    });
    return { id: r.route.id, durationMinutes: r.route.durationMinutes };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = parseNumber(form.price);
    if (!form.date || !form.time || !price) return toast.error('Completá fecha, hora y precio.');
    if (!form.busId) return toast.error('Elegí el bus');
    setSaving(true);
    try {
      // ---- Editar ----
      if (trip) {
        await api(`/api/admin/trips/${trip.id}`, {
          method: 'PATCH',
          auth: true,
          body: {
            busId: form.busId,
            driverId: form.driverId || null,
            departureTime: toIsoPY(form.date, form.time),
            arrivalTime: route
              ? new Date(new Date(toIsoPY(form.date, form.time)).getTime() + route.durationMinutes * 60000).toISOString()
              : undefined,
            price,
          },
        });
        toast.success('Viaje actualizado');
        onSaved();
        onClose();
        return;
      }

      // ---- Crear: ruta → viajes → publicidad ----
      const r = await resolveRoute(price);
      if (!r) return;

      const days = Math.min(60, Math.max(1, Number(form.days) || 1));
      const failures: string[] = [];
      const created: string[] = [];
      for (let i = 0; i < days; i++) {
        const date = addDaysStr(form.date, i);
        try {
          const res = await api<{ trip: { id: string } }>('/api/admin/trips', {
            method: 'POST',
            auth: true,
            body: {
              routeId: r.id,
              busId: form.busId,
              driverId: form.driverId || null,
              departureTime: toIsoPY(date, form.time),
              price,
              showOnHome: form.showOnHome,
            },
          });
          created.push(res.trip.id);
        } catch (err) {
          failures.push(`${date}: ${errorMessage(err)}`);
        }
      }

      // Publicidad: si se cargó algo, se aplica a todos los viajes creados
      const hasPromo = !!image || form.promoTitle.trim() || form.promoText.trim() || form.promoLayout !== 'square';
      if (created.length && form.showOnHome && hasPromo) {
        try {
          let imageId: string | undefined;
          if (image) {
            const dataUrl = await resizeImage(image.file, 1600, 0.85);
            const up = await api<{ imageId: string }>(`/api/admin/trips/${created[0]}/promo-image`, {
              method: 'POST',
              auth: true,
              body: { dataUrl },
            });
            imageId = up.imageId;
          }
          for (const id of created) {
            await api(`/api/admin/trips/${id}/promo`, {
              method: 'PUT',
              auth: true,
              body: {
                showOnHome: true,
                promoLayout: form.promoLayout,
                promoTitle: form.promoTitle.trim() || null,
                promoText: form.promoText.trim() || null,
                ...(imageId ? { promoImageId: imageId } : {}),
              },
            });
          }
        } catch (err) {
          toast.error(`El viaje se creó, pero la imagen no se pudo guardar: ${errorMessage(err)}. Subila desde el viaje.`);
        }
      }

      if (created.length) {
        toast.success(
          created.length === 1
            ? form.showOnHome
              ? 'Viaje creado y publicado en la portada'
              : 'Viaje creado'
            : `${created.length} viajes creados`,
        );
      }
      if (failures.length) toast.error(`No se pudieron crear ${failures.length}: ${failures[0]}`);
      onSaved();
      if (created.length) onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const routeLabel = isNewRoute ? `${form.origin.trim() || 'Origen'} › ${form.destination.trim() || 'Destino'}` : route ? `${route.origin} › ${route.destination}` : '';

  return (
    <Modal open={open} onClose={onClose} title={trip ? 'Editar viaje' : 'Nuevo viaje'}>
      {buses.length === 0 ? (
        <p className="text-niebla">Primero cargá al menos un bus activo en Ajustes → Buses.</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          {/* ---------- Ruta ---------- */}
          <div>
          {trip ? (
            <Field label="Ruta">
              <p className="flex h-12 items-center rounded-xl border-2 border-linea bg-papel px-3.5 font-bold text-tinta">
                {trip.route.origin} › {trip.route.destination}
              </p>
            </Field>
          ) : (
            <Select label="Ruta" value={form.routeId} onChange={(e) => setRoute(e.target.value)}>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.origin} › {r.destination}
                </option>
              ))}
              <option value={NEW_ROUTE}>➕ Nueva ruta…</option>
            </Select>
          )}
          {!trip && route && (
            <RouteInline
              key={route.id}
              route={route}
              onUpdated={(r) => {
                setRoutes((list) => list.map((x) => (x.id === r.id ? r : x)));
                setForm((f) => ({ ...f, price: numberToInput(r.basePrice) }));
              }}
              onDeleted={(id) => {
                const rest = routes.filter((x) => x.id !== id);
                setRoutes(rest);
                setRoute(rest[0]?.id ?? NEW_ROUTE);
              }}
            />
          )}
          </div>

          {isNewRoute && (
            <div className="space-y-3 rounded-xl bg-papel p-3">
              <datalist id="trip-form-places">
                {places.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Origen"
                  list="trip-form-places"
                  placeholder="Fernando de la Mora"
                  value={form.origin}
                  onChange={(e) => set('origin', e.target.value)}
                  required
                />
                <Input
                  label="Destino"
                  list="trip-form-places"
                  placeholder="Salto Cristal"
                  value={form.destination}
                  onChange={(e) => set('destination', e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Duración: horas" type="number" min={0} value={form.hours} onChange={(e) => set('hours', e.target.value)} />
                <Input label="Minutos" type="number" min={0} max={59} value={form.minutes} onChange={(e) => set('minutes', e.target.value)} />
              </div>
              <p className="text-sm text-niebla">La ruta se guarda sola y queda lista para los próximos viajes.</p>
            </div>
          )}

          {/* ---------- Viaje ---------- */}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Bus" value={form.busId} onChange={(e) => set('busId', e.target.value)}>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.capacity} lugares)
                </option>
              ))}
            </Select>
            <Select label="Chofer" value={form.driverId} onChange={(e) => set('driverId', e.target.value)}>
              <option value="">Sin asignar</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            <Input label="Hora de salida" type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </div>
          <NumberInput
            label="Precio por pasajero (Gs.)"
            placeholder="120.000"
            value={form.price}
            onValueChange={(v) => set('price', v)}
            hint={route ? `Llega en ${Math.round(route.durationMinutes / 6) / 10} h aprox.` : undefined}
          />
          {!trip && (
            <Input
              label="Crear para cuántos días seguidos"
              type="number"
              min={1}
              max={60}
              value={form.days}
              onChange={(e) => set('days', e.target.value)}
              hint="Ej: 7 crea el mismo horario toda la semana."
            />
          )}

          {/* ---------- Publicidad ---------- */}
          {!trip && (
            <div className="rounded-xl border-2 border-linea p-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-ruta"
                  checked={form.showOnHome}
                  onChange={(e) => set('showOnHome', e.target.checked)}
                />
                <span>
                  <span className="block font-bold">Mostrar en la portada</span>
                  <span className="text-sm text-niebla">Sacalo para un viaje privado.</span>
                </span>
              </label>

              {form.showOnHome && (
                <div className="mt-4 space-y-4">
                  <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
                  {image ? (
                    <div className="relative mx-auto max-w-xs overflow-hidden rounded-xl bg-ruta">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt="Vista previa del banner"
                        className={cn('w-full object-contain', form.promoLayout === 'wide' ? 'aspect-[2/1]' : 'aspect-square')}
                      />
                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-tierra shadow"
                        aria-label="Quitar imagen"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-linea text-niebla hover:border-ruta hover:text-ruta"
                    >
                      <ImagePlus className="size-6" />
                      <span className="font-bold">Subir imagen del banner</span>
                      <span className="text-xs">Si no subís una, se usa la del último viaje de esta ruta</span>
                    </button>
                  )}
                  {image && (
                    <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                      <ImagePlus className="size-4" /> Cambiar imagen
                    </Button>
                  )}

                  <div>
                    <p className="text-sm font-bold">Formato</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Formato del banner">
                      {(
                        [
                          ['square', 'Cuadrado', '1080 × 1080'],
                          ['wide', 'Rectangular', '1600 × 800'],
                        ] as [PromoLayout, string, string][]
                      ).map(([k, label, hint]) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={form.promoLayout === k}
                          onClick={() => set('promoLayout', k)}
                          className={cn(
                            'flex min-w-0 flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-center',
                            form.promoLayout === k ? 'border-ruta bg-ruta-50' : 'border-linea bg-white',
                          )}
                        >
                          <span className={cn('shrink-0 rounded bg-ruta/70', k === 'square' ? 'size-7' : 'h-5 w-10')} aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold leading-tight">{label}</span>
                            <span className="block text-xs leading-tight text-niebla">{hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    label="Título (opcional)"
                    placeholder={routeLabel}
                    maxLength={60}
                    value={form.promoTitle}
                    onChange={(e) => set('promoTitle', e.target.value)}
                  />
                  <Field label="Texto (opcional)" htmlFor="trip-promo-text" hint="Qué incluye, punto de salida, vuelta…">
                    <textarea
                      id="trip-promo-text"
                      rows={2}
                      maxLength={300}
                      value={form.promoText}
                      onChange={(e) => set('promoText', e.target.value)}
                      className="w-full rounded-xl border-2 border-linea bg-white px-3.5 py-2.5 text-base focus:border-ruta focus:outline-none"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={saving}>
            {trip ? 'Guardar cambios' : form.showOnHome ? 'Crear y publicar viaje' : 'Crear viaje'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

function blank(): Form {
  return {
    routeId: '',
    origin: '',
    destination: '',
    hours: '',
    minutes: '0',
    busId: '',
    driverId: '',
    date: '',
    time: '07:00',
    price: '',
    days: '1',
    showOnHome: true,
    promoLayout: 'square',
    promoTitle: '',
    promoText: '',
  };
}
