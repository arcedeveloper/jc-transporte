'use client';

import { useEffect, useState } from 'react';
import { createAuthSocket, joinRoom } from '@/lib/socket';
import type { TripStatus } from '@/lib/types';
import { useSession } from '@/store/auth';

export interface LivePosition {
  lat: number;
  lng: number;
  speed: number | null;
  at: string;
}

/**
 * Escucha en vivo la ubicación y el estado de uno o varios viajes.
 * Devuelve las posiciones/estados que llegaron por Socket.io (pisan a los iniciales).
 */
export function useTracking(tripIds: string[]) {
  const token = useSession('admin')?.token ?? null;
  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [statuses, setStatuses] = useState<Record<string, TripStatus>>({});
  const [connected, setConnected] = useState(false);
  const key = tripIds.join(',');

  useEffect(() => {
    if (!token || !tripIds.length) return;
    const socket = createAuthSocket(token);
    const leaves = tripIds.map((id) => joinRoom(socket, 'tracking:join', 'tracking:leave', id));

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('bus:location', (p: { tripId: string } & LivePosition) => {
      setPositions((all) => ({ ...all, [p.tripId]: { lat: p.lat, lng: p.lng, speed: p.speed, at: p.at } }));
    });
    socket.on('trip:status', (p: { tripId: string; status: TripStatus }) => {
      setStatuses((all) => ({ ...all, [p.tripId]: p.status }));
    });

    return () => {
      leaves.forEach((leave) => leave());
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);

  return { positions, statuses, connected };
}

/** Re-renderiza cada segundo (para "hace 5 s"). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
