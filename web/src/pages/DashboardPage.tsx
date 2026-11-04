import { Link } from 'react-router-dom';
import { useDashboard } from '@/api/queries';
import { PageHeader, StatCard, Card, CardHeader, Button, LoadingBlock } from '@/components/ui/primitives';
import { JournalStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatPeriod } from '@/lib/format';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) return <LoadingBlock />;

  const maxCat = Math.max(1, ...data.book_value_by_category.map((c) => c.book_value));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Ringkasan portofolio aset dan status integrasi ke Akunta."
        actions={
          data.pending_depreciation_period ? (
            <Link to="/depresiasi">
              <Button>Jalankan depresiasi {formatPeriod(data.pending_depreciation_period)}</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Aset" value={data.asset_count} hint={`${data.active_count} aktif`} icon="▣" />
        <StatCard
          label="Nilai Perolehan"
          value={formatIDR(data.total_acquisition_cost)}
          tone="info"
          icon="₋"
        />
        <StatCard
          label="Nilai Buku"
          value={formatIDR(data.total_book_value)}
          hint={`Akum. depresiasi ${formatIDR(data.total_accumulated_depreciation)}`}
          tone="success"
          icon="∑"
        />
        <StatCard
          label="Jurnal Antre ke Akunta"
          value={data.akunta_queued}
          hint={data.akunta_queued > 0 ? 'Perlu ditinjau' : 'Semua terkirim'}
          tone={data.akunta_queued > 0 ? 'warning' : 'success'}
          icon="⤤"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Nilai buku per kategori" subtitle="Komposisi aset aktif berdasarkan nilai buku." />
          <div className="flex flex-col gap-4 px-5 py-5">
            {data.book_value_by_category.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-text-default">{c.category}</span>
                  <span className="font-semibold text-text-strong">{formatIDR(c.book_value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border-soft">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(c.book_value / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Kondisi aset" subtitle="Aset aktif." />
          <div className="flex flex-col gap-3 px-5 py-5">
            <ConditionRow label="Baik" value={data.condition_breakdown.good} tone="bg-success" />
            <ConditionRow label="Perlu perbaikan" value={data.condition_breakdown.needs_repair} tone="bg-warning" />
            <ConditionRow label="Rusak" value={data.condition_breakdown.broken} tone="bg-danger" />
            <ConditionRow label="Tidak terpakai" value={data.condition_breakdown.idle} tone="bg-text-muted" />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Jurnal terbaru ke Akunta"
          subtitle="Hasil posting sub-ledger aset ke general ledger."
          action={
            <Link to="/akunta" className="text-xs font-semibold text-primary hover:underline">
              Lihat semua →
            </Link>
          }
        />
        {data.recent_journals.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">Belum ada jurnal terkirim.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Memo</Th>
                <Th>Sumber</Th>
                <Th align="right">Nilai</Th>
                <Th align="center">Status</Th>
                <Th>No. Jurnal Akunta</Th>
              </tr>
            </thead>
            <tbody>
              {data.recent_journals.map((j) => {
                const total = j.lines.reduce((s, l) => s + l.debit, 0);
                return (
                  <Tr key={j.id}>
                    <Td>{j.memo}</Td>
                    <Td className="capitalize">{j.source === 'depreciation' ? 'Depresiasi' : 'Pelepasan'}</Td>
                    <Td align="right" className="font-mono">{formatIDR(total)}</Td>
                    <Td align="center"><JournalStatusBadge status={j.status} /></Td>
                    <Td className="font-mono text-xs text-text-muted">{j.akunta_journal_no ?? '—'}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ConditionRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-text-default">
        <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
        {label}
      </span>
      <span className="font-semibold text-text-strong">{value}</span>
    </div>
  );
}
