'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { LedSign } from '@/components/led-sign';
import { fetchSignRoutes, signLines } from '@/components/landing';
import { Button, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { RouteOption } from '@/lib/types';
import { toast } from '@/store/toast';
import { Panel } from './bits';

const MAX_MESSAGES = 10;
const MAX_LEN = 30;

/** Editor del cartel LED de la portada, con vista previa en vivo. */
export function SignEditor({ initialMessages, initialShowRoutes }: { initialMessages: string[]; initialShowRoutes: boolean }) {
  const [messages, setMessages] = useState<string[]>(initialMessages);
  const [showRoutes, setShowRoutes] = useState(initialShowRoutes);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSignRoutes()
      .then(setRoutes)
      .catch(() => undefined);
  }, []);

  const clean = messages.map((m) => m.trim()).filter(Boolean);
  const preview = signLines(routes, clean, showRoutes);

  function update(i: number, value: string) {
    setMessages((list) => list.map((m, j) => (j === i ? value.slice(0, MAX_LEN) : m)));
  }
  function move(i: number, dir: -1 | 1) {
    setMessages((list) => {
      const next = [...list];
      const j = i + dir;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api('/api/admin/settings/sign', {
        method: 'PUT',
        auth: true,
        body: { signMessages: clean, signShowRoutes: showRoutes },
      });
      setMessages(clean);
      toast.success('Cartel actualizado. Ya se ve en la portada.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Cartel de la portada">
      <p className="-mt-2 mb-4 text-niebla">Así lo ven los pasajeros al entrar. Siempre empieza con JC TRANSPORTE y después pasan tus mensajes y las próximas salidas, uno por uno.</p>

      <div className="rounded-2xl bg-ruta p-4">
        <LedSign lines={preview} size="md" />
      </div>

      <label className="mt-5 flex items-center gap-2 font-bold">
        <input type="checkbox" className="size-5 accent-ruta" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} />
        Mostrar las próximas salidas ({routes.length})
      </label>
      <p className="ml-7 text-sm text-niebla">Se toman solas de los viajes publicados en la portada. Cuando publicás o termina un viaje, el cartel cambia solo.</p>

      <div className="mt-5">
        <p className="font-bold">Mensajes propios</p>
        <ul className="mt-2 space-y-2">
          {messages.map((m, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={m}
                onChange={(e) => update(i, e.target.value)}
                placeholder="Ej: Reservá online"
                aria-label={`Mensaje ${i + 1}`}
                className="font-display text-lg uppercase tracking-wide"
              />
              <span className="w-12 shrink-0 text-right text-sm tabular-nums text-niebla">
                {m.length}/{MAX_LEN}
              </span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-2 text-ruta hover:bg-ruta-50 disabled:opacity-30" aria-label="Subir">
                <ArrowUp className="size-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === messages.length - 1}
                className="rounded-lg p-2 text-ruta hover:bg-ruta-50 disabled:opacity-30"
                aria-label="Bajar"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                onClick={() => setMessages((list) => list.filter((_, j) => j !== i))}
                className="rounded-lg p-2 text-tierra hover:bg-tierra-50"
                aria-label="Borrar mensaje"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {messages.length < MAX_MESSAGES && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setMessages((list) => [...list, ''])}>
            <Plus className="size-4" /> Agregar mensaje
          </Button>
        )}
        <p className="mt-2 text-sm text-niebla">Consejo: hasta 22 letras se lee entero en el celular.</p>
      </div>

      <Button className="mt-5" loading={saving} onClick={() => void save()}>
        Guardar cartel
      </Button>
    </Panel>
  );
}
