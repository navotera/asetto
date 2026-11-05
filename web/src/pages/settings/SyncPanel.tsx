import { useSettings, useSaveSettings } from '@/api/queries';
import { Card, CardHeader, LoadingBlock } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { SyncSettings } from '@/api/types';

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
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ' +
        (on ? 'bg-primary' : 'bg-border-default')
      }
    >
      <span
        className={
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ' +
          (on ? 'left-0.5 translate-x-5' : 'left-0.5')
        }
      />
    </button>
  );
}

export function SyncPanel() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const toast = useToast();

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

  return (
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
  );
}
