import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Barlow_Condensed } from 'next/font/google';
import { Toaster } from '@/components/ui';
import './globals.css';

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display-src',
  display: 'swap',
});

const body = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body-src',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'JC Transporte · Pasajes de bus online', template: '%s · JC Transporte' },
  description: 'Reservá tu asiento en el bus desde el celular. Elegí tu lugar, pagá por transferencia y viajá tranquilo.',
  applicationName: 'JC Transporte',
};

export const viewport: Viewport = {
  themeColor: '#12355b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PY" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh font-sans text-[17px] leading-relaxed antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
