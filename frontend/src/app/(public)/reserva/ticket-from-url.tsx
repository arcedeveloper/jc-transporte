'use client';

import { useSearchParams } from 'next/navigation';
import { BookingTicket } from '@/components/booking-ticket';

/** /reserva?code=…&tel=…&nueva=1 */
export function TicketFromUrl() {
  const sp = useSearchParams();
  const code = sp.get('code') ?? '';
  return <BookingTicket key={code} code={code} phone={sp.get('tel') ?? ''} isNew={sp.get('nueva') === '1'} />;
}
