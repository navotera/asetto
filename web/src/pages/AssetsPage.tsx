import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAssets, useCategories, useCustodians, useCan } from '@/api/queries';
import { PageHeader, Button, Card, Input, Select, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { ConditionBadge, AssetStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatDate } from '@/lib/format';
import { AssetFormModal } from './AssetFormModal';
import type { Asset, AssetCondition } from '@/api/types';

const CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: 'good', label: 'Baik' },
  { value: 'needs_repair', label: 'Perlu Perbaikan' },
  { value: 'broken', label: 'Rusak' },
  { value: 'idle', label: 'Tidak Terpakai' },
];

type SortKey = 'code' | 'name' | 'category' | 'custodian' | 'acquisition_cost' | 'book_value' | 'condition' | 'status';

export default function AssetsPage() {
  const { data: assets, isLoading } = useAssets();
  const { data: categories } = useCategories();
  const { data: custodians } = useCustodians();
  const { can } = useCan();
  const showValues = can('asset.view_value');
  const canManage = can('asset.manage');

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [custodianFilter, setCustodianFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const c = searchParams.get('category');
    if (c) setCategoryFilter(c);
  }, [searchParams]);

  const custodianName = (id: string | null) => custodians?.find((c) => c.id === id)?.name ?? '—';
  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? '—';

  const hasFilter = !!(search || categoryFilter || statusFilter || conditionFilter || custodianFilter);
  function resetFilters() {
    setSearch(''); setCategoryFilter(''); setStatusFilter(''); setConditionFilter(''); setCustodianFilter('');
  }

  const accessors: Record<SortKey, (a: Asset) => string | number> = {
    code: (a) => a.code,
    name: (a) => a.name.toLowerCase(),
    category: (a) => categoryName(a.category_id).toLowerCase(),
    custodian: (a) => custodianName(a.custodian_id).toLowerCase(),
    acquisition_cost: (a) => a.acquisition_cost ?? 0,
    book_value: (a) => a.book_value ?? 0,
    condition: (a) => a.condition,
    status: (a) => a.status,
  };

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  const rows = useMemo(() => {
    const filtered = (assets ?? []).filter((a) => {
      if (categoryFilter && a.category_id !== categoryFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (conditionFilter && a.condition !== conditionFilter) return false;
      if (custodianFilter && (a.custodian_id ?? '') !== custodianFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
      }
      return true;
    });
    const acc = accessors[sortKey];
    return filtered.sort((x, y) => {
      const av = acc(x), bv = acc(y);
      const r = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? r : -r;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, search, categoryFilter, statusFilter, conditionFilter, custodianFilter, sortKey, sortDir, categories, custodians]);

  function SortTh({ label, k, align }: { label: string; k: SortKey; align?: 'right' | 'center' }) {
    const active = sortKey === k;
    return (
      <Th align={align}>
        <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-text-strong">
          {label}
          <span className="text-[9px] text-text-muted">{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </Th>
    );
  }

  return (
    <div>
      <PageHeader
        title="Daftar Aset"
        description="Klik nama aset untuk melihat detail, mengubah, atau menghapus."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="relative flex h-9 items-center gap-2 rounded-lg border border-border-default px-3 text-sm font-semibold text-text-default hover:bg-primary-light"
              title="Filter"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter
              {hasFilter && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-danger" />}
            </button>
            {canManage && <Button onClick={() => setModalOpen(true)}>+ Tambah Aset</Button>}
          </div>
        }
      />

      {filterOpen && (
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input placeholder="Cari nama atau kode…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Semua kategori</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={custodianFilter} onChange={(e) => setCustodianFilter(e.target.value)}>
              <option value="">Semua penanggung jawab</option>
              {custodians?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
              <option value="">Semua kondisi</option>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="disposed">Dilepas</option>
            </Select>
            {hasFilter && <Button variant="secondary" onClick={resetFilters}>Reset filter</Button>}
          </div>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada aset" description="Ubah filter atau tambah aset baru." icon="▣" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th align="center">No</Th>
                <SortTh label="Kode / Nama" k="name" />
                <SortTh label="Kategori" k="category" />
                <SortTh label="Penanggung Jawab" k="custodian" />
                {showValues && <SortTh label="Nilai Perolehan" k="acquisition_cost" align="right" />}
                {showValues && <SortTh label="Nilai Buku" k="book_value" align="right" />}
                <SortTh label="Kondisi" k="condition" align="center" />
                <SortTh label="Status" k="status" align="center" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <Tr key={a.id}>
                  <Td align="center" className="text-text-muted tabular-nums">{i + 1}</Td>
                  <Td>
                    <Link to={`/aset/${a.id}`} className="font-semibold text-text-strong hover:text-primary hover:underline">
                      {a.name}
                    </Link>
                    <div className="font-mono text-xs text-text-muted">{a.code} · {formatDate(a.acquisition_date)}</div>
                  </Td>
                  <Td>
                    <button
                      onClick={() => setCategoryFilter(a.category_id)}
                      className="text-left hover:text-primary hover:underline"
                      title="Filter kategori ini"
                    >
                      {categoryName(a.category_id)}
                    </button>
                  </Td>
                  <Td>
                    {a.custodian_id ? (
                      <button
                        onClick={() => setCustodianFilter(a.custodian_id as string)}
                        className="text-left hover:text-primary hover:underline"
                        title="Filter penanggung jawab ini"
                      >
                        {custodianName(a.custodian_id)}
                      </button>
                    ) : (
                      <span>{custodianName(a.custodian_id)}</span>
                    )}
                    <div className="text-xs text-text-muted">{a.location}</div>
                  </Td>
                  {showValues && <Td align="right" className="font-mono">{formatIDR(a.acquisition_cost)}</Td>}
                  {showValues && <Td align="right" className="font-mono font-semibold text-text-strong">{formatIDR(a.book_value)}</Td>}
                  <Td align="center">
                    <button onClick={() => setConditionFilter(a.condition)} title="Filter kondisi ini">
                      <ConditionBadge condition={a.condition} />
                    </button>
                  </Td>
                  <Td align="center">
                    <button onClick={() => setStatusFilter(a.status)} title="Filter status ini">
                      <AssetStatusBadge status={a.status} />
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <AssetFormModal open={modalOpen} onClose={() => setModalOpen(false)} asset={null} />
    </div>
  );
}
