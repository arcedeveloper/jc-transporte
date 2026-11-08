'use client';

import { siteUrl } from '@/lib/paths';
import { useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Check, Copy, Trash2, Undo2, Users } from 'lucide-react';
import { PageTitle, Tabs } from '@/components/admin/bits';
import { ConfirmDelete } from '@/components/admin/confirm-delete';
import { TripForm } from '@/components/admin/trip-form';
import { Button, Empty, ErrorBox, Spinner, buttonClass, cn } from '@/components/ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { api, errorMessage } from '@/lib/api';
import { ago, dateStrLong, dateTime, docFmt, gs, waLink } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { msgGroupDismissed, msgGroupReady } from '@/lib/whatsapp-messages';
import type { GroupRequest, GroupRequestStatus, TimeSlot } from '@/lib/types';
import { toast } from '@/store/toast';

type Tab = 'open' | 'accepted' | 'dismissed';

const SLOT_LABEL: Record<TimeSlot, string> = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche', any: 'Le da igual' };

const dateLabel = (d: string) => dateStrLong(d).toLowerCase();

export default function GroupRequestsAdmin() {
  const [tab, setTab] = useState<Tab>('open');
  const { data, error, loading, reload } = useQuery(
    () => api<{ requests: GroupRequest[] }>(`/api/admin/group-requests${tab === 'open' ? '' : `?status=${tab}`}`, { auth: true }),
    [tab],
    { live: true },
  );
  const [building, setBuilding] = useState<GroupRequest | null>(null);
  const [toDelete, setToDelete] = useState<GroupRequest | null>(null);

  async function setStatus(r: GroupRequest, status: GroupRequestStatus, msg?: string) {
    try {
      await api(`/api/admin/group-requests/${r.id}`, { method: 'PATCH', auth: true, body: { status } });
      if (msg) toast.success(msg);
      void reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageTitle title="Viajes grupales" />
      <p className="-mt-3 mb-5 max-w-prose text-niebla">
        Grupos que piden su propio viaje desde la portada. Escribiles por WhatsApp con el precio y, cuando acepten, armá el viaje: se crea{' '}
        <strong className="text-tinta">privado</strong> (no sale en la portada) y les mandás el enlace para que cada uno reserve y pague. El tamaño
        del grupo y los días de anticipación se cambian en{' '}
        <Link href="/admin/ajustes" className="font-bold text-ruta underline">
          Ajustes
        </Link>
        .
      </p>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          ['open', 'Por responder'],
          ['accepted', 'Con viaje'],
          ['dismissed', 'Descartados'],
        ]}
      />

      <div className="mt-5">
        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error.message} onRetry={() => void reload()} />
        ) : !data?.requests.length ? (
          <Empty title={tab === 'open' ? 'No hay pedidos nuevos' : 'No hay nada acá'}>
            {tab === 'open' && <p>Cuando un grupo pida un viaje desde la portada, aparece acá.</p>}
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.requests.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                onBuild={() => setBuilding(r)}
                onStatus={(s, m) => void setStatus(r, s, m)}
                onDelete={() => setToDelete(r)}
                onChanged={() => void reload(true)}
              />
            ))}
          </div>
        )}
      </div>

      <TripForm
        open={!!building}
        group={building}
        onClose={() => setBuilding(null)}
        onSaved={() => {
          setTab('accepted');
          void reload(true);
        }}
      />

      <ConfirmDelete
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Borrar pedido"
        onConfirm={async () => {
          if (!toDelete) return;
          await api(`/api/admin/group-requests/${toDelete.id}`, { method: 'DELETE', auth: true });
          toast.success('Pedido borrado');
          void reload(true);
        }}
      >
        <p>
          Se borra el pedido de <strong>{toDelete?.fullName}</strong> ({toDelete?.origin} › {toDelete?.destination}). Si ya armaste un viaje, el viaje
          no se borra.
        </p>
      </ConfirmDelete>
    </>
  );
}

