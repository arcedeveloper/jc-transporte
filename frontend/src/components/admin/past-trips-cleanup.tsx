'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDelete } from '@/components/admin/confirm-delete';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { num } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { toast } from '@/store/toast';

/** Botón "Borrar viajes pasados": limpia de una vez los viajes terminados o cancelados con sus reservas. */
export function PastTripsCleanup({ onDone }: { onDone: () => void }) {
  const { data, reload } = useQuery(() => api<{ trips: number; bookings: number }>('/api/admin/trips/cleanup', { auth: true }), [], { live: true });
  const [open, setOpen] = useState(false);

  if (!data?.trips) return null;

  return (
    <>
      <Button variant="ghost" className="text-tierra hover:bg-tierra-50" onClick={() => setOpen(true)}>
        <Trash2 className="size-5" aria-hidden /> Borrar viajes pasados ({num(data.trips)})
      </Button>
      <ConfirmDelete
        open={open}
        onClose={() => setOpen(false)}
        title="Borrar viajes pasados"
        confirmLabel={`Borrar ${num(data.trips)} viaje(s)`}
        onConfirm={async () => {
          const r = await api<{ deletedTrips: number; deletedBookings: number }>('/api/admin/trips/cleanup', { method: 'POST', auth: true });
          toast.success(`${r.deletedTrips} viaje(s) y ${r.deletedBookings} reserva(s) borrados`);
          void reload(true);
          onDone();
        }}
      >
        <p>
          Se borran los <strong>{num(data.trips)} viajes</strong> que ya terminaron o se cancelaron, con sus{' '}
          <strong>{num(data.bookings)} reserva(s)</strong>. Los viajes próximos no se tocan.
        </p>
        <p className="text-niebla">
          Incluye las reservas pagadas de esos viajes, así que la recaudación del Panel baja. Si querés guardar las listas, descargá antes las planillas
          Excel.
        </p>
      </ConfirmDelete>
    </>
  );
}
