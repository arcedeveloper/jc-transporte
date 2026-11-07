'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api';
import { onDataChanged } from '@/lib/socket';

interface Info {
  whatsapp: string | null;
  email: string | null;
  /** Usuario de Instagram / TikTok sin @ */
  instagram: string | null;
  tiktok: string | null;
  /** Página de Facebook ("jctransporte" o "profile.php?id=123") */
  facebook: string | null;
  /** Mensajes del cartel LED (se editan en Admin → Ajustes) */
  signMessages: string[];
  signShowRoutes: boolean;
  /** Viaje grupal a medida */
  groupMinPeople: number;
  groupMaxPeople: number;
  groupMinDays: number;
  loaded: boolean;
}

type InfoResponse = Omit<Info, 'loaded'>;

const useInfoStore = create<Info>()(() => ({ whatsapp: null, email: null, instagram: null, tiktok: null, facebook: null, signMessages: [], signShowRoutes: true, groupMinPeople: 12, groupMaxPeople: 17, groupMinDays: 5, loaded: false }));
let requested = false;

/** WhatsApp, email y cartel de la empresa (se piden una sola vez). */
export function usePublicInfo() {
  const info = useInfoStore();
  useEffect(() => {
    if (requested) return;
    requested = true;
    const load = () =>
      api<InfoResponse>('/api/public/info')
        .then((d) => useInfoStore.setState({ ...d, loaded: true }))
        .catch(() => useInfoStore.setState({ loaded: true }));
    void load();
    // Si cambiás algo en Ajustes (cartel, WhatsApp, redes), se actualiza solo
    onDataChanged(() => void load());
  }, []);
  return info;
}
