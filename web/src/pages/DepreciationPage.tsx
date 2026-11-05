import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDepreciationReport, useDepreciationReportCategory } from '@/api/queries';
import { PageHeader, Card, CardHeader, Button, Field, Input, LoadingBlock, EmptyState, Spinner } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR } from '@/lib/format';
import type { DepreciationReportCategory } from '@/api/types';

function monthStart(): string {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toLocaleDateString('en-CA');
}
function monthEnd(): string {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).toLocaleDateString('en-CA');
}

export default function DepreciationPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const { data, isLoading, isFetching } = useDepreciationReport(from, to);

  return (
    <div>
      <PageHeader
        title="Laporan Depresiasi"
        description="Beban depresiasi per kategori. Depresiasi dijalankan otomatis oleh cron; pengiriman jurnal ada di Peristiwa Ekonomi."
        actions={
          <Link to="/depresiasi/riwayat">
            <Button variant="secondary">Riwayat run</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Dari tanggal">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Sampai tanggal">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="text-xs text-text-muted sm:pb-2.5">{isFetching ? 'Memuat…' : 'Default: bulan ini'}</div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Beban depresiasi per kategori"
          subtitle="Beban = periode yang dipilih (bukan akumulasi). Klik baris kategori untuk rincian per aset."
          action={
            data ? (
              <div className="text-right text-xs text-text-muted">
                <div>Perolehan: <span className="font-mono text-text-default">{formatIDR(data.total_acquisition_cost)}</span> · Akumulasi: <span className="font-mono text-text-default">{formatIDR(data.total_accumulated)}</span></div>
                <div>Beban periode: <span className="font-mono font-bold text-primary">{formatIDR(data.total_amount)}</span> · Nilai sisa: <span className="font-mono font-bold text-text-strong">{formatIDR(data.total_book_value)}</span></div>
              </div>
            ) : undefined
          }
        />
        {isLoading ? (
          <LoadingBlock label="Menyusun laporan…" />
        ) : !data || data.categories.length === 0 ? (
          <EmptyState
            title="Belum ada depresiasi pada rentang ini"
            description="Pilih rentang tanggal lain, atau tunggu depresiasi berjalan."
            icon="↘"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Kategori</Th>
                <Th align="center">Jumlah Aset</Th>
                <Th align="right">Nilai Perolehan</Th>
                <Th align="right">Akumulasi Depresiasi</Th>
                <Th align="right">Beban (periode)</Th>
                <Th align="right">Nilai Sisa</Th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <CategoryRow key={c.category_id ?? 'none'} category={c} from={data.from} to={data.to} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function CategoryRow({ category, from, to }: { category: DepreciationReportCategory; from: string; to: string }) {
  const [open, setOpen] = useState(false);
  // Lazy: the per-asset detail is only fetched when the row is expanded.
  const { data: assets, isLoading } = useDepreciationReportCategory(category.category_id, from, to, open);

  return (
    <Fragment>
      <Tr className="cursor-pointer">
        <Td>
          <button onClick={() => setOpen((v) => !v)} className="text-left font-semibold text-text-strong hover:text-primary">
            <span className="mr-1 inline-block text-text-muted">{open ? '▾' : '▸'}</span>
            {category.category_name}
            {category.category_code && <span className="ml-2 font-mono text-xs text-text-muted">{category.category_code}</span>}
          </button>
        </Td>
        <Td align="center" className="tabular-nums text-text-muted">{category.asset_count}</Td>
        <Td align="right" className="font-mono">{formatIDR(category.acquisition_cost)}</Td>
        <Td align="right" className="font-mono text-text-muted">{formatIDR(category.accumulated)}</Td>
        <Td align="right" className="font-mono font-semibold text-primary">{formatIDR(category.total_amount)}</Td>
        <Td align="right" className="font-mono font-semibold text-text-strong">{formatIDR(category.book_value)}</Td>
      </Tr>
      {open && (
        <tr>
          <td colSpan={6} className="border-b border-border-soft bg-page-bg/60 px-6 py-3">
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-text-muted"><Spinner /> Memuat rincian…</div>
            ) : !assets || assets.length === 0 ? (
              <div className="py-3 text-sm text-text-muted">Tidak ada rincian.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-text-muted">
                    <th className="py-1 text-left font-semibold">Aset</th>
                    <th className="py-1 text-center font-semibold">Periode</th>
                    <th className="py-1 text-right font-semibold">Nilai Perolehan</th>
                    <th className="py-1 text-right font-semibold">Akumulasi</th>
                    <th className="py-1 text-right font-semibold">Beban</th>
                    <th className="py-1 text-right font-semibold">Nilai Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.asset_id} className="border-t border-border-soft/60">
                      <td className="py-1.5">
                        <Link to={`/aset/${a.asset_id}`} className="font-medium text-text-default hover:text-primary hover:underline">
                          {a.asset_name}
                        </Link>
                        <span className="ml-2 font-mono text-xs text-text-muted">{a.asset_code}</span>
                      </td>
                      <td className="py-1.5 text-center tabular-nums text-text-muted">{a.periods}</td>
                      <td className="py-1.5 text-right font-mono">{formatIDR(a.acquisition_cost)}</td>
                      <td className="py-1.5 text-right font-mono text-text-muted">{formatIDR(a.accumulated)}</td>
                      <td className="py-1.5 text-right font-mono text-primary">{formatIDR(a.total_amount)}</td>
                      <td className="py-1.5 text-right font-mono text-text-strong">{formatIDR(a.book_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
