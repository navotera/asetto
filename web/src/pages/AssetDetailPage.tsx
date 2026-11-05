import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useAsset,
  useAssetPhotos,
  useCategories,
  useCustodians,
  useDeleteAsset,
  useSetCondition,
  useCreateDisposal,
  useCan,
} from '@/api/queries';
import { PageHeader, Button, Card, CardHeader, LoadingBlock, EmptyState, Field, Input, NumberInput, Select, Spinner } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { KebabMenu } from '@/components/ui/KebabMenu';
import { ConditionBadge, AssetStatusBadge } from '@/components/ui/badges';
import { cn } from '@/lib/cn';
import { formatIDR, formatDate, formatPeriod } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { AssetFormModal } from './AssetFormModal';
import { CustodyPanel } from './asset-detail/CustodyPanel';
import { PhotosPanel } from './asset-detail/PhotosPanel';
import { DepreciationPanel } from './asset-detail/DepreciationPanel';
import { PurchasePanel } from './asset-detail/PurchasePanel';
import { AuditPanel } from './asset-detail/AuditPanel';
import { JournalPanel } from './asset-detail/JournalPanel';
import type { Asset, AssetCondition, DisposalType } from '@/api/types';

const CONDITION_OPTIONS: { value: AssetCondition; label: string }[] = [
  { value: 'good', label: 'Baik' },
  { value: 'needs_repair', label: 'Perlu Perbaikan' },
  { value: 'broken', label: 'Rusak' },
  { value: 'idle', label: 'Tidak Terpakai' },
];

const methodLabels: Record<Asset['method'], string> = {
  straight_line: 'Garis Lurus',
  declining_balance: 'Saldo Menurun',
  none: 'Tanpa Depresiasi',
};

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'nilai', label: 'Nilai & Depresiasi' },
  { key: 'pelimpahan', label: 'Pelimpahan' },
  { key: 'foto', label: 'Foto' },
  { key: 'depresiasi', label: 'Depresiasi' },
  { key: 'pembelian', label: 'Pembelian' },
  { key: 'jurnal', label: 'Jurnal' },
  { key: 'audit', label: 'Audit' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-soft px-5 py-3 last:border-0">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className="text-right text-sm text-text-default">{children}</span>
    </div>
  );
}

