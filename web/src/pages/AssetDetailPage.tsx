import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAsset, useCategories, useCustodians, useDeleteAsset, useCan } from '@/api/queries';
import { PageHeader, Button, Card, CardHeader, LoadingBlock, EmptyState, Input, Spinner } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
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
import type { Asset } from '@/api/types';

const methodLabels: Record<Asset['method'], string> = {
  straight_line: 'Garis Lurus',
  declining_balance: 'Saldo Menurun',
  none: 'Tanpa Depresiasi',
};

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'pelimpahan', label: 'Pelimpahan' },
  { key: 'foto', label: 'Foto' },
  { key: 'depresiasi', label: 'Depresiasi' },
  { key: 'pembelian', label: 'Pembelian' },
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
  const navigate = useNavigate();
  const del = useDeleteAsset();
  const toast = useToast();
  const { can } = useCan();
  const canManage = can('asset.manage');
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabKey>('ringkasan');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

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
            {canManage && <Button variant="secondary" onClick={() => setEditing(true)}>Ubah</Button>}
            {canManage && (
              <Button variant="danger" onClick={() => { setConfirmName(''); setDeleteOpen(true); }}>Hapus</Button>
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
        <div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Informasi Umum" />
              <Row label="Kode"><span className="font-mono">{asset.code}</span></Row>
              <Row label="Kategori">{categoryName}</Row>
              <Row label="Kondisi"><ConditionBadge condition={asset.condition} /></Row>
              <Row label="Penanggung Jawab">{custodian ? custodian.name : '—'}</Row>
              <Row label="Lokasi">{asset.location || '—'}</Row>
              <Row label="Nomor Seri"><span className="font-mono">{asset.serial_number || '—'}</span></Row>
              <Row label="Tanggal Perolehan">{formatDate(asset.acquisition_date)}</Row>
            </Card>

            <Card>
              <CardHeader title="Nilai & Depresiasi" />
              <Row label="Nilai Perolehan"><span className="font-mono">{formatIDR(asset.acquisition_cost)}</span></Row>
              <Row label="Nilai Residu"><span className="font-mono">{formatIDR(asset.salvage_value)}</span></Row>
              <Row label="Akumulasi Depresiasi"><span className="font-mono">{formatIDR(asset.accumulated_depreciation)}</span></Row>
              <Row label="Nilai Buku">
                <span className="font-mono font-semibold text-text-strong">{formatIDR(asset.book_value)}</span>
              </Row>
              <Row label="Metode Depresiasi">{methodLabels[asset.method]}</Row>
              <Row label="Umur Manfaat">{asset.useful_life_months} bulan</Row>
              <Row label="Depresiasi Terakhir">
                {asset.last_depreciated_period ? formatPeriod(asset.last_depreciated_period) : 'Belum pernah'}
              </Row>
            </Card>
          </div>

          {asset.notes && (
            <Card className="mt-4">
              <CardHeader title="Catatan" />
              <div className="whitespace-pre-wrap px-5 py-4 text-sm text-text-default">{asset.notes}</div>
            </Card>
          )}
        </div>
      )}

      {tab === 'pelimpahan' && <CustodyPanel asset={asset} />}
      {tab === 'foto' && <PhotosPanel asset={asset} />}
      {tab === 'depresiasi' && <DepreciationPanel asset={asset} />}
      {tab === 'pembelian' && <PurchasePanel asset={asset} />}
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
    </div>
  );
}
