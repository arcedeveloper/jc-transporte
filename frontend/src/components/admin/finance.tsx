'use client';

import { useState } from 'react';
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { Panel } from '@/components/admin/bits';
import { ExpenseForm } from '@/components/admin/expense-form';
import { Button, Spinner, cn } from '@/components/ui';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { gs } from '@/lib/format';
import { EXPENSE_LABEL, type Expense, type FinanceSummary } from '@/lib/types';
import { toast } from '@/store/toast';

/** "2026-11" → "noviembre de 2026" */
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`));

/** Mes actual en Paraguay: "2026-11" */
export const thisMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);

/** Tarjetas Recaudado / Gastos / Ganancia del mes */
export function FinanceCards({ summary }: { summary: FinanceSummary | undefined }) {
  const card = (title: string, value: number | undefined, color: string, hint: string) => (
    <div className="rounded-2xl border border-linea bg-white p-5">
      <p className="font-bold text-niebla">{title}</p>
      <p className={cn('font-display text-3xl font-bold xl:text-4xl', color)}>{value === undefined ? '…' : gs(value)}</p>
      <p className="text-sm text-niebla">{hint}</p>
    </div>
  );
  return (
    <>
      {card('Recaudado', summary?.revenue, 'text-monte', 'Pagos confirmados del mes')}
      {card('Gastos', summary?.expenses, 'text-tierra', 'Sueldos, insumos, imprevistos…')}
      {card('Ganancia', summary?.profit, summary && summary.profit < 0 ? 'text-tierra' : 'text-ruta', 'Recaudado menos gastos')}
    </>
  );
}

/** Lista de gastos del mes, con "Agregar gasto" y "Descargar Excel" */
export function ExpensesPanel({
  month,
  expenses,
  loading,
  onChanged,
}: {
  month: string;
  expenses: Expense[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function remove(e: Expense) {
    try {
      await api(`/api/admin/expenses/${e.id}`, { method: 'DELETE', auth: true });
      toast.success('Gasto borrado');
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadFile(`/api/admin/finance/export.xlsx?month=${month}`, `movimientos-${month}.xlsx`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  const fmt = (d: string) => new Intl.DateTimeFormat('es-PY', { timeZone: 'America/Asuncion', day: '2-digit', month: '2-digit' }).format(new Date(d));

  return (
    <Panel
      title={`Gastos de ${monthLabel(month)}`}
      className="xl:col-span-2"
      action={
        <span className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" loading={downloading} onClick={() => void download()}>
            <FileSpreadsheet className="size-4" /> Descargar Excel del mes
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Agregar gasto
          </Button>
        </span>
      }
    >
      <p className="-mt-2 mb-4 text-sm text-niebla">
        Los gastos de un viaje también se cargan adentro del viaje (Cuentas del viaje). El Excel trae todos los ingresos y gastos del mes, y un
        resumen por viaje.
      </p>
      {loading ? (
        <Spinner />
      ) : expenses.length === 0 ? (
        <p className="text-niebla">No hay gastos cargados este mes.</p>
      ) : (
        <ul className="divide-y divide-linea rounded-xl border border-linea">
          {expenses.map((e) => (
            <li key={e.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-4 py-2.5">
              <span className="text-sm text-niebla">{fmt(e.date)}</span>
              <span className="min-w-0">
                <span className="block font-bold">{EXPENSE_LABEL[e.category]}</span>
                <span className="block truncate text-sm text-niebla">
                  {[e.driver?.fullName, e.description, e.trip ? `${e.trip.route.origin} › ${e.trip.route.destination}` : 'General']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-bold text-tierra">−{gs(e.amount)}</span>
                <button
                  onClick={() => void remove(e)}
                  className="grid size-8 place-items-center rounded-lg text-niebla hover:bg-tierra-50 hover:text-tierra"
                  aria-label="Borrar gasto"
                  title="Borrar gasto"
                >
                  <Trash2 className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ExpenseForm open={adding} onClose={() => setAdding(false)} onSaved={onChanged} />
    </Panel>
  );
}