export default function AssetDetailPage() {
  const { id = '' } = useParams();
  const { data: asset, isLoading, isError } = useAsset(id);
  const { data: categories } = useCategories();
  const { data: custodians } = useCustodians();
  const { data: photos } = useAssetPhotos(id);
  const navigate = useNavigate();
  const del = useDeleteAsset();
  const setConditionMut = useSetCondition();
  const disposeMut = useCreateDisposal();
  const toast = useToast();
  const { can } = useCan();
  const canManage = can('asset.manage');
  const canDispose = can('disposal.manage');
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabKey>('ringkasan');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [conditionOpen, setConditionOpen] = useState(false);
  const [newCondition, setNewCondition] = useState<AssetCondition>('good');
  const [disposalOpen, setDisposalOpen] = useState(false);
  const [disposalType, setDisposalType] = useState<DisposalType>('sale');
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10));
  const [proceeds, setProceeds] = useState('0');

  async function doDelete() {
    if (!asset) return;
    try {
      await del.mutateAsync(asset.id);
      toast('success', 'Aset dihapus.');
      navigate('/aset');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menghapus aset.');
    }
  }

  function openConditionModal() {
    if (asset) setNewCondition(asset.condition);
    setConditionOpen(true);
  }

  async function saveCondition() {
    if (!asset) return;
    try {
      await setConditionMut.mutateAsync({ id: asset.id, condition: newCondition });
      toast('success', 'Kondisi aset diperbarui.');
      setConditionOpen(false);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal mengubah kondisi.');
    }
  }

  async function submitDisposal() {
    if (!asset) return;
    try {
      await disposeMut.mutateAsync({
        asset_id: asset.id,
        date: disposalDate,
        type: disposalType,
        proceeds: disposalType === 'writeoff' ? 0 : Number(proceeds) || 0,
      });
      toast('success', 'Pelepasan dicatat & jurnal dikirim ke Akunta.');
      setDisposalOpen(false);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal mencatat pelepasan.');
    }
  }

  if (isLoading) {
    return (
      <Card>
        <LoadingBlock />
      </Card>
    );
  }

  if (isError || !asset) {
    return (
      <div>
        <div className="mb-4">
          <Link to="/aset" className="text-sm text-text-muted hover:text-primary">← Daftar Aset</Link>
        </div>
        <Card>
          <EmptyState title="Aset tidak ditemukan" description="Aset mungkin sudah dihapus atau dipindahkan." icon="▣" />
        </Card>
      </div>
    );
  }

  const categoryName = categories?.find((c) => c.id === asset.category_id)?.name ?? '—';
  const custodian = custodians?.find((c) => c.id === asset.custodian_id);

  // Newest photo from the Foto tab, shown as a quick preview.
  const lastPhoto = photos && photos.length
    ? [...photos].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
    : null;

  // Asset age in whole months, from acquisition date to today.
  const ageMonths = (() => {
    const d = new Date(asset.acquisition_date);
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (now.getDate() < d.getDate()) m -= 1;
    return Math.max(0, m);
  })();
  const ageYears = Math.floor(ageMonths / 12);

  return (
    <div>
      <div className="mb-4">
        <Link to="/aset" className="text-sm text-text-muted hover:text-primary">← Daftar Aset</Link>
      </div>

      <PageHeader
        title={asset.name}
        description={`${asset.code} · ${categoryName}`}
        actions={
          <div className="flex items-center gap-2">
            <AssetStatusBadge status={asset.status} />
            {(canManage || canDispose) && (
              <KebabMenu
                items={[
                  ...(canManage
                    ? [
                        { label: 'Ubah', onClick: () => setEditing(true) },
                        { label: 'Ubah Kondisi', onClick: openConditionModal },
                        { label: 'Assign to', onClick: () => setTab('pelimpahan') },
                      ]
                    : []),
                  ...(canDispose && asset.status === 'active'
                    ? [{ label: 'Pelepasan / Penjualan', onClick: () => { setDisposalType('sale'); setProceeds('0'); setDisposalOpen(true); } }]
                    : []),
                  ...(canManage
                    ? [{ label: 'Hapus', danger: true, onClick: () => { setConfirmName(''); setDeleteOpen(true); } }]
                    : []),
                ]}
              />
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-default',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ringkasan' && (
        <div className="grid grid-cols-1 gap-4">
          {/* Foto terakhir (kiri) + penanggung jawab & kondisi (kanan). */}
          <Card>
            <div className="flex items-center gap-4 border-b border-border-soft px-4 py-3">
              <button
                onClick={() => setTab('foto')}
                className="shrink-0 overflow-hidden rounded-lg border border-border-soft"
                title="Buka tab Foto"
              >
                {lastPhoto?.thumb_url || lastPhoto?.url ? (
                  <img
                    src={(lastPhoto.thumb_url ?? lastPhoto.url) as string}
                    alt="Foto terakhir"
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center bg-page-bg text-[10px] font-medium text-text-muted">
                    Foto
                  </span>
                )}
              </button>
              <div className="ml-auto flex min-w-0 items-center gap-2 text-sm">
                <span
                  className="inline-flex items-center gap-1.5 text-text-default"
                  title="Tanggal perolehan"
                >
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-text-muted"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="whitespace-nowrap">
                    {formatDate(asset.acquisition_date)} <span className="text-text-muted">({ageYears} Tahun)</span>
                  </span>
                </span>
                <span aria-hidden="true" className="text-text-muted">·</span>
                <span className="inline-flex min-w-0 items-center gap-1.5 text-text-default" title="Penanggung Jawab">
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-text-muted"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="truncate font-medium">{custodian ? custodian.name : '—'}</span>
                </span>
                <span aria-hidden="true" className="text-text-muted">·</span>
                <ConditionBadge condition={asset.condition} />
              </div>
            </div>
            <Row label="Lokasi">{asset.location || '—'}</Row>
            <Row label="Nomor Seri"><span className="font-mono">{asset.serial_number || '—'}</span></Row>
            <Row label="Tanggal Perolehan">{formatDate(asset.acquisition_date)}</Row>
          </Card>

          {asset.notes && (
            <Card>
              <CardHeader title="Catatan" />
              <div className="whitespace-pre-wrap px-5 py-4 text-sm text-text-default">{asset.notes}</div>
            </Card>
          )}
        </div>
      )}

      {tab === 'nilai' && (
        <Card>
          <CardHeader title="Nilai & Depresiasi" />
          <Row label="Nilai Pembelian"><span className="font-mono">{formatIDR(asset.acquisition_cost)}</span></Row>
          <Row label="Nilai Residu"><span className="font-mono">{formatIDR(asset.salvage_value)}</span></Row>
          <Row label="Akumulasi Depresiasi"><span className="font-mono">{formatIDR(asset.accumulated_depreciation)}</span></Row>
          <Row label="Nilai Sisa">
            <span className="font-mono font-semibold text-text-strong">{formatIDR(asset.book_value)}</span>
          </Row>
          <Row label="Metode Depresiasi">{methodLabels[asset.method]}</Row>
          <Row label="Umur Manfaat">{asset.useful_life_months} bulan</Row>
          <Row label="Depresiasi Terakhir">
            {asset.last_depreciated_period ? formatPeriod(asset.last_depreciated_period) : 'Belum pernah'}
          </Row>
        </Card>
      )}

      {tab === 'pelimpahan' && <CustodyPanel asset={asset} />}
      {tab === 'foto' && <PhotosPanel asset={asset} />}
      {tab === 'depresiasi' && <DepreciationPanel asset={asset} />}
      {tab === 'pembelian' && <PurchasePanel asset={asset} />}
      {tab === 'jurnal' && <JournalPanel asset={asset} />}
      {tab === 'audit' && <AuditPanel asset={asset} />}

      <AssetFormModal open={editing} onClose={() => setEditing(false)} asset={asset} />

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Hapus aset ${asset.code}`}
        description="Tindakan ini permanen. Ketik nama aset secara lengkap untuk konfirmasi."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Batal</Button>
            <Button variant="danger" disabled={confirmName !== asset.name || del.isPending} onClick={doDelete}>
              {del.isPending && <Spinner />} Hapus permanen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            Ketik <strong className="text-text-strong">{asset.name}</strong> untuk mengonfirmasi penghapusan.
          </p>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={asset.name} />
        </div>
      </Modal>

      <Modal
        open={conditionOpen}
        onClose={() => setConditionOpen(false)}
        title={`Ubah kondisi ${asset.code}`}
        description="Perbarui kondisi fisik aset saat ini."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConditionOpen(false)}>Batal</Button>
            <Button onClick={saveCondition} disabled={setConditionMut.isPending}>
              {setConditionMut.isPending && <Spinner />} Simpan
            </Button>
          </>
        }
      >
        <Field label="Kondisi">
          <Select value={newCondition} onChange={(e) => setNewCondition(e.target.value as AssetCondition)}>
            {CONDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={disposalOpen}
        onClose={() => setDisposalOpen(false)}
        title={`Pelepasan ${asset.code}`}
        description="Catat penjualan atau penghapusan aset; laba/rugi otomatis dijurnal ke Akunta."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDisposalOpen(false)}>Batal</Button>
            <Button onClick={submitDisposal} disabled={disposeMut.isPending}>
              {disposeMut.isPending && <Spinner />} Catat & Posting
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jenis">
              <Select value={disposalType} onChange={(e) => setDisposalType(e.target.value as DisposalType)}>
                <option value="sale">Penjualan</option>
                <option value="writeoff">Penghapusan</option>
              </Select>
            </Field>
            <Field label="Tanggal">
              <Input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
            </Field>
          </div>
          {disposalType === 'sale' && (
            <Field label="Hasil Penjualan (Rp)">
              <NumberInput value={proceeds} onChange={(e) => setProceeds(e.target.value)} />
            </Field>
          )}
          {(() => {
            const p = disposalType === 'writeoff' ? 0 : Number(proceeds) || 0;
            const gainLoss = p - asset.book_value;
            return (
              <div className="rounded-lg bg-primary-light/60 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Nilai buku saat ini</span>
                  <span className="font-mono">{formatIDR(asset.book_value)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold">
                  <span>{gainLoss >= 0 ? 'Laba pelepasan' : 'Rugi pelepasan'}</span>
                  <span className={`font-mono ${gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                    {gainLoss >= 0 ? formatIDR(gainLoss) : `(${formatIDR(-gainLoss)})`}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}
