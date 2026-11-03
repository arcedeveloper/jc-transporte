'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/lib/types';

/**
 * Sesiones del personal. El admin y el chofer tienen sesiones SEPARADAS,
 * así se puede tener /admin y /chofer abiertos a la vez en el mismo navegador.
 * Los pasajeros no tienen cuenta.
 */
export type Area = 'admin' | 'driver';

export interface Session {
  token: string;
  user: User;
}

interface AuthState {
  sessions: Partial<Record<Area, Session>>;
  login: (token: string, user: User) => Promise<void>;
  logout: (area: Area) => void;
}

const STORAGE_KEY = 'jc-auth-v2';

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      sessions: {},
      login: async (token, user) => {
        // Releemos lo guardado por si otra pestaña inició otra sesión mientras tanto
        await useAuth.persist.rehydrate();
        set((s) => ({ sessions: { ...s.sessions, [user.role]: { token, user } } }));
      },
      logout: (area) =>
        set((s) => {
          const { [area]: _removed, ...rest } = s.sessions;
          return { sessions: rest };
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sessions: s.sessions }),
    },
  ),
);

// Mantener sincronizadas las pestañas (si cerrás sesión en una, se cierra en todas)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useAuth.persist.rehydrate();
  });
}

/** /chofer/... usa la sesión del chofer; el resto (admin) la del admin. */
export const areaFromPath = (path: string): Area => (path.startsWith('/chofer') ? 'driver' : 'admin');

export function currentArea(): Area {
  return typeof window !== 'undefined' ? areaFromPath(window.location.pathname) : 'admin';
}

/** Token de la sección actual (o de la que se indique). */
export function getToken(area: Area = currentArea()) {
  return useAuth.getState().sessions[area]?.token ?? null;
}

export function useSession(area: Area) {
  return useAuth((s) => s.sessions[area] ?? null);
}

/** true cuando ya se leyó la sesión guardada (evita redirigir al login por error). */
export function useAuthReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (useAuth.persist.hasHydrated()) setReady(true);
    return useAuth.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}
