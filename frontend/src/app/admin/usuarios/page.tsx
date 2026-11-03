'use client';

import { useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageTitle } from '@/components/admin/bits';
import { ConfirmDelete } from '@/components/admin/confirm-delete';
import { Button, ErrorBox, Input, Modal, Select, Spinner, cn } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import type { AdminUser, Role } from '@/lib/types';
import { useSession } from '@/store/auth';
import { toast } from '@/store/toast';

export default function UsersAdmin() {
  const me = useSession('admin')?.user;
  const { data, error, loading, reload } = useQuery(() => api<{ users: AdminUser[] }>('/api/admin/users', { auth: true }));
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'driver' as Role, password: '' });
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [editFor, setEditFor] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '' });
  const [newPass, setNewPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/admin/users', { method: 'POST', auth: true, body: form });
      toast.success(`${form.fullName} ya puede entrar con su email y contraseña`);
      setCreating(false);
      setForm({ fullName: '', email: '', role: 'driver', password: '' });
      void reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function update(u: AdminUser, body: Record<string, unknown>, msg: string) {
    setSaving(true);
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'PATCH', auth: true, body });
      toast.success(msg);
      setResetFor(null);
      setEditFor(null);
      setNewPass('');
      void reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle title="Usuarios">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-5" aria-hidden /> Agregar usuario
        </Button>
      </PageTitle>
      <p className="-mt-3 mb-5 max-w-prose text-niebla">
        Los choferes entran en <strong>/login</strong> desde el celular y ven solo sus viajes. Los pasajeros no necesitan cuenta.
      </p>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} onRetry={() => void reload()} />
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
          {data?.users.map((u) => (
            <li key={u.id} className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-4', !u.isActive && 'opacity-60')}>
              <span>
                <span className="font-bold">{u.fullName}</span>{' '}
                <span className="rounded-full bg-ruta-50 px-2 py-0.5 text-sm font-bold text-ruta">{u.role === 'admin' ? 'Admin' : 'Chofer'}</span>
                <span className="block text-sm text-niebla">
                  {u.email}
                  {!u.isActive && ', desactivado'}
                </span>
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditFor(u);
                    setEditForm({ fullName: u.fullName, email: u.email });
                  }}
                >
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setResetFor(u)}>
                  <KeyRound className="size-4" /> Cambiar clave
                </Button>
                {u.id !== me?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void update(u, { isActive: !u.isActive }, u.isActive ? `${u.fullName} ya no puede entrar` : `${u.fullName} activado`)}
                  >
                    {u.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                )}
                {u.id !== me?.id && (
                  <Button variant="ghost" size="sm" className="text-tierra hover:bg-tierra-50" onClick={() => setToDelete(u)} aria-label={`Borrar ${u.fullName}`}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Agregar usuario">
        <form onSubmit={create} className="space-y-4">
          <Input label="Nombre y apellido" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="driver">Chofer</option>
            <option value="admin">Admin</option>
          </Select>
          <Input
            label="Contraseña inicial"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="Mínimo 8 caracteres. Pasásela en persona."
            required
          />
          <Button type="submit" size="lg" className="w-full" loading={saving}>
            Crear usuario
          </Button>
        </form>
      </Modal>

      <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Editar usuario">
        {editFor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void update(editFor, { fullName: editForm.fullName.trim(), email: editForm.email.trim() }, 'Usuario actualizado');
            }}
            className="space-y-4"
          >
            <Input label="Nombre y apellido" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} required />
            <Input
              label="Email (con el que entra)"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              hint={editFor.id === me?.id ? 'Si cambiás tu email, la próxima vez entrás con el nuevo.' : undefined}
              required
            />
            <Button type="submit" size="lg" className="w-full" loading={saving}>
              Guardar
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title="Cambiar contraseña">
        {resetFor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void update(resetFor, { password: newPass }, `Contraseña de ${resetFor.fullName} actualizada`);
            }}
            className="space-y-4"
          >
            <p>
              Nueva contraseña para <strong>{resetFor.fullName}</strong>.
            </p>
            <Input label="Nueva contraseña" type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} hint="Mínimo 8 caracteres." required />
            <Button type="submit" size="lg" className="w-full" loading={saving}>
              Guardar contraseña
            </Button>
          </form>
        )}
      </Modal>
      <ConfirmDelete
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Borrar usuario"
        onConfirm={async () => {
          if (!toDelete) return;
          await api(`/api/admin/users/${toDelete.id}`, { method: 'DELETE', auth: true });
          toast.success(`${toDelete.fullName} borrado`);
          void reload(true);
        }}
      >
        <p>
          <strong>{toDelete?.fullName}</strong> ({toDelete?.email}) ya no va a poder entrar. En sus viajes viejos el chofer queda vacío.
        </p>
        <p className="text-niebla">Si solo querés que no entre por un tiempo, usá Desactivar.</p>
      </ConfirmDelete>
    </>
  );
}
