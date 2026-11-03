'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, ApiError, api } from '@/lib/api';
import { getToken } from '@/store/auth';

export type ShareState = 'off' | 'starting' | 'on' | 'error';

export interface GeoPos {
  lat: number;
  lng: number;
  speedMps: number | null;
  accuracy: number;
}

const SEND_EVERY_MS = 5000;

/**
 * Comparte la ubicación del celular del chofer cada 5 segundos.
 * - Mantiene la pantalla encendida (Wake Lock) mientras comparte.
 * - Si el chofer cierra la página o sale, avisa al servidor que dejó de compartir.
 */
export function useLocationSharing(tripId: string, onTripClosed?: (msg: string) => void) {
  const [state, setState] = useState<ShareState>('off');
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<GeoPos | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [netProblem, setNetProblem] = useState(false);
  const [wakeLockOk, setWakeLockOk] = useState<boolean | null>(null);

  const watchId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef<GeoPos | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const active = useRef(false);
  const closedCb = useRef(onTripClosed);
  closedCb.current = onTripClosed;

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await navigator.wakeLock.request('screen');
        setWakeLockOk(true);
      } else {
        setWakeLockOk(false);
      }
    } catch {
      setWakeLockOk(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    active.current = false;
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, []);

  /** Aviso al servidor que funciona aunque se esté cerrando la página. */
  const notifyStop = useCallback(() => {
    const token = getToken('driver');
    void fetch(`${API_URL}/api/driver/trips/${tripId}/stop`, {
      method: 'POST',
      keepalive: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => undefined);
  }, [tripId]);

  const send = useCallback(async () => {
    const p = latest.current;
    if (!p || !active.current) return;
    try {
      await api(`/api/driver/trips/${tripId}/location`, {
        method: 'POST',
        auth: true,
        body: { lat: p.lat, lng: p.lng, speedMps: p.speedMps },
      });
      setLastSent(Date.now());
      setNetProblem(false);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'TRIP_CLOSED' || e.status === 403 || e.status === 404)) {
        cleanup();
        setState('off');
        closedCb.current?.(e.message);
      } else {
        setNetProblem(true); // sin internet: seguimos intentando
      }
    }
  }, [tripId, cleanup]);

  const start = useCallback(() => {
    setError(null);
    if (!('geolocation' in navigator)) {
      setState('error');
      setError('Este celular no permite compartir la ubicación desde el navegador.');
      return;
    }
    if (!window.isSecureContext) {
      setState('error');
      setError('La ubicación solo funciona en una página segura (https). Abrí la app desde el link oficial.');
      return;
    }
    setState('starting');
    active.current = true;
    void requestWakeLock();

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const first = !latest.current;
        latest.current = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          speedMps: p.coords.speed != null && !Number.isNaN(p.coords.speed) ? p.coords.speed : null,
          accuracy: p.coords.accuracy,
        };
        setPos(latest.current);
        if (first) {
          setState('on');
          void send();
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          cleanup();
          setState('error');
          setError(
            'No diste permiso para usar la ubicación. Tocá el candado al lado de la dirección de la página, activá "Ubicación" y probá de nuevo.',
          );
        } else if (!latest.current) {
          setError('Buscando señal GPS… Si tarda, salí a un lugar abierto y verificá que la ubicación del celular esté activada.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );

    timer.current = setInterval(() => void send(), SEND_EVERY_MS);
  }, [cleanup, requestWakeLock, send]);

  const stop = useCallback(() => {
    cleanup();
    latest.current = null;
    setPos(null);
    setState('off');
    notifyStop();
  }, [cleanup, notifyStop]);

  // Al volver a la pantalla, pedimos de nuevo que no se apague (el sistema lo suelta al bloquear)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && active.current) void requestWakeLock();
    };
    const onPageHide = () => {
      if (active.current) notifyStop();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [requestWakeLock, notifyStop]);

  // Si el chofer navega a otra pantalla de la app, dejamos de compartir
  useEffect(
    () => () => {
      if (active.current) {
        cleanup();
        notifyStop();
      }
    },
    [cleanup, notifyStop],
  );

  return { state, error, pos, lastSent, netProblem, wakeLockOk, start, stop };
}
