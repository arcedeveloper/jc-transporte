'use client';

import { useState } from 'react';
import { Panel } from '@/components/admin/bits';
import { Button, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/store/toast';

/** Ajustes → Viaje grupal personalizado: tamaño del grupo y días de anticipación. */
export function RequestRules({ minPeople, maxPeople, minDays }: { minPeople: number; maxPeople: number; minDays: number }) {
  const [form, setForm] = useState({ min: String(minPeople), max: String(maxPeople), days: String(minDays) });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/admin/settings/groups', {
        method: 'PUT',
        auth: true,
        body: { groupMinPeople: Number(form.min), groupMaxPeople: Number(form.max), groupMinDays: Number(form.days) },
      });
      toast.success('Reglas del viaje grupal guardadas');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Viaje grupal personalizado">
      <p className="-mt-2 mb-4 text-niebla">Lo que se le pide a un grupo que quiere su propio viaje. Se muestra en la portada.</p>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-3">
        <Input label="Personas mínimas" type="number" min={1} max={80} value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} required />
        <Input label="Personas máximas" type="number" min={1} max={80} value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} required />
        <Input
          label="Días de anticipación"
          type="number"
          min={0}
          max={60}
          value={form.days}
          onChange={(e) => setForm({ ...form, days: e.target.value })}
          hint="Ej: 5 = hoy solo se puede pedir para dentro de 5 días."
          required
        />
        <div className="sm:col-span-3">
          <Button type="submit" size="lg" loading={saving}>
            Guardar reglas
          </Button>
        </div>
      </form>
    </Panel>
  );
}
