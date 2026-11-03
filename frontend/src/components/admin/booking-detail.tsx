'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, Trash2 } from 'lucide-react';
import { BookingBadge, Button, Input, Modal, buttonClass, cn } from '@/components/ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { api, errorMessage } from '@/lib/api';
import { ago, dateTime, docFmt, gs, waLink } from '@/lib/format';
import { msgCancelled, msgConfirmed, msgReminder } from '@/lib/whatsapp-messages';
import type { AdminBooking } from '@/lib/types';
import { toast } from '@/store/toast';

type Done = { kind: 'confirm' | 'cancel'; booking: AdminBooking; reason?: string; wasPaid: boolean };

/** Detalle de una reserva: confirmar pago, cancelar y avisar al pasajero por WhatsApp. */
export function BookingDetail({
  booking,
  onClose,
  onChanged,
}: {
  booking: AdminBooking | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  /** Después de confirmar o cancelar mostramos el botón para avisar por WhatsApp */
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (booking) {
      setCancelling(false);
      setDeleting(false);
      setReason('');
      setDone(null);
    }
  }, [booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // La reserva puede desaparecer de la lista al cambiar de estado: usamos la copia guardada
  const b = done?.booking ?? booking;

  function close() {
    setDone(null);
    onClose();
  }

  const msgBase = b && {
    code: b.bookingCode,
    name: b.passengers[0]?.fullName ?? '',
    origin: b.trip.route.origin,
    destination: b.trip.route.destination,
    departureTime: b.trip.departureTime,
    passengers: b.numberOfPassengers,
  };

  async function act(kind: 'confirm' | 'cancel') {
    if (!b) return;
    setBusy(kind);
    const finalReason = reason.trim() || 'Cancelada por la empresa';
    try {
      await api(`/api/admin/bookings/${b.id}/${kind}`, {
        method: 'POST',
        auth: true,
        body: kind === 'cancel' ? { reason: finalReason } : undefined,
      });
      toast.success(kind === 'confirm' ? `${b.bookingCode} confirmada` : `${b.bookingCode} cancelada. Los lugares quedaron libres.`);
      setDone({
        kind,
        booking: { ...b, status: kind === 'confirm' ? 'confirmed' : 'cancelled' },
        reason: finalReason,
        wasPaid: b.status === 'confirmed',
      });
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!b) return;
    setBusy('delete');
    try {
      await api(`/api/admin/bookings/${b.id}`, { method: 'DELETE', auth: true });
      toast.success(`${b.bookingCode} borrada`);
      onChanged();
      close();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  /** Se puede borrar si está cancelada o si su viaje ya salió */
  const canDelete = !!b && (b.status === 'cancelled' || new Date(b.trip.departureTime).getTime() < Date.now());

  const overdue = b?.status === 'pending' && new Date(b.paymentDeadline).getTime() < Date.now() + 2 * 3600_000;

  return (
    <Modal open={!!b} onClose={close} title={b?.bookingCode ?? ''} wide>
      {b && msgBase && (
        <div className="space-y-5">
          {/* ---- Después de una acción: avisar por WhatsApp ---- */}
          {done && (
            <div className={cn('rounded-2xl p-5', done.kind === 'confirm' ? 'bg-monte-50' : 'bg-tierra-50')}>
              <p className={cn('flex items-center gap-2 text-lg font-bold', done.kind === 'confirm' ? 'text-monte' : 'text-tierra')}>
                <CircleCheck className="size-6" />
                {done.kind === 'confirm' ? 'Pago confirmado' : 'Reserva cancelada'}
              </p>
              <p className="mt-1">Ahora avisale al pasajero. El mensaje ya está escrito, solo tocá enviar en WhatsApp.</p>
              <a
                href={waLink(
                  b.contactPhone,
                  done.kind === 'confirm'
                    ? msgConfirmed(msgBase)
                    : msgCancelled({ ...msgBase, reason: done.reason ?? '', wasPaid: done.wasPaid }),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('whatsapp', 'lg', 'mt-4 w-full')}
              >
                <WhatsAppIcon className="size-6" /> Avisar por WhatsApp
              </a>
              <Button variant="ghost" className="mt-2 w-full" onClick={close}>
                Listo, cerrar
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <BookingBadge status={b.status} />
            <span className="text-sm text-niebla">Creada {ago(b.createdAt)}</span>
            {b.status === 'pending' && (
              <span className={cn('text-sm font-bold', overdue ? 'text-tierra' : 'text-niebla')}>Vence {dateTime(b.paymentDeadline)}</span>
            )}
          </div>

          <div className="rounded-2xl bg-papel p-4">
            <p className="font-bold">
              {b.trip.route.origin} › {b.trip.route.destination}
            </p>
            <p className="text-niebla">{dateTime(b.trip.departureTime)}</p>
            <p className="mt-2 font-display text-3xl font-bold text-ruta">{gs(b.totalAmount)}</p>
          </div>

          <div>
            <h3 className="font-bold">Pasajeros</h3>
            <ul className="mt-2 divide-y divide-linea rounded-xl border border-linea">
              {b.passengers.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    <span className="font-bold">{p.fullName}</span>
                    <span className="block text-sm text-niebla">
                      {p.document && <>CI {docFmt(p.document)} · </>}Tel. {p.phone}
                    </span>
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ruta font-display text-lg font-bold text-white">
                    {i + 1}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!done && (
            <div className="flex flex-wrap gap-2">
              <a
                href={waLink(
                  b.contactPhone,
                  b.status === 'pending'
                    ? msgReminder({ ...msgBase, total: b.totalAmount, deadline: b.paymentDeadline })
                    : b.status === 'confirmed'
                      ? msgConfirmed(msgBase)
                      : `Hola, te escribimos de JC Transporte por tu reserva ${b.bookingCode}.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('whatsapp', 'sm')}
              >
                <WhatsAppIcon className="size-4" />
                {b.status === 'pending' ? 'Recordar el pago' : b.status === 'confirmed' ? 'Reenviar confirmación' : 'Escribir'}
                <span className="font-normal opacity-80">({b.contactPhone})</span>
              </a>
            </div>
          )}

          {b.notes && <p className="rounded-xl bg-ambar-50 p-3">Nota: {b.notes}</p>}
          {b.cancelReason && <p className="rounded-xl bg-tierra-50 p-3 text-tierra">Motivo de cancelación: {b.cancelReason}</p>}

          {!done && b.status !== 'cancelled' && !cancelling && (
            <div className="flex flex-col gap-2 border-t border-linea pt-5 sm:flex-row">
              {b.status === 'pending' && (
                <Button size="lg" className="flex-1" loading={busy === 'confirm'} onClick={() => void act('confirm')}>
                  Confirmar pago
                </Button>
              )}
              <Button variant="ghost" className="text-tierra hover:bg-tierra-50" onClick={() => setCancelling(true)}>
                Cancelar reserva
              </Button>
            </div>
          )}

          {!done && cancelling && (
            <div className="space-y-3 rounded-2xl border-2 border-tierra/30 p-4">
              <p className="font-bold text-tierra">
                ¿Cancelar {b.bookingCode}? Sus {b.numberOfPassengers} lugar(es) quedan libres.
              </p>
              <Input label="Motivo (va en el mensaje al pasajero)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: no se recibió el pago" />
              <div className="flex gap-2">
                <Button variant="danger" loading={busy === 'cancel'} onClick={() => void act('cancel')}>
                  Sí, cancelar
                </Button>
                <Button variant="ghost" onClick={() => setCancelling(false)}>
                  Volver
                </Button>
              </div>
            </div>
          )}

          {!done && canDelete && !cancelling && (
            <div className="border-t border-linea pt-5">
              {!deleting ? (
                <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" onClick={() => setDeleting(true)}>
                  <Trash2 className="size-4" /> Borrar reserva
                </Button>
              ) : (
                <div className="space-y-3 rounded-2xl border-2 border-tierra/30 p-4">
                  <p className="font-bold text-tierra">
                    ¿Borrar {b.bookingCode} para siempre? Desaparece de la lista y de las estadísticas. No se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="danger" loading={busy === 'delete'} onClick={() => void remove()}>
                      Sí, borrar
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(false)}>
                      Volver
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
