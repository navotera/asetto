import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMe, useSettings, useSaveSettings, useCan } from '@/api/queries';
import { PageHeader, Card, CardHeader, Badge, Field, Select, Spinner } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/toast';
import { UserRolesPanel } from './settings/UserRolesPanel';
import { RoleMatrixPanel } from './settings/RoleMatrixPanel';
import { CustodianLinkPanel } from './settings/CustodianLinkPanel';
import { EntitiesPanel } from './settings/EntitiesPanel';
import { IntegrationPanel } from './settings/IntegrationPanel';
import { SyncPanel } from './settings/SyncPanel';
import { CronPanel } from './settings/CronPanel';
import { GeneralPanel } from './settings/GeneralPanel';

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-soft px-5 py-3 last:border-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-strong">{value}</span>
    </div>
  );
}

interface Section {
  id: string;
  label: string;
  description: string;
  icon: string;
  adminOnly?: boolean;
}

const SECTIONS: Section[] = [
  { id: 'umum', label: 'Umum', description: 'Zona waktu & format tanggal', icon: '⚙', adminOnly: true },
  { id: 'profil', label: 'Profil Pengguna', description: 'Identitas dari Ecopa', icon: '◉' },
  { id: 'entitas', label: 'Entitas', description: 'Perusahaan (PT) & jurnal', icon: '◫', adminOnly: true },
  { id: 'depresiasi', label: 'Depresiasi Terjadwal', description: 'Mode posting otomatis', icon: '↘', adminOnly: true },
  { id: 'sinkron', label: 'Sinkronisasi Akunta', description: 'Peristiwa ekonomi ke Akunta', icon: '⤤', adminOnly: true },
  { id: 'cron', label: 'Penjadwalan (Cron)', description: 'Status scheduler & tugas', icon: '⏱', adminOnly: true },
  { id: 'penyimpanan', label: 'Penyimpanan File', description: 'Disk foto & bukti', icon: '▤', adminOnly: true },
  { id: 'users', label: 'User & Roles', description: 'Assign role & impersonate', icon: '♙', adminOnly: true },
  { id: 'roles', label: 'Role Management', description: 'Matriks izin role', icon: '✓', adminOnly: true },
  { id: 'custodian', label: 'Tautan Custodian', description: 'Custodian → user Ecopa', icon: '⇄', adminOnly: true },
  { id: 'integrasi', label: 'Integrasi', description: 'Ecopa & Akunta', icon: '⇆' },
];

export default function SettingsPage() {
  const { data: me } = useMe();
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const { can } = useCan();
  const isAdmin = me?.app_role === 'admin' || can('settings.manage');

  const sections = useMemo(() => SECTIONS.filter((s) => !s.adminOnly || isAdmin), [isAdmin]);
  const [searchParams] = useSearchParams();
  const [active, setActive] = useState(searchParams.get('section') ?? 'profil');
  const current = sections.find((s) => s.id === active) ?? sections[0];

  // Deep-link to a section via ?section=… (e.g. from the Peristiwa Ekonomi cog).
  useEffect(() => {
    const s = searchParams.get('section');
    if (s) setActive(s);
  }, [searchParams]);

  async function update(patch: { mode?: 'auto_post' | 'draft'; disk?: string }) {
    try {
      await save.mutateAsync(patch);
      toast('success', 'Pengaturan disimpan.');
    } catch {
      toast('error', 'Gagal menyimpan pengaturan.');
    }
  }

  return (
    <div>
      <PageHeader title="Pengaturan" description="Profil, operasional, akses, dan integrasi ekosistem." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Left vertical menu */}
        <Card className="h-fit p-2">
          <nav className="flex flex-col gap-0.5">
            {sections.map((s) => {
              const isActive = current?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    isActive ? 'bg-primary-light' : 'hover:bg-primary-light/60',
                  )}
                >
                  <span aria-hidden="true" className={cn('mt-0.5 w-4 text-center text-base', isActive ? 'text-primary' : 'text-text-muted')}>
                    {s.icon}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-sm font-semibold', isActive ? 'text-primary' : 'text-text-default')}>
                      {s.label}
                    </span>
                    <span className="block text-[11px] text-text-muted">{s.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Right detail panel */}
        <div className="min-w-0">
          {current?.id === 'umum' && <GeneralPanel />}

          {current?.id === 'profil' && (
            <Card>
              <CardHeader title="Profil Pengguna" subtitle="Identitas berasal dari Ecopa (SSO)." />
              <Row label="Nama" value={me?.name ?? '—'} />
              <Row label="Email" value={me?.email ?? '—'} />
              <Row label="Peran Ekosistem" value={<Badge tone="info">{me?.app_role ?? '—'}</Badge>} />
              <Row label="Peran Asetto" value={me?.role ?? (me?.roles?.length ? me.roles.join(', ') : '—')} />
            </Card>
          )}

          {current?.id === 'depresiasi' && (
            <Card>
              <CardHeader title="Depresiasi Terjadwal" subtitle="Cara menjalankan depresiasi bulanan otomatis." />
              <div className="px-5 py-4">
                <Field label="Mode" hint="Auto-post langsung kirim jurnal ke Akunta; draft perlu disetujui admin.">
                  <Select
                    value={settings?.mode ?? 'auto_post'}
                    disabled={save.isPending || !settings}
                    onChange={(e) => update({ mode: e.target.value as 'auto_post' | 'draft' })}
                  >
                    <option value="auto_post">Auto-post (otomatis ke Akunta)</option>
                    <option value="draft">Draft (perlu persetujuan admin)</option>
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {current?.id === 'penyimpanan' && (
            <Card>
              <CardHeader title="Penyimpanan File" subtitle="Lokasi penyimpanan foto aset & bukti pembelian." />
              <div className="px-5 py-4">
                <Field label="Disk" hint="Foto/bukti otomatis di-resize + dibuat thumbnail; original tidak disimpan.">
                  <Select
                    value={settings?.disk ?? 'public'}
                    disabled={save.isPending || !settings}
                    onChange={(e) => update({ disk: e.target.value })}
                  >
                    {(settings?.disks ?? ['public']).map((d) => (
                      <option key={d} value={d}>
                        {d === 'public' ? 'Lokal (server)' : d === 's3' ? 'Cloud (S3)' : d}
                      </option>
                    ))}
                  </Select>
                </Field>
                {save.isPending && <div className="mt-2 flex items-center gap-2 text-xs text-text-muted"><Spinner /> Menyimpan…</div>}
              </div>
            </Card>
          )}

          {current?.id === 'sinkron' && <SyncPanel />}
          {current?.id === 'cron' && <CronPanel />}
          {current?.id === 'entitas' && <EntitiesPanel />}
          {current?.id === 'users' && <UserRolesPanel />}
          {current?.id === 'roles' && <RoleMatrixPanel />}
          {current?.id === 'custodian' && <CustodianLinkPanel />}

          {current?.id === 'integrasi' && <IntegrationPanel />}
        </div>
      </div>
    </div>
  );
}
