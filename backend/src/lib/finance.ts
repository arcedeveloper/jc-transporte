import ExcelJS from 'exceljs';
import type { ExpenseCategory } from '@prisma/client';
import { prisma } from './prisma.js';
import { BUSINESS_TZ, BUSINESS_UTC_OFFSET } from '../config/business.js';

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  driver: 'Sueldo del chofer',
  supplies: 'Insumos (agua, obsequios)',
  repair: 'Reparación o imprevisto',
  fuel: 'Combustible',
  other: 'Otro',
};

/** "2026-11" → desde el 1/11 00:00 hasta el 1/12 00:00 (hora de Paraguay) */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const start = new Date(`${month}-01T00:00:00${BUSINESS_UTC_OFFSET}`);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const end = new Date(`${next}-01T00:00:00${BUSINESS_UTC_OFFSET}`);
  return { start, end };
}

/** Mes actual en Paraguay: "2026-11" */
export function currentMonth(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);
}

const tripLabel = (t: { departureTime: Date; route: { origin: string; destination: string } } | null) =>
  t
    ? `${t.route.origin} › ${t.route.destination}, ${new Intl.DateTimeFormat('es-PY', { timeZone: BUSINESS_TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(t.departureTime)}`
    : '';

/** Ingresos (pagos confirmados) y gastos de un mes */
export async function monthMovements(month: string) {
  const { start, end } = monthRange(month);
  const tripSelect = { select: { id: true, departureTime: true, route: { select: { origin: true, destination: true } } } } as const;
  const [bookings, expenses] = await Promise.all([
    prisma.booking.findMany({
      where: { status: 'confirmed', confirmedAt: { gte: start, lt: end } },
      orderBy: { confirmedAt: 'asc' },
      select: {
        bookingCode: true,
        totalAmount: true,
        numberOfPassengers: true,
        confirmedAt: true,
        passengers: { select: { fullName: true }, take: 1, orderBy: { createdAt: 'asc' } },
        trip: tripSelect,
      },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
      include: { trip: tripSelect, driver: { select: { fullName: true } } },
    }),
  ]);
  const revenue = bookings.reduce((a, b) => a + b.totalAmount, 0);
  const spent = expenses.reduce((a, e) => a + e.amount, 0);
  const byCategory = Object.fromEntries(
    (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => [c, expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0)]),
  ) as Record<ExpenseCategory, number>;
  return { bookings, expenses, revenue, spent, profit: revenue - spent, byCategory };
}

const NAVY = 'FF12355B';
const GREEN = 'FF1F7A4D';
const RED = 'FFB3412A';
const LIGHT = 'FFF4F6F8';

/** Excel del mes: hoja con todos los movimientos y hoja con el resumen por viaje */
export async function buildFinanceXlsx(month: string) {
  const m = await monthMovements(month);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JC Transporte';
  wb.created = new Date();
  const money = '#,##0" Gs."';
  const monthName = new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`));
  const fmtDate = (d: Date) => new Intl.DateTimeFormat('es-PY', { timeZone: BUSINESS_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);

  // ---------- Hoja 1: movimientos ----------
  const ws = wb.addWorksheet('Movimientos', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [
    { key: 'date', width: 12 },
    { key: 'type', width: 10 },
    { key: 'cat', width: 26 },
    { key: 'detail', width: 40 },
    { key: 'trip', width: 40 },
    { key: 'amount', width: 18 },
  ];
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = `JC Transporte · Movimientos de ${monthName}`;
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: NAVY } };
  ws.addRow([]);
  const head = ws.addRow(['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Viaje', 'Monto']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }));

  type Row = { date: Date; type: string; cat: string; detail: string; trip: string; amount: number };
  const rows: Row[] = [
    ...m.bookings.map((b) => ({
      date: b.confirmedAt!,
      type: 'Ingreso',
      cat: 'Pasaje',
      detail: `${b.bookingCode} · ${b.passengers[0]?.fullName ?? ''} (${b.numberOfPassengers} pas.)`,
      trip: tripLabel(b.trip),
      amount: b.totalAmount,
    })),
    ...m.expenses.map((e) => ({
      date: e.date,
      type: 'Gasto',
      cat: CATEGORY_LABEL[e.category],
      detail: [e.driver?.fullName, e.description].filter(Boolean).join(' · '),
      trip: e.trip ? tripLabel(e.trip) : 'General',
      amount: -e.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const r of rows) {
    const row = ws.addRow({ ...r, date: fmtDate(r.date) });
    row.getCell('amount').numFmt = money;
    row.getCell('amount').font = { color: { argb: r.amount < 0 ? RED : GREEN } };
  }
  if (!rows.length) ws.addRow(['', '', '', 'No hubo movimientos este mes']);

  ws.addRow([]);
  const total = (label: string, value: number, color: string) => {
    const r = ws.addRow(['', '', '', '', label, value]);
    r.font = { bold: true, color: { argb: color } };
    r.getCell(6).numFmt = money;
    r.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }));
  };
  total('Total recaudado', m.revenue, GREEN);
  total('Total gastos', -m.spent, RED);
  total('Ganancia', m.profit, NAVY);

  // ---------- Hoja 2: por viaje ----------
  const wt = wb.addWorksheet('Por viaje');
  wt.columns = [
    { key: 'trip', width: 44 },
    { key: 'revenue', width: 18 },
    { key: 'spent', width: 18 },
    { key: 'profit', width: 18 },
  ];
  const th = wt.addRow(['Viaje', 'Recaudado', 'Gastos', 'Ganancia']);
  th.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  th.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }));
  const per = new Map<string, { label: string; time: number; revenue: number; spent: number }>();
  const slot = (key: string, label: string, time: number) => {
    let x = per.get(key);
    if (!x) per.set(key, (x = { label, time, revenue: 0, spent: 0 }));
    return x;
  };
  for (const b of m.bookings) slot(b.trip.id, tripLabel(b.trip), b.trip.departureTime.getTime()).revenue += b.totalAmount;
  for (const e of m.expenses) {
    const x = e.trip ? slot(e.trip.id, tripLabel(e.trip), e.trip.departureTime.getTime()) : slot('general', 'Gastos generales (sin viaje)', Number.MAX_SAFE_INTEGER);
    x.spent += e.amount;
  }
  for (const x of [...per.values()].sort((a, b) => a.time - b.time)) {
    const r = wt.addRow([x.label, x.revenue, -x.spent, x.revenue - x.spent]);
    [2, 3, 4].forEach((i) => (r.getCell(i).numFmt = money));
  }
  const tt = wt.addRow(['Total', m.revenue, -m.spent, m.profit]);
  tt.font = { bold: true };
  [2, 3, 4].forEach((i) => (tt.getCell(i).numFmt = money));

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `movimientos-${month}.xlsx` };
}
