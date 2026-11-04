import { Link } from 'react-router-dom';
import { useDepreciationRuns } from '@/api/queries';
import { PageHeader, Card, LoadingBlock, EmptyState, Badge } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatPeriod, formatDate } from '@/lib/format';

export default function DepreciationHistoryPage() {
  const { data: runs, isLoading } = useDepreciationRuns();

  return (
    <div>
      <PageHeader title="Riwayat Run Depresiasi" description="Setiap run bulanan dan jurnal yang dihasilkannya." />
      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : !runs || runs.length === 0 ? (
          <EmptyState
            title="Belum ada run"
            description="Jalankan depresiasi bulanan dari menu Jalankan Depresiasi."
            icon="↻"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Periode</Th>
                <Th align="center">Jumlah Aset</Th>
                <Th align="right">Total Beban</Th>
                <Th>Diposting</Th>
                <Th align="center">Status</Th>
                <Th align="right">Jurnal</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-semibold text-text-strong">{formatPeriod(r.period)}</Td>
                  <Td align="center">{r.lines.length}</Td>
                  <Td align="right" className="font-mono">{formatIDR(r.total_amount)}</Td>
                  <Td>{formatDate(r.posted_at?.slice(0, 10))}</Td>
                  <Td align="center"><Badge tone="success">Posted</Badge></Td>
                  <Td align="right">
                    <Link to="/akunta" className="text-xs font-semibold text-primary hover:underline">
                      Lihat →
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
