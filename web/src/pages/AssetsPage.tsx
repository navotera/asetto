import { useMemo, useState } from 'react';
import { useAssets, useCategories, useCustodians, useDeleteAsset } from '@/api/queries';
import { PageHeader, Button, Card, Input, Select, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { ConditionBadge, AssetStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { AssetFormModal } from './AssetFormModal';
import type { Asset } from '@/api/types';

export default function AssetsPage() {
  const { data: assets, isLoading } = useAssets();
  const { data: categories } = useCategories();
  const { data: custodians } = useCustodians();
  const del = useDeleteAsset();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Asset | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const custodianName = (id: string | null) => custodians?.find((c) => c.id === id)?.name ?? '—';
  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    return (assets ?? []).filter((a) => {
      if (categoryFilter && a.category_id !== categoryFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [assets, search, categoryFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(a: Asset) {
    setEditing(a);
    setModalOpen(true);
  }
  async function remove(a: Asset) {
    if (!confirm(`Hapus aset ${a.code}?`)) return;
    try {
      await del.mutateAsync(a.id);
      toast('success', 'Aset dihapus.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Daftar Aset"
        description="Kelola seluruh aset perusahaan beserta data depresiasinya."
        actions={<Button onClick={openCreate}>+ Tambah Aset</Button>}
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input placeholder="Cari nama atau kode…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Semua kategori</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="disposed">Dilepas</option>
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : filtered.length === 0 ? (
          <EmptyState title="Tidak ada aset" description="Ubah filter atau tambah aset baru." icon="▣" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Kode / Nama</Th>
                <Th>Kategori</Th>
                <Th>Penanggung Jawab</Th>
                <Th align="right">Nilai Perolehan</Th>
                <Th align="right">Nilai Buku</Th>
                <Th align="center">Kondisi</Th>
                <Th align="center">Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <div className="font-semibold text-text-strong">{a.name}</div>
                    <div className="font-mono text-xs text-text-muted">{a.code} · {formatDate(a.acquisition_date)}</div>
                  </Td>
                  <Td>{categoryName(a.category_id)}</Td>
                  <Td>
                    <div>{custodianName(a.custodian_id)}</div>
                    <div className="text-xs text-text-muted">{a.location}</div>
                  </Td>
                  <Td align="right" className="font-mono">{formatIDR(a.acquisition_cost)}</Td>
                  <Td align="right" className="font-mono font-semibold text-text-strong">{formatIDR(a.book_value)}</Td>
                  <Td align="center"><ConditionBadge condition={a.condition} /></Td>
                  <Td align="center"><AssetStatusBadge status={a.status} /></Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="px-2 py-1" onClick={() => openEdit(a)}>Ubah</Button>
                      {a.status === 'active' && (
                        <Button variant="ghost" className="px-2 py-1 text-danger" onClick={() => remove(a)}>Hapus</Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <AssetFormModal open={modalOpen} onClose={() => setModalOpen(false)} asset={editing} />
    </div>
  );
}
