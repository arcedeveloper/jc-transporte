import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { TripStatus, UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { verifyToken } from '../lib/jwt.js';

/**
 * Salas:
 *   trip:<tripId>      → pasajeros viendo un viaje (lugares libres en vivo)
 *   tracking:<tripId>  → admins viendo el mapa en vivo del bus (requiere token de admin)
 *
 * Para entrar a tracking, el cliente se conecta con:
 *   io(API_URL, { auth: { token: '<JWT>' } })
 */
export interface ServerToClientEvents {
  /** Cambió la cantidad de lugares libres de un viaje */
  'trip:places': (p: { tripId: string; available: number; closed: boolean; bookable: boolean }) => void;
  'bus:location': (p: {
    tripId: string;
    lat: number;
    lng: number;
    speed: number | null;
    at: string;
  }) => void;
  'trip:status': (p: { tripId: string; status: TripStatus }) => void;
  /** Algo cambió (viaje, reserva, ajustes…): las páginas abiertas recargan sus datos */
  'data:changed': () => void;
}

export interface ClientToServerEvents {
  'trip:join': (tripId: string) => void;
  'trip:leave': (tripId: string) => void;
  'tracking:join': (tripId: string) => void;
  'tracking:leave': (tripId: string) => void;
}

interface SocketData {
  userId?: string;
  role?: UserRole;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
let io: IO | null = null;

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export function initSocket(httpServer: HttpServer) {
  io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  // Si el cliente manda token, lo identificamos. Sin token = visitante.
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token === 'string') {
      const payload = verifyToken(token);
      if (payload) {
        socket.data.userId = payload.sub;
        socket.data.role = payload.role;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.on('trip:join', (tripId) => {
      if (isUuid(tripId)) void socket.join(`trip:${tripId}`);
    });
    socket.on('trip:leave', (tripId) => {
      if (isUuid(tripId)) void socket.leave(`trip:${tripId}`);
    });
    socket.on('tracking:join', (tripId) => {
      if (isUuid(tripId) && socket.data.role === 'admin') void socket.join(`tracking:${tripId}`);
    });
    socket.on('tracking:leave', (tripId) => {
      if (isUuid(tripId)) void socket.leave(`tracking:${tripId}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io no fue inicializado');
  return io;
}

/** Avisos del mapa en vivo del bus. */
export const trackingEvents = {
  location(tripId: string, p: { lat: number; lng: number; speed: number | null; at: Date }) {
    getIO()
      .to(`tracking:${tripId}`)
      .emit('bus:location', { tripId, lat: p.lat, lng: p.lng, speed: p.speed, at: p.at.toISOString() });
  },
  status(tripId: string, status: TripStatus) {
    getIO().to([`tracking:${tripId}`, `trip:${tripId}`]).emit('trip:status', { tripId, status });
  },
};

/**
 * Avisa a todas las páginas abiertas que hubo un cambio, para que recarguen sin que nadie
 * toque "actualizar". Varios cambios seguidos se juntan en un solo aviso.
 * Así no hace falta consultar la base cada tantos segundos (Neon puede dormir tranquilo).
 */
let pending: NodeJS.Timeout | null = null;
export function notifyChanged() {
  if (!io || pending) return;
  pending = setTimeout(() => {
    pending = null;
    io?.emit('data:changed');
  }, 400);
}
