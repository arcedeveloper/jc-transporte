import ExcelJS from 'exceljs';
import { BUSINESS_TZ } from '../config/business.js';
import { formatDateTime } from './format.js';

interface ChecklistTrip {
  departureTime: Date;
  route: { origin: string; destination: string };
  bus: { name: string; plate: string };
  driver: { fullName: string } | null;
  bookings: { bookingCode: string; passengers: { fullName: string; document: string; phone: string }[] }[];
}

const NAVY = 'FF12355B';
const AMBER_LIGHT = 'FFFFF6DC';
const GREY = 'FF5F6B78';

/** "Asunción" → "asuncion" (para el nombre del archivo) */
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** "0983775018" → "0983 775 018" (más fácil de leer en la hoja impresa) */
const phoneFmt = (p: string) => {
  const d = p.replace(/\D/g, '');
  return d.length === 10 && d.startsWith('09') ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : p;
};

/**
 * Planilla de control para imprimir: solo pasajeros con pago confirmado,
 * ordenados por nombre, con una casilla para tildar cuando suben.
 */
export async function buildChecklist(trip: ChecklistTrip) {
  const rows = trip.bookings
    .flatMap((b) => b.passengers.map((p) => ({ ...p, code: b.bookingCode })))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'JC Transporte';
  wb.created = new Date();

  const ws = wb.addWorksheet('Pasajeros', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: '6:6',
    },
    headerFooter: { oddFooter: '&LJC Transporte&RPágina &P de &N' },
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  // Sin cédula: lo importante es el nombre y el WhatsApp (si alguien falta, se le escribe directo).
  // Dos casillas: Subida 1ra (al salir) y Subida 2da (al volver).
  ws.columns = [
    { key: 'n', width: 5 },
    { key: 'name', width: 36 },
    { key: 'phone', width: 17 },
    { key: 'code', width: 14 },
    { key: 'check1', width: 11 },
    { key: 'check2', width: 11 },
    { key: 'notes', width: 22 },
  ];

  const title = (row: number, text: string, size: number, bold = true, color = 'FF17202B') => {
    ws.mergeCells(`A${row}:G${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text;
    c.font = { size, bold, color: { argb: color } };
    c.alignment = { vertical: 'middle' };
    ws.getRow(row).height = size + 10;
  };

  title(1, 'JC Transporte · Lista de pasajeros', 16, true, NAVY);
  title(2, `${trip.route.origin} › ${trip.route.destination}`, 13);
  title(
    3,
    `Salida: ${formatDateTime(trip.departureTime)}   ·   Bus: ${trip.bus.name} (${trip.bus.plate})   ·   Chofer: ${trip.driver?.fullName ?? 'sin asignar'}`,
    10,
    false,
    GREY,
  );
  title(4, `Pasajeros con pago confirmado: ${rows.length}`, 11);

  const header = ws.getRow(6);
  header.values = ['N°', 'Nombre y apellido', 'WhatsApp', 'Código', 'Subida 1ra', 'Subida 2da', 'Observaciones'];
  header.height = 22;
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const border = { style: 'thin' as const, color: { argb: 'FFB7C0CA' } };
  rows.forEach((p, i) => {
    const row = ws.addRow({ n: i + 1, name: p.fullName, phone: phoneFmt(p.phone), code: p.code, check1: '☐', check2: '☐', notes: '' });
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = { top: border, left: border, bottom: border, right: border };
      c.alignment = { vertical: 'middle', horizontal: col === 2 || col === 7 ? 'left' : 'center' };
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F8' } };
    });
    row.getCell('check1').font = { size: 16 };
    row.getCell('check2').font = { size: 16 };
    row.getCell('name').font = { bold: true };
  });

  if (rows.length === 0) {
    const r = ws.addRow({ name: 'Todavía no hay pasajeros con pago confirmado.' });
    r.getCell('name').font = { italic: true, color: { argb: GREY } };
  }

  ws.addRow([]);
  const total = ws.addRow({ name: `Total: ${rows.length} pasajeros`, code: 'Subieron:', check1: '____', check2: '____' });
  total.getCell('name').font = { bold: true };
  total.getCell('code').font = { bold: true };
  total.getCell('name').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_LIGHT } };

  const day = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(trip.departureTime);
  const time = new Intl.DateTimeFormat('es-PY', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(trip.departureTime)
    .replace(':', '');
  const filename = `pasajeros-${slug(trip.route.origin)}-${slug(trip.route.destination)}-${day}-${time}.xlsx`;

  const buffer = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return { buffer, filename };
}
