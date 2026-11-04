import { useMyAssets } from '@/api/queries';
import { PageHeader, Card, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { ConditionBadge, AssetStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatDate } from '@/lib/format';

export default function MyAssetsPage() {
  const { data: assets, isLoading } = useMyAssets();

  return (
    <div>
      <PageHeader
        title="Aset Saya"
        description="Aset yang menjadi tanggung jawab Anda. Nilai aset tidak ditampilkan."
      />
      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : !assets || assets.length === 0 ? (
          <EmptyState
            title="Belum ada aset"
            description="Belum ada aset yang dilimpahkan kepada Anda."
            icon="◱"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th align="center">No</Th>
                <Th>Kode / Nama</Th>
                <Th>Kategori</Th>
                <Th>Lokasi</Th>
                <Th align="center">Kondisi</Th>
                <Th align="center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <Tr key={a.id}>
                  <Td align="center" className="text-text-muted tabular-nums">{i + 1}</Td>
                  <Td>
                    <div className="font-semibold text-text-strong">{a.name}</div>
                    <div className="font-mono text-xs text-text-muted">{a.code} · {formatDate(a.acquisition_date)}</div>
                  </Td>
                  <Td>{a.category_name ?? '—'}</Td>
                  <Td>{a.location || '—'}</Td>
                  <Td align="center"><ConditionBadge condition={a.condition} /></Td>
                  <Td align="center"><AssetStatusBadge status={a.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
