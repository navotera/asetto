import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories, useEntities, useSaveAsset } from '@/api/queries';
import { api } from '@/api/client';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import {
  PageHeader,
  Card,
  CardHeader,
  Field,
  Input,
  DateInput,
  NumberInput,
  Select,
  Textarea,
  Button,
  Toggle,
  Spinner,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { ResponsiblePicker, type ResponsibleValue } from '@/components/ResponsiblePicker';
import { formatIDR } from '@/lib/format';

type PendingPhoto = { file: File; url: string };

/**
 * Dedicated "Tambah Aset" page (replaces the modal). Entity defaults to the
 * active entity; depreciation method follows the category; custodian handover
 * (pelimpahan) lives on the asset detail page instead. Supports multiple photo
 * uploads and a per-asset Akunta economic-event sync toggle.
 */
export default function AssetCreatePage() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: entities } = useEntities();
  const { activeEntityId } = useActiveEntity();
  const save = useSaveAsset();
  const toast = useToast();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().slice(0, 10));
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [salvageValue, setSalvageValue] = useState('0');
  const [serialNumber, setSerialNumber] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [syncAkunta, setSyncAkunta] = useState(true);
  const [responsible, setResponsible] = useState<ResponsibleValue>({ type: null, id: null });
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const entity = (entities ?? []).find((e) => e.id === activeEntityId) ?? (entities ?? [])[0] ?? null;
  const category = categories?.find((c) => c.id === categoryId) ?? null;

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...picked]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function removePhoto(url: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.url === url);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.url !== url);
    });
  }

  async function submit() {
    if (!name || !categoryId || !entity) {
      toast('error', 'Nama, entitas, dan kategori wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await save.mutateAsync({
        name,
        entity_id: entity.id,
        category_id: categoryId,
        acquisition_date: acquisitionDate,
        acquisition_cost: Number(acquisitionCost) || 0,
        salvage_value: Number(salvageValue) || 0,
        useful_life_months: category?.default_useful_life_months ?? 60,
        method: category?.default_method ?? 'straight_line',
        location: location || '—',
        serial_number: serialNumber || undefined,
        notes: notes || undefined,
        sync_akunta: syncAkunta,
        responsible_type: responsible.type,
        responsible_id: responsible.id,
      });

      // Upload any photos to the freshly-created asset (one request each).
      if (photos.length > 0) {
        let failed = 0;
        for (const p of photos) {
          const fd = new FormData();
          fd.append('photo', p.file);
          try {
            await api.upload(`/assets/${created.id}/photos`, fd);
          } catch {
            failed += 1;
          }
        }
        if (failed > 0) toast('error', `${failed} foto gagal diunggah.`);
      }

      toast('success', 'Aset ditambahkan.');
      navigate(`/aset/${created.id}`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menyimpan aset.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tambah Aset"
        description="Lengkapi data aset. Nilai perolehan & masa manfaat menentukan jadwal depresiasi."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/aset')}>Batal</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Spinner />} Simpan Aset
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        {/* Informasi dasar */}
        <Card>
          <CardHeader title="Informasi Aset" subtitle="Identitas dan penempatan aset." />
          <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nama Aset">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Laptop Dell Latitude" />
              </Field>
            </div>
            <Field label="Entitas (Perusahaan)" hint="Mengikuti entitas aktif di kanan atas.">
              <Input readOnly tabIndex={-1} value={entity?.name ?? '—'} className="cursor-not-allowed bg-page-bg text-text-muted" />
            </Field>
            <Field label="Kategori" hint="Menentukan metode & masa manfaat depresiasi.">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— pilih kategori —</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Penanggung Jawab" hint="User atau Team dari entitas ini (opsional).">
              <ResponsiblePicker entityId={entity?.id ?? null} value={responsible} onChange={setResponsible} />
            </Field>
            <Field label="Lokasi">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="mis. Kantor Pusat — Lantai 3" />
            </Field>
            <Field label="Nomor Seri / Identitas">
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Catatan">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        {/* Perolehan & depresiasi */}
        <Card>
          <CardHeader title="Perolehan & Depresiasi" subtitle="Dasar perhitungan nilai buku dan beban depresiasi." />
          <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Tanggal Perolehan">
              <DateInput value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </Field>
            <Field label="Masa Manfaat (bulan)" hint="Mengikuti kategori terpilih.">
              <Input
                readOnly
                tabIndex={-1}
                value={category ? String(category.default_useful_life_months) : '—'}
                className="cursor-not-allowed bg-page-bg text-text-muted"
              />
            </Field>
            <Field label="Nilai Perolehan (Rp)">
              <NumberInput value={acquisitionCost} onChange={(e) => setAcquisitionCost(e.target.value)} />
            </Field>
            <Field label="Nilai Residu (Rp)" hint="Nilai sisa di akhir masa manfaat.">
              <NumberInput value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} />
            </Field>
            {Number(acquisitionCost) > 0 && (
              <div className="sm:col-span-2 rounded-lg bg-primary-light/50 p-3 text-sm text-text-muted">
                Nilai dapat disusutkan:{' '}
                <span className="font-semibold text-text-strong">
                  {formatIDR(Math.max(0, (Number(acquisitionCost) || 0) - (Number(salvageValue) || 0)))}
                </span>
                {category && <> · metode <span className="font-semibold text-text-strong">
                  {category.default_method === 'declining_balance' ? 'Saldo Menurun' : category.default_method === 'none' ? 'Tidak Didepresiasi' : 'Garis Lurus'}
                </span></>}
              </div>
            )}
          </div>
        </Card>

        {/* Foto */}
        <Card>
          <CardHeader
            title="Foto Aset"
            subtitle="Unggah satu atau beberapa foto. Otomatis di-resize saat disimpan."
            action={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>＋ Pilih Foto</Button>
              </>
            }
          />
          {photos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-text-muted">Belum ada foto dipilih.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => (
                <figure key={p.url} className="group relative overflow-hidden rounded-lg border border-border-soft bg-field-bg">
                  <div className="block aspect-square">
                    <img src={p.url} alt={p.file.name} className="h-full w-full object-cover" />
                  </div>
                  <button
                    onClick={() => removePhoto(p.url)}
                    title="Hapus"
                    className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-md bg-danger text-white group-hover:flex"
                  >
                    ✕
                  </button>
                  <figcaption className="truncate px-2 py-1.5 text-[11px] text-text-muted">{p.file.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </Card>

        {/* Sinkronisasi Akunta */}
        <Card>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-text-strong">Sinkronisasi ke Akunta</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Jika aktif, event ekonomi aset ini (perolehan, depresiasi, pelepasan) dikirim ke antrian Akunta.
              </p>
            </div>
            <Toggle checked={syncAkunta} onChange={setSyncAkunta} label="Sinkronisasi ke Akunta" />
          </div>
        </Card>
      </div>
    </div>
  );
}