function RequestCard({
  r,
  onBuild,
  onStatus,
  onDelete,
  onChanged,
}: {
  r: GroupRequest;
  onBuild: () => void;
  onStatus: (s: GroupRequestStatus, msg?: string) => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const open = r.status === 'new' || r.status === 'contacted';
  const link = r.trip && typeof window !== 'undefined' ? siteUrl(`/viaje?id=${r.trip.id}`) : '';

  const firstMsg = `Hola ${r.fullName.split(' ')[0]}, te escribimos de JC Transporte por el viaje grupal que pediste: ${r.origin} › ${r.destination}, ${dateLabel(r.date)}${r.returnDate ? ` (vuelta ${dateLabel(r.returnDate)})` : ''}, ${r.passengers} personas.`;
  const message =
    r.status === 'accepted' && r.trip
      ? msgGroupReady({
          name: r.fullName,
          origin: r.trip.route.origin,
          destination: r.trip.route.destination,
          departureTime: r.trip.departureTime,
          price: r.trip.price,
          link,
        })
      : r.status === 'dismissed'
        ? msgGroupDismissed({ name: r.fullName, origin: r.origin, destination: r.destination, dateLabel: dateLabel(r.date) })
        : firstMsg;

  function onWhatsApp() {
    if (r.status === 'new') onStatus('contacted');
    if (r.status === 'accepted' || r.status === 'dismissed') {
      void api(`/api/admin/group-requests/${r.id}/notified`, { method: 'POST', auth: true })
        .then(onChanged)
        .catch(() => undefined);
    }
  }

  return (
    <section className={cn('rounded-2xl border bg-white p-5', r.status === 'new' ? 'border-2 border-ambar' : 'border-linea')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-3xl font-bold leading-tight">
            {r.origin} <span className="text-ambar-dark">›</span> {r.destination}
          </h2>
          <p className="font-bold text-niebla">
            {dateStrLong(r.date)}
            {r.returnDate && <span className="font-normal">, vuelta {dateLabel(r.returnDate)}</span>}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-bold',
            r.status === 'new' && 'bg-ambar text-ruta-dark',
            r.status === 'contacted' && 'bg-ruta-50 text-ruta',
            r.status === 'accepted' && 'bg-monte text-white',
            r.status === 'dismissed' && 'bg-papel text-niebla',
          )}
        >
          {{ new: 'Nuevo', contacted: 'Contactado', accepted: 'Con viaje', dismissed: 'Descartado' }[r.status]}
        </span>
      </div>

      <p className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="flex items-center gap-1 rounded-full bg-ruta-50 px-2.5 py-0.5 font-bold text-ruta">
          <Users className="size-3.5" aria-hidden /> {r.passengers} personas
        </span>
        <span className="rounded-full bg-papel px-2.5 py-0.5">Prefieren: {SLOT_LABEL[r.preferredTime]}</span>
      </p>
      <p className="mt-3">
        <strong>{r.fullName}</strong>
        {r.document && <span className="text-niebla"> · CI {docFmt(r.document)}</span>}
        <span className="text-niebla"> · {r.contactPhone}</span>
      </p>
      {r.notes && <p className="mt-1 rounded-xl bg-papel p-3 text-sm">“{r.notes}”</p>}
      <p className="mt-1 text-xs text-niebla">Pedido {ago(r.createdAt)}</p>

      {r.trip && (
        <div className="mt-3 rounded-xl bg-monte-50 p-3 text-sm">
          <p className="font-bold text-monte">
            Viaje armado: {r.trip.route.origin} › {r.trip.route.destination}, {dateTime(r.trip.departureTime)}, {gs(r.trip.price)} c/u
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/admin/viajes/detalle?id=${r.trip.id}`} className={buttonClass('outline', 'sm')}>
              Ver viaje y reservas
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => toast.success('Enlace copiado'));
              }}
            >
              <Copy className="size-4" /> Copiar enlace
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-linea pt-4">
        <a href={waLink(r.contactPhone, message)} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp} className={buttonClass('whatsapp', 'sm')}>
          <WhatsAppIcon className="size-4" />
          {r.status === 'accepted' ? 'Mandar el enlace' : r.status === 'dismissed' ? 'Avisar que no sale' : 'Escribir'}
        </a>
        {r.notifiedAt && (
          <span className="flex items-center gap-1 text-sm font-bold text-monte">
            <Check className="size-4" /> Avisado
          </span>
        )}
        {open && (
          <Button size="sm" onClick={onBuild}>
            <CalendarPlus className="size-4" /> Armar viaje
          </Button>
        )}
        {open && (
          <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" onClick={() => onStatus('dismissed', 'Pedido descartado')}>
            Descartar
          </Button>
        )}
        {!open && (
          <Button variant="ghost" size="sm" onClick={() => onStatus('contacted', 'El pedido volvió a "Por responder"')}>
            <Undo2 className="size-4" /> Volver a abrir
          </Button>
        )}
        <button
          onClick={onDelete}
          className="ml-auto grid size-9 place-items-center rounded-lg text-tierra hover:bg-tierra-50"
          aria-label="Borrar pedido"
          title="Borrar pedido"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </section>
  );
}
