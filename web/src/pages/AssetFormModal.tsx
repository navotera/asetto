import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, DateInput, NumberInput, Select, Textarea, Spinner } from '@/components/ui/primitives';
import { useCategories, useCustodians, useEntities, useSaveAsset } from '@/api/queries';
import { useToast } from '@/components/ui/toast';
import type { Asset, DepreciationMethod } from '@/api/types';

const methodLabels: Record<DepreciationMethod, string> = {
  straight_line: 'Garis Lurus',
  declining_balance: 'Saldo Menurun',
  none: 'Tidak Didepresiasi',
};

type FormState = {
  name: string;
  entity_id: string;
  category_id: string;
  acquisition_date: string;
  acquisition_cost: string;
  salvage_value: string;
  useful_life_months: string;
  method: DepreciationMethod;
  custodian_id: string;
  location: string;
  serial_number: string;
  notes: string;
};

function toForm(asset?: Asset | null): FormState {
  return {
    name: asset?.name ?? '',
    entity_id: asset?.entity_id ?? '',
    category_id: asset?.category_id ?? '',
    acquisition_date: asset?.acquisition_date ?? new Date().toISOString().slice(0, 10),
    acquisition_cost: asset ? String(asset.acquisition_cost) : '',
    salvage_value: asset ? String(asset.salvage_value) : '0',
    useful_life_months: asset ? String(asset.useful_life_months) : '60',
    method: asset?.method ?? 'straight_line',
    custodian_id: asset?.custodian_id ?? '',
    location: asset?.location ?? '',
    serial_number: asset?.serial_number ?? '',
    notes: asset?.notes ?? '',
  };
}

export function AssetFormModal({ open, onClose, asset }: { open: boolean; onClose: () => void; asset?: Asset | null }) {
  const { data: categories } = useCategories();
  const { data: custodians } = useCustodians();
  const { data: entities } = useEntities();
  const save = useSaveAsset();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(toForm(asset));

  useEffect(() => {
    if (open) setForm(toForm(asset));
  }, [open, asset]);

  // Method + useful life ALWAYS follow the chosen category (read-only fields),
  // on both create and edit.
  useEffect(() => {
    if (!categories) return;
    const cat = categories.find((c) => c.id === form.category_id);
    if (cat) {
      setForm((f) => ({
        ...f,
        method: cat.default_method,
        useful_life_months: String(cat.default_useful_life_months),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category_id, categories]);

  const set = (k: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.name || !form.category_id || !form.entity_id) {
      toast('error', 'Nama, entitas, dan kategori wajib diisi.');
      return;
    }
    try {
      await save.mutateAsync({
        id: asset?.id,
        name: form.name,
        entity_id: form.entity_id,
        category_id: form.category_id,
        acquisition_date: form.acquisition_date,
        acquisition_cost: Number(form.acquisition_cost) || 0,
        salvage_value: Number(form.salvage_value) || 0,
        useful_life_months: Number(form.useful_life_months) || 1,
        method: form.method,
        custodian_id: form.custodian_id || null,
        location: form.location || '—',
        serial_number: form.serial_number || undefined,
        notes: form.notes || undefined,
      });
      toast('success', asset ? 'Aset diperbarui.' : 'Aset ditambahkan.');
      onClose();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menyimpan aset.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? `Ubah ${asset.code}` : 'Tambah Aset'}
      description="Nilai perolehan dan masa manfaat menentukan jadwal depresiasi."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Spinner />} Simpan
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nama Aset">
            <Input value={form.name} onChange={set('name')} placeholder="mis. Laptop Dell Latitude" />
          </Field>
        </div>
        <Field label="Entitas (Perusahaan)" hint="Jurnal di Akunta mengacu pada entitas ini.">
          <Select value={form.entity_id} onChange={set('entity_id')}>
            <option value="">— pilih entitas —</option>
            {entities?.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Kategori">
          <Select value={form.category_id} onChange={set('category_id')}>
            <option value="">— pilih kategori —</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Metode Depresiasi" hint="Mengikuti kategori terpilih.">
          <Input
            readOnly
            tabIndex={-1}
            value={methodLabels[form.method]}
            className="cursor-not-allowed bg-page-bg text-text-muted"
          />
        </Field>
        <Field label="Tanggal Perolehan">
          <DateInput value={form.acquisition_date} onChange={set('acquisition_date')} />
        </Field>
        <Field label="Masa Manfaat (bulan)" hint="Mengikuti kategori terpilih.">
          <NumberInput
            readOnly
            tabIndex={-1}
            value={form.useful_life_months}
            onChange={set('useful_life_months')}
            className="cursor-not-allowed bg-page-bg text-text-muted"
          />
        </Field>
        <Field label="Nilai Perolehan (Rp)">
          <NumberInput value={form.acquisition_cost} onChange={set('acquisition_cost')} />
        </Field>
        <Field label="Nilai Residu (Rp)" hint="Nilai sisa di akhir masa manfaat.">
          <NumberInput value={form.salvage_value} onChange={set('salvage_value')} />
        </Field>
        <Field label="Penanggung Jawab">
          <Select value={form.custodian_id} onChange={set('custodian_id')}>
            <option value="">— belum ditentukan —</option>
            {custodians?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === 'person' ? 'Personil' : 'Entitas'})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lokasi">
          <Input value={form.location} onChange={set('location')} placeholder="mis. Kantor Pusat — Lantai 3" />
        </Field>
        <Field label="Nomor Seri / Identitas">
          <Input value={form.serial_number} onChange={set('serial_number')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Catatan">
            <Textarea value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
