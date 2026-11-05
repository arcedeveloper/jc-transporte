import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TripFromUrl } from './trip-from-url';

export const metadata: Metadata = { title: 'Reservar' };

export default function TripPage() {
  return (
    <Suspense>
      <TripFromUrl />
    </Suspense>
  );
}
