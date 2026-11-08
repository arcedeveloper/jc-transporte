'use client';

import Link from 'next/link';
import { usePath } from '@/lib/paths';
import { Mail, Ticket } from 'lucide-react';
import { FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa';
import { WhatsAppIcon } from './whatsapp-icon';
import { waLink } from '@/lib/format';
import { usePublicInfo } from './public-info';
import { cn } from './ui';

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="JC Transporte, inicio">
      <span className="grid size-9 place-items-center rounded-lg bg-ambar font-display text-xl font-bold text-ruta-dark">JC</span>
      <span className={cn('font-display text-2xl font-bold tracking-wide', light ? 'text-white' : 'text-ruta')}>TRANSPORTE</span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePath();
  const onHome = pathname === '/';
  return (
    <header className={cn('relative z-20', onHome ? 'bg-ruta' : 'border-b border-linea bg-white')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo light={onHome} />
        <nav className="flex items-center gap-1">
          <Link
            href="/mi-reserva"
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 font-bold',
              onHome ? 'text-white hover:bg-white/10' : 'text-ruta hover:bg-ruta-50',
            )}
          >
            <Ticket className="size-5" aria-hidden />
            Mi reserva
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { whatsapp, email, instagram, tiktok, facebook } = usePublicInfo();
  return (
    <footer className="mt-24 bg-ruta-dark text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-white/60">Viajes en bus con tu lugar reservado, desde tu celular.</p>
        </div>
        <div>
          <p className="font-display text-xl font-semibold text-white">Contacto</p>
          <ul className="mt-3 space-y-2">
            {whatsapp && (
              <li>
                <a href={waLink(whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-ambar">
                  <WhatsAppIcon className="size-5" aria-hidden /> WhatsApp
                </a>
              </li>
            )}
            {facebook && (
              <li>
                <a href={`https://www.facebook.com/${facebook}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-ambar">
                  <FaFacebook className="size-5" aria-hidden /> Facebook
                </a>
              </li>
            )}
            {instagram && (
              <li>
                <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-ambar">
                  <FaInstagram className="size-5" aria-hidden /> @{instagram}
                </a>
              </li>
            )}
            {tiktok && (
              <li>
                <a href={`https://www.tiktok.com/@${tiktok}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-ambar">
                  <FaTiktok className="size-5" aria-hidden /> @{tiktok}
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="flex items-center gap-2 break-all hover:text-ambar">
                  <Mail className="size-5 shrink-0" aria-hidden /> {email}
                </a>
              </li>
            )}
          </ul>
        </div>
        <div>
          <p className="font-display text-xl font-semibold text-white">Tu viaje</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/#salidas" className="hover:text-ambar">
                Próximas salidas
              </Link>
            </li>
            <li>
              <Link href="/viaje-grupal" className="hover:text-ambar">
                Viaje grupal personalizado
              </Link>
            </li>
            <li>
              <Link href="/#sugerencias" className="hover:text-ambar">
                Dejar una sugerencia
              </Link>
            </li>
            <li>
              <Link href="/mi-reserva" className="hover:text-ambar">
                Consultar mi reserva
              </Link>
            </li>
            <li>
              <Link href="/#preguntas" className="hover:text-ambar">
                Preguntas frecuentes
              </Link>
            </li>
          </ul>
        </div>
      </div>
            <div className="border-t border-white/10 py-9 text-center text-sm text-white/50">
        <p>© {new Date().getFullYear()} JC Transporte</p>
        <p className="mt-1">Desarrollado por César Matías Rodas Arce. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}

/** Botón flotante de WhatsApp. Se oculta mientras elegís asientos (ahí está la barra de compra). */
export function WhatsAppFloat() {
  const { whatsapp } = usePublicInfo();
  const pathname = usePath();
  if (!whatsapp || pathname === '/viaje') return null;
  return (
    <a
      href={waLink(whatsapp, 'Hola, tengo una consulta sobre los pasajes')}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-[#1f9e55] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105"
      aria-label="Escribinos por WhatsApp"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
