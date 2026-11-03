'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageTitle } from '@/components/admin/bits';
import { Button, Empty, ErrorBox, Input, Modal, NumberInput, Spinner, cn } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { duration, gs, numberToInput, parseNumber } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { AdminRoute } from '@/lib/types';
import { toast } from '@/store/toast';

const empty = { origin: '', destination: '', distanceKm: '', hours: '', minutes: '0', basePrice: '', isActive: true, withReturn: true };

export default function RoutesAdmin() {
  const { data, error, loading, reload } = useQuery(() => api<{ routes: AdminRoute[] }>('/api/admin/routes', { auth: true }));
  const [editing, setEditing] = useState<AdminRoute | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Mensaje del servidor cuando la ruta tiene reservas viejas: pide confirmar escribiendo BORRAR */
  const [forceWarning, setForceWarning] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  async function remove(force = false) {
    if (!editing || editing === 'new') return;
    setDeleting(true);
    try {
      const r = await api<{ deletedTrips: number; deletedBookings: number }>(
        `/api/admin/routes/${editing.id}${force ? '?force=true' : ''}`,
        { method: 'DELETE', auth: true },
      );
      const parts = [r.deletedTrips && `${r.deletedTrips} viaje(s)`, r.deletedBookings && `${r.deletedBookings} reserva(s)`].filter(Boolean);
      toast.success(parts.length ? `Ruta borrada junto con ${parts.join(' y ')}.` : 'Ruta borrada.');
      setEditing(null);
      void reload(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'HAS_BOOKINGS') {
        setForceWarning(err.message);
      } else {
        toast.error(errorMessage(err));
        setConfirmDelete(false);
      }
    } finally {
      setDeleting(false);
    }
  }

  function open(r: AdminRoute | 'new') {
    setEditing(r);
    setConfirmDelete(false);
    setForceWarning(null);
    setTyped('');
    if (r === 'new') setForm(empty);
    else
      setForm({
        origin: r.origin,
        destination: r.destination,
        distanceKm: numberToInput(r.distanceKm),
        hours: String(Math.floor(r.durationMinutes / 60)),
        minutes: String(r.durationMinutes % 60),
        basePrice: numberToInput(r.basePrice),
        isActive: r.isActive,
        withReturn: false,
      });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      distanceKm: parseNumber(form.distanceKm),
      durationMinutes: Number(form.hours || 0) * 60 + Number(form.minutes || 0),
      basePrice: parseNumber(form.basePrice),
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      if (editing === 'new') {
        await api('/api/admin/routes', { method: 'POST', auth: true, body });
        const exists = data?.routes.some(
          (r) => r.origin.toLowerCase() === body.destination.toLowerCase() && r.destination.toLowerCase() === body.origin.toLowerCase(),
        );
        if (form.withReturn && !exists) {
          await api('/api/admin/routes', {
            method: 'POST',
            auth: true,
            body: { ...body, origin: body.destination, destination: body.origin },
          });
          toast.success(`Rutas creadas: ida y vuelta. Ya aparecen ${body.origin} y ${body.destination} en el buscador.`);
        } else {
          toast.success(`Ruta creada. Ya aparece en el buscador.`);
        }
      } else if (editing) {
        await api(`/api/admin/routes/${editing.id}`, { method: 'PATCH', auth: true, body });
        toast.success('Ruta guardada');
      }
      setEditing(null);
      void reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/admin/viajes" className="mb-3 inline-flex items-center gap-1.5 font-bold text-ruta hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Volver a Viajes
      </Link>
      <PageTitle title="Rutas">
        <Button onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden /> Nueva ruta
        </Button>
      </PageTitle>
      <p className="-mt-3 mb-5 max-w-prose text-niebla">
        Las ciudades que los pasajeros eligen en el buscador salen de acá. Para sumar una ciudad, creá una ruta nueva (se puede crear la vuelta en el mismo paso). Para que se pueda reservar, después cargá horarios en Viajes.
      </p>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} onRetry={() => void reload()} />
      ) : !data?.routes.length ? (
        <Empty title="No hay rutas" />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
          {data.routes.map((r) => (
            <li key={r.id} className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-4', !r.isActive && 'opacity-60')}>
              <span>
                <span className="font-display text-2xl font-bold">
                  {r.origin} › {r.destination}
                </span>
                <span className="block text-sm text-niebla">
                  {r.distanceKm > 0 && `${r.distanceKm} km, `}{duration(r.durationMinutes)}, {gs(r.basePrice)}
                  {!r.isActive && ', desactivada'}
                </span>
              </span>
              <Button variant="outline" size="sm" onClick={() => open(r)}>
                <Pencil className="size-4" /> Editar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nueva ruta' : 'Editar ruta'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Origen" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required />
            <Input label="Destino" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberInput label="Km (opcional)" decimals value={form.distanceKm} onValueChange={(v) => setForm({ ...form, distanceKm: v })} />
            <Input label="Horas" type="number" min={0} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
            <Input label="Minutos" type="number" min={0} max={59} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          </div>
          <NumberInput label="Precio base (Gs.)" placeholder="120.000" value={form.basePrice} onValueChange={(v) => setForm({ ...form, basePrice: v })} required />
          {editing === 'new' && (
            <label className="flex items-center gap-2 rounded-xl bg-ruta-50 p-3 font-bold text-ruta">
              <input type="checkbox" className="size-5 accent-ruta" checked={form.withReturn} onChange={(e) => setForm({ ...form, withReturn: e.target.checked })} />
              Crear también la vuelta{form.origin && form.destination ? ` (${form.destination} › ${form.origin})` : ''}
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-5 accent-ruta" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Activa (aparece en el buscador)
          </label>
          <Button type="submit" size="lg" className="w-full" loading={saving}>
            Guardar ruta
          </Button>

          {editing && editing !== 'new' && (
            <div className="border-t border-linea pt-4">
              {!confirmDelete ? (
                <Button variant="ghost" className="w-full text-tierra hover:bg-tierra-50" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" /> Borrar ruta
                </Button>
              ) : forceWarning ? (
                <div className="space-y-3 rounded-2xl border-2 border-tierra bg-tierra-50 p-4">
                  <p className="font-bold text-tierra">Borrado definitivo</p>
                  <p className="text-sm">{forceWarning}</p>
                  <p className="text-sm">
                    Esto <strong>no se puede deshacer</strong>. Si preferís conservar el historial, desactivá la ruta en vez de borrarla. Para borrar igual, escribí <strong>BORRAR</strong>:
                  </p>
                  <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="BORRAR" aria-label="Escribí BORRAR para confirmar" />
                  <div className="flex gap-2">
                    <Button variant="danger" disabled={typed.trim().toUpperCase() !== 'BORRAR'} loading={deleting} onClick={() => void remove(true)}>
                      Borrar todo
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setForceWarning(null);
                        setConfirmDelete(false);
                        setTyped('');
                      }}
                    >
                      Volver
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border-2 border-tierra/30 p-4">
                  <p className="font-bold text-tierra">
                    ¿Borrar {editing.origin} › {editing.destination}?
                  </p>
                  <p className="text-sm text-niebla">
                    {editing._count?.trips
                      ? `También se borran sus ${editing._count.trips} viaje(s) y las reservas canceladas que tengan. Esto no se puede deshacer.`
                      : 'No tiene viajes. Esto no se puede deshacer.'}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                      Sí, borrar
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                      Volver
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
