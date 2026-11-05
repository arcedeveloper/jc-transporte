import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

// Permite "Agregar a pantalla de inicio" en el celular (útil para el chofer).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JC Transporte',
    short_name: 'JC Transporte',
    description: 'Pasajes de bus online',
    start_url: `${base}/`,
    display: 'standalone',
    background_color: '#f4f6f8',
    theme_color: '#12355b',
    lang: 'es-PY',
    icons: [{ src: `${base}/icon.svg`, sizes: 'any', type: 'image/svg+xml' }],
  };
}
