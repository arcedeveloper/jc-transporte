import type { Metadata } from 'next';
import { BookingFlow } from '@/components/booking-flow';

export const metadata: Metadata = { title: 'Reservar' };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingFlow tripId={id} />;
}
