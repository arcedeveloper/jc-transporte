'use client';

import { useSearchParams } from 'next/navigation';
import { BookingFlow } from '@/components/booking-flow';

/** /viaje?id=… */
export function TripFromUrl() {
  const id = useSearchParams().get('id') ?? '';
  return <BookingFlow key={id} tripId={id} />;
}
