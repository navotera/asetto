import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAssets, useCreateDisposal, useDisposals } from '@/api/queries';
import { PageHeader, Card, CardHeader, LoadingBlock, EmptyState, Button, Badge } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { Field, DateInput, NumberInput, Select, Spinner } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import type { DisposalType } from '@/api/types';

export default function DisposalPage() {
  const { data: assets } = useAssets();
  const { data: disposals, isLoading } = useDisposals();
  const create = useCreateDisposal();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [type, setType] = useState<DisposalType>('sale');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [proceeds, setProceeds] = useState('0');

  const activeAssets = (assets ?? []).filter((a) => a.status === 'active');
  const selected = activeAssets.find((a) => a.id === assetId);

  const gainLoss = useMemo(() => {
    if (!selected) return 0;
    const p = type === 'writeoff' ? 0 : Number(proceeds) || 0;
    return p - selected.book_value;
  }, [selected, type, proceeds]);

  async function submit() {
    if (!assetId) {
      toast('error', 'Pilih aset yang akan dilepas.');
      return;
    }
    try {
      await create.mutateAsync({ asset_id: assetId, date, type, proceeds: Number(proceeds) || 0 });
      toast('success', 'Pelepasan dicatat & jurnal dikirim ke Akunta.');
      setOpen(false);
      setAssetId('');
      setProceeds('0');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal mencatat pelepasan.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Pelepasan & Penjualan Aset"
        description="Catat penjualan atau penghapusan aset; laba/rugi otomatis dijurnal ke Akunta."
        actions={<Button onClick={() => setOpen(true)}>+ Lepas Aset</Button>}
      />

      <Card>
        <CardHeader title="Riwayat pelepasan" />
        {isLoading ? (
          <LoadingBlock />
        ) : !disposals || disposals.length === 0 ? (
          <EmptyState title="Belum ada pelepasan" icon="⊗" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Aset</Th>
                <Th align="center">Jenis</Th>
                <Th>Tanggal</Th>
                <Th align="right">Hasil</Th>
                <Th align="right">Nilai Buku</Th>
                <Th align="right">Laba / (Rugi)</Th>
                <Th align="right">Jurnal</Th>
              </tr>
            </thead>
            <tbody>
              {disposals.map((d) => (
                <Tr key={d.id}>
                  <Td>
                    <div className="font-semibold text-text-strong">{d.asset_name}</div>
                    <div className="font-mono text-xs text-text-muted">{d.asset_code}</div>
                  </Td>
                  <Td align="center">
                    <Badge tone={d.type === 'sale' ? 'info' : 'neutral'}>{d.type === 'sale' ? 'Penjualan' : 'Penghapusan'}</Badge>
                  </Td>
                  <Td>{formatDate(d.date)}</Td>
                  <Td align="right" className="font-mono">{formatIDR(d.proceeds)}</Td>
                  <Td align="right" className="font-mono">{formatIDR(d.book_value_at_disposal)}</Td>
                  <Td align="right" className={`font-mono font-semibold ${d.gain_loss >= 0 ? 'text-success' : 'text-danger'}`}>
                    {d.gain_loss >= 0 ? formatIDR(d.gain_loss) : `(${formatIDR(-d.gain_loss)})`}
                  </Td>
                  <Td align="right">
                    <Link to="/akunta" className="text-xs font-semibold text-primary hover:underline">Lihat →</Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Lepas Aset"
        description="Pilih aset dan jenis pelepasan. Jurnal laba/rugi dihitung otomatis."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending && <Spinner />} Catat & Posting
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Aset">
            <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="">— pilih aset —</option>
              {activeAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jenis">
              <Select value={type} onChange={(e) => setType(e.target.value as DisposalType)}>
                <option value="sale">Penjualan</option>
                <option value="writeoff">Penghapusan</option>
              </Select>
            </Field>
            <Field label="Tanggal">
              <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          {type === 'sale' && (
            <Field label="Hasil Penjualan (Rp)">
              <NumberInput value={proceeds} onChange={(e) => setProceeds(e.target.value)} />
            </Field>
          )}
          {selected && (
            <div className="rounded-lg bg-primary-light/60 p-3 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Nilai buku saat ini</span><span className="font-mono">{formatIDR(selected.book_value)}</span></div>
              <div className="mt-1 flex justify-between font-semibold">
                <span>{gainLoss >= 0 ? 'Laba pelepasan' : 'Rugi pelepasan'}</span>
                <span className={`font-mono ${gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                  {gainLoss >= 0 ? formatIDR(gainLoss) : `(${formatIDR(-gainLoss)})`}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
