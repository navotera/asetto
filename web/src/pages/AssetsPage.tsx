import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useAssetsPaged,
  fetchAssetsFiltered,
  useCategories,
  useCustodians,
  useEntities,
  useCan,
  type AssetListParams,
} from '@/api/queries';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import { PageHeader, Card, Input, Select, Field, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { ConditionBadge, AssetStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { KebabMenu, type KebabItem } from '@/components/ui/KebabMenu';
import { useToast } from '@/components/ui/toast';
import { formatIDR, formatDate } from '@/lib/format';
import { AssetFormModal } from './AssetFormModal';
import type { AssetCondition } from '@/api/types';

// xlsx is heavy (~400 kB) and only needed when exporting/importing — load it on demand.
const ImportAssetsModal = lazy(() =>
  import('./ImportAssetsModal').then((m) => ({ default: m.ImportAssetsModal })),
);

const CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: 'good', label: 'Baik' },
  { value: 'needs_repair', label: 'Perlu Perbaikan' },
  { value: 'broken', label: 'Rusak' },
  { value: 'idle', label: 'Tidak Terpakai' },
];

// Only two real choices → radio group instead of a dropdown.
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'disposed', label: 'Dilepas' },
];

const PER_PAGE = 25;

type SortKey = 'code' | 'name' | 'category' | 'custodian' | 'acquisition_cost' | 'book_value' | 'condition' | 'status';

export default function AssetsPage() {
  const { data: categories } = useCategories();
  const { data: custodians } = useCustodians();
  const { data: entities } = useEntities();
  const { can } = useCan();
  const { activeEntityId } = useActiveEntity();
  const toast = useToast();
  const showValues = can('asset.view_value');
  const canManage = can('asset.manage');

  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [custodianFilter, setCustodianFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = searchParams.get('category');
    if (c) setCategoryFilter(c);
  }, [searchParams]);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter/sort/search change returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, conditionFilter, custodianFilter, activeEntityId, sortKey, sortDir]);

  // Close the filter popover on outside click or Escape.
  useEffect(() => {
    if (!filterOpen) return;
    function onDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFilterOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  const filterParams: AssetListParams = {
    search: search || undefined,
    category_id: categoryFilter || undefined,
    status: statusFilter || undefined,
    condition: conditionFilter || undefined,
    custodian_id: custodianFilter || undefined,
    entity_id: activeEntityId || undefined,
    sort: sortKey,
    dir: sortDir,
  };

  const { data, isLoading, isFetching } = useAssetsPaged({ ...filterParams, page, per_page: PER_PAGE });
  const rows = data?.items ?? [];

  const custodianName = (id: string | null) => custodians?.find((c) => c.id === id)?.name ?? '—';
  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? '—';

  const hasFilter = !!(searchInput || categoryFilter || statusFilter || conditionFilter || custodianFilter);
  function resetFilters() {
    setSearchInput(''); setSearch(''); setCategoryFilter(''); setStatusFilter(''); setConditionFilter(''); setCustodianFilter('');
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  async function handleExport() {
    try {
      const all = await fetchAssetsFiltered(filterParams);
      if (all.length === 0) {
        toast('error', 'Tidak ada aset untuk diekspor.');
        return;
      }
      const { exportAssetsXlsx } = await import('@/lib/assetSheet');
      exportAssetsXlsx(all, { categories: categories ?? [], custodians: custodians ?? [], entities: entities ?? [] });
      toast('success', `${all.length} aset diekspor.`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal mengekspor aset.');
    }
  }

  const actionItems: KebabItem[] = [
    ...(canManage ? [{ label: '+ Tambah Aset', onClick: () => setModalOpen(true) }] : []),
    { label: 'Ekspor', onClick: handleExport },
    ...(canManage ? [{ label: 'Impor', onClick: () => setImportOpen(true) }] : []),
  ];

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

  const total = data?.total ?? 0;
  const lastPage = data?.last_page ?? 1;
  const firstRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const lastRow = Math.min(page * PER_PAGE, total);
  const pageBtn = 'flex h-8 items-center rounded-lg border border-border-default px-3 text-sm font-semibold text-text-default hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div>
      <PageHeader
        title="Daftar Aset"
        description="Klik nama aset untuk melihat detail, mengubah, atau menghapus."
        actions={
          <div className="flex items-center gap-2">
            <div className="w-40 sm:w-56">
              <Input
                aria-label="Cari aset"
                placeholder="Cari nama atau kode…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="relative flex h-9 items-center gap-2 rounded-lg border border-border-default px-3 text-sm font-semibold text-text-default hover:bg-primary-light"
                aria-expanded={filterOpen}
                aria-label={hasFilter ? 'Filter (sedang aktif)' : 'Filter'}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filter
                {hasFilter && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-danger" />}
              </button>

              {filterOpen && (
                <div className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-card border border-border-soft bg-card-bg p-4 shadow-pop">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-strong">Filter Aset</span>
                    {hasFilter && (
                      <button onClick={resetFilters} className="text-xs font-semibold text-primary hover:underline">
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <Field label="Kategori">
                      <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">Semua kategori</option>
                        {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Penanggung Jawab">
                      <Select value={custodianFilter} onChange={(e) => setCustodianFilter(e.target.value)}>
                        <option value="">Semua penanggung jawab</option>
                        {custodians?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Kondisi">
                      <Select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
                        <option value="">Semua kondisi</option>
                        {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </Select>
                    </Field>
                    <div>
                      <span className="mb-1 block text-xs font-semibold text-text-default">Status</span>
                      <div className="flex flex-col gap-1.5">
                        {STATUS_OPTIONS.map((o) => (
                          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-text-default">
                            <input
                              type="radio"
                              name="status-filter"
                              className="accent-primary"
                              checked={statusFilter === o.value}
                              onChange={() => setStatusFilter(o.value)}
                            />
                            {o.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <KebabMenu items={actionItems} />
          </div>
        }
      />

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada aset" description="Ubah filter atau tambah aset baru." icon="▣" />
        ) : (
          <>
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
                    <Td align="center" className="text-text-muted tabular-nums">{firstRow + i}</Td>
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

            <div className="flex flex-col items-center justify-between gap-3 border-t border-border-soft px-5 py-3 text-sm sm:flex-row">
              <span className="text-text-muted">
                Menampilkan <span className="font-semibold text-text-default">{firstRow}–{lastRow}</span> dari{' '}
                <span className="font-semibold text-text-default">{total}</span> aset
                {isFetching && <span className="ml-2 text-xs text-text-muted">memuat…</span>}
              </span>
              <div className="flex items-center gap-2">
                <button className={pageBtn} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ‹ Sebelumnya
                </button>
                <span className="px-1 text-text-muted">Hal {page} / {lastPage}</span>
                <button className={pageBtn} disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>
                  Berikutnya ›
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <AssetFormModal open={modalOpen} onClose={() => setModalOpen(false)} asset={null} />
      {importOpen && (
        <Suspense fallback={null}>
          <ImportAssetsModal open={importOpen} onClose={() => setImportOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
