'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Input, NumberInput } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { numberToInput, parseNumber } from '@/lib/format';
import type { AdminRoute } from '@/lib/types';
import { toast } from '@/store/toast';

/**
 * Editar o borrar la ruta elegida sin salir de "Nuevo viaje":
 * se despliega ahí mismo, igual que "Nueva ruta".
 */
export function RouteInline({
  route,
  onUpdated,
  onDeleted,
}: {
  route: AdminRoute;
  onUpdated: (r: AdminRoute) => void;
  onDeleted: (id: string) => void;
}) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'delete'>('idle');
  const [form, setForm] = useState({ origin: '', destination: '', hours: '', minutes: '', price: '' });
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<{ text: string; canForce: boolean } | null>(null);

  function startEdit() {
    setForm({
      origin: route.origin,
      destination: route.destination,
      hours: String(Math.floor(route.durationMinutes / 60)),
      minutes: String(route.durationMinutes % 60),
      price: numberToInput(route.basePrice),
    });
    setMode('edit');
  }

  async function save() {
    const durationMinutes = Number(form.hours || 0) * 60 + Number(form.minutes || 0);
    if (form.origin.trim().length < 2 || form.destination.trim().length < 2) return toast.error('Escribí origen y destino');
    if (durationMinutes <= 0) return toast.error('Poné cuánto dura el viaje');
    setBusy(true);
    try {
      const r = await api<{ route: AdminRoute }>(`/api/admin/routes/${route.id}`, {
        method: 'PATCH',
        auth: true,
        body: { origin: form.origin.trim(), destination: form.destination.trim(), durationMinutes, basePrice: parseNumber(form.price) || route.basePrice },
      });
      toast.success('Ruta actualizada');
      onUpdated({ ...route, ...r.route });
      setMode('idle');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(force = false) {
    setBusy(true);
    try {
      await api(`/api/admin/routes/${route.id}${force ? '?force=true' : ''}`, { method: 'DELETE', auth: true });
      toast.success(`Ruta ${route.origin} › ${route.destination} borrada`);
      setMode('idle');
      setWarning(null);
      onDeleted(route.id);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'HAS_BOOKINGS' || e.code === 'ACTIVE_BOOKINGS')) {
        setWarning({ text: e.message, canForce: e.code === 'HAS_BOOKINGS' });
      } else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const trips = route._count?.trips ?? 0;

  if (mode === 'idle') {
    return (
      <div className="mt-1 flex gap-3 text-sm">
        <button type="button" onClick={startEdit} className="flex items-center gap-1 text-niebla underline hover:text-ruta">
          <Pencil className="size-3.5" /> Editar esta ruta
        </button>
        <button type="button" onClick={() => setMode('delete')} className="flex items-center gap-1 text-niebla underline hover:text-tierra">
          <Trash2 className="size-3.5" /> Borrar esta ruta
        </button>
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div className="mt-2 space-y-3 rounded-xl bg-papel p-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Origen" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          <Input label="Destino" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Horas" type="number" min={0} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          <Input label="Minutos" type="number" min={0} max={59} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          <NumberInput label="Precio base" value={form.price} onValueChange={(v) => setForm({ ...form, price: v })} />
        </div>
        <p className="text-xs text-niebla">Los cambios valen para los viajes nuevos. Los ya creados mantienen su precio.</p>
        <div className="flex gap-2">
          <Button size="sm" loading={busy} onClick={() => void save()}>
            Guardar ruta
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl border-2 border-tierra/30 p-3">
      {warning ? (
        <p className="text-sm font-bold text-tierra">{warning.text}</p>
      ) : (
        <p className="text-sm">
          ¿Borrar la ruta <strong>{route.origin} › {route.destination}</strong>?
          {trips > 0 && (
            <>
              {' '}
              También se borran sus <strong>{trips} viaje(s)</strong>.
            </>
          )}
        </p>
      )}
      <div className="flex gap-2">
        {(!warning || warning.canForce) && (
          <Button size="sm" variant="danger" loading={busy} onClick={() => void remove(!!warning)}>
            {warning ? 'Borrar igual' : 'Sí, borrar'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setMode('idle');
            setWarning(null);
          }}
        >
          Volver
        </Button>
      </div>
    </div>
  );
}
