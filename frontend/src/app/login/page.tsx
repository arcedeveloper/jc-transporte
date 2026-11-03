'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Lock } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';
import { areaFromPath, useAuth, useAuthReady, type Area } from '@/store/auth';
import { Logo } from '@/components/site-chrome';
import { Button, Input, PasswordInput } from '@/components/ui';

const HOME: Record<Area, string> = { admin: '/admin', driver: '/chofer' };
const LABEL: Record<Area, string> = { admin: 'Ir al panel de administración', driver: 'Ir a la vista del chofer' };

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const nextArea = next ? areaFromPath(next) : null;
  const ready = useAuthReady();
  const sessions = useAuth((s) => s.sessions);
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si venís de /admin o /chofer y ya tenés esa sesión abierta, te devolvemos directo
  useEffect(() => {
    if (ready && next && nextArea && sessions[nextArea]) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, next, nextArea]);

  const destination = (u: User) => (next && nextArea === u.role ? next : HOME[u.role]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      await login(res.token, res.user);
      router.replace(destination(res.user));
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  const open = (Object.keys(sessions) as Area[]).filter((a) => sessions[a]);

  return (
    <>
      {ready && open.length > 0 && (
        <div className="mt-6 space-y-2">
          {open.map((a) => (
            <Link
              key={a}
              href={HOME[a]}
              className="flex items-center justify-between gap-3 rounded-xl border-2 border-monte/30 bg-monte-50 px-4 py-3 text-left hover:border-monte"
            >
              <span>
                <span className="block font-bold text-monte">{LABEL[a]}</span>
                <span className="text-sm text-niebla">Sesión abierta: {sessions[a]?.user.fullName}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-monte" aria-hidden />
            </Link>
          ))}
          <p className="pt-2 text-center text-sm text-niebla">O entrá con otra cuenta:</p>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4 text-left">
        <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput
          label="Contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p className="rounded-xl bg-tierra-50 p-3 font-bold text-tierra" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          <Lock className="size-5" aria-hidden /> Entrar
        </Button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ruta px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold text-ruta">Ingreso del personal</h1>
        <p className="text-niebla">Para administración y choferes.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
