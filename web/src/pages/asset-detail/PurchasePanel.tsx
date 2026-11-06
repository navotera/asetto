import { useEffect, useRef, useState } from 'react';
import { useAssetPurchase, useSavePurchase } from '@/api/queries';
import { Card, CardHeader, Button, Field, Input, DateInput, NumberInput, Textarea, Spinner, LoadingBlock } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { Asset } from '@/api/types';

export function PurchasePanel({ asset }: { asset: Asset }) {
  const { data: purchase, isLoading } = useAssetPurchase(asset.id);
  const save = useSavePurchase(asset.id);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ vendor: '', invoice_no: '', purchase_date: '', amount: '', notes: '' });
  const [proofName, setProofName] = useState('');

  useEffect(() => {
    if (purchase) {
      setForm({
        vendor: purchase.vendor ?? '',
        invoice_no: purchase.invoice_no ?? '',
        purchase_date: purchase.purchase_date ?? '',
        amount: purchase.amount ? String(purchase.amount) : '',
        notes: purchase.notes ?? '',
      });
    }
  }, [purchase]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    const data = new FormData();
    data.append('vendor', form.vendor);
    data.append('invoice_no', form.invoice_no);
    if (form.purchase_date) data.append('purchase_date', form.purchase_date);
    data.append('amount', form.amount || '0');
    data.append('notes', form.notes);
    const file = fileRef.current?.files?.[0];
    if (file) data.append('proof', file);

    try {
      await save.mutateAsync(data);
      toast('success', 'Data pembelian disimpan.');
      setProofName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
  }

  if (isLoading) {
    return (
      <Card>
        <LoadingBlock />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Data Pembelian" subtitle="Informasi akuisisi aset." />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Vendor / Pemasok">
            <Input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="PT ..." />
          </Field>
          <Field label="No. Faktur / Invoice">
            <Input value={form.invoice_no} onChange={(e) => set('invoice_no', e.target.value)} />
          </Field>
          <Field label="Tanggal Pembelian">
            <DateInput value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
          </Field>
          <Field label="Nilai Pembelian (Rp)">
            <NumberInput value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Catatan">
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end border-t border-border-soft px-5 py-3">
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Spinner />} Simpan
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Bukti Pembelian" subtitle="Gambar atau PDF." />
        <div className="flex flex-col gap-3 px-5 py-4">
          {purchase?.proof_url ? (
            purchase.proof_type === 'image' ? (
              <a href={purchase.proof_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border-soft">
                <img src={purchase.proof_thumb_url ?? purchase.proof_url} alt="Bukti pembelian" className="max-h-48 w-full object-cover" />
              </a>
            ) : (
              <a href={purchase.proof_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border-soft px-3 py-4 text-sm text-primary hover:underline">
                📄 Lihat dokumen (PDF)
              </a>
            )
          ) : (
            <div className="rounded-lg border border-dashed border-border-default px-3 py-6 text-center text-xs text-text-muted">
              Belum ada bukti diunggah.
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setProofName(e.target.files?.[0]?.name ?? '')}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {proofName ? `Dipilih: ${proofName}` : 'Pilih file bukti'}
          </Button>
          {proofName && <p className="text-[11px] text-text-muted">Klik “Simpan” untuk mengunggah bukti.</p>}
        </div>
      </Card>
    </div>
  );
}
