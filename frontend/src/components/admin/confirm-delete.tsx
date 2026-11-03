'use client';

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { toast } from '@/store/toast';

/**
 * Ventana "¿Seguro que querés borrar…?". Borrar no se puede deshacer,
 * así que siempre se pide una confirmación explícita.
 */
export function ConfirmDelete({
  open,
  onClose,
  title,
  children,
  confirmLabel = 'Sí, borrar',
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  /** Si tira error, se muestra el mensaje y la ventana queda abierta */
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">{children}</div>
      <p className="mt-3 text-sm font-bold text-tierra">Esto no se puede deshacer.</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button variant="danger" size="lg" className="flex-1" loading={busy} onClick={() => void run()}>
          <Trash2 className="size-5" aria-hidden /> {confirmLabel}
        </Button>
        <Button variant="ghost" size="lg" onClick={onClose}>
          Volver
        </Button>
      </div>
    </Modal>
  );
}
