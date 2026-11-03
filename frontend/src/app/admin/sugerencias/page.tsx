'use client';

import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { PageTitle, Panel } from '@/components/admin/bits';
import { Button, Empty, ErrorBox, Spinner, buttonClass, cn } from '@/components/ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { api, errorMessage } from '@/lib/api';
import { ago, waLink } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import type { Suggestion } from '@/lib/types';
import { toast } from '@/store/toast';

/** Lo que la gente sugiere en la portada: destinos y fechas que les gustaría. */
export default function SuggestionsAdmin() {
  const { data, error, loading, reload } = useQuery(() =>
    api<{ suggestions: Suggestion[]; top: { destination: string; count: number }[]; unread: number }>('/api/admin/suggestions', { auth: true }),
    [],
    { live: true },
  );

  // Al abrir la página se marcan como leídas (las nuevas quedan resaltadas esta vez)
  useEffect(() => {
    if (data?.unread) void api('/api/admin/suggestions/read-all', { method: 'POST', auth: true }).catch(() => undefined);
  }, [data?.unread]);

  async function remove(id: string) {
    try {
      await api(`/api/admin/suggestions/${id}`, { method: 'DELETE', auth: true });
      void reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function cleanup() {
    try {
      const r = await api<{ deleted: number }>('/api/admin/suggestions/cleanup', { method: 'POST', auth: true });
      toast.success(`${r.deleted} sugerencia(s) borradas`);
      void reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error?.message ?? 'Error'} onRetry={() => void reload()} />;

  const max = data.top[0]?.count ?? 1;

  return (
    <>
      <PageTitle title="Sugerencias">
        {data.suggestions.length > 0 && (
          <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" onClick={() => void cleanup()}>
            <Trash2 className="size-4" /> Borrar las leídas
          </Button>
        )}
      </PageTitle>
      <p className="-mt-3 mb-5 max-w-prose text-niebla">
        Lo que la gente escribe en “¿A dónde te gustaría viajar?”. Usalo para decidir las próximas salidas.
      </p>

      {data.suggestions.length === 0 ? (
        <Empty title="Todavía no hay sugerencias">
          <p>Aparecen acá cuando alguien las manda desde la portada.</p>
        </Empty>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
          <Panel title="Destinos más pedidos" className="self-start">
            <ul className="space-y-3">
              {data.top.map((t) => (
                <li key={t.destination}>
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">{t.destination}</span>
                    <span className="text-niebla">{t.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-papel">
                    <div className="h-full rounded-full bg-ambar" style={{ width: `${(t.count / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <ul className="space-y-3">
            {data.suggestions.map((s) => (
              <li key={s.id} className={cn('rounded-2xl border bg-white p-4', s.isRead ? 'border-linea' : 'border-2 border-ambar')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-2xl font-bold">
                      {s.origin ? (
                        <>
                          {s.origin} <span className="text-ambar-dark">›</span>{' '}
                        </>
                      ) : null}
                      {s.destination}
                    </p>
                    {s.whenText && <p className="font-bold text-niebla">Cuándo: {s.whenText}</p>}
                  </div>
                  <span className="text-sm text-niebla">
                    {!s.isRead && <strong className="mr-2 text-ambar-dark">Nueva</strong>}
                    {ago(s.createdAt)}
                  </span>
                </div>
                {s.message && <p className="mt-2">“{s.message}”</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s.name && <span className="text-sm">{s.name}</span>}
                  {s.contactPhone && (
                    <a
                      href={waLink(
                        s.contactPhone,
                        `Hola${s.name ? ` ${s.name.split(' ')[0]}` : ''}, te escribimos de JC Transporte por tu sugerencia de viajar a ${s.destination}.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass('whatsapp', 'sm')}
                    >
                      <WhatsAppIcon className="size-4" /> {s.contactPhone}
                    </a>
                  )}
                  <button
                    onClick={() => void remove(s.id)}
                    className="ml-auto grid size-9 place-items-center rounded-lg text-tierra hover:bg-tierra-50"
                    aria-label="Borrar sugerencia"
                    title="Borrar sugerencia"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
