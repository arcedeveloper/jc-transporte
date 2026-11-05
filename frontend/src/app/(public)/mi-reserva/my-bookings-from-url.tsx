'use client';

import { useSearchParams } from 'next/navigation';
import { MyBookings } from '@/components/my-bookings';

/** /mi-reserva?codigo=… */
export function MyBookingsFromUrl() {
  return <MyBookings initialCode={useSearchParams().get('codigo') ?? ''} />;
}
