'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Check, Copy, Trash2, Undo2, Users } from 'lucide-react';
import { PageTitle, Tabs } from '@/components/admin/bits';
import { ConfirmDelete } from '@/components/admin/confirm-delete';
import { Button, Empty, ErrorBox, Input, Modal, NumberInput, Select, Spinner, buttonClass, cn } from '@/components/ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { api, errorMessage } from '@/lib/api';
import { ago, dateStrLong, dateTime, docFmt, gs, numberToInput, parseNumber, toIsoPY, waLink } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { msgGroupDismissed, msgGroupReady } from '@/lib/whatsapp-messages';
import type { AdminBus, AdminRoute, AdminUser, GroupRequest, GroupRequestStatus, TimeSlot } from '@/lib/types';
import { toast } from '@/store/toast';

type Tab = 'open' | 'accepted' | 'dismissed';

const SLOT_LABEL: Record<TimeSlot, string> = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche', any: 'Le da igual' };
const SLOT_TIME: Record<TimeSlot, string> = { morning: '07:00', afternoon: '14:00', night: '19:00', any: '07:00' };

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

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

      <BuildTripModal
        request={building}
        onClose={() => setBuilding(null)}
        onDone={() => {
          setBuilding(null);
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
  const link = r.trip && typeof window !== 'undefined' ? `${window.location.origin}/viaje/${r.trip.id}` : '';

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
            <Link href={`/admin/viajes/${r.trip.id}`} className={buttonClass('outline', 'sm')}>
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

/** Armar el viaje del grupo: ruta (sugerida por nombre), hora, bus donde entran todos, chofer y precio. Se crea privado. */
function BuildTripModal({ request: r, onClose, onDone }: { request: GroupRequest | null; onClose: () => void; onDone: () => void }) {
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [buses, setBuses] = useState<AdminBus[]>([]);
  const [drivers, setDrivers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState({ routeId: '', date: '', time: '07:00', busId: '', driverId: '', price: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!r) return;
    void Promise.all([
      api<{ routes: AdminRoute[] }>('/api/admin/routes', { auth: true }),
      api<{ buses: AdminBus[] }>('/api/admin/buses', { auth: true }),
      api<{ users: AdminUser[] }>('/api/admin/users?role=driver', { auth: true }),
    ])
      .then(([ro, b, d]) => {
        const activeRoutes = ro.routes.filter((x) => x.isActive);
        const activeBuses = b.buses.filter((x) => x.isActive).sort((a, c) => a.capacity - c.capacity);
        const activeDrivers = d.users.filter((u) => u.isActive);
        setRoutes(activeRoutes);
        setBuses(activeBuses);
        setDrivers(activeDrivers);
        const match = activeRoutes.find((x) => norm(x.origin) === norm(r.origin) && norm(x.destination) === norm(r.destination));
        const bus = activeBuses.find((x) => x.capacity >= r.passengers) ?? activeBuses[activeBuses.length - 1];
        setForm({
          routeId: match?.id ?? '',
          date: r.date,
          time: SLOT_TIME[r.preferredTime],
          busId: bus?.id ?? '',
          driverId: activeDrivers[0]?.id ?? '',
          price: match ? numberToInput(match.basePrice) : '',
        });
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, [r]);

  const route = routes.find((x) => x.id === form.routeId);
  const bus = buses.find((x) => x.id === form.busId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!r) return;
    const price = parseNumber(form.price);
    if (!form.routeId || !form.busId || !form.date || !price) return toast.error('Completá ruta, fecha, bus y precio');
    setSaving(true);
    try {
      const t = await api<{ trip: { id: string } }>('/api/admin/trips', {
        method: 'POST',
        auth: true,
        body: {
          routeId: form.routeId,
          busId: form.busId,
          driverId: form.driverId || null,
          departureTime: toIsoPY(form.date, form.time),
          price,
          showOnHome: false,
        },
      });
      await api(`/api/admin/group-requests/${r.id}/trip`, { method: 'POST', auth: true, body: { tripId: t.trip.id } });
      toast.success('Viaje armado. Ahora mandale el enlace por WhatsApp.');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!r} onClose={onClose} title="Armar el viaje del grupo">
      {r && (
        <form onSubmit={save} className="space-y-4">
          <p className="rounded-xl bg-papel p-3">
            <strong>
              {r.origin} › {r.destination}
            </strong>
            <br />
            {dateStrLong(r.date)}, {r.passengers} personas, prefieren {SLOT_LABEL[r.preferredTime].toLowerCase()}
          </p>
          <Select
            label="Ruta"
            value={form.routeId}
            onChange={(e) => {
              const ro = routes.find((x) => x.id === e.target.value);
              setForm({ ...form, routeId: e.target.value, price: ro ? numberToInput(ro.basePrice) : form.price });
            }}
          >
            <option value="">Elegí la ruta…</option>
            {routes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.origin} › {x.destination}
              </option>
            ))}
          </Select>
          {!route && (
            <p className="text-sm text-niebla">
              ¿No está? Creala en{' '}
              <Link href="/admin/rutas" className="font-bold text-ruta underline">
                Rutas
              </Link>{' '}
              ({r.origin} › {r.destination}) y volvé.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <Input label="Hora de salida" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
          </div>
          <Select label="Bus" value={form.busId} onChange={(e) => setForm({ ...form, busId: e.target.value })}>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.capacity} lugares)
              </option>
            ))}
          </Select>
          {bus && bus.capacity < r.passengers && (
            <p className="text-sm font-bold text-tierra">
              Ojo: el grupo es de {r.passengers} y este bus tiene {bus.capacity} lugares.
            </p>
          )}
          <Select label="Chofer" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
            <option value="">Sin asignar</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
          <NumberInput
            label="Precio por persona (Gs.)"
            placeholder="150.000"
            value={form.price}
            onValueChange={(v) => setForm({ ...form, price: v })}
            hint={route ? `Precio de la ruta: ${gs(route.basePrice)}` : undefined}
          />
          <Button type="submit" size="lg" className="w-full" loading={saving}>
            <CalendarPlus className="size-5" /> Armar viaje privado
          </Button>
          <p className="text-sm text-niebla">No aparece en la portada. Solo entra quien tenga el enlace.</p>
        </form>
      )}
    </Modal>
  );
}
