import type { NextConfig } from 'next';

// La página se publica como archivos fijos (GitHub Pages).
// NEXT_PUBLIC_BASE_PATH = "/jc-transporte" en GitHub; vacío en tu compu.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // Oculta el botón "N" de Next.js que aparece abajo a la izquierda mientras desarrollás
  devIndicators: false,
};

export default nextConfig;
