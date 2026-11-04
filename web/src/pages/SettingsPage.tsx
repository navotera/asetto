import { useMe } from '@/api/queries';
import { api } from '@/api/client';
import { PageHeader, Card, CardHeader, Badge, Button } from '@/components/ui/primitives';
import { useColorMode, setColorMode } from '@/hooks/useColorMode';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-soft px-5 py-3 last:border-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-strong">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { data: me } = useMe();
  const mode = useColorMode();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <PageHeader title="Pengaturan" description="Profil, tampilan, dan status integrasi ekosistem." />
      </div>

      <Card>
        <CardHeader title="Profil Pengguna" subtitle="Identitas berasal dari Ecopa (SSO)." />
        <Row label="Nama" value={me?.name ?? '—'} />
        <Row label="Email" value={me?.email ?? '—'} />
        <Row label="Peran Ekosistem" value={<Badge tone="info">{me?.app_role ?? '—'}</Badge>} />
        <Row label="Peran Asetto" value={me?.roles?.join(', ') ?? '—'} />
      </Card>

      <Card>
        <CardHeader title="Tampilan" subtitle="Preferensi tema disimpan di perangkat ini." />
        <div className="flex items-center gap-2 px-5 py-4">
          <Button variant={mode === 'light' ? 'primary' : 'secondary'} onClick={() => setColorMode('light')}>☀ Terang</Button>
          <Button variant={mode === 'dark' ? 'primary' : 'secondary'} onClick={() => setColorMode('dark')}>☾ Gelap</Button>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Integrasi"
          subtitle="Identitas lewat Ecopa; data akuntansi dikirim ke Akunta."
        />
        <Row
          label="Mode API"
          value={
            api.mode === 'mock'
              ? <Badge tone="warning">Mock (data contoh di browser)</Badge>
              : <Badge tone="success">Live (backend Asetto)</Badge>
          }
        />
        <Row label="Identity Provider" value="Ecopa — OIDC (silent SSO)" />
        <Row label="General Ledger" value="Akunta — REST api-client (server-to-server)" />
        <Row label="Posting jurnal" value="Idempoten, mengikuti periode & invariant Akunta" />
      </Card>

      {api.mode === 'mock' && (
        <Card className="lg:col-span-2 border-warning/40">
          <div className="px-5 py-4 text-sm text-text-muted">
            <strong className="text-text-default">Catatan mode mock.</strong> Seluruh data berjalan di browser dengan
            dataset contoh. Alur depresiasi → jurnal ke Akunta disimulasikan di outbox lokal. Untuk menghubungkan ke
            backend Asetto sungguhan, set <code className="font-mono">VITE_API_MODE=live</code> dan{' '}
            <code className="font-mono">VITE_API_BASE</code> di <code className="font-mono">.env</code>.
          </div>
        </Card>
      )}
    </div>
  );
}
