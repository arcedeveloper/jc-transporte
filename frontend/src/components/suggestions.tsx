'use client';

import { useState } from 'react';
import { CircleCheck, Lightbulb } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button, Input } from './ui';

const empty = { destination: '', origin: '', whenText: '', message: '', name: '', contactPhone: '' };

/** "¿A dónde te gustaría viajar?": la gente deja ideas de destinos y fechas. */
export function SuggestionsSection() {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.destination.trim().length < 2) return setError('Contanos a dónde te gustaría viajar');
    setSending(true);
    setError(null);
    try {
      await api('/api/suggestions', {
        method: 'POST',
        body: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined])),
      });
      setSent(true);
      setForm(empty);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="sugerencias" className="mx-auto mt-24 max-w-3xl scroll-mt-6 px-4" aria-labelledby="sug-title">
      <p className="flex items-center justify-center gap-2 font-bold text-ambar-dark">
        <Lightbulb className="size-5" aria-hidden /> Sugerencias
      </p>
      <h2 id="sug-title" className="text-center font-display text-4xl font-bold text-ruta">
        ¿A dónde te gustaría viajar?
      </h2>
      <p className="mx-auto mt-2 max-w-prose text-center text-niebla">
        Contanos qué destino o qué fecha te gustaría. Con las ideas que más se repiten armamos las próximas salidas.
      </p>

      {sent ? (
        <div className="mt-6 rounded-2xl bg-monte-50 p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-monte">
            <CircleCheck className="size-6" /> ¡Gracias por tu sugerencia!
          </p>
          <p className="mt-1">La vamos a tener en cuenta para las próximas salidas.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSent(false)}>
            Mandar otra
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-white p-5 ring-1 ring-linea sm:p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Destino"
              placeholder="Ej: Encarnación, San Bernardino"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              error={error && form.destination.trim().length < 2 ? error : undefined}
            />
            <Input
              label="Desde dónde (opcional)"
              placeholder="Ej: Fernando de la Mora"
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
            />
            <Input
              label="¿Cuándo? (opcional)"
              placeholder="Ej: fin de semana largo, diciembre"
              value={form.whenText}
              onChange={(e) => setForm({ ...form, whenText: e.target.value })}
            />
            <Input
              label="Tu nombre (opcional)"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <Input
            label="Comentario (opcional)"
            placeholder="Lo que quieras contarnos"
            maxLength={500}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <Input
            label="Tu WhatsApp (opcional)"
            type="tel"
            inputMode="tel"
            placeholder="Si querés que te avisemos cuando salga"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          />
          {error && form.destination.trim().length >= 2 && (
            <p className="text-tierra" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-center pt-2">
            <Button type="submit" size="lg" loading={sending}>
              Enviar sugerencia
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
