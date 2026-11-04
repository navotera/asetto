import { Link } from 'react-router-dom';
import { useDashboard } from '@/api/queries';
import { PageHeader, StatCard, Card, CardHeader, Button, LoadingBlock } from '@/components/ui/primitives';
import { JournalStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { DonutChart, CHART_PALETTE } from '@/components/ui/DonutChart';
import { formatIDR, formatPeriod } from '@/lib/format';

/** Compact Rupiah for the donut centre, e.g. "Rp 1,2 M". */
function shortIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(0)} jt`;
  return formatIDR(value);
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) return <LoadingBlock />;

  const categorySegments = data.book_value_by_category.map((c, i) => ({
    label: c.category,
    value: c.book_value,
    color: CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  const conditionSegments = [
    { label: 'Baik', value: data.condition_breakdown.good, color: 'var(--a-success)' },
    { label: 'Perlu perbaikan', value: data.condition_breakdown.needs_repair, color: 'var(--a-warning)' },
    { label: 'Rusak', value: data.condition_breakdown.broken, color: 'var(--a-danger)' },
    { label: 'Tidak terpakai', value: data.condition_breakdown.idle, color: 'var(--a-text-muted)' },
  ];

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
          <DonutChart
            segments={categorySegments}
            formatValue={formatIDR}
            centerValue={shortIDR(data.total_book_value)}
            centerLabel="Nilai Buku"
            emptyLabel="Belum ada aset aktif."
          />
        </Card>

        <Card>
          <CardHeader title="Kondisi aset" subtitle="Aset aktif." />
          <DonutChart
            segments={conditionSegments}
            centerValue={String(data.active_count)}
            centerLabel="Aset Aktif"
            emptyLabel="Belum ada aset aktif."
          />
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
                <Th>Raw ID Akunta</Th>
              </tr>
            </thead>
            <tbody>
              {data.recent_journals.map((j) => {
                const p = (j.payload ?? {}) as Record<string, unknown>;
                const total = typeof p.amount === 'number' ? p.amount : typeof p.cost === 'number' ? p.cost : 0;
                const sourceLabel =
                  j.source === 'depreciation' ? 'Depresiasi' : j.source === 'acquisition' ? 'Perolehan' : 'Pelepasan';
                return (
                  <Tr key={j.id}>
                    <Td>{j.memo}</Td>
                    <Td>{sourceLabel}</Td>
                    <Td align="right" className="font-mono">{formatIDR(total)}</Td>
                    <Td align="center"><JournalStatusBadge status={j.status} /></Td>
                    <Td className="font-mono text-xs text-text-muted">{j.akunta_raw_id ?? '—'}</Td>
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
