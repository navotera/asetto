import { useEffect, useState } from 'react';
import { useSaveCategory } from '@/api/queries';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, Select, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { AssetCategory, DepreciationMethod } from '@/api/types';

const METHODS: { value: DepreciationMethod; label: string }[] = [
  { value: 'straight_line', label: 'Garis Lurus' },
  { value: 'declining_balance', label: 'Saldo Menurun' },
  { value: 'none', label: 'Tanpa Depresiasi' },
];

const EMPTY = {
  code: '',
  name: '',
  default_method: 'straight_line' as DepreciationMethod,
  default_useful_life_months: 60,
};

export function CategoryFormModal({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category: AssetCategory | null;
}) {
  const save = useSaveCategory();
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (open) {
      setForm(category ? {
        code: category.code,
        name: category.name,
        default_method: category.default_method,
        default_useful_life_months: category.default_useful_life_months,
      } : { ...EMPTY });
    }
  }, [open, category]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    try {
      await save.mutateAsync(category ? { id: category.id, ...form } : form);
      toast('success', category ? 'Kategori diperbarui.' : 'Kategori ditambahkan.');
      onClose();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menyimpan kategori.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? `Ubah Kategori ${category.code}` : 'Tambah Kategori'}
      description="Metode depresiasi default. Kode kategori dipetakan ke akun GL oleh admin Akunta (Auto Mapping) — Asetto tidak menyimpan kode akun."
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
        <Field label="Kode">
          <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="KND" />
        </Field>
        <Field label="Nama Kategori">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Kendaraan" />
        </Field>
        <Field label="Metode Default">
          <Select value={form.default_method} onChange={(e) => set('default_method', e.target.value as DepreciationMethod)}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Masa Manfaat (bulan)">
          <Input
            type="number"
            min={1}
            value={form.default_useful_life_months}
            onChange={(e) => set('default_useful_life_months', Number(e.target.value))}
          />
        </Field>
      </div>
    </Modal>
  );
}
