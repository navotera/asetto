import { useRef, useState } from 'react';
import { useAssetPhotos, useUploadPhoto, useDeletePhoto } from '@/api/queries';
import { Card, CardHeader, Button, Input, Spinner, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';
import type { Asset } from '@/api/types';

export function PhotosPanel({ asset }: { asset: Asset }) {
  const { data: photos, isLoading } = useAssetPhotos(asset.id);
  const upload = useUploadPhoto(asset.id);
  const del = useDeletePhoto(asset.id);
  const toast = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');

  async function onPick(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append('photo', file);
    if (caption) form.append('caption', caption);
    try {
      await upload.mutateAsync(form);
      toast('success', 'Foto diunggah.');
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    }
  }

  async function remove(id: string) {
    if (!confirm('Hapus foto ini?')) return;
    try {
      await del.mutateAsync(id);
      toast('success', 'Foto dihapus.');
    } catch {
      toast('error', 'Gagal menghapus foto.');
    }
  }

  return (
    <Card>
      <CardHeader
        title="Foto Aset"
        subtitle="Foto otomatis di-resize; thumbnail dibuat. Original tidak disimpan."
        action={
          <div className="flex items-center gap-2">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Keterangan (opsional)"
              className="hidden w-48 sm:block"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Spinner /> : '＋'} Unggah
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingBlock />
      ) : !photos || photos.length === 0 ? (
        <EmptyState title="Belum ada foto" description="Unggah foto kondisi atau dokumentasi aset." icon="◧" />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded-lg border border-border-soft bg-field-bg">
              <a href={p.url ?? '#'} target="_blank" rel="noreferrer" className="block aspect-square">
                {p.thumb_url ? (
                  <img src={p.thumb_url} alt={p.caption ?? 'Foto aset'} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-muted">◧</div>
                )}
              </a>
              <button
                onClick={() => remove(p.id)}
                title="Hapus"
                className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-md bg-danger text-white group-hover:flex"
              >
                ✕
              </button>
              <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-text-muted">
                <span className="truncate">{p.caption || '—'}</span>
                <span className="shrink-0">{formatDate(p.taken_at ?? p.created_at)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Card>
  );
}
