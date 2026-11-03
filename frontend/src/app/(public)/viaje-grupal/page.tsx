import type { Metadata } from 'next';
import { GroupRequestForm } from '@/components/group-request-form';

export const metadata: Metadata = { title: 'Viaje grupal personalizado' };

export default function GroupTripPage() {
  return <GroupRequestForm />;
}
