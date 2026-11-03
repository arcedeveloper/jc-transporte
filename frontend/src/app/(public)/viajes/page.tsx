import { redirect } from 'next/navigation';

/** La búsqueda de horarios se reemplazó por las tarjetas de la portada. */
export default function TripsPage() {
  redirect('/#salidas');
}
