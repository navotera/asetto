import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAssetsPaged,
  fetchAssetsFiltered,
  useCategories,
  useCustodians,
  useEntities,
  useRestoreAsset,
  useCan,
  type AssetListParams,
} from '@/api/queries';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import { PageHeader, Card, Input, Select, Field, LoadingBlock, EmptyState, Button } from '@/components/ui/primitives';
import { ConditionBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { KebabMenu, type KebabItem } from '@/components/ui/KebabMenu';
import { useToast } from '@/components/ui/toast';
import { formatIDR, formatDate, formatAge } from '@/lib/format';
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

type TabKey = 'active' | 'inactive' | 'trashed';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'Aktif' },
  { key: 'inactive', label: 'Tidak Aktif' },
  { key: 'trashed', label: 'Trashed' },
];

const PER_PAGE = 25;

type SortKey = 'code' | 'name' | 'category' | 'acquisition_date' | 'book_value' | 'condition';

export default function AssetsPage() {
  const { data: categories } = useCategories();
  const { data: custodians } = useCustodians();
  const { data: entities } = useEntities();
  const { can } = useCan();
  const { activeEntityId } = useActiveEntity();
  const navigate = useNavigate();
  const toast = useToast();
  const restore = useRestoreAsset();
  const showValues = can('asset.view_value');
  const canManage = can('asset.manage');

  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('active');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [conditionFilter, setConditionFilter] = useState('');
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

  // Any filter/sort/search/tab change returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, tab, categoryFilter, conditionFilter, activeEntityId, sortKey, sortDir]);

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
    tab,
    condition: conditionFilter || undefined,
    entity_id: activeEntityId || undefined,
    sort: sortKey,
    dir: sortDir,
  };

  const { data, isLoading, isFetching } = useAssetsPaged({ ...filterParams, page, per_page: PER_PAGE });
  const rows = data?.items ?? [];
  const counts = data?.counts ?? { active: 0, inactive: 0, trashed: 0 };

  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? '—';

  const hasFilter = !!(searchInput || categoryFilter || conditionFilter);
  function resetFilters() {
    setSearchInput(''); setSearch(''); setCategoryFilter(''); setConditionFilter('');
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

  async function handleRestore(id: string, name: string) {
    try {
      await restore.mutateAsync(id);
      toast('success', `"${name}" dipulihkan.`);
    } catch {
      toast('error', 'Gagal memulihkan aset.');
    }
  }

  const actionItems: KebabItem[] = [
    ...(canManage ? [{ label: '+ Tambah Aset', onClick: () => navigate('/aset/baru') }] : []),
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
  const isTrashed = tab === 'trashed';

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
                    <Field label="Kondisi">
                      <Select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
                        <option value="">Semua kondisi</option>
                        {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </Select>
                    </Field>
                  </div>
                </div>
              )}
            </div>
            <KebabMenu items={actionItems} />
          </div>
        }
      />

      <Card>
        {/* Tabs: Aktif / Tidak Aktif / Trashed, each with a thin grey count badge. */}
        <div className="flex items-center gap-1 border-b border-border-soft px-3 pt-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  'relative -mb-px flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors ' +
                  (active
                    ? 'border-b-2 border-primary text-text-strong'
                    : 'border-b-2 border-transparent text-text-muted hover:text-text-default')
                }
              >
                {t.label}
                <span className="rounded-full bg-border-soft px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState
            title={isTrashed ? 'Sampah kosong' : 'Tidak ada aset'}
            description={isTrashed ? 'Aset yang dihapus akan muncul di sini.' : 'Ubah filter atau tambah aset baru.'}
            icon={isTrashed ? '🗑' : '▣'}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th align="center">No</Th>
                  <SortTh label="Kode / Nama" k="name" />
                  <SortTh label="Kategori" k="category" />
                  <SortTh label="Tanggal Perolehan" k="acquisition_date" />
                  <Th>Umur Aset</Th>
                  {showValues && <SortTh label="Nilai Buku" k="book_value" align="right" />}
                  <SortTh label="Kondisi" k="condition" align="center" />
                  {isTrashed && <Th align="center">Aksi</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <Tr key={a.id}>
                    <Td align="center" className="text-text-muted tabular-nums">{firstRow + i}</Td>
                    <Td>
                      {isTrashed ? (
                        <span className="font-semibold text-text-strong">{a.name}</span>
                      ) : (
                        <Link to={`/aset/${a.id}`} className="font-semibold text-text-strong hover:text-primary hover:underline">
                          {a.name}
                        </Link>
                      )}
                      <div className="font-mono text-xs text-text-muted">{a.code}</div>
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
                    <Td>{formatDate(a.acquisition_date)}</Td>
                    <Td className="text-text-muted">{formatAge(a.acquisition_date)}</Td>
                    {showValues && <Td align="right" className="font-mono font-semibold text-text-strong">{formatIDR(a.book_value)}</Td>}
                    <Td align="center">
                      <button onClick={() => setConditionFilter(a.condition)} title="Filter kondisi ini">
                        <ConditionBadge condition={a.condition} />
                      </button>
                    </Td>
                    {isTrashed && (
                      <Td align="center">
                        {canManage && (
                          <Button
                            variant="secondary"
                            className="px-2.5 py-1 text-xs"
                            disabled={restore.isPending}
                            onClick={() => handleRestore(a.id, a.name)}
                          >
                            Pulihkan
                          </Button>
                        )}
                      </Td>
                    )}
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

      {importOpen && (
        <Suspense fallback={null}>
          <ImportAssetsModal open={importOpen} onClose={() => setImportOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
