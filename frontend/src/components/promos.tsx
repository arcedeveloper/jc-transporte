'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Sparkles, Users } from 'lucide-react';
import { api, promoImageUrl } from '@/lib/api';
import { dateTime, gs } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { FeaturedTrip, PromoLayout } from '@/lib/types';
import { usePublicInfo } from './public-info';
import { Spinner, cn } from './ui';

/**
 * Imagen de publicidad: se ve entera (no se recorta el logo ni el texto del flyer).
 * Atrás va la misma imagen borrosa para rellenar el espacio que sobra.
 */
export function PromoImage({
  imageId,
  title,
  layout,
  className,
}: {
  imageId: string | null;
  title: string;
  layout: PromoLayout;
  className?: string;
}) {
  const ratio = layout === 'wide' ? 'aspect-[2/1]' : 'aspect-square';
  if (!imageId) {
    return (
      <div className={cn('grid place-items-center bg-ruta p-6 text-center', ratio, className)}>
        <span className="text-balance font-display text-4xl font-bold leading-none text-ambar sm:text-5xl">{title}</span>
      </div>
    );
  }
  const src = promoImageUrl(imageId);
  return (
    <div className={cn('relative overflow-hidden bg-ruta', ratio, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="relative size-full object-contain" loading="lazy" />
    </div>
  );
}

const tripTitle = (t: FeaturedTrip) => t.promo.title || `${t.origin} › ${t.destination}`;

function TripPromoCard({ t, i }: { t: FeaturedTrip; i: number }) {
  const wide = t.promo.layout === 'wide';
  const few = t.bookable && t.availableSeats <= 4;
  const badge = t.closed ? 'Reservas cerradas' : t.soldOut ? 'Cupo lleno' : few ? `¡Últimos ${t.availableSeats}!` : null;

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(i, 6) * 0.05 }}
      className={cn(wide && 'sm:col-span-2')}
    >
      <Link
        href={`/viaje/${t.id}`}
        className={cn(
          'group flex h-full flex-col overflow-hidden rounded-2xl border border-linea bg-white transition hover:-translate-y-0.5 hover:shadow-lg',
          !t.bookable && 'opacity-80',
        )}
      >
        <div className="relative">
          <PromoImage imageId={t.promo.imageId} title={tripTitle(t)} layout={t.promo.layout} />
          {badge && (
            <span
              className={cn(
                'absolute right-3 top-3 rounded-full px-3 py-1 text-sm font-bold shadow',
                t.bookable ? 'bg-ambar text-ruta-dark' : 'bg-tierra text-white',
              )}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-2xl font-bold leading-tight text-ruta">{tripTitle(t)}</h3>
          {t.promo.title && (
            <p className="text-sm text-niebla">
              {t.origin} › {t.destination}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-sm font-bold">
            <CalendarDays className="size-4 text-ruta" aria-hidden /> {dateTime(t.departureTime)}
          </p>
          {t.promo.text && <p className={cn('mt-2 text-sm text-niebla', !wide && 'line-clamp-3')}>{t.promo.text}</p>}
          <div className="mt-auto flex items-end justify-between gap-2 pt-4">
            <span>
              <span className="block font-display text-2xl font-bold text-ruta">
                {gs(t.price)}
                <span className="font-sans text-sm font-normal text-niebla"> por persona</span>
              </span>
              {t.bookable && (
                <span className={cn('flex items-center gap-1 text-sm', few ? 'font-bold text-tierra' : 'text-niebla')}>
                  <Users className="size-4" aria-hidden /> {t.availableSeats} lugar{t.availableSeats === 1 ? '' : 'es'} libre
                  {t.availableSeats === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1 font-bold text-ruta group-hover:underline">
              {t.bookable ? 'Reservar' : 'Ver'} <ArrowRight className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

/** Última tarjeta: viaje grupal a medida */
function GroupCard({ i }: { i: number }) {
  const info = usePublicInfo();
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(i, 6) * 0.05 }}
    >
      <Link
        href="/viaje-grupal"
        className="group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-dashed border-ruta/40 bg-ruta-50 transition hover:-translate-y-0.5 hover:border-ruta hover:shadow-lg"
      >
        <div className="grid aspect-square place-items-center bg-ruta p-6 text-center text-white">
          <div>
            <Users className="mx-auto size-14 text-ambar" aria-hidden />
            <p className="mt-3 font-display text-4xl font-bold leading-none">Viaje grupal personalizado</p>
            <p className="mt-2 text-white/75">Ustedes eligen a dónde y cuándo</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <ul className="space-y-1.5 text-sm">
            <li>
              👥 Grupos de <strong>{info.groupMinPeople} a {info.groupMaxPeople} personas</strong>
            </li>
            <li>
              📅 Con al menos <strong>{info.groupMinDays} días</strong> de anticipación
            </li>
            <li>💬 Te pasamos el precio por WhatsApp. Se paga cuando el viaje está armado.</li>
          </ul>
          <span className="mt-auto flex items-center gap-1 pt-4 font-bold text-ruta group-hover:underline">
            Pedir mi viaje grupal <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </Link>
    </motion.li>
  );
}

/** Portada: los viajes publicados (como publicidad) y al final el viaje grupal. */
export function FeaturedTrips() {
  const { data, loading } = useQuery(() => api<{ trips: FeaturedTrip[] }>('/api/trips/featured'), [], { live: true });
  const trips = data?.trips ?? [];
  return (
    <section id="salidas" className="mx-auto max-w-6xl scroll-mt-6 px-4" aria-labelledby="salidas-title">
      <p className="flex items-center justify-center gap-2 font-bold text-ambar-dark">
        <Sparkles className="size-5" aria-hidden /> Próximas salidas
      </p>
      <h2 id="salidas-title" className="text-center font-display text-4xl font-bold text-ruta sm:text-5xl">
        Elegí tu viaje
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-center text-niebla">
        Tocá una salida, reservá tu lugar y pagá. Te confirmamos por WhatsApp.
      </p>
      {loading ? (
        <Spinner label="Cargando salidas…" />
      ) : (
        <ul className="mt-6 grid grid-flow-row-dense gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t, i) => (
            <TripPromoCard key={t.id} t={t} i={i} />
          ))}
          <GroupCard i={trips.length} />
        </ul>
      )}
      {!loading && trips.length === 0 && (
        <p className="mt-4 text-center text-niebla">Pronto publicamos nuevas salidas. Mientras tanto, podés pedir un viaje para tu grupo o dejarnos una sugerencia.</p>
      )}
    </section>
  );
}
