'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Star, Trash2, Users } from 'lucide-react';
import { PageTitle } from '@/components/admin/bits';
import { ConfirmDelete } from '@/components/admin/confirm-delete';
import { Button, Empty, ErrorBox, Field, Input, Modal, Spinner, cn } from '@/components/ui';
import { api, busPhotoUrl, errorMessage } from '@/lib/api';
import { resizeImage } from '@/lib/image';
import { useQuery } from '@/lib/use-query';
import type { AdminBus } from '@/lib/types';
import { toast } from '@/store/toast';

const MAX_PHOTOS = 4;
const empty = { name: '', plate: '', capacity: '17', description: '' };

export default function BusesAdmin() {
  const { data, error, loading, reload } = useQuery(() => api<{ buses: AdminBus[] }>('/api/admin/buses', { auth: true }));
  const [editing, setEditing] = useState<AdminBus | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AdminBus | null>(null);

  function open(bus: AdminBus | 'new') {
    setEditing(bus);
    setForm(
      bus === 'new' ? empty : { name: bus.name, plate: bus.plate, capacity: String(bus.capacity), description: bus.description ?? '' },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { name: form.name, plate: form.plate, capacity: Number(form.capacity), description: form.description.trim() || null };
    setSaving(true);
    try {
      if (editing === 'new') await api('/api/admin/buses', { method: 'POST', auth: true, body });
      else if (editing) await api(`/api/admin/buses/${editing.id}`, { method: 'PATCH', auth: true, body });
      toast.success(editing === 'new' ? 'Bus creado. Ahora podés subirle fotos.' : 'Bus guardado');
      setEditing(null);
      void reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(bus: AdminBus) {
    try {
      await api(`/api/admin/buses/${bus.id}`, { method: 'PATCH', auth: true, body: { isActive: !bus.isActive } });
      toast.success(bus.isActive ? `${bus.name} desactivado: no aparece al crear viajes` : `${bus.name} activado`);
      void reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageTitle title="Buses">
        <Button onClick={() => open('new')}>
          <Plus className="size-5" aria-hidden /> Agregar bus
        </Button>
      </PageTitle>
      <p className="-mt-3 mb-5 max-w-prose text-niebla">
        Cada viaje usa un bus. Los <strong>lugares</strong> son los pasajeros que se venden por viaje. Las fotos y la descripción las ven los pasajeros
        al elegir el horario.
      </p>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} onRetry={() => void reload()} />
      ) : !data?.buses.length ? (
        <Empty title="No hay buses cargados" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.buses.map((bus) => (
            <section key={bus.id} className={cn('rounded-2xl border border-linea bg-white p-5', !bus.isActive && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl font-bold">
                    {bus.name} <span className="text-xl text-niebla">({bus.plate})</span>
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-niebla">
                    <Users className="size-4" aria-hidden /> <strong className="text-tinta">{bus.capacity} lugares</strong> por viaje,{' '}
                    {bus._count.trips} viaje(s){!bus.isActive && ', desactivado'}
                  </p>
                  {bus.description ? (
                    <p className="mt-1">{bus.description}</p>
                  ) : (
                    <p className="mt-1 text-sm italic text-niebla">Sin descripción para los pasajeros</p>
                  )}
                </div>
                <span className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => open(bus)}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void toggleActive(bus)}>
                    {bus.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" onClick={() => setToDelete(bus)} aria-label={`Borrar ${bus.name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </div>
              <BusPhotos bus={bus} onChanged={() => void reload(true)} />
            </section>
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Agregar bus' : 'Editar bus'}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Nombre" placeholder="Bus 2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Chapa" placeholder="ABC 123" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} required />
          <Input
            label="Lugares por viaje"
            type="number"
            min={1}
            max={80}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            hint="Cantidad de pasajeros que se pueden reservar en cada viaje."
            required
          />
          <Field label="Descripción para los pasajeros (opcional)" htmlFor="bus-desc" hint={`${form.description.length}/200`}>
            <textarea
              id="bus-desc"
              rows={3}
              maxLength={200}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ej: Aire acondicionado, asientos reclinables, cargador USB"
              className="w-full rounded-xl border-2 border-linea bg-white px-3.5 py-2.5 text-base focus:border-ruta focus:outline-none"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={saving}>
            Guardar bus
          </Button>
        </form>
      </Modal>

      <ConfirmDelete
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Borrar ${toDelete?.name ?? 'bus'}`}
        onConfirm={async () => {
          if (!toDelete) return;
          const r = await api<{ deletedTrips: number }>(`/api/admin/buses/${toDelete.id}`, { method: 'DELETE', auth: true });
          toast.success(r.deletedTrips ? `${toDelete.name} borrado junto con ${r.deletedTrips} viaje(s) viejo(s)` : `${toDelete.name} borrado`);
          void reload(true);
        }}
      >
        <p>
          Se borra <strong>{toDelete?.name}</strong> con sus fotos y sus viajes que ya pasaron (con sus reservas).
        </p>
        <p className="text-niebla">Si tiene viajes próximos no se puede borrar: cambiales el bus primero, o solo desactivalo.</p>
      </ConfirmDelete>
    </>
  );
}

function BusPhotos({ bus, onChanged }: { bus: AdminBus; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const left = MAX_PHOTOS - bus.photos.length;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, left);
    setUploading(true);
    let ok = 0;
    for (const file of list) {
      try {
        const dataUrl = await resizeImage(file);
        await api(`/api/admin/buses/${bus.id}/photos`, { method: 'POST', auth: true, body: { dataUrl } });
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      }
    }
    setUploading(false);
    if (input.current) input.current.value = '';
    if (ok) toast.success(ok === 1 ? 'Foto subida' : `${ok} fotos subidas`);
    if (files.length > list.length) toast.info(`Solo se subieron ${list.length}: el máximo es ${MAX_PHOTOS} fotos por bus.`);
    onChanged();
  }

  async function remove(photoId: string) {
    try {
      await api(`/api/admin/buses/${bus.id}/photos/${photoId}`, { method: 'DELETE', auth: true });
      toast.success('Foto borrada');
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function makeFirst(photoId: string) {
    try {
      await api(`/api/admin/buses/${bus.id}/photos/${photoId}/first`, { method: 'POST', auth: true });
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="mt-5 border-t border-linea pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">
          Fotos <span className="font-normal text-niebla">({bus.photos.length} de {MAX_PHOTOS})</span>
        </p>
        {left > 0 && (
          <>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
            <Button variant="outline" size="sm" loading={uploading} onClick={() => input.current?.click()}>
              <ImagePlus className="size-4" /> Subir fotos
            </Button>
          </>
        )}
      </div>
      {bus.photos.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-3 flex h-28 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-linea text-niebla hover:border-ruta hover:text-ruta"
        >
          <ImagePlus className="size-6" />
          Subí fotos del bus por fuera y por dentro
        </button>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {bus.photos.map((p, i) => (
            <li key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-papel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={busPhotoUrl(p.id)} alt={`Foto ${i + 1} del ${bus.name}`} className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-ambar px-1.5 text-xs font-bold text-ruta-dark">Principal</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => void makeFirst(p.id)}
                    className="grid size-8 place-items-center rounded-lg bg-white/90 text-ruta"
                    aria-label="Usar como principal"
                    title="Usar como principal"
                  >
                    <Star className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  className="grid size-8 place-items-center rounded-lg bg-white/90 text-tierra"
                  aria-label="Borrar foto"
                  title="Borrar foto"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-niebla">La principal es la que aparece en la lista de horarios. Las fotos se achican solas antes de subir.</p>
    </div>
  );
}
