'use client';

import { gs } from '@/lib/format';

/** "Tu pago: Gs. 250.000" o "Pago a confirmar" */
export function PayLine({ pay, big }: { pay?: number | null; big?: boolean }) {
  return pay != null ? (
    <span className={big ? 'block rounded-2xl bg-monte-50 p-4 text-lg font-bold text-monte' : 'mt-2 block font-bold text-monte'}>
      💵 Tu pago: {gs(pay)}
    </span>
  ) : (
    <span className={big ? 'block rounded-2xl bg-ambar-50 p-4 font-bold text-ambar-dark' : 'mt-2 block text-sm font-bold text-ambar-dark'}>
      💵 Pago a confirmar
    </span>
  );
}
