'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { usePath } from '@/lib/paths';
import { useAuthReady, useSession, type Area } from '@/store/auth';
import { Spinner } from './ui';

/** Solo muestra el contenido si hay sesión iniciada en esta sección (admin o chofer). */
export function AuthGuard({ area, children }: { area: Area; children: ReactNode }) {
  const ready = useAuthReady();
  const session = useSession(area);
  const router = useRouter();
  const pathname = usePath();
  const allowed = !!session && session.user.role === area;

  useEffect(() => {
    if (ready && !allowed) router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [ready, allowed, router, pathname]);

  if (!ready || !allowed) return <Spinner label="Verificando sesión…" />;
  return <>{children}</>;
}
