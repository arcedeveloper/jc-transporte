import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Oculta el botón "N" de Next.js que aparece abajo a la izquierda mientras desarrollás
  devIndicators: false,
};

export default nextConfig;
