import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePendingPeriod, useDepreciationPreview, usePostDepreciation } from '@/api/queries';
import { PageHeader, Card, CardHeader, Button, Input, Spinner, EmptyState, LoadingBlock, Badge } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatPeriod } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import type { DepreciationRun } from '@/api/types';

export default function DepreciationPage() {
  const { data: pending, isLoading: pendingLoading } = usePendingPeriod();
  const [period, setPeriod] = useState<string>('');
  const { data: preview, isLoading: previewLoading } = useDepreciationPreview(period || null);
  const post = usePostDepreciation();
  const toast = useToast();
  const [result, setResult] = useState<DepreciationRun | null>(null);

  useEffect(() => {
    if (pending?.period && !period) setPeriod(pending.period);
  }, [pending, period]);

  async function run() {
    if (!period) return;
    try {
      const res = await post.mutateAsync(period);
      setResult(res);
      toast('success', `Depresiasi ${formatPeriod(period)} diposting & dikirim ke Akunta.`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal memposting depresiasi.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Jalankan Depresiasi"
        description="Hitung beban depresiasi bulanan, lalu posting sebagai jurnal ke Akunta."
        actions={
          <Link to="/depresiasi/riwayat">
            <Button variant="secondary">Riwayat run</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Periode depresiasi" subtitle="Satu run per periode. Posting bersifat idempoten." />
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end">
          <div className="w-full sm:w-56">
            <span className="mb-1 block text-xs font-semibold text-text-default">Periode (bulan)</span>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="text-sm text-text-muted">
            {pendingLoading
              ? 'Memeriksa periode…'
              : pending?.period
                ? <>Periode terdekat yang belum didepresiasi: <strong className="text-text-default">{formatPeriod(pending.period)}</strong></>
                : 'Semua aset sudah terdepresiasi sampai bulan berjalan.'}
          </div>
        </div>
      </Card>

      {result && <PostedResult run={result} />}

      <Card>
        <CardHeader
          title={period ? `Pratinjau — ${formatPeriod(period)}` : 'Pratinjau'}
          subtitle="Rincian beban per aset sebelum diposting."
          action={
            <Button onClick={run} disabled={post.isPending || !preview || preview.lines.length === 0}>
              {post.isPending && <Spinner />} Jalankan & Posting ke Akunta
            </Button>
          }
        />
        {previewLoading ? (
          <LoadingBlock label="Menghitung depresiasi…" />
        ) : !preview || preview.lines.length === 0 ? (
          <EmptyState
            title="Tidak ada yang perlu didepresiasi"
            description="Untuk periode ini semua aset sudah terdepresiasi atau sudah habis masa manfaatnya."
            icon="↘"
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Aset</Th>
                  <Th>Kategori</Th>
                  <Th align="right">Nilai Buku Awal</Th>
                  <Th align="right">Beban Depresiasi</Th>
                  <Th align="right">Nilai Buku Akhir</Th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l) => (
                  <Tr key={l.asset_id}>
                    <Td>
                      <div className="font-semibold text-text-strong">{l.asset_name}</div>
                      <div className="font-mono text-xs text-text-muted">{l.asset_code}</div>
                    </Td>
                    <Td>{l.category_name}</Td>
                    <Td align="right" className="font-mono">{formatIDR(l.book_value_before)}</Td>
                    <Td align="right" className="font-mono font-semibold text-primary">{formatIDR(l.amount)}</Td>
                    <Td align="right" className="font-mono">{formatIDR(l.book_value_after)}</Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td className="font-semibold text-text-strong" >Total</Td>
                  <Td />
                  <Td />
                  <Td align="right" className="font-mono text-base font-bold text-text-strong">{formatIDR(preview.total_amount)}</Td>
                  <Td />
                </tr>
              </tfoot>
            </Table>
            <p className="px-5 py-3 text-xs text-text-muted">
              Saat diposting, Asetto membuat jurnal <strong>Dr Beban Depresiasi / Cr Akumulasi Depresiasi</strong> per
              kategori lalu mengirimnya ke Akunta (server-to-server, idempotency key <code className="font-mono">dep:{period}</code>).
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

function PostedResult({ run }: { run: DepreciationRun }) {
  return (
    <Card className="mb-6 border-success/40">
      <CardHeader
        title={<span className="flex items-center gap-2">✓ Run {formatPeriod(run.period)} diposting <Badge tone="success">Terkirim ke Akunta</Badge></span>}
        subtitle={`${run.lines.length} aset · total ${formatIDR(run.total_amount)}`}
        action={
          <Link to="/akunta" className="text-xs font-semibold text-primary hover:underline">
            Lihat jurnal di outbox →
          </Link>
        }
      />
    </Card>
  );
}
