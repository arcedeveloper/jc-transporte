'use client';

import { useEffect, useState } from 'react';
import { PageTitle, Panel } from '@/components/admin/bits';
import { SignEditor } from '@/components/admin/sign-editor';
import { RequestRules } from '@/components/admin/request-rules';
import { Button, ErrorBox, Input, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import type { Settings } from '@/lib/types';
import { toast } from '@/store/toast';

const emptySettings: Settings = {
  bankName: '',
  bankAccount: '',
  bankHolder: '',
  bankRuc: '',
  bankAlias: '',
  adminWhatsapp: '',
  adminEmail: '',
  instagram: '',
  tiktok: '',
};

export default function SettingsAdmin() {
  const { data, error, loading, reload } = useQuery(() => api<{ settings: Settings | null }>('/api/admin/settings', { auth: true }));
  const [form, setForm] = useState<Settings>(emptySettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings)
      setForm({ ...emptySettings, ...data.settings, bankRuc: data.settings.bankRuc ?? '', bankAlias: data.settings.bankAlias ?? '', adminEmail: data.settings.adminEmail ?? '', instagram: data.settings.instagram ?? '', tiktok: data.settings.tiktok ?? '' });
  }, [data]);

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        auth: true,
        body: { ...form, bankRuc: form.bankRuc || null, bankAlias: form.bankAlias || null, adminEmail: form.adminEmail || null, instagram: form.instagram || null, tiktok: form.tiktok || null },
      });
      toast.success('Datos guardados. Los próximos pasajeros ya los ven.');
      void reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void reload()} />;

  return (
    <>
      <PageTitle title="Empresa" />
      <div className="max-w-4xl">
        <div className="min-w-0 space-y-6">
        {data?.settings && (
          <SignEditor
            initialMessages={data.settings.signMessages ?? []}
            initialShowRoutes={data.settings.signShowRoutes ?? true}
          />
        )}
        <Panel title="Datos de la empresa">
          <p className="-mt-2 mb-4 text-niebla">La cuenta para las transferencias (el pasajero la ve después de reservar, con botones para copiar), el WhatsApp y las redes que aparecen en la página.</p>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Input label="Banco" value={form.bankName} onChange={set('bankName')} required />
            <Input label="Número de cuenta" value={form.bankAccount} onChange={set('bankAccount')} required />
            <Input label="Titular" value={form.bankHolder} onChange={set('bankHolder')} required />
            <Input label="RUC o CI del titular (opcional)" value={form.bankRuc ?? ''} onChange={set('bankRuc')} />
            <Input label="Alias (opcional)" value={form.bankAlias ?? ''} onChange={set('bankAlias')} hint="Para transferencias SIPAP por alias" />
            <div className="hidden sm:block" />
            <Input
              label="WhatsApp de la empresa"
              inputMode="tel"
              value={form.adminWhatsapp}
              onChange={set('adminWhatsapp')}
              hint="Con código de país, sin + ni espacios: 595981123456"
              required
            />
            <Input label="Email de la empresa (opcional)" type="email" value={form.adminEmail ?? ''} onChange={set('adminEmail')} hint="Si lo cargás, aparece en el pie de página" />
            <Input
              label="Instagram (opcional)"
              placeholder="jctransporte_py"
              value={form.instagram ?? ''}
              onChange={set('instagram')}
              hint="Solo el usuario, con o sin @. Aparece en el pie de página."
            />
            <Input
              label="TikTok (opcional)"
              placeholder="Cuando lo tengas"
              value={form.tiktok ?? ''}
              onChange={set('tiktok')}
              hint="Solo el usuario, con o sin @."
            />
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" loading={saving}>
                Guardar datos
              </Button>
            </div>
          </form>
        </Panel>
        {data?.settings && (
          <RequestRules
            minPeople={data.settings.groupMinPeople ?? 12}
            maxPeople={data.settings.groupMaxPeople ?? 17}
            minDays={data.settings.groupMinDays ?? 5}
          />
        )}
        </div>
      </div>
    </>
  );
}
