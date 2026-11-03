'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Search } from 'lucide-react';
import { getSavedBookings, type SavedBooking } from '@/lib/browser';
import { dateTime } from '@/lib/format';
import { Button, Input } from './ui';

export function MyBookings({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [saved, setSaved] = useState<SavedBooking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSaved(getSavedBookings());
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^JC-\d{4}-\d{3,}$/.test(c)) return setError('El código tiene este formato: JC-2026-001');
    setError(null);
    // Si la reserva se hizo desde este celular, se abre completa (con el teléfono guardado)
    const mine = saved.find((b) => b.code === c);
    router.push(mine ? `/reserva/${c}?tel=${encodeURIComponent(mine.phone)}` : `/reserva/${c}`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-5xl font-bold text-ruta">Mi reserva</h1>
      <p className="mt-2 text-niebla">Mirá el estado de tu reserva y los datos para pagar. Solo necesitás tu código.</p>

      {saved.length > 0 && (
        <section className="mt-8" aria-labelledby="guardadas">
          <h2 id="guardadas" className="text-lg font-bold">
            Reservas hechas desde este celular
          </h2>
          <ul className="mt-3 divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
            {saved.map((b) => (
              <li key={b.code}>
                <Link
                  href={`/reserva/${b.code}?tel=${encodeURIComponent(b.phone)}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-ruta-50"
                >
                  <span>
                    <span className="block font-display text-2xl font-bold">{b.code}</span>
                    <span className="text-niebla">
                      {b.label}, {dateTime(b.departureTime)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-ruta" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-linea bg-white p-5" noValidate>
        <h2 className="text-lg font-bold">{saved.length ? 'Buscar otra reserva' : 'Buscar con tu código'}</h2>
        <Input label="Código de reserva" placeholder="JC-2026-001" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
        {error && (
          <p className="text-tierra" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full">
          <Search className="size-5" aria-hidden /> Ver mi reserva
        </Button>
      </form>
    </div>
  );
}
