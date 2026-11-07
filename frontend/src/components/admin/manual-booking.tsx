'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Modal, cn } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { docClean, docInput, gs } from '@/lib/format';
import { toast } from '@/store/toast';

interface Pax {
  key: number;
  fullName: string;
  document: string;
  phone: string;
}

let nextKey = 1;
const blankPax = (): Pax => ({ key: nextKey++, fullName: '', document: '', phone: '' });

/**
 * Cargar una reserva a mano (cliente que reservó por teléfono o en persona).
 * Si ya pagó, queda confirmada y ocupa su lugar enseguida.
 */
export function ManualBooking({
  open,
  onClose,
  onSaved,
  tripId,
  price,
  left,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  tripId: string;
  price: number;
  /** Lugares que quedan */
  left: number;
}) {
  const [pax, setPax] = useState<Pax[]>([blankPax()]);
  const [paid, setPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPax([blankPax()]);
    setPaid(true);
  }, [open]);

  const update = (key: number, patch: Partial<Pax>) => setPax((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pax.some((p) => p.fullName.trim().length < 3)) return toast.error('Escribí nombre y apellido de cada pasajero');
    if (pax.some((p) => p.document.trim().length < 3)) return toast.error('Escribí la cédula de cada pasajero');
    const contact = pax[0]?.phone.trim() ?? '';
    if (contact.replace(/\D/g, '').length < 6) return toast.error('Escribí el WhatsApp del pasajero 1');
    if (pax.some((p) => p.phone.trim() && p.phone.replace(/\D/g, '').length < 6)) return toast.error('Revisá los números de WhatsApp');
    setSaving(true);
    try {
      const r = await api<{ booking: { bookingCode: string } }>('/api/admin/bookings', {
        method: 'POST',
        auth: true,
        body: {
          tripId,
          contactPhone: contact,
          paid,
          passengers: pax.map((p) => ({ fullName: p.fullName.trim(), document: docClean(p.document), phone: p.phone.trim() || undefined })),
        },
      });
      toast.success(`Reserva ${r.booking.bookingCode} cargada${paid ? ' y confirmada' : ''}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar pasajero">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-niebla">
          Para clientes que reservaron por teléfono o en persona. Quedan {left} lugar{left === 1 ? '' : 'es'}.
        </p>

        <ul className="space-y-3">
          {pax.map((p, i) => (
            <li key={p.key} className="relative space-y-3 rounded-xl border-2 border-linea p-3">
              <p className="font-bold">Pasajero {i + 1}</p>
              {pax.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPax((list) => list.filter((x) => x.key !== p.key))}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-niebla hover:bg-tierra-50 hover:text-tierra"
                  aria-label={`Quitar pasajero ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Nombre y apellido" value={p.fullName} onChange={(e) => update(p.key, { fullName: e.target.value })} />
                <Input
                  label="Cédula"
                  inputMode="numeric"
                  placeholder="Ej: 4.567.890"
                  value={p.document}
                  onChange={(e) => update(p.key, { document: docInput(e.target.value) })}
                />
                <Input
                  label={i === 0 ? 'WhatsApp' : 'WhatsApp (opcional)'}
                  inputMode="tel"
                  placeholder="0981 123 456"
                  value={p.phone}
                  onChange={(e) => update(p.key, { phone: e.target.value })}
                  hint={i === 0 ? 'Por acá le confirmamos.' : 'Si lo dejás vacío, se usa el del pasajero 1.'}
                />
              </div>
            </li>
          ))}
        </ul>

        {pax.length < Math.min(10, left) && (
          <Button variant="outline" className="w-full" onClick={() => setPax((list) => [...list, blankPax()])}>
            <Plus className="size-4" /> Agregar otro pasajero
          </Button>
        )}

        <div>
          <p className="mb-1.5 text-sm font-bold">¿Ya pagó?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, label: 'Sí, ya pagó' },
              { v: false, label: 'Todavía no' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setPaid(o.v)}
                className={cn(
                  'h-12 rounded-xl border-2 font-bold transition-colors',
                  paid === o.v ? 'border-ruta bg-ruta text-white' : 'border-linea bg-white text-tinta hover:border-ruta',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-niebla">
            {paid ? 'Queda confirmada y ocupa su lugar.' : 'Queda esperando pago, como las reservas de la página.'}
          </p>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={saving}>
          Guardar reserva ({gs(price * pax.length)})
        </Button>
      </form>
    </Modal>
  );
}
