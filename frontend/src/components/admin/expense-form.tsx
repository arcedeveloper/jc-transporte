'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Modal, NumberInput, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { addDaysStr, dateTime, gs, parseNumber, todayPY } from '@/lib/format';
import { EXPENSE_LABEL, type AdminTrip, type AdminUser, type ExpenseCategory } from '@/lib/types';
import { toast } from '@/store/toast';

interface Item {
  key: number;
  category: ExpenseCategory;
  driverId: string;
  amount: string;
  description: string;
}

const PLACEHOLDER: Record<ExpenseCategory, string> = {
  driver: 'Ej: viaje a Caacupé',
  supplies: 'Ej: 3 cajas de agua y obsequios',
  repair: 'Ej: pinchazo de rueda',
  fuel: 'Ej: carga completa',
  other: 'Ej: peaje, estacionamiento',
};

let nextKey = 1;

/**
 * Cargar uno o varios gastos de una vez (insumos, combustible, sueldo del chofer…).
 * Si es de un viaje, la fecha es la del viaje. Solo un gasto general pide fecha.
 */
export function ExpenseForm({
  open,
  onClose,
  onSaved,
  tripId,
  defaultCategory = 'supplies',
  defaultDriverId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Si viene, los gastos son de ese viaje */
  tripId?: string;
  defaultCategory?: ExpenseCategory;
  defaultDriverId?: string | null;
}) {
  const [drivers, setDrivers] = useState<AdminUser[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [chosenTrip, setChosenTrip] = useState('');
  const [date, setDate] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

  const blankItem = (category: ExpenseCategory, driverId = ''): Item => ({ key: nextKey++, category, driverId, amount: '', description: '' });

  useEffect(() => {
    if (!open) return;
    const today = todayPY();
    setChosenTrip(tripId ?? '');
    setDate(today);
    setItems([blankItem(defaultCategory, defaultDriverId ?? '')]);
    api<{ users: AdminUser[] }>('/api/admin/users?role=driver', { auth: true })
      .then((d) => {
        const active = d.users.filter((u) => u.isActive);
        setDrivers(active);
        setItems((list) => list.map((it) => ({ ...it, driverId: it.driverId || active[0]?.id || '' })));
      })
      .catch(() => undefined);
    if (!tripId) {
      api<{ trips: AdminTrip[] }>(`/api/admin/trips?from=${addDaysStr(today, -60)}&to=${addDaysStr(today, 365)}`, { auth: true })
        .then((d) => setTrips(d.trips.filter((t) => t.status !== 'cancelled')))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tripId, defaultCategory, defaultDriverId]);

  const tripSelected = !!(tripId ?? chosenTrip);
  const trip = trips.find((t) => t.id === chosenTrip);
  const hasDriverRow = items.some((it) => it.category === 'driver');

  function chooseTrip(id: string) {
    setChosenTrip(id);
    const t = trips.find((x) => x.id === id);
    // El chofer del viaje queda elegido para cargarle el sueldo
    if (t?.driverId) setItems((list) => list.map((it) => (it.category === 'driver' ? { ...it, driverId: t.driverId! } : it)));
  }
  const update = (key: number, patch: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const total = items.reduce((a, it) => a + parseNumber(it.amount), 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const filled = items.filter((it) => parseNumber(it.amount) > 0);
    if (!filled.length) return toast.error('Poné el monto de al menos un gasto');
    if (filled.some((it) => it.category === 'driver' && !it.driverId)) return toast.error('Elegí el chofer');
    if (filled.some((it) => it.category === 'driver') && !tripSelected) return toast.error('El sueldo del chofer va con un viaje: elegí el viaje');
    setSaving(true);
    let ok = 0;
    try {
      for (const it of filled) {
        await api('/api/admin/expenses', {
          method: 'POST',
          auth: true,
          body: {
            category: it.category,
            description: it.description.trim() || null,
            amount: parseNumber(it.amount),
            tripId: (tripId ?? chosenTrip) || null,
            driverId: it.category === 'driver' ? it.driverId : null,
            // La fecha solo se manda en un gasto general; en un viaje se usa la del viaje
            date: tripSelected ? undefined : date || undefined,
          },
        });
        ok++;
      }
      toast.success(ok === 1 ? 'Gasto cargado' : `${ok} gastos cargados`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(ok ? `Se cargaron ${ok}, pero uno falló: ${errorMessage(err)}` : errorMessage(err));
      if (ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cargar gastos">
      <form onSubmit={save} className="space-y-4">
        {!tripId && (
          <Select label="¿De qué viaje?" value={chosenTrip} onChange={(e) => chooseTrip(e.target.value)}>
            <option value="">Gasto general (no es de un viaje)</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.route.origin} › {t.route.destination}, {dateTime(t.departureTime)}
              </option>
            ))}
          </Select>
        )}
        {!tripSelected && <Input label="Fecha del gasto" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}

        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={it.key} className="relative space-y-3 rounded-xl border-2 border-linea p-3">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((list) => list.filter((x) => x.key !== it.key))}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-niebla hover:bg-tierra-50 hover:text-tierra"
                  aria-label={`Quitar gasto ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Tipo" value={it.category} onChange={(e) => update(it.key, { category: e.target.value as ExpenseCategory })}>
                  {(Object.keys(EXPENSE_LABEL) as ExpenseCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {EXPENSE_LABEL[k]}
                    </option>
                  ))}
                </Select>
                <NumberInput label="Monto (Gs.)" placeholder="150.000" value={it.amount} onValueChange={(v) => update(it.key, { amount: v })} />
              </div>
              {it.category === 'driver' && (
                <Select label="Chofer" value={it.driverId} onChange={(e) => update(it.key, { driverId: e.target.value })}>
                  {drivers.length === 0 && <option value="">No hay choferes cargados</option>}
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
                </Select>
              )}
              <Input
                label="Detalle (opcional)"
                placeholder={PLACEHOLDER[it.category]}
                maxLength={200}
                value={it.description}
                onChange={(e) => update(it.key, { description: e.target.value })}
              />
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => setItems((list) => [...list, blankItem('fuel')])}>
            <Plus className="size-4" /> Agregar otro gasto
          </Button>
          {trip && !hasDriverRow && (
            <Button variant="outline" className="flex-1" onClick={() => setItems((list) => [...list, blankItem('driver', trip.driverId ?? drivers[0]?.id ?? '')])}>
              <Plus className="size-4" /> Sueldo del chofer{trip.driver ? ` (${trip.driver.fullName})` : ''}
            </Button>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={saving}>
          {items.length > 1 ? `Guardar ${items.length} gastos (${gs(total)})` : 'Guardar gasto'}
        </Button>
      </form>
    </Modal>
  );
}
