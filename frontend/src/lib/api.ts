import { currentArea, getToken, useAuth } from '@/store/auth';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** URL pública de una foto de bus */
export const busPhotoUrl = (id: string) => `${API_URL}/api/public/bus-photos/${id}`;
export const promoImageUrl = (id: string) => `${API_URL}/api/public/promo-images/${id}`;
/** Descarga del PDF del paquete */
export const tripPdfUrl = (id: string) => `${API_URL}/api/public/trip-pdfs/${id}`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Manda el token del admin/chofer */
  auth?: boolean;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  // Cada sección (admin / chofer) manda su propio token
  const area = currentArea();
  if (opts.auth) {
    const token = getToken(area);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.', 'NETWORK');
  }

  const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!res.ok) {
    if (res.status === 401 && opts.auth) useAuth.getState().logout(area);
    throw new ApiError(res.status, data?.error ?? 'Algo salió mal. Intentá de nuevo.', data?.code);
  }
  return data as T;
}

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Algo salió mal. Intentá de nuevo.';

/** Descarga un archivo del backend (con el token del admin) y lo guarda en la compu. */
export async function downloadFile(path: string, fallbackName: string) {
  const token = getToken(currentArea());
  let res: Response;
  try {
    res = await fetch(API_URL + path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.', 'NETWORK');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, data?.error ?? 'No se pudo descargar el archivo.');
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
