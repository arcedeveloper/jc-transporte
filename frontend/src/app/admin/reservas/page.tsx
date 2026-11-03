'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import { PageTitle, Tabs } from '@/components/admin/bits';
import { BookingDetail } from '@/components/admin/booking-detail';
import { ConfirmDelete } from '@/components/admin/confirm-delete';
import { BookingBadge, Button, Empty, ErrorBox, Input, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { dateTime, gs, num } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { AdminBooking, BookingStatus } from '@/lib/types';

type Filter = BookingStatus;

function BookingsAdmin() {
  const params = useSearchParams();
  const initial = (params.get('estado') as Filter | null) ?? 'pending';
  const [filter, setFilter] = useState<Filter>(initial);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [filter, debounced]);

  const { data, error, loading, reload } = useQuery(() => {
    const sp = new URLSearchParams({ page: String(page) });
    sp.set('status', filter);
    if (debounced) sp.set('q', debounced);
    return api<{ bookings: AdminBooking[]; total: number; pages: number }>(`/api/admin/bookings?${sp.toString()}`, { auth: true });
  }, [filter, debounced, page], { live: true });

  const open = data?.bookings.find((b) => b.id === openId) ?? null;

  return (
    <>
      <PageTitle title="Reservas" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            ['pending', 'Esperando pago'],
            ['confirmed', 'Confirmadas'],
            ['cancelled', 'Canceladas'],
          ]}
        />
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-niebla" aria-hidden />
          <Input
            className="pl-10"
            placeholder="Código, nombre o teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar reservas"
          />
        </div>
      </div>

      {filter === 'cancelled' && !debounced && !!data?.total && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-tierra-50 px-5 py-3">
          <p>
            Hay <strong>{num(data.total)}</strong> reserva(s) cancelada(s). Podés borrarlas para que no se acumulen.
          </p>
          <Button variant="danger" size="sm" onClick={() => setBulkOpen(true)}>
            <Trash2 className="size-4" /> Borrar todas las canceladas
          </Button>
        </div>
      )}

      <div className="mt-5">
        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error.message} onRetry={() => void reload()} />
        ) : !data?.bookings.length ? (
          <Empty title={debounced ? 'Sin resultados' : filter === 'pending' ? 'No hay pagos pendientes' : 'No hay reservas'}>
            {filter === 'pending' && !debounced && <p>Cuando alguien reserve, aparece acá hasta que confirmes el pago.</p>}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
              {data.bookings.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => setOpenId(b.id)}
                    className="grid w-full gap-1 px-5 py-4 text-left hover:bg-ruta-50 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-4"
                  >
                    <span className="font-display text-xl font-bold">{b.bookingCode}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">
                        {b.passengers[0]?.fullName}
                        {b.passengers.length > 1 && ` y ${b.passengers.length - 1} más`}
                      </span>
                      <span className="block truncate text-sm text-niebla">
                        {b.trip.route.origin} › {b.trip.route.destination}, {dateTime(b.trip.departureTime)}, {b.numberOfPassengers} pasajero(s)
                      </span>
                    </span>
                    <span className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      <span className="font-bold text-ruta">{gs(b.totalAmount)}</span>
                      <BookingBadge status={b.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {data.pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-niebla">
                  Página {page} de {data.pages} ({num(data.total)} reservas)
                </span>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="Página siguiente">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDelete
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Borrar reservas canceladas"
        confirmLabel={`Borrar ${data ? num(data.total) : ''} canceladas`}
        onConfirm={async () => {
          const r = await api<{ deleted: number }>('/api/admin/bookings/cleanup', { method: 'POST', auth: true, body: { scope: 'cancelled' } });
          toast.success(`${r.deleted} reserva(s) cancelada(s) borrada(s)`);
          void reload(true);
        }}
      >
        <p>
          Se borran <strong>todas</strong> las reservas canceladas con sus pasajeros. Las confirmadas y las que esperan pago no se tocan.
        </p>
      </ConfirmDelete>

      <BookingDetail booking={open} onClose={() => setOpenId(null)} onChanged={() => void reload(true)} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <BookingsAdmin />
    </Suspense>
  );
}
