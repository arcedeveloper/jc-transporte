'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileSpreadsheet, Lock, LockOpen, Pencil, Radio, Trash2 } from 'lucide-react';
import { Occupancy, Panel } from '@/components/admin/bits';
import { ConfirmDelete } from '@/components/admin/confirm-delete';
import { PromoPanel } from '@/components/admin/promo-panel';
import { TripForm } from '@/components/admin/trip-form';
import { BookingBadge, Button, ButtonLink, ErrorBox, Input, Modal, Select, Spinner, TripBadge, buttonClass, cn } from '@/components/ui';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { dayLong, docFmt, gs, hhmm, waLink } from '@/lib/format';
import { msgCancelled } from '@/lib/whatsapp-messages';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { useQuery } from '@/lib/use-query';
import type { AdminBooking, AdminTrip, AdminUser, Availability } from '@/lib/types';
import { toast } from '@/store/toast';

type TripBooking = Omit<AdminBooking, 'trip'>;
type TripDetail = AdminTrip & { bookings: TripBooking[] };
interface CancelResult {
  reason: string;
  cancelledBookings: number;
  contacts: { code: string; wasPaid: boolean; phone: string; name: string; passengers: number }[];
}

function TripDetailPageInner() {
  const id = useSearchParams().get('id') ?? '';
  const { data, error, loading, reload } = useQuery(
    () => api<{ trip: TripDetail; availability: Availability }>(`/api/admin/trips/${id}`, { auth: true }),
    [id],
    { live: true },
  );
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  /** Después de cancelar el viaje: lista de pasajeros para avisar por WhatsApp */
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);
  const [notified, setNotified] = useState<Set<string>>(new Set());
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeDriver, setCloseDriver] = useState('');
  const [drivers, setDrivers] = useState<AdminUser[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  const trip = data?.trip;

  const active = trip?.bookings.filter((b) => b.status !== 'cancelled') ?? [];
  const passengers = active
    .flatMap((b) => b.passengers.map((p) => ({ ...p, code: b.bookingCode, status: b.status })))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

  /** Viaje terminado o cancelado: se puede borrar con todas sus reservas */
  const isPast =
    !!trip && trip.status !== 'in_progress' && (trip.status !== 'scheduled' || new Date(trip.arrivalTime).getTime() < Date.now());
  /** Viaje futuro: solo se borra si no tiene reservas activas */
  const canDelete = !!trip && trip.status !== 'in_progress' && (isPast || active.length === 0);

  /** Solo para ver: confirmadas y esperando pago (las acciones están en Reservas) */
  const listed = (trip?.bookings ?? []).filter((b) => b.status === 'confirmed' || b.status === 'pending');

  async function setClosed(close: boolean) {
    setBusy(true);
    try {
      await api(`/api/admin/trips/${id}/${close ? 'close' : 'reopen'}`, {
        method: 'POST',
        auth: true,
        body: close ? { driverId: closeDriver || null } : undefined,
      });
      toast.success(close ? 'Viaje confirmado: las reservas quedaron cerradas' : 'Reservas abiertas otra vez');
      setCloseOpen(false);
      void reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadFile(`/api/admin/trips/${id}/checklist.xlsx`, 'pasajeros.xlsx');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      await api(`/api/admin/trips/${id}/complete`, { method: 'POST', auth: true });
      toast.success('Viaje marcado como finalizado');
      void reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelTrip() {
    setBusy(true);
    try {
      const r = await api<CancelResult>(`/api/admin/trips/${id}/cancel`, {
        method: 'POST',
        auth: true,
        body: { reason: reason.trim() || 'Viaje cancelado por la empresa' },
      });
      toast.success(`Viaje cancelado. ${r.cancelledBookings} reserva(s) canceladas.`);
      setNotified(new Set());
      if (r.contacts.length) setCancelResult(r);
      else setCancelOpen(false);
      void reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !trip || !data) return <ErrorBox message={error?.message ?? 'No encontrado'} onRetry={() => void reload()} />;

  const open = trip.status === 'scheduled' || trip.status === 'in_progress';

  return (
    <>
      <Link href="/admin/viajes" className="inline-flex items-center gap-1.5 font-bold text-ruta hover:underline print:hidden">
        <ArrowLeft className="size-4" /> Viajes
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-ruta">
            {trip.route.origin} › {trip.route.destination}
          </h1>
          <p className="text-lg">
            {dayLong(trip.departureTime)}, sale {hhmm(trip.departureTime)} y llega {hhmm(trip.arrivalTime)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-niebla">
            <TripBadge status={trip.status} />
            <span>
              {trip.bus.name} ({trip.bus.plate})
            </span>
            <span>{trip.driver?.fullName ?? 'Sin chofer'}</span>
            <span>{gs(trip.price)} por pasajero</span>
            {trip.bookingClosed && trip.status === 'scheduled' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ruta px-2.5 py-0.5 text-sm font-bold text-white">
                <Lock className="size-3.5" /> Reservas cerradas
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {(trip.status === 'in_progress' || trip.lastLocationAt) && (
            <ButtonLink href={`/admin/viajes/mapa?id=${id}`} variant="primary" size="sm">
              <Radio className="size-4" /> Mapa en vivo
            </ButtonLink>
          )}
          {open && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Editar
            </Button>
          )}
          {open && (
            <Button variant="outline" size="sm" loading={busy} onClick={() => void complete()}>
              Marcar finalizado
            </Button>
          )}
          {open && (
            <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" onClick={() => setCancelOpen(true)}>
              Cancelar viaje
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Borrar viaje
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6 self-start print:hidden">
        <Panel title="Lugares">
          {(() => {
            const a = data.availability;
            const paid = active.filter((b) => b.status === 'confirmed').reduce((n, b) => n + b.numberOfPassengers, 0);
            const pending = active.filter((b) => b.status === 'pending').reduce((n, b) => n + b.numberOfPassengers, 0);
            return (
              <>
                <div className="flex items-end justify-between">
                  <p className="font-display text-5xl font-bold text-ruta">
                    {a.occupied}
                    <span className="text-2xl text-niebla">/{a.capacity}</span>
                  </p>
                  <p className="text-right text-sm text-niebla">{a.available === 0 ? 'Completo' : `${a.available} libres`}</p>
                </div>
                <div className="mt-3">
                  <Occupancy used={a.occupied} total={a.capacity} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-monte-50 p-3">
                    <dt className="text-sm text-monte">Pagaron</dt>
                    <dd className="font-display text-3xl font-bold text-monte">{paid}</dd>
                  </div>
                  <div className="rounded-xl bg-ambar-50 p-3">
                    <dt className="text-sm text-ambar-dark">Esperando pago</dt>
                    <dd className="font-display text-3xl font-bold text-ambar-dark">{pending}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-niebla">Solo los que pagaron ocupan lugar. El lugar es del primero que paga.</p>
                {pending > a.available && (
                  <p className="mt-2 rounded-xl bg-tierra-50 p-3 text-sm font-bold text-tierra">
                    Hay {pending} esperando pago y {a.available === 0 ? 'ya no quedan lugares' : `quedan ${a.available} lugar(es)`}: no van a entrar todos.
                    Avisales por WhatsApp.
                  </p>
                )}
              </>
            );
          })()}

          <div className="mt-5 space-y-2 border-t border-linea pt-5">
            {trip.status === 'scheduled' &&
              (trip.bookingClosed ? (
                <>
                  <p className="flex items-center gap-2 rounded-xl bg-ruta-50 p-3 font-bold text-ruta">
                    <Lock className="size-4" /> Viaje confirmado: nadie más puede reservar
                  </p>
                  <Button variant="ghost" className="w-full" loading={busy} onClick={() => void setClosed(false)}>
                    <LockOpen className="size-4" /> Reabrir reservas
                  </Button>
                </>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setCloseDriver(trip.driverId ?? '');
                    setCloseOpen(true);
                    if (!drivers.length) {
                      api<{ users: AdminUser[] }>('/api/admin/users?role=driver', { auth: true })
                        .then((d) => setDrivers(d.users.filter((u) => u.isActive)))
                        .catch(() => undefined);
                    }
                  }}
                >
                  <Lock className="size-5" /> Confirmar viaje
                </Button>
              ))}
            <Button variant="outline" className="w-full" loading={downloading} onClick={() => void download()}>
              <FileSpreadsheet className="size-5" /> Descargar planilla (Excel)
            </Button>
            <p className="text-center text-sm text-niebla">Solo los que pagaron: nombre, WhatsApp y casillas de Subida 1ra (ida) y Subida 2da (vuelta).</p>
          </div>
        </Panel>

        <PromoPanel trip={trip} onChanged={() => void reload(true)} />
        </div>

        <div className="space-y-6">
          <Panel title={`Pasajeros (${passengers.length})`}>
            {passengers.length === 0 ? (
              <p className="text-niebla">Todavía no hay pasajeros.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="text-sm text-niebla">
                  <tr>
                    <th className="py-2 pr-3">N°</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Cédula</th>
                    <th className="py-2 pr-3">Teléfono</th>
                    <th className="py-2 pr-3 max-sm:hidden">Código</th>
                    <th className="py-2">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {passengers.map((p, i) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-display text-xl font-bold">{i + 1}</td>
                      <td className="py-2 pr-3">
                        {p.fullName}
                        {p.boarded && <span className="ml-2 text-sm font-bold text-monte">Subió</span>}
                      </td>
                      <td className="py-2 pr-3">{p.document ? docFmt(p.document) : '—'}</td>
                      <td className="py-2 pr-3">{p.phone}</td>
                      <td className="py-2 pr-3 max-sm:hidden">{p.code}</td>
                      <td className="py-2">{p.status === 'confirmed' ? <span className="font-bold text-monte">Pagado</span> : <span className="font-bold text-ambar-dark">Pendiente</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Reservas de este viaje" className="print:hidden">
            {listed.length === 0 ? (
              <p className="text-niebla">Sin reservas.</p>
            ) : (
              <ul className="divide-y divide-linea">
                {listed.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="font-display text-xl font-bold">{b.bookingCode}</span>
                      <span className="block text-sm text-niebla">
                        {b.passengers.map((p) => p.fullName).join(', ')}
                      </span>
                    </span>
                    <BookingBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <TripForm open={editing} onClose={() => setEditing(false)} onSaved={() => void reload(true)} trip={trip} />

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Confirmar viaje">
        <p>
          Al confirmar el viaje se <strong>cierran las reservas</strong>: nadie más puede anotarse, aunque queden lugares libres.
        </p>
        <p className="mt-3 rounded-xl bg-papel p-3 text-sm">
          Pagaron: <strong>{data.availability.occupied}</strong> de {data.availability.capacity}. Las reservas que todavía no pagaron siguen
          activas y las podés confirmar después.
        </p>
        <div className="mt-4">
          <Select label="Chofer responsable" value={closeDriver} onChange={(e) => setCloseDriver(e.target.value)}>
            <option value="">Sin asignar todavía</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-sm text-niebla">Es el que ve el viaje en su celular y comparte la ubicación.</p>
        </div>
        <Button size="lg" className="mt-5 w-full" loading={busy} onClick={() => void setClosed(true)}>
          <Lock className="size-5" /> Sí, confirmar viaje
        </Button>
        <p className="mt-2 text-center text-sm text-niebla">Si te equivocás, lo podés reabrir.</p>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setCancelResult(null);
        }}
        title={cancelResult ? 'Avisá a los pasajeros' : 'Cancelar viaje'}
      >
        {cancelResult ? (
          <div>
            <p>Tocá cada botón para mandarle el aviso por WhatsApp. El mensaje ya está escrito con el motivo.</p>
            <ul className="mt-4 space-y-2">
              {cancelResult.contacts.map((c) => {
                const sent = notified.has(c.code);
                return (
                  <li key={c.code} className={cn('flex items-center justify-between gap-3 rounded-xl border-2 p-3', sent ? 'border-monte/40 bg-monte-50' : 'border-linea')}>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{c.name}</span>
                      <span className="text-sm text-niebla">
                        {c.code}
                        {c.wasPaid && <strong className="ml-1 text-tierra">· ya pagó</strong>}
                      </span>
                    </span>
                    <a
                      href={waLink(
                        c.phone,
                        msgCancelled({
                          code: c.code,
                          name: c.name,
                          origin: trip.route.origin,
                          destination: trip.route.destination,
                          departureTime: trip.departureTime,
                          passengers: c.passengers,
                          reason: cancelResult.reason,
                          wasPaid: c.wasPaid,
                        }),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setNotified((s) => new Set(s).add(c.code))}
                      className={buttonClass(sent ? 'outline' : 'whatsapp', 'sm', 'shrink-0')}
                    >
                      <WhatsAppIcon className="size-4" /> {sent ? 'Enviado' : 'Avisar'}
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-niebla">
              {notified.size} de {cancelResult.contacts.length} avisados.
            </p>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                setCancelOpen(false);
                setCancelResult(null);
              }}
            >
              Terminar
            </Button>
          </div>
        ) : (
        <>
        <p>
          Se cancelan las <strong>{active.length}</strong> reservas activas y los asientos quedan libres. En el paso siguiente te mostramos la lista para
          avisarle a cada pasajero por WhatsApp.
        </p>
        <div className="mt-4">
          <Input label="Motivo (lo ven los pasajeros)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: problema mecánico" />
        </div>
        <Button variant="danger" size="lg" className="mt-5 w-full" loading={busy} onClick={() => void cancelTrip()}>
          Cancelar viaje
        </Button>
        </>
        )}
      </Modal>

      <ConfirmDelete
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Borrar viaje"
        onConfirm={async () => {
          const r = await api<{ deletedBookings: number }>(`/api/admin/trips/${id}`, { method: 'DELETE', auth: true });
          toast.success(r.deletedBookings ? `Viaje borrado junto con ${r.deletedBookings} reserva(s)` : 'Viaje borrado');
          router.replace('/admin/viajes');
        }}
      >
        <p>
          Se borra el viaje <strong>{trip.route.origin} › {trip.route.destination}</strong> del {dayLong(trip.departureTime)} a las{' '}
          {hhmm(trip.departureTime)}
          {trip.bookings.length > 0 && (
            <>
              {' '}
              junto con sus <strong>{trip.bookings.length} reserva(s)</strong>
            </>
          )}
          .
        </p>
        {isPast && active.length > 0 && <p className="text-niebla">Descargá antes la planilla si querés guardar la lista de pasajeros.</p>}
      </ConfirmDelete>
    </>
  );
}
export default function TripDetailPage() {
  return (
    <Suspense>
      <TripDetailPageInner />
    </Suspense>
  );
}
