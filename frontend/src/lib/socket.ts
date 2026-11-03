'use client';

import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

let publicSocket: Socket | null = null;

/** Conexión compartida para el mapa de asientos (sin login). */
export function getPublicSocket() {
  if (!publicSocket) {
    publicSocket = io(API_URL, { transports: ['websocket', 'polling'] });
  }
  return publicSocket;
}

/** Conexión con token, para que el admin vea el bus en vivo. Hay que cerrarla al salir. */
export function createAuthSocket(token: string) {
  return io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
}

/** Entra a una sala y vuelve a entrar si se corta la conexión. Devuelve la función para salir. */
export function joinRoom(socket: Socket, joinEvent: string, leaveEvent: string, id: string) {
  const join = () => socket.emit(joinEvent, id);
  if (socket.connected) join();
  socket.on('connect', join);
  return () => {
    socket.off('connect', join);
    socket.emit(leaveEvent, id);
  };
}

/**
 * Llama a `cb` cuando el servidor avisa que algo cambió (nuevo viaje, reserva confirmada, ajustes…)
 * y al reconectarse (por si se perdió un aviso). Devuelve la función para dejar de escuchar.
 */
export function onDataChanged(cb: () => void) {
  const s = getPublicSocket();
  let t: ReturnType<typeof setTimeout> | null = null;
  // Un pequeño margen al azar para que no recarguen todas las páginas en el mismo milisegundo
  const fire = () => {
    if (t) clearTimeout(t);
    t = setTimeout(cb, 200 + Math.random() * 600);
  };
  let first = true;
  const onConnect = () => {
    if (first) {
      first = false;
      return;
    }
    fire();
  };
  s.on('data:changed', fire);
  s.on('connect', onConnect);
  return () => {
    if (t) clearTimeout(t);
    s.off('data:changed', fire);
    s.off('connect', onConnect);
  };
}
