import { useAssets, useSetCondition } from '@/api/queries';
import { PageHeader, Card, LoadingBlock, Select } from '@/components/ui/primitives';
import { ConditionBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import type { AssetCondition } from '@/api/types';

const options: { value: AssetCondition; label: string }[] = [
  { value: 'good', label: 'Baik' },
  { value: 'needs_repair', label: 'Perlu Perbaikan' },
  { value: 'broken', label: 'Rusak' },
  { value: 'idle', label: 'Tidak Terpakai' },
];

export default function ConditionPage() {
  const { data: assets, isLoading } = useAssets();
  const setCondition = useSetCondition();
  const toast = useToast();

  const active = (assets ?? []).filter((a) => a.status === 'active');

  async function change(id: string, condition: AssetCondition) {
    try {
      await setCondition.mutateAsync({ id, condition });
      toast('success', 'Kondisi aset diperbarui.');
    } catch {
      toast('error', 'Gagal memperbarui kondisi.');
    }
  }

  return (
    <div>
      <PageHeader title="Kondisi Aset" description="Pantau dan perbarui kondisi fisik aset aktif." />
      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Aset</Th>
                <Th>Lokasi</Th>
                <Th align="center">Kondisi Saat Ini</Th>
                <Th align="right">Ubah Kondisi</Th>
              </tr>
            </thead>
            <tbody>
              {active.map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <div className="font-semibold text-text-strong">{a.name}</div>
                    <div className="font-mono text-xs text-text-muted">{a.code}</div>
                  </Td>
                  <Td>{a.location}</Td>
                  <Td align="center"><ConditionBadge condition={a.condition} /></Td>
                  <Td align="right">
                    <Select
                      value={a.condition}
                      onChange={(e) => change(a.id, e.target.value as AssetCondition)}
                      className="ml-auto w-48"
                    >
                      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
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
