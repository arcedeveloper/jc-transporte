'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CircleCheck, Minus, Plus, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { addDaysStr, dateStrLong, docClean, docInput, todayPY, waLink } from '@/lib/format';
import type { LocationsResponse, TimeSlot } from '@/lib/types';
import { usePublicInfo } from './public-info';
import { WhatsAppIcon } from './whatsapp-icon';
import { Button, Input, buttonClass, cn } from './ui';

const SLOTS: [TimeSlot, string][] = [
  ['morning', 'Mañana'],
  ['afternoon', 'Tarde'],
  ['night', 'Noche'],
  ['any', 'Nos da igual'],
];

type Form = {
  origin: string;
  destination: string;
  date: string;
  returnDate: string;
  preferredTime: TimeSlot;
  passengers: number;
  fullName: string;
  document: string;
  contactPhone: string;
  notes: string;
};

/** Viaje grupal personalizado: un grupo elige destino y fecha. No paga hasta que el viaje está armado. */
export function GroupRequestForm() {
  const info = usePublicInfo();
  const min = info.groupMinPeople;
  const max = info.groupMaxPeople;
  const [today, setToday] = useState<string | null>(null);
  const [places, setPlaces] = useState<string[]>([]);
  const [form, setForm] = useState<Form>({
    origin: '',
    destination: '',
    date: '',
    returnDate: '',
    preferredTime: 'any',
    passengers: 12,
    fullName: '',
    document: '',
    contactPhone: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState<Form | null>(null);

  useEffect(() => {
    setToday(todayPY());
    api<LocationsResponse>('/api/trips/locations')
      .then((l) => setPlaces([...new Set([...l.origins, ...l.destinations])].sort((a, b) => a.localeCompare(b, 'es'))))
      .catch(() => undefined);
    try {
      const c = JSON.parse(localStorage.getItem('jc-contact') ?? 'null') as { phone?: string; name?: string } | null;
      if (c) setForm((f) => ({ ...f, contactPhone: c.phone ?? '', fullName: c.name ?? '' }));
    } catch {
      /* nada */
    }
  }, []);

  // Si cambian las reglas (Ajustes), la cantidad queda dentro del rango
  useEffect(() => {
    if (info.loaded) setForm((f) => ({ ...f, passengers: Math.min(max, Math.max(min, f.passengers)) }));
  }, [info.loaded, min, max]);

  const earliest = useMemo(() => (today ? addDaysStr(today, info.groupMinDays) : ''), [today, info.groupMinDays]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<keyof Form, string>> = {};
    if (form.origin.trim().length < 2) errs.origin = 'Escribí desde dónde salen';
    if (form.destination.trim().length < 2) errs.destination = 'Escribí a dónde quieren ir';
    if (!form.date) errs.date = 'Elegí la fecha';
    else if (form.date < earliest) errs.date = `Tiene que ser desde el ${dateStrLong(earliest).toLowerCase()}`;
    if (form.returnDate && form.date && form.returnDate < form.date) errs.returnDate = 'La vuelta tiene que ser después de la ida';
    if (form.fullName.trim().length < 3) errs.fullName = 'Escribí tu nombre y apellido';
    if (form.document.trim().length < 3) errs.document = 'Escribí tu cédula';
    if (form.contactPhone.replace(/\D/g, '').length < 6) errs.contactPhone = 'Escribí tu WhatsApp';
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await api('/api/group-requests', {
        method: 'POST',
        body: {
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          date: form.date,
          returnDate: form.returnDate || undefined,
          preferredTime: form.preferredTime,
          passengers: form.passengers,
          fullName: form.fullName.trim(),
          document: docClean(form.document),
          contactPhone: form.contactPhone.trim(),
          notes: form.notes.trim() || undefined,
        },
      });
      try {
        const prev = JSON.parse(localStorage.getItem('jc-contact') ?? '{}') as Record<string, string>;
        localStorage.setItem('jc-contact', JSON.stringify({ ...prev, phone: form.contactPhone.trim(), name: form.fullName.trim() }));
      } catch {
        /* nada */
      }
      setDone(form);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const msg = `Hola, soy ${done.fullName}. Pedí un viaje grupal ${done.origin} › ${done.destination} para el ${dateStrLong(done.date).toLowerCase()}, somos ${done.passengers}.`;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-linea sm:p-8">
          <p className="flex items-center gap-2 text-xl font-bold text-monte">
            <CircleCheck className="size-7" /> ¡Recibimos tu pedido!
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold text-ruta">
            {done.origin} › {done.destination}
          </h1>
          <p className="mt-1 text-lg">
            {dateStrLong(done.date)}, {done.passengers} personas
          </p>
          <p className="mt-5">
            Te escribimos por <strong>WhatsApp</strong> al {done.contactPhone} con el precio y el horario. Cuando el viaje esté armado, te mandamos un
            enlace para que cada uno de tu grupo reserve y pague su lugar. <strong>Hasta entonces no pagás nada.</strong>
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {info.whatsapp && (
              <a href={waLink(info.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className={buttonClass('whatsapp', 'md')}>
                <WhatsAppIcon className="size-5" /> Escribirnos ahora
              </a>
            )}
            <Link href="/" className={buttonClass('outline', 'md')}>
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="flex items-center gap-2 font-bold text-ambar-dark">
        <Users className="size-5" aria-hidden /> Viaje grupal personalizado
      </p>
      <h1 className="font-display text-5xl font-bold leading-none text-ruta">Armamos el viaje de tu grupo</h1>
      <p className="mt-3 max-w-prose text-lg text-niebla">
        Ustedes eligen a dónde van y qué día. Nosotros ponemos el bus y el chofer.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Requisitos">
        <Req icon={<Users className="size-6" />} title={`${min} a ${max} personas`} text="Es el tamaño del grupo que entra en nuestros buses." />
        <Req icon={<CalendarDays className="size-6" />} title={`${info.groupMinDays} días antes`} text="Pedilo con anticipación, así preparamos todo." />
        <Req icon={<WhatsAppIcon className="size-6" />} title="Pagás después" text="Primero te pasamos el precio. Se paga cuando el viaje está armado." />
      </section>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-linea sm:p-8" noValidate>
        <datalist id="lugares">
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <fieldset className="space-y-4">
          <legend className="text-lg font-bold">El viaje</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="¿Desde dónde salen?"
              list="lugares"
              placeholder="Ej: Fernando de la Mora"
              value={form.origin}
              onChange={(e) => set('origin', e.target.value)}
              error={errors.origin}
            />
            <Input
              label="¿A dónde quieren ir?"
              list="lugares"
              placeholder="Ej: Concepción"
              value={form.destination}
              onChange={(e) => set('destination', e.target.value)}
              error={errors.destination}
            />
            <Input
              label="Fecha de ida"
              type="date"
              min={earliest}
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              error={errors.date}
              hint={earliest ? `Desde el ${dateStrLong(earliest).toLowerCase()}` : undefined}
            />
            <Input
              label="Fecha de vuelta (opcional)"
              type="date"
              min={form.date || earliest}
              value={form.returnDate}
              onChange={(e) => set('returnDate', e.target.value)}
              error={errors.returnDate}
              hint="Si vuelven otro día"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-bold">¿Cuántos son?</p>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set('passengers', Math.max(min, form.passengers - 1))}
                  disabled={form.passengers <= min}
                  className="grid size-12 place-items-center rounded-xl border-2 border-linea bg-white text-ruta disabled:opacity-40"
                  aria-label="Uno menos"
                >
                  <Minus className="size-5" />
                </button>
                <span className="w-12 text-center font-display text-4xl font-bold" aria-live="polite">
                  {form.passengers}
                </span>
                <button
                  type="button"
                  onClick={() => set('passengers', Math.min(max, form.passengers + 1))}
                  disabled={form.passengers >= max}
                  className="grid size-12 place-items-center rounded-xl border-2 border-linea bg-white text-ruta disabled:opacity-40"
                  aria-label="Uno más"
                >
                  <Plus className="size-5" />
                </button>
              </div>
              <p className="mt-1 text-sm text-niebla">
                De {min} a {max} personas
              </p>
            </div>
            <div>
              <p className="text-sm font-bold">¿A qué hora prefieren salir?</p>
              <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Horario preferido">
                {SLOTS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={form.preferredTime === k}
                    onClick={() => set('preferredTime', k)}
                    className={cn(
                      'h-11 rounded-full border-2 px-4 font-bold',
                      form.preferredTime === k ? 'border-ruta bg-ruta text-white' : 'border-linea bg-white text-ruta',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-linea pt-6">
          <legend className="text-lg font-bold">Quién organiza</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre y apellido"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              error={errors.fullName}
            />
            <Input
              label="Cédula"
              inputMode="numeric"
              placeholder="Ej: 4.567.890"
              value={form.document}
              onChange={(e) => set('document', docInput(e.target.value))}
              error={errors.document}
            />
            <Input
              label="Tu WhatsApp"
              type="tel"
              inputMode="tel"
              placeholder="0981 123 456"
              value={form.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              error={errors.contactPhone}
            />
          </div>
          <Input
            label="Algo más que debamos saber (opcional)"
            placeholder="Ej: es un paseo del colegio, queremos parar a almorzar"
            maxLength={500}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </fieldset>

        {sendError && (
          <p className="text-tierra" role="alert">
            {sendError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={sending}>
          Pedir mi viaje grupal
        </Button>
        <p className="text-sm text-niebla">Pedirlo no te compromete a nada. Te respondemos por WhatsApp.</p>
      </form>
    </div>
  );
}

function Req({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-linea">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ambar-50 text-ambar-dark">{icon}</span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="text-sm text-niebla">{text}</span>
      </span>
    </div>
  );
}
