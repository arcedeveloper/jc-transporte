import type { Metadata } from 'next';
import { BookingTicket } from '@/components/booking-ticket';

export const metadata: Metadata = { title: 'Tu reserva' };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const tel = Array.isArray(sp.tel) ? sp.tel[0] : sp.tel;
  return <BookingTicket code={decodeURIComponent(code)} phone={tel ?? ''} isNew={sp.nueva === '1'} />;
}
