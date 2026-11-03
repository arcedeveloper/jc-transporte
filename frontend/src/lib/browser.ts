// Utilidades que solo funcionan en el navegador. Llamarlas dentro de useEffect o en eventos.

/** UUID v4. crypto.randomUUID no existe en http:// (ej: probando desde el celular por wifi). */
export function uuid() {
  const c = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado: no pasa nada */
  }
}

/** Identificador anónimo de este navegador para retener asientos. */
export function getSessionId() {
  let id = safeGet('jc-session');
  if (!id) {
    id = uuid();
    safeSet('jc-session', id);
  }
  return id;
}

export interface SavedBooking {
  code: string;
  phone: string;
  label: string; // "Asunción → Encarnación"
  departureTime: string;
}

/** Reservas hechas desde este celular, para encontrarlas fácil en "Mi reserva". */
export function getSavedBookings(): SavedBooking[] {
  try {
    // .filter: las reservas guardadas por versiones viejas no tienen teléfono
    return (JSON.parse(safeGet('jc-bookings') ?? '[]') as SavedBooking[]).filter((b) => b.phone);
  } catch {
    return [];
  }
}

export function saveBooking(b: SavedBooking) {
  const list = getSavedBookings().filter((x) => x.code !== b.code);
  safeSet('jc-bookings', JSON.stringify([b, ...list].slice(0, 20)));
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
