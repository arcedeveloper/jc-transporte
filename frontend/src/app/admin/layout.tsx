'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePath } from '@/lib/paths';
import { CalendarDays, LayoutDashboard, LogOut, Radio, Settings, Ticket, type LucideIcon } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { cn } from '@/components/ui';
import { api } from '@/lib/api';
import { onDataChanged } from '@/lib/socket';
import { useAuth, useSession } from '@/store/auth';

type Badge = 'groups' | 'suggestions';

interface Section {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Pestañas que se muestran arriba de las páginas de esta sección */
  tabs?: { href: string; label: string; badge?: Badge }[];
  /** Otras páginas que pertenecen a esta sección (sin pestaña propia) */
  extra?: string[];
}

/**
 * Menú ordenado en 5 secciones. Las páginas siguen en sus direcciones de siempre;
 * cada sección agrupa las suyas en pestañas.
 */
const sections: Section[] = [
  { href: '/admin', label: 'Panel', icon: LayoutDashboard },
  { href: '/admin/reservas', label: 'Reservas', icon: Ticket },
  {
    href: '/admin/viajes',
    label: 'Viajes',
    icon: CalendarDays,
    extra: ['/admin/rutas'],
    tabs: [
      { href: '/admin/viajes', label: 'Salidas' },
      { href: '/admin/pedidos', label: 'Grupales', badge: 'groups' },
      { href: '/admin/sugerencias', label: 'Sugerencias', badge: 'suggestions' },
    ],
  },
  { href: '/admin/en-vivo', label: 'En vivo', icon: Radio },
  {
    href: '/admin/ajustes',
    label: 'Ajustes',
    icon: Settings,
    tabs: [
      { href: '/admin/ajustes', label: 'Empresa' },
      { href: '/admin/usuarios', label: 'Usuarios' },
      { href: '/admin/buses', label: 'Buses' },
    ],
  },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePath();
  const router = useRouter();
  const user = useSession('admin')?.user;
  const logout = useAuth((s) => s.logout);
  const [badges, setBadges] = useState<Record<Badge, number>>({ groups: 0, suggestions: 0 });

  const current =
    sections.find((s) => s.tabs?.some((t) => under(pathname, t.href)) || s.extra?.some((e) => under(pathname, e))) ??
    sections.find((s) => (s.href === '/admin' ? pathname === '/admin' : under(pathname, s.href)));
  // Las pestañas se ven en las páginas principales, no adentro de un viaje o una reserva
  const showTabs = !!current?.tabs?.some((t) => t.href === pathname);

  // Grupales nuevos y sugerencias sin leer (se actualiza al cambiar de página)
  useEffect(() => {
    const load = () =>
      api<{ newGroups: number; unreadSuggestions: number }>('/api/admin/group-requests/summary', { auth: true })
        .then((d) => setBadges({ groups: d.newGroups, suggestions: d.unreadSuggestions }))
        .catch(() => undefined);
    void load();
    return onDataChanged(() => void load());
  }, [pathname]);

  function exit() {
    logout('admin');
    router.replace('/login');
  }

  return (
    <AuthGuard area="admin">
      <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr] print:block">
        {/* Barra lateral (escritorio) / barra superior (celular) */}
        <aside className="sticky top-0 z-20 bg-ruta text-white lg:h-dvh print:hidden">
          <div className="flex h-14 items-center justify-between px-4 lg:h-16">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-ambar font-display text-lg font-bold text-ruta-dark">JC</span>
              <span className="font-display text-xl font-bold">Administración</span>
            </Link>
            <button onClick={exit} className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Salir">
              <LogOut className="size-5" />
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:px-3" aria-label="Secciones">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const active = sec === current;
              const count = sec.tabs?.reduce((a, t) => a + (t.badge ? badges[t.badge] : 0), 0) ?? 0;
              return (
                <Link
                  key={sec.href}
                  href={sec.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 font-bold transition-colors',
                    active ? 'bg-white text-ruta' : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {sec.label}
                  {count > 0 && (
                    <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-ambar px-1.5 text-sm text-ruta-dark" aria-label={`${count} nuevos`}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="absolute inset-x-0 bottom-0 hidden border-t border-white/10 p-4 lg:block">
            <p className="truncate text-sm text-white/60">{user?.fullName}</p>
            <button onClick={exit} className="mt-2 flex items-center gap-2 font-bold text-white/80 hover:text-white">
              <LogOut className="size-4" /> Salir
            </button>
          </div>
        </aside>
        <main className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">
          {showTabs && current?.tabs && (
            <nav className="-mt-1 mb-6 flex gap-1 overflow-x-auto border-b border-linea [scrollbar-width:none] print:hidden [&::-webkit-scrollbar]:hidden" aria-label={current.label}>
              {current.tabs.map((t) => {
                const active = t.href === pathname;
                const n = t.badge ? badges[t.badge] : 0;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      '-mb-px flex shrink-0 items-center gap-1.5 border-b-[3px] px-3.5 py-2.5 font-bold transition-colors',
                      active ? 'border-ruta text-ruta' : 'border-transparent text-niebla hover:text-ruta',
                    )}
                  >
                    {t.label}
                    {n > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-ambar px-1 text-xs text-ruta-dark">{n}</span>}
                  </Link>
                );
              })}
            </nav>
          )}
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
