'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lightbulb, Radio, UsersRound } from 'lucide-react';
import { Occupancy, PageTitle, Panel } from '@/components/admin/bits';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { ExpensesPanel, FinanceCards, monthLabel, thisMonth } from '@/components/admin/finance';
import { ErrorBox, Spinner, TripBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { dateStrLong, hhmm, num } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { Dashboard, Expense, FinanceSummary } from '@/lib/types';

export default function AdminDashboard() {
  const { data, error, loading, reload } = useQuery(() => api<Dashboard>('/api/admin/dashboard', { auth: true }), [], { live: true });
  const extra = useQuery(() => api<{ newGroups: number; unreadSuggestions: number }>('/api/admin/group-requests/summary', { auth: true }), [], { live: true });
  const [month, setMonth] = useState(thisMonth);
  const summary = useQuery(() => api<FinanceSummary>(`/api/admin/finance/summary?month=${month}`, { auth: true }), [month], { live: true });
  const expenses = useQuery(() => api<{ expenses: Expense[] }>(`/api/admin/expenses?month=${month}`, { auth: true }), [month], { live: true });
  const refreshFinance = () => {
    void summary.reload(true);
    void expenses.reload(true);
  };

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error?.message ?? 'Error'} onRetry={() => void reload()} />;

  return (
    <>
      <PageTitle title="Panel" />
      <p className="-mt-4 mb-6 text-niebla">{dateStrLong(data.today)}</p>

      {!!(extra.data?.newGroups || extra.data?.unreadSuggestions) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {!!extra.data?.newGroups && (
            <Link
              href="/admin/pedidos"
              className="flex items-center gap-3 rounded-2xl border-2 border-ambar bg-ambar-50 p-4 font-bold text-ambar-dark hover:shadow-md"
            >
              <UsersRound className="size-6 shrink-0" aria-hidden />
              {extra.data.newGroups === 1 ? '1 grupo pidió un viaje. Respondele.' : `${extra.data.newGroups} grupos pidieron un viaje. Respondeles.`}
            </Link>
          )}
          {!!extra.data?.unreadSuggestions && (
            <Link href="/admin/sugerencias" className="flex items-center gap-3 rounded-2xl border border-linea bg-white p-4 font-bold text-ruta hover:shadow-md">
              <Lightbulb className="size-6 shrink-0" aria-hidden />
              {extra.data.unreadSuggestions} sugerencia(s) nueva(s)
            </Link>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-tinta">
          Cuentas de {monthLabel(month)}
        </p>
        <label className="flex items-center gap-2 text-sm font-bold text-niebla">
          Mes
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="h-10 rounded-xl border-2 border-linea bg-white px-3 text-tinta focus:border-ruta focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/reservas?estado=pending" className="rounded-2xl border-2 border-ambar bg-ambar-50 p-5 transition hover:shadow-md">
          <p className="font-bold text-ambar-dark">Esperando pago</p>
          <p className="font-display text-5xl font-bold text-tinta">{num(data.bookings.pending)}</p>
          <p className="text-sm text-ambar-dark">Revisá WhatsApp y confirmá</p>
        </Link>
        <FinanceCards summary={summary.data} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Viajes de hoy">
          {data.todayTrips.length === 0 ? (
            <p className="text-niebla">No hay viajes hoy.</p>
          ) : (
            <ul className="divide-y divide-linea">
              {data.todayTrips.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/admin/viajes/detalle?id=${t.id}`} className="min-w-0 hover:underline">
                    <span className="font-display text-2xl font-bold">{hhmm(t.departureTime)}</span>{' '}
                    <span className="font-bold">
                      {t.origin} › {t.destination}
                    </span>
                    <span className="block text-sm text-niebla">
                      {t.busName}
                      {t.driverName ? `, ${t.driverName}` : ', sin chofer asignado'}
                    </span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <Occupancy used={t.occupiedSeats} total={t.totalSeats} />
                    {t.status === 'in_progress' ? (
                      <Link href={`/admin/viajes/mapa?id=${t.id}`} className="flex items-center gap-1.5 rounded-full bg-monte px-3 py-1 text-sm font-bold text-white">
                        <Radio className="size-4" aria-hidden /> Ver mapa
                      </Link>
                    ) : (
                      <TripBadge status={t.status} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recaudación">
          <RevenueChart data={data.revenueByDay} />
        </Panel>

        <ExpensesPanel month={month} expenses={expenses.data?.expenses ?? []} loading={expenses.loading} onChanged={refreshFinance} />
      </div>
    </>
  );
}
