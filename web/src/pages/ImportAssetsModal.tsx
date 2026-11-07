import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, Spinner, Badge } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import { useCategories, useEntities, useImportAssets } from '@/api/queries';
import { parseAssetFile, downloadTemplateXlsx, type RawRow, type ImportResult } from '@/lib/assetSheet';

type Step = 'select' | 'preview' | 'done';

export function ImportAssetsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: categories } = useCategories();
  const { data: entities } = useEntities();
  const importMut = useImportAssets();

  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setStep('select');
    setFileName('');
    setRows([]);
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() {
    reset();
    onClose();
  }

  const lookups = { categories: categories ?? [], entities: entities ?? [] };

  async function onPick(file: File | undefined) {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseAssetFile(file);
      if (parsed.length === 0) {
        toast('error', 'Tidak ada baris data pada berkas. Pastikan header sesuai template.');
        setParsing(false);
        return;
      }
      setRows(parsed);
      const res = await importMut.mutateAsync({ rows: parsed, commit: false });
      setPreview(res);
      setStep('preview');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal membaca berkas.');
    } finally {
      setParsing(false);
    }
  }

  async function commit() {
    try {
      const res = await importMut.mutateAsync({ rows, commit: true });
      setResult(res);
      setStep('done');
      toast('success', `${res.created} aset berhasil diimpor.`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal mengimpor aset.');
    }
  }

  const summary = preview?.summary;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Impor Aset dari Spreadsheet"
      description="Unggah berkas Excel/CSV. Baris divalidasi dulu sebelum disimpan."
      size="lg"
      footer={
        step === 'preview' ? (
          <>
            <Button variant="secondary" onClick={reset} disabled={importMut.isPending}>
              Ganti berkas
            </Button>
            <Button onClick={commit} disabled={importMut.isPending || !summary?.valid}>
              {importMut.isPending && <Spinner />} Impor {summary?.valid ?? 0} aset
            </Button>
          </>
        ) : step === 'done' ? (
          <Button onClick={close}>Selesai</Button>
        ) : (
          <Button variant="secondary" onClick={close}>
            Tutup
          </Button>
        )
      }
    >
      {step === 'select' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-dashed border-border-default bg-field-bg px-5 py-8 text-center">
            <p className="text-sm text-text-default">Pilih berkas <strong>.xlsx</strong> atau <strong>.csv</strong></p>
            <p className="mt-1 text-xs text-text-muted">
              Kolom mengikuti template. Entitas, kategori, dan penanggung jawab diisi dengan nama/kode.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button onClick={() => fileRef.current?.click()} disabled={parsing}>
                {parsing && <Spinner />} Pilih berkas
              </Button>
              <Button variant="secondary" onClick={() => downloadTemplateXlsx(lookups)}>
                Unduh template
              </Button>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Kode boleh dikosongkan agar dibuat otomatis. Tanggal memakai format YYYY-MM-DD; nilai dalam rupiah penuh.
          </p>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-muted">{fileName} —</span>
            <Badge tone="neutral">{preview.summary.total} baris</Badge>
            <Badge tone="success">{preview.summary.valid} valid</Badge>
            {preview.summary.invalid > 0 && <Badge tone="danger">{preview.summary.invalid} bermasalah</Badge>}
          </div>
          {preview.summary.invalid > 0 && (
            <p className="text-xs text-text-muted">
              Baris bermasalah akan dilewati; hanya baris valid yang diimpor. Perbaiki berkas lalu unggah ulang untuk
              mengimpor semuanya.
            </p>
          )}
          <div className="max-h-[48vh] overflow-y-auto rounded-lg border border-border-soft">
            <Table>
              <thead>
                <tr>
                  <Th align="center">Baris</Th>
                  <Th>Nama</Th>
                  <Th align="center">Status</Th>
                  <Th>Keterangan</Th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <Tr key={r.row}>
                    <Td align="center" className="tabular-nums text-text-muted">{r.row}</Td>
                    <Td className="font-medium text-text-default">{r.name || <span className="text-text-muted">—</span>}</Td>
                    <Td align="center">
                      {r.valid ? <Badge tone="success">Valid</Badge> : <Badge tone="danger">Gagal</Badge>}
                    </Td>
                    <Td>
                      {r.errors.length > 0 ? (
                        <ul className="list-inside list-disc text-xs text-danger">
                          {r.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-text-muted">Siap diimpor</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="text-3xl text-success">✓</div>
          <p className="text-sm font-semibold text-text-strong">{result.created} aset berhasil diimpor.</p>
          {!!result.skipped && (
            <p className="text-xs text-text-muted">{result.skipped} baris dilewati karena tidak valid.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
