// Mensajes de WhatsApp listos para mandar desde el panel admin.
import { dateTime, gs } from './format';

interface Msg {
  code: string;
  name: string;
  origin: string;
  destination: string;
  departureTime: string;
  passengers: number;
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? '';
const people = (n: number) => (n === 1 ? '1 pasajero' : `${n} pasajeros`);

export function msgConfirmed(b: Msg) {
  return [
    `¡Hola ${firstName(b.name)}! Recibimos tu pago 🙌`,
    `Tu reserva *${b.code}* está *CONFIRMADA*.`,
    '',
    `🚌 ${b.origin} › ${b.destination}`,
    `📅 ${dateTime(b.departureTime)}`,
    `👥 ${people(b.passengers)}`,
    '',
    'Al subir mostrá este código y tu cédula. ¡Buen viaje!',
    'JC Transporte',
  ].join('\n');
}

export function msgReminder(b: Msg & { total: number; deadline: string }) {
  return [
    `Hola ${firstName(b.name)}, te escribimos de JC Transporte.`,
    `Tu reserva *${b.code}* (${b.origin} › ${b.destination}, ${dateTime(b.departureTime)}) está *pendiente de pago*.`,
    '',
    `Total: ${gs(b.total)}`,
    `Tu lugar se asegura con el pago (los lugares son para los primeros que pagan). Tenés tiempo hasta el ${dateTime(b.deadline)}.`,
    '',
    'Cuando transfieras, mandanos el comprobante por acá. ¡Gracias!',
  ].join('\n');
}

export function msgCancelled(b: Msg & { reason: string; wasPaid: boolean }) {
  return [
    `Hola ${firstName(b.name)}, te escribimos de JC Transporte.`,
    `Tu reserva *${b.code}* (${b.origin} › ${b.destination}, ${dateTime(b.departureTime)}) fue *cancelada*.`,
    `Motivo: ${b.reason}`,
    '',
    b.wasPaid
      ? 'Como ya habías pagado, respondé este mensaje y coordinamos la devolución o el cambio de fecha.'
      : 'Si querés reservar otro horario, respondé este mensaje y te ayudamos.',
  ].join('\n');
}

/** Viaje grupal: se armó el viaje, el enlace para que cada uno reserve y pague */
export function msgGroupReady(b: { name: string; origin: string; destination: string; departureTime: string; price: number; link: string }) {
  return [
    `¡Hola ${firstName(b.name)}! Te escribimos de JC Transporte 🎉`,
    `Ya está armado el viaje de tu grupo:`,
    '',
    `🚌 ${b.origin} › ${b.destination}`,
    `📅 ${dateTime(b.departureTime)}`,
    `💵 ${gs(b.price)} por persona`,
    '',
    'Pasale este enlace a tu grupo. Cada uno reserva su lugar y paga por transferencia:',
    b.link,
    '',
    'El enlace es solo para ustedes, no aparece en la página. ¡Gracias por elegirnos!',
  ].join('\n');
}

/** Viaje grupal: no se puede hacer */
export function msgGroupDismissed(b: { name: string; origin: string; destination: string; dateLabel: string }) {
  return [
    `Hola ${firstName(b.name)}, te escribimos de JC Transporte.`,
    `Gracias por pedirnos el viaje ${b.origin} › ${b.destination} del ${b.dateLabel}. Lamentablemente esta vez no lo podemos hacer.`,
    '',
    'Si quieren otra fecha, respondé este mensaje y lo vemos. ¡Gracias!',
  ].join('\n');
}
