import { BUSINESS_TZ } from '../config/business.js';

export const formatGs = (n: number) =>
  new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n);

export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat('es-PY', { timeZone: BUSINESS_TZ, dateStyle: 'full', timeStyle: 'short' }).format(d);

export const whatsappLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/** Escapa texto para meterlo dentro de HTML. */
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "0981 123-456", "+595 981 123456" → "981123456" (para comparar teléfonos de Paraguay) */
export function phoneKey(phone: string) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('595')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Cédula numérica sin puntos ("6.018.795" → "6018795"); si tiene letras queda igual */
export const docClean = (doc: string) => (/^[\d.\s]+$/.test(doc.trim()) ? doc.replace(/\D/g, '') : doc.trim());

/** Cédula para mostrar: "6018795" → "6.018.795" */
export const docFmt = (doc: string) =>
  /^\d+$/.test(doc) ? doc.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : doc;
