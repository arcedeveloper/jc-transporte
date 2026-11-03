'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth, useSession } from '@/store/auth';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useSession('driver')?.user;
  const logout = useAuth((s) => s.logout);
  return (
    <AuthGuard area="driver">
      <header className="sticky top-0 z-20 bg-ruta text-white">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/chofer" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-ambar font-display text-lg font-bold text-ruta-dark">JC</span>
            <span className="font-display text-xl font-bold">Chofer</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="max-w-[10rem] truncate text-sm text-white/70">{user?.fullName}</span>
            <button
              onClick={() => {
                logout('driver');
                router.replace('/login');
              }}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10"
              aria-label="Salir"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-5">{children}</main>
    </AuthGuard>
  );
}
