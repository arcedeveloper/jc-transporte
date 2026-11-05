'use client';

import { usePathname } from 'next/navigation';

/** Carpeta donde vive la página (GitHub Pages: "/jc-transporte"; en tu compu: vacío) */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

/** Dirección completa para compartir por WhatsApp, ej: siteUrl('/viaje?id=123') */
export function siteUrl(path: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin + BASE_PATH + path;
}

/** Ruta actual sin la barra del final ("/admin/viajes/" → "/admin/viajes") */
export function usePath() {
  return (usePathname() || '/').replace(/(.)\/$/, '$1');
}
