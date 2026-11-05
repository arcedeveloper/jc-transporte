import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MyBookingsFromUrl } from './my-bookings-from-url';

export const metadata: Metadata = { title: 'Mi reserva' };

export default function MyBookingPage() {
  return (
    <Suspense>
      <MyBookingsFromUrl />
    </Suspense>
  );
}
