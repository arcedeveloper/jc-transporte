'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, MapPin, Radio, ShieldCheck, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { onDataChanged } from '@/lib/socket';
import { BASE_PATH } from '@/lib/paths';
import type { FeaturedTrip, RouteOption } from '@/lib/types';
import { LedSign } from './led-sign';
import { usePublicInfo } from './public-info';
import { buttonClass, cn } from './ui';

/** Destinos de las salidas publicadas en la portada (sin repetir), para el cartel. */
export async function fetchSignRoutes(): Promise<RouteOption[]> {
  const { trips } = await api<{ trips: FeaturedTrip[] }>('/api/trips/featured');
  const seen = new Set<string>();
  const out: RouteOption[] = [];
  for (const t of trips) {
    const k = `${t.origin}|${t.destination}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ origin: t.origin, destination: t.destination, durationMinutes: t.durationMinutes, basePrice: t.price, imageUrl: null });
  }
  return out;
}

/**
 * Qué muestra el cartel: siempre "JC TRANSPORTE", y después las próximas salidas
 * publicadas y/o los mensajes cargados en Admin → Ajustes. Van rotando uno por uno.
 */
export function signLines(routes: RouteOption[], messages: string[], showRoutes: boolean, loaded = true) {
  const BRAND = 'JC TRANSPORTE';
  const routeLines = routes.map((r) => `${r.origin}  ›  ${r.destination}`);
  const extra = loaded ? [...((showRoutes ?? true) ? routeLines : []), ...(messages ?? [])] : routeLines;
  // Sin repetir el nombre si alguien también lo cargó como mensaje
  return [BRAND, ...extra.filter((l) => l.trim().toUpperCase() !== BRAND)];
}

export function Hero() {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const info = usePublicInfo();
  const lines = signLines(routes, info.signMessages, info.signShowRoutes, info.loaded);

  useEffect(() => {
    const load = () =>
      fetchSignRoutes()
        .then(setRoutes)
        .catch(() => undefined);
    void load();
    // El cartel se actualiza solo cuando publicás o cambiás un viaje
    return onDataChanged(() => void load());
  }, []);

  return (
    <section className="relative isolate overflow-hidden bg-ruta pb-16 pt-8 sm:pb-20 sm:pt-12">
      {/* Foto del bus de fondo, borrosa y oscurecida para que el texto se lea */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE_PATH}/hero-bus.jpg`}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 size-full scale-105 object-cover object-[30%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ruta/70 via-ruta/60 to-ruta/90" aria-hidden />
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <LedSign lines={lines} className="mx-auto max-w-xl" />
          <h1 className="mt-8 text-balance font-display text-5xl font-bold leading-[0.95] text-white sm:text-7xl">
            Tu lugar, reservado desde tu comodidad.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
            Reservá en un minuto, pagá y subí tranquilo.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="#salidas" className={buttonClass('accent', 'lg')}>
              Ver próximas salidas
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const steps = [
  { title: 'Elegí tu salida', text: 'Tocá el viaje que te guste, decinos cuántos viajan y completá nombre y cédula de cada pasajero. Te lleva un minuto.' },
  { title: 'Transferí el pasaje', text: 'Te mostramos la cuenta y el monto exacto. Podés copiar cada dato con un toque.' },
  { title: 'Mandá el comprobante', text: 'Un botón abre WhatsApp con el mensaje listo. Confirmamos tu reserva en menos de 24 hs y te avisamos por WhatsApp.' },
];

export function HowItWorks() {
  return (
    <section className="mx-auto mt-24 max-w-3xl px-4" aria-labelledby="como">
      <h2 id="como" className="text-center font-display text-4xl font-bold text-ruta">
        Cómo reservar
      </h2>
      <ol className="mx-auto mt-8 max-w-xl space-y-8">
        {steps.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-ambar font-display text-2xl font-bold text-ruta-dark" aria-hidden>
              {i + 1}
            </span>
            <div>
              <h3 className="text-xl font-bold">{s.title}</h3>
              <p className="mt-1 max-w-prose text-niebla">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const reasons = [
  { icon: Users, title: 'Grupos chicos', text: 'Buses de pocos pasajeros: más espacio, menos espera para subir y bajar.' },
  { icon: Radio, title: 'Seguimiento en vivo', text: 'Desde la oficina vemos dónde está el bus durante todo el viaje.' },
  { icon: ShieldCheck, title: 'Tu lugar asegurado', text: 'Nunca vendemos más lugares de los que hay.' },
];

export function Reasons() {
  return (
    <section className="mt-24 bg-white py-16" aria-labelledby="porque">
      <div className="mx-auto max-w-5xl px-4">
        <h2 id="porque" className="text-center font-display text-4xl font-bold text-ruta">
          Por qué viajar con nosotros
        </h2>
        <ul className="mt-10 grid gap-10 sm:grid-cols-3">
          {reasons.map(({ icon: Icon, title, text }) => (
            <li key={title} className="text-center">
              <Icon className="mx-auto size-8 text-ambar-dark" aria-hidden />
              <h3 className="mt-3 text-xl font-bold">{title}</h3>
              <p className="mt-1 text-niebla">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Opiniones de pasajeros. Cargá acá opiniones REALES (con permiso del pasajero).
 * Si la lista está vacía, la sección no se muestra.
 */
const testimonials: { name: string; city: string; text: string }[] = [
  // { name: 'Nombre', city: 'Ciudad', text: 'Lo que dijo el pasajero.' },
];

export function Testimonials() {
  if (!testimonials.length) return null;
  return (
    <section className="mx-auto mt-24 max-w-5xl px-4" aria-labelledby="opiniones">
      <h2 id="opiniones" className="text-center font-display text-4xl font-bold text-ruta">
        Lo que dicen los pasajeros
      </h2>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2">
        {testimonials.map((t) => (
          <li key={t.name} className="border-l-4 border-ambar pl-5">
            <blockquote className="text-lg">“{t.text}”</blockquote>
            <p className="mt-2 font-bold text-niebla">
              {t.name}, {t.city}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const faqs = [
  {
    q: '¿Cómo pago el pasaje?',
    a: 'Por transferencia bancaria. Después de reservar te mostramos los datos de la cuenta y el monto. Cuando transferís, nos mandás el comprobante por WhatsApp.',
  },
  {
    q: '¿Cuánto tiempo tengo para pagar?',
    a: 'Hasta 24 horas después de reservar (o hasta la salida del bus, si es antes). Ojo: el lugar se asegura con el pago, así que los lugares son para los primeros que pagan. Si no recibimos el pago a tiempo, la reserva se cancela sola.',
  },
  {
    q: '¿Cómo sé que mi reserva está confirmada?',
    a: 'Te escribimos por WhatsApp apenas confirmamos el pago. También podés verlo en cualquier momento en “Mi reserva”, con tu código y tu teléfono.',
  },
  {
    q: '¿Y si quiero ir a otro lugar u otro día?',
    a: 'Si son un grupo (de 12 a 17 personas), pedí un “Viaje grupal personalizado”: ustedes eligen destino y fecha, con al menos 5 días de anticipación, y pagan cuando el viaje está armado. Si viajás solo, dejanos una sugerencia: con las ideas que más se repiten armamos las próximas salidas.',
  },
  {
    q: '¿Puedo cambiar o cancelar mi pasaje?',
    a: 'Escribinos por WhatsApp con tu código de reserva y te ayudamos.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="preguntas" className="mx-auto mt-24 max-w-3xl scroll-mt-6 px-4" aria-labelledby="faq">
      <h2 id="faq" className="text-center font-display text-4xl font-bold text-ruta">
        Preguntas frecuentes
      </h2>
      <div className="mt-6 divide-y divide-linea rounded-2xl border border-linea bg-white">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <h3>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lg font-bold"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  {f.q}
                  <ChevronDown className={cn('size-5 shrink-0 text-ruta transition-transform', isOpen && 'rotate-180')} aria-hidden />
                </button>
              </h3>
              <div id={`faq-${i}`} hidden={!isOpen} className="px-5 pb-5 text-niebla">
                {f.a}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-center text-niebla">
        <MapPin className="size-5 text-ambar-dark" aria-hidden />
        ¿Otra duda? Tocá el botón verde de WhatsApp y te respondemos.
      </p>
    </section>
  );
}
