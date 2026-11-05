import { useEffect, useState } from 'react';
import { useIntegrationStatus, useRegisterIntegration, useCancelIntegration } from '@/api/queries';
import { api } from '@/api/client';
import { Card, CardHeader, Badge, Field, Input, Button, Spinner, LoadingBlock } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast('success', `${label} disalin.`);
    } catch {
      toast('error', 'Gagal menyalin.');
    }
  }
  return (
    <div className="border-b border-border-soft px-5 py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-muted">{label}</span>
        <button onClick={copy} className="shrink-0 text-xs font-semibold text-primary hover:underline" disabled={!value}>
          Salin
        </button>
      </div>
      <div className="mt-1 break-all font-mono text-sm text-text-strong">{value || '—'}</div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </div>
  );
}

export function IntegrationPanel() {
  const { data: status, isLoading } = useIntegrationStatus();
  const register = useRegisterIntegration();
  const cancel = useCancelIntegration();
  const toast = useToast();

  const [ecopaUrl, setEcopaUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [editing, setEditing] = useState(false);

  // Prefill from the backend-reported defaults once loaded. Base URL falls back
  // to the current origin (so localhost shows localhost, not a placeholder).
  useEffect(() => {
    if (status) {
      setEcopaUrl((v) => v || status.ecopa_url || '');
      setBaseUrl((v) => v || status.base_url || (typeof window !== 'undefined' ? window.location.origin : ''));
    }
  }, [status]);

  if (isLoading || !status) {
    return (
      <Card>
        <LoadingBlock />
      </Card>
    );
  }

  const active = status.integration_status === 'on' || status.registration_status === 'active';
  const pending = status.registration_status === 'pending';

  async function submit() {
    if (!ecopaUrl.trim() || !token.trim()) {
      toast('error', 'Ecopa URL dan Registration Token wajib diisi.');
      return;
    }
    try {
      await register.mutateAsync({
        ecopa_url: ecopaUrl.trim(),
        registration_token: token.trim(),
        base_url: baseUrl.trim() || undefined,
      });
      setToken('');
      setEditing(false);
      toast('success', editing ? 'Konfigurasi diperbarui.' : 'Permintaan registrasi dikirim ke Ecopa.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Registrasi gagal.');
    }
  }

  async function doCancel() {
    try {
      await cancel.mutateAsync();
      toast('success', 'Registrasi dibatalkan.');
    } catch {
      toast('error', 'Gagal membatalkan registrasi.');
    }
  }

  const modeBadge =
    api.mode === 'mock'
      ? <Badge tone="warning">Mock (data contoh di browser)</Badge>
      : <Badge tone="success">Live (backend Asetto)</Badge>;

  // ---- Connected ----
  if (active && !editing) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader
            title="Integrasi Ecopa"
            subtitle="Identitas lewat Ecopa (SSO). Credential disimpan terenkripsi oleh backend."
            action={<Badge tone="success">Terhubung</Badge>}
          />
          <div className="flex flex-wrap gap-2 px-5 py-3">
            <Badge tone={status.sso_ready ? 'success' : 'warning'}>SSO {status.sso_ready ? 'siap' : 'belum'}</Badge>
            <Badge tone={status.webhook_ready ? 'success' : 'warning'}>Webhook {status.webhook_ready ? 'siap' : 'belum'}</Badge>
            {modeBadge}
          </div>
          <CopyRow label="Ecopa URL" value={status.ecopa_url} />
          <CopyRow label="Base URL Asetto" value={status.base_url} hint="Origin publik Asetto; dasar redirect & webhook." />
          <CopyRow label="Redirect URI" value={status.redirect_uri} hint="Harus terdaftar persis sama di Ecopa." />
          <CopyRow label="Webhook URL" value={status.webhook_url} hint="Ecopa mengirim event approval & lifecycle ke sini." />
        </Card>

        <Card>
          <CardHeader title="General Ledger" subtitle="Data akuntansi dikirim ke Akunta." />
          <div className="px-5 py-3 text-sm text-text-muted">
            Akunta — REST api-client (server-to-server), posting jurnal idempoten mengikuti periode & invariant Akunta.
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setEcopaUrl(status.ecopa_url || '');
              setBaseUrl(status.base_url || (typeof window !== 'undefined' ? window.location.origin : ''));
              setToken('');
              setEditing(true);
            }}
          >
            Ubah konfigurasi
          </Button>
          <Button variant="secondary" onClick={doCancel} disabled={cancel.isPending}>
            {cancel.isPending && <Spinner />} Putuskan
          </Button>
        </div>
      </div>
    );
  }

  // ---- Pending ----
  if (pending) {
    return (
      <Card>
        <CardHeader title="Menunggu persetujuan Ecopa" action={<Badge tone="info">Pending</Badge>} />
        <div className="px-5 py-4 text-sm text-text-muted">
          Permintaan registrasi sudah dikirim. Administrator Ecopa perlu menyetujuinya; setelah disetujui, credential SSO &
          webhook dikirim otomatis ke Asetto (tak perlu input manual).
        </div>
        <div className="px-5 pb-4">
          <Button variant="secondary" onClick={doCancel} disabled={cancel.isPending}>
            {cancel.isPending && <Spinner />} Batalkan & ubah
          </Button>
        </div>
      </Card>
    );
  }

  // ---- Not configured / rejected: registration wizard ----
  return (
    <Card>
      <CardHeader
        title={editing ? 'Ubah konfigurasi Ecopa' : 'Hubungkan ke Ecopa'}
        subtitle={
          editing
            ? 'Mengubah Ecopa URL / Base URL mendaftar ulang ke Ecopa (butuh Registration Token baru).'
            : 'Daftarkan Asetto ke Ecopa untuk mengaktifkan login SSO.'
        }
        action={modeBadge}
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        {status.registration_status === 'rejected' && status.registration_message && (
          <div className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
            Ditolak Ecopa: {status.registration_message}
          </div>
        )}
        <Field label="Ecopa URL" hint="Alamat Identity Provider Ecopa.">
          <Input value={ecopaUrl} onChange={(e) => setEcopaUrl(e.target.value)} placeholder="https://home.opensynergic.com" />
        </Field>
        <Field
          label="Base URL Asetto (origin publik)"
          hint="Dasar redirect URI & webhook. Kosongkan untuk memakai APP_URL server."
        >
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://asetto.perusahaan.co.id" />
        </Field>
        <Field label="Registration Token" hint="Ambil dari dashboard Ecopa (Apps Management → Add Application).">
          <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token dari Ecopa" />
        </Field>
        {baseUrl.trim() && (
          <div className="rounded-lg bg-primary-light/50 p-3 text-xs text-text-muted">
            <div>Redirect URI: <span className="font-mono text-text-default">{baseUrl.trim().replace(/\/+$/, '')}/auth/ecopa/callback</span></div>
            <div className="mt-1">Webhook: <span className="font-mono text-text-default">{baseUrl.trim().replace(/\/+$/, '')}/webhooks/ecopa</span></div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={register.isPending}>
            {register.isPending && <Spinner />} {editing ? 'Simpan perubahan' : 'Daftarkan ke Ecopa'}
          </Button>
          {editing && (
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={register.isPending}>
              Batal
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
