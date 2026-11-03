import type { Metadata } from 'next';
import { MyBookings } from '@/components/my-bookings';

export const metadata: Metadata = { title: 'Mi reserva' };

export default async function MyBookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = Array.isArray(sp.codigo) ? sp.codigo[0] : sp.codigo;
  return <MyBookings initialCode={code ?? ''} />;
}
