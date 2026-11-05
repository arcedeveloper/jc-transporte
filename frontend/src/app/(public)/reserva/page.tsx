import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TicketFromUrl } from './ticket-from-url';

export const metadata: Metadata = { title: 'Tu reserva' };

export default function BookingPage() {
  return (
    <Suspense>
      <TicketFromUrl />
    </Suspense>
  );
}
