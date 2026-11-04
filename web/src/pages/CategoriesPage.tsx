import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories, useDeleteCategory, useCan } from '@/api/queries';
import { PageHeader, Card, LoadingBlock, Badge, Button } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { KebabMenu } from '@/components/ui/KebabMenu';
import { useToast } from '@/components/ui/toast';
import { CategoryFormModal } from './CategoryFormModal';
import type { AssetCategory } from '@/api/types';

const methodLabel: Record<string, string> = {
  straight_line: 'Garis Lurus',
  declining_balance: 'Saldo Menurun',
  none: 'Tanpa Depresiasi',
};

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const del = useDeleteCategory();
  const toast = useToast();
  const { can } = useCan();
  const canManage = can('asset.manage');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssetCategory | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(c: AssetCategory) {
    setEditing(c);
    setModalOpen(true);
  }
  async function remove(c: AssetCategory) {
    if (!confirm(`Hapus kategori ${c.code}?`)) return;
    try {
      await del.mutateAsync(c.id);
      toast('success', 'Kategori dihapus.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menghapus kategori.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Kategori Aset"
        description="Tiap kategori menentukan metode default dan pemetaan akun GL di Akunta."
        actions={canManage ? <Button onClick={openCreate}>+ Tambah Kategori</Button> : undefined}
      />
      <Card>
        {isLoading || !categories ? (
          <LoadingBlock />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Kode</Th>
                <Th>Kategori</Th>
                <Th>Metode Default</Th>
                <Th align="center">Masa Manfaat</Th>
                <Th align="center">Jumlah Aset</Th>
                {canManage && <Th align="right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-mono">{c.code}</Td>
                  <Td>
                    <Link
                      to={`/aset?category=${c.id}`}
                      className="font-semibold text-text-strong hover:text-primary hover:underline"
                      title="Lihat aset kategori ini"
                    >
                      {c.name}
                    </Link>
                  </Td>
                  <Td><Badge tone="info">{methodLabel[c.default_method]}</Badge></Td>
                  <Td align="center">{c.default_useful_life_months} bln</Td>
                  <Td align="center">
                    <Link to={`/aset?category=${c.id}`} className="font-semibold text-text-strong tabular-nums hover:text-primary hover:underline">
                      {c.asset_count ?? 0}
                    </Link>
                  </Td>
                  {canManage && (
                    <Td align="right">
                      <KebabMenu
                        items={[
                          { label: 'Ubah', onClick: () => openEdit(c) },
                          { label: 'Hapus', onClick: () => remove(c), danger: true },
                        ]}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-text-muted">
        Tiap kategori memetakan akun GL di <strong>Akunta</strong> (aset, akum. depresiasi, beban depresiasi) —
        diatur lewat form Tambah/Ubah. Asetto tidak menyimpan ledger sendiri; akun ini dipakai saat posting jurnal.
      </p>

      <CategoryFormModal open={modalOpen} onClose={() => setModalOpen(false)} category={editing} />
    </div>
  );
}
