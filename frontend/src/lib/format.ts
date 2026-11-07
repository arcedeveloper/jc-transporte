// Todo se muestra en hora de Paraguay, sin importar dónde esté el navegador o el servidor.
export const TZ = 'America/Asuncion';

const numberFmt = new Intl.NumberFormat('es-PY');
export const gs = (n: number) => `Gs. ${numberFmt.format(n)}`;
/** 1500 → "1.500" */
export const num = (n: number) => numberFmt.format(n);

const timeFmt = new Intl.DateTimeFormat('es-PY', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
export const hhmm = (d: string | Date) => timeFmt.format(new Date(d));

const dayFmt = new Intl.DateTimeFormat('es-PY', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
export const dayLong = (d: string | Date) => capitalize(dayFmt.format(new Date(d)));

const dayShortFmt = new Intl.DateTimeFormat('es-PY', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const dayShort = (d: string | Date) => capitalize(dayShortFmt.format(new Date(d)).replace(/\./g, ''));

const dateTimeFmt = new Intl.DateTimeFormat('es-PY', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
export const dateTime = (d: string | Date) => capitalize(dateTimeFmt.format(new Date(d)).replace(/\./g, ''));

/** Retorno: "18:00" si es el mismo día de la salida, si no "Sáb, 7 nov, 18:00" */
export function returnLabel(departure: string | Date, ret: string | Date) {
  const day = (d: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date(d));
  return day(departure) === day(ret) ? hhmm(ret) : dateTime(ret);
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Fecha de hoy en Paraguay: "2026-10-25" */
export function todayPY() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Suma días a "2026-10-25" */
export function addDaysStr(date: string, n: number) {
  const d = new Date(`${date}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

/** "2026-10-25" → "Domingo 25 de octubre" */
export const dateStrLong = (date: string) => dayLong(`${date}T12:00:00-03:00`);

/** "hace 5 s", "hace 3 min", "hace 2 h" */
export function ago(d: string | Date | number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** "0981 123 456" → "595981123456" (para links de WhatsApp) */
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('595')) return d;
  if (d.startsWith('0')) return `595${d.slice(1)}`;
  if (d.length === 9) return `595${d}`;
  return d;
}

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** Para inputs datetime: "2026-10-25" + "07:30" → ISO en hora de Paraguay */
export const toIsoPY = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).toISOString();

/** ISO → { date: "2026-10-25", time: "07:30" } en hora de Paraguay */
export function fromIsoPY(iso: string) {
  const d = new Date(iso);
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d),
    time: hhmm(d),
  };
}

/* ---------- Números con separador de miles (120.000) ---------- */

/** "120000" o "120.000" → "120.000". Solo dígitos; ignora todo lo demás. */
export function groupDigits(s: string) {
  const digits = s.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Igual que groupDigits pero acepta decimales con coma: "1234,5" → "1.234,5" */
export function groupDecimal(s: string) {
  const clean = s.replace(/[^\d,]/g, '');
  const [int = '', ...rest] = clean.split(',');
  const dec = rest.join('').slice(0, 2);
  return groupDigits(int) + (clean.includes(',') ? `,${dec}` : '');
}

/** "120.000" → 120000 · "1.234,5" → 1234.5 */
export function parseNumber(s: string) {
  return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
}

/** Número → texto con puntos para precargar un campo: 120000 → "120.000", 365.5 → "365,5" */
export function numberToInput(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  const [int, dec] = String(n).split('.');
  return groupDigits(int!) + (dec ? `,${dec.slice(0, 2)}` : '');
}

/** Cédula: si son solo números se muestra con puntos (6.018.795); si tiene letras, tal cual */
export function docFmt(doc: string) {
  return /^[\d.\s]+$/.test(doc) ? groupDigits(doc) : doc;
}

/** Mientras se escribe: si son solo números, se ponen los puntos (4567890 → 4.567.890) */
export function docInput(v: string) {
  return /^[\d.\s]*$/.test(v) ? groupDigits(v) : v.slice(0, 20);
}

/** Cédula para guardar: sin puntos si es numérica, así la búsqueda funciona igual */
export function docClean(doc: string) {
  const t = doc.trim();
  return /^[\d.\s]+$/.test(t) ? t.replace(/\D/g, '') : t;
}
