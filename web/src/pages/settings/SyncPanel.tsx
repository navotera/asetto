import { useEffect, useState } from 'react';
import { useSettings, useSaveSettings } from '@/api/queries';
import { Card, CardHeader, LoadingBlock, Field, Input, Button, Select, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { SyncSettings, RetentionSettings } from '@/api/types';

const EVENTS: { key: keyof SyncSettings; label: string; desc: string }[] = [
  { key: 'acquisition', label: 'Perolehan', desc: 'Kapitalisasi aset saat data pembelian diisi.' },
  { key: 'depreciation', label: 'Depresiasi', desc: 'Beban depresiasi per periode.' },
  { key: 'disposal', label: 'Pelepasan & Penjualan', desc: 'Penjualan / penghapusan aset + laba-rugi.' },
];

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ' +
        (on ? 'bg-primary' : 'bg-border-default')
      }
    >
      <span
        className={
          'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ' +
          (on ? 'translate-x-4' : '')
        }
      />
    </button>
  );
}

export function SyncPanel() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const toast = useToast();

  const [trashedMonths, setTrashedMonths] = useState('3');
  const [acceptedYears, setAcceptedYears] = useState('2');

  useEffect(() => {
    if (settings?.retention) {
      setTrashedMonths(String(settings.retention.trashed_months));
      setAcceptedYears(String(settings.retention.accepted_years));
    }
  }, [settings]);

  if (!settings) {
    return (
      <Card>
        <LoadingBlock />
      </Card>
    );
  }

  const sync: SyncSettings = settings.sync ?? { acquisition: true, depreciation: true, disposal: true };

  async function toggle(key: keyof SyncSettings, value: boolean) {
    try {
      await save.mutateAsync({ sync: { ...sync, [key]: value } });
      toast('success', value ? 'Sinkronisasi diaktifkan.' : 'Sinkronisasi dimatikan.');
    } catch {
      toast('error', 'Gagal menyimpan.');
    }
  }

  async function saveMode(mode: 'auto_post' | 'draft') {
    try {
      await save.mutateAsync({ mode });
      toast('success', 'Mode depresiasi disimpan.');
    } catch {
      toast('error', 'Gagal menyimpan.');
    }
  }

  async function saveRetention() {
    const retention: RetentionSettings = {
      trashed_months: Math.max(0, Number(trashedMonths) || 0),
      accepted_years: Math.max(0, Number(acceptedYears) || 0),
    };
    try {
      await save.mutateAsync({ retention });
      toast('success', 'Retensi disimpan.');
    } catch {
      toast('error', 'Gagal menyimpan retensi.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Depresiasi Terjadwal"
          subtitle="Cara cron menjalankan depresiasi bulanan otomatis — ini soal alur jalankan/approve, berbeda dari sakelar kirim-ke-Akunta di bawah."
        />
        <div className="px-5 py-4">
          <Field label="Mode" hint="Auto-post: langsung commit lalu masuk antrean Akunta. Draft: dibuat draft untuk disetujui admin dulu.">
            <Select
              value={settings.mode ?? 'auto_post'}
              disabled={save.isPending}
              onChange={(e) => saveMode(e.target.value as 'auto_post' | 'draft')}
            >
              <option value="auto_post">Auto-post (otomatis ke Akunta)</option>
              <option value="draft">Draft (perlu persetujuan admin)</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sinkronisasi Akunta"
          subtitle="Pilih peristiwa ekonomi mana yang dikirim ke Akunta. Yang dimatikan tidak masuk antrean."
        />
        {EVENTS.map((e) => (
          <div key={e.key} className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-4 last:border-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-default">{e.label}</div>
              <div className="text-xs text-text-muted">{e.desc}</div>
            </div>
            <Toggle on={sync[e.key]} disabled={save.isPending} onChange={(v) => toggle(e.key, v)} />
          </div>
        ))}
      </Card>

      <Card>
        <CardHeader
          title="Retensi antrean"
          subtitle="Pembersihan otomatis antrean oleh cron. Nilai 0 = jangan hapus otomatis."
        />
        <div className="flex flex-col gap-4 px-5 py-4">
          <Field label="Hapus item Trashed setelah (bulan)" hint="Antrean yang dibuang dihapus permanen setelah masa ini.">
            <Input type="number" min={0} value={trashedMonths} onChange={(e) => setTrashedMonths(e.target.value)} />
          </Field>
          <Field label="Hapus item Berhasil setelah (tahun)" hint="Riwayat yang sudah berhasil dihapus setelah masa ini.">
            <Input type="number" min={0} value={acceptedYears} onChange={(e) => setAcceptedYears(e.target.value)} />
          </Field>
          <div>
            <Button onClick={saveRetention} disabled={save.isPending}>
              {save.isPending && <Spinner />} Simpan retensi
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
