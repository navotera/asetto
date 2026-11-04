import { useAssetDepreciation } from '@/api/queries';
import { Card, CardHeader, Badge, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatPeriod } from '@/lib/format';
import type { Asset } from '@/api/types';

export function DepreciationPanel({ asset }: { asset: Asset }) {
  const { data: entries, isLoading } = useAssetDepreciation(asset.id);

  return (
    <Card>
      <CardHeader
        title="Riwayat Depresiasi"
        subtitle="Beban depresiasi per periode yang dijalankan terjadwal untuk aset ini."
      />
      {isLoading ? (
        <LoadingBlock />
      ) : !entries || entries.length === 0 ? (
        <EmptyState title="Belum ada depresiasi" description="Depresiasi terjadwal akan muncul di sini setiap periode." icon="↘" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Periode</Th>
              <Th align="right">Beban</Th>
              <Th align="right">Nilai Buku Sebelum</Th>
              <Th align="right">Nilai Buku Sesudah</Th>
              <Th align="center">Status</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <Tr key={`${e.period}-${i}`}>
                <Td className="font-medium text-text-strong">{e.period ? formatPeriod(e.period) : '—'}</Td>
                <Td align="right" className="font-mono">{formatIDR(e.amount)}</Td>
                <Td align="right" className="font-mono text-text-muted">{formatIDR(e.book_value_before)}</Td>
                <Td align="right" className="font-mono">{formatIDR(e.book_value_after)}</Td>
                <Td align="center">
                  {e.status === 'posted' ? <Badge tone="success">Diposting</Badge> : <Badge tone="warning">Draft</Badge>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
