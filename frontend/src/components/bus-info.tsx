'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bus, ChevronLeft, ChevronRight, Images, Users } from 'lucide-react';
import { busPhotoUrl } from '@/lib/api';
import type { BusPublic } from '@/lib/types';
import { Modal, cn } from './ui';

/** Galería: foto grande + miniaturas. Se navega tocando las miniaturas o las flechas. */
export function BusGallery({ photoIds, name }: { photoIds: string[]; name: string }) {
  const [i, setI] = useState(0);
  if (!photoIds.length) return null;
  const current = photoIds[i % photoIds.length]!;
  const go = (d: number) => setI((x) => (x + d + photoIds.length) % photoIds.length);

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-papel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={current}
            src={busPhotoUrl(current)}
            alt={`${name}, foto ${i + 1} de ${photoIds.length}`}
            className="absolute inset-0 size-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>
        {photoIds.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ruta shadow"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ruta shadow"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      {photoIds.length > 1 && (
        <div className="mt-2 flex gap-2">
          {photoIds.map((id, j) => (
            <button
              key={id}
              type="button"
              onClick={() => setI(j)}
              className={cn('h-14 w-20 overflow-hidden rounded-lg border-2', j === i ? 'border-ruta' : 'border-transparent opacity-70')}
              aria-label={`Ver foto ${j + 1}`}
              aria-current={j === i}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={busPhotoUrl(id)} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tarjeta "Tu bus": fotos, capacidad y descripción. */
export function BusCard({ bus }: { bus: BusPublic }) {
  return (
    <section className="rounded-2xl border border-linea bg-white p-5" aria-labelledby="tu-bus">
      <h2 id="tu-bus" className="flex items-center gap-2 text-lg font-bold">
        <Bus className="size-5 text-ruta" aria-hidden /> Tu bus: {bus.name}
      </h2>
      <p className="mt-1 flex items-center gap-1.5 text-niebla">
        <Users className="size-4" aria-hidden /> {bus.capacity} lugares
        {bus.description && <span className="text-tinta">. {bus.description}</span>}
      </p>
      {bus.photoIds.length > 0 && (
        <div className="mt-4">
          <BusGallery photoIds={bus.photoIds} name={bus.name} />
        </div>
      )}
    </section>
  );
}

/** Miniatura del bus en la lista de horarios; al tocarla abre las fotos. */
export function BusThumb({ bus }: { bus: BusPublic }) {
  const [open, setOpen] = useState(false);
  const first = bus.photoIds[0];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 text-left"
        aria-label={`Ver el ${bus.name}`}
      >
        <span className="relative grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-ruta-50 text-ruta">
          {first ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={busPhotoUrl(first)} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <Bus className="size-6" aria-hidden />
          )}
          {bus.photoIds.length > 1 && (
            <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">
              <Images className="size-2.5" /> {bus.photoIds.length}
            </span>
          )}
        </span>
        <span className="text-sm">
          <span className="block font-bold text-tinta group-hover:underline">{bus.name}</span>
          <span className="text-niebla">{bus.capacity} lugares</span>
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={bus.name} wide>
        {bus.description && <p className="mb-4 text-lg">{bus.description}</p>}
        {bus.photoIds.length ? (
          <BusGallery photoIds={bus.photoIds} name={bus.name} />
        ) : (
          <p className="text-niebla">Todavía no hay fotos de este bus.</p>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-niebla">
          <Users className="size-4" aria-hidden /> {bus.capacity} lugares
        </p>
      </Modal>
    </>
  );
}
