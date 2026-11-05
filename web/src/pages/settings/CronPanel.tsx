import { useSchedulerHealth } from '@/api/queries';
import { Card, CardHeader, Badge, LoadingBlock } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export function CronPanel() {
  const { data, isLoading } = useSchedulerHealth(true);
  const toast = useToast();

  if (isLoading || !data) {
    return (
      <Card>
        <LoadingBlock />
      </Card>
    );
  }

  const s = data.scheduler;

  async function copyCron() {
    try {
      await navigator.clipboard.writeText(s.cron_command);
      toast('success', 'Perintah cron disalin.');
    } catch {
      toast('error', 'Gagal menyalin.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Penjadwalan (Cron)"
          subtitle="Cron OS perlu menjalankan scheduler Laravel agar antrean jurnal, depresiasi bulanan, dan pembersihan berjalan."
          action={s.healthy ? <Badge tone="success">Aktif</Badge> : <Badge tone="danger">Belum terdeteksi</Badge>}
        />
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-3">
          <span className="text-sm text-text-muted">Heartbeat terakhir</span>
          <span className="text-sm font-medium text-text-strong">
            {s.last ? `${s.age_seconds ?? '—'} detik lalu` : 'Belum pernah'}
          </span>
        </div>
        {!s.healthy && (
          <div className="border-b border-border-soft bg-danger-light px-5 py-3 text-sm text-danger">
            Cron belum disetup. Tambahkan baris cron di bawah (jalan tiap menit), atau saat development jalankan{' '}
            <code className="font-semibold">serve.ps1 -Live</code> / <code className="font-semibold">php artisan schedule:work</code>.
          </div>
        )}
        <div className="px-5 py-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-text-default">Perintah cron (tiap menit)</span>
            <button onClick={copyCron} className="text-xs font-semibold text-primary hover:underline">Salin</button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-page-bg px-3 py-2 text-xs text-text-default">{s.cron_command}</pre>
          <div className="mt-2 text-xs text-text-muted">Direktori kerja: <span className="font-mono">{s.working_directory}</span></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tugas terjadwal" subtitle="Dijalankan oleh scheduler saat cron aktif." />
        {data.tasks.map((t) => (
          <div key={t.command} className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-3 last:border-0">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-default">{t.label}</div>
              <div className="font-mono text-xs text-text-muted">{t.command}</div>
            </div>
            <span className="shrink-0 text-xs text-text-muted">{t.schedule}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
