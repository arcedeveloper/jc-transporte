'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, ImagePlus, Trash2 } from 'lucide-react';
import { Panel } from '@/components/admin/bits';
import { PromoImage } from '@/components/promos';
import { Button, Field, Input, cn } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { resizeImage } from '@/lib/image';
import type { AdminTrip, PromoLayout } from '@/lib/types';
import { toast } from '@/store/toast';

/**
 * Publicidad del viaje en la portada: imagen (flyer o logo), formato de la tarjeta,
 * título y texto. Los viajes nuevos de la misma ruta copian esto solos.
 */
export function PromoPanel({ trip, onChanged }: { trip: AdminTrip; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    showOnHome: trip.showOnHome,
    promoLayout: trip.promoLayout,
    promoTitle: trip.promoTitle ?? '',
    promoText: trip.promoText ?? '',
  });
  const [busy, setBusy] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);

  // Recién creado el viaje (?publicidad=1): bajamos hasta acá para subir la imagen
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('publicidad') !== '1') return;
    setHighlight(true);
    setTimeout(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, []);

  useEffect(() => {
    setForm({ showOnHome: trip.showOnHome, promoLayout: trip.promoLayout, promoTitle: trip.promoTitle ?? '', promoText: trip.promoText ?? '' });
  }, [trip.id, trip.showOnHome, trip.promoLayout, trip.promoTitle, trip.promoText]);

  const dirty =
    form.showOnHome !== trip.showOnHome ||
    form.promoLayout !== trip.promoLayout ||
    form.promoTitle !== (trip.promoTitle ?? '') ||
    form.promoText !== (trip.promoText ?? '');

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      await api(`/api/admin/trips/${trip.id}/promo`, {
        method: 'PUT',
        auth: true,
        body: { ...form, promoTitle: form.promoTitle.trim() || null, promoText: form.promoText.trim() || null },
      });
      toast.success(form.showOnHome ? 'Publicidad guardada. Ya se ve en la portada.' : 'Guardado. Este viaje no aparece en la portada.');
    });

  const upload = (file: File | undefined) =>
    file &&
    run('upload', async () => {
      const dataUrl = await resizeImage(file, 1600, 0.85);
      await api(`/api/admin/trips/${trip.id}/promo-image`, { method: 'POST', auth: true, body: { dataUrl } });
      if (input.current) input.current.value = '';
      toast.success('Imagen subida');
    });

  const removeImage = () =>
    run('remove', async () => {
      await api(`/api/admin/trips/${trip.id}/promo-image`, { method: 'DELETE', auth: true });
      toast.success('Imagen quitada');
    });

  const applyRoute = () =>
    run('apply', async () => {
      if (dirty) {
        await api(`/api/admin/trips/${trip.id}/promo`, {
          method: 'PUT',
          auth: true,
          body: { ...form, promoTitle: form.promoTitle.trim() || null, promoText: form.promoText.trim() || null },
        });
      }
      const r = await api<{ updated: number }>(`/api/admin/trips/${trip.id}/promo/apply-route`, { method: 'POST', auth: true });
      toast.success(r.updated ? `Copiado a ${r.updated} viaje(s) próximos de esta ruta` : 'No hay otros viajes próximos de esta ruta');
    });

  const title = form.promoTitle.trim() || `${trip.route.origin} › ${trip.route.destination}`;

  return (
    <div ref={box} className={cn('scroll-mt-6 rounded-2xl', highlight && 'ring-4 ring-ambar')}>
    <Panel title="Publicidad en la portada">
      {highlight && !trip.promoImageId && (
        <p className="mb-4 rounded-xl bg-ambar-50 p-3 font-bold text-ambar-dark">
          ¡Viaje creado! Ahora subí la imagen o el logo para que se vea lindo en la portada.
        </p>
      )}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-papel p-3">
        <input
          type="checkbox"
          className="size-5 accent-ruta"
          checked={form.showOnHome}
          onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })}
        />
        <span>
          <span className="block font-bold">Mostrar en la portada</span>
          <span className="text-sm text-niebla">Sacalo para viajes privados (por ejemplo, un viaje grupal).</span>
        </span>
      </label>

      <div className={cn('mt-4 space-y-4', !form.showOnHome && 'opacity-50')}>
        <div className="mx-auto max-w-sm overflow-hidden rounded-2xl ring-1 ring-linea">
          <PromoImage imageId={trip.promoImageId} title={title} layout={form.promoLayout} />
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
          <Button variant="outline" size="sm" loading={busy === 'upload'} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" /> {trip.promoImageId ? 'Cambiar imagen' : 'Subir imagen o logo'}
          </Button>
          {trip.promoImageId && (
            <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" loading={busy === 'remove'} onClick={() => void removeImage()}>
              <Trash2 className="size-4" /> Quitar
            </Button>
          )}
        </div>

        <div>
          <p className="text-sm font-bold">Formato de la tarjeta</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Formato">
            {(
              [
                ['square', 'Cuadrada', 'Ocupa un lugar'],
                ['wide', 'Rectangular', 'Ocupa dos lugares'],
              ] as [PromoLayout, string, string][]
            ).map(([k, label, hint]) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.promoLayout === k}
                onClick={() => setForm({ ...form, promoLayout: k })}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-center',
                  form.promoLayout === k ? 'border-ruta bg-ruta-50' : 'border-linea bg-white',
                )}
              >
                <span className={cn('shrink-0 rounded bg-ruta/70', k === 'square' ? 'size-8' : 'h-6 w-12')} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight">{label}</span>
                  <span className="block text-xs leading-tight text-niebla">{hint}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-niebla">Usá una imagen cuadrada (1:1) o rectangular (2:1). Si no coincide, se ve entera con un fondo difuminado.</p>
        </div>

        <Input
          label="Título (opcional)"
          placeholder={`${trip.route.origin} › ${trip.route.destination}`}
          maxLength={60}
          value={form.promoTitle}
          onChange={(e) => setForm({ ...form, promoTitle: e.target.value })}
          hint="Ej: Paseo a Bella Vista y Concepción"
        />
        <Field label="Texto (opcional)" htmlFor="promo-text" hint={`${form.promoText.length}/300. Qué incluye, punto de salida, vuelta…`}>
          <textarea
            id="promo-text"
            rows={3}
            maxLength={300}
            value={form.promoText}
            onChange={(e) => setForm({ ...form, promoText: e.target.value })}
            className="w-full rounded-xl border-2 border-linea bg-white px-3.5 py-2.5 text-base focus:border-ruta focus:outline-none"
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Button disabled={!dirty} loading={busy === 'save'} onClick={() => void save()}>
          Guardar publicidad
        </Button>
        <Button variant="ghost" size="sm" loading={busy === 'apply'} onClick={() => void applyRoute()}>
          <Copy className="size-4" /> Usar lo mismo en los próximos viajes de esta ruta
        </Button>
      </div>
    </Panel>
    </div>
  );
}
