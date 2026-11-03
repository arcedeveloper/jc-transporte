import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4">
      <p className="font-display text-7xl font-bold text-ambar-dark">404</p>
      <h1 className="font-display text-4xl font-bold text-ruta">Esta página no existe</h1>
      <p className="text-niebla">Puede que el link esté mal escrito o que la página se haya movido.</p>
      <Link href="/" className="rounded-xl bg-ruta px-5 py-3 font-bold text-white hover:bg-ruta-dark">
        Ir al inicio
      </Link>
    </main>
  );
}
