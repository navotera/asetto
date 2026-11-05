import { useState } from 'react';
import { useAssetJournals, useRetryJournal, useTrashJournal } from '@/api/queries';
import { Card, CardHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { JournalLog } from '@/components/JournalLog';
import type { Asset } from '@/api/types';

/** Per-asset economic-event log (acquisition + disposal journals for this asset). */
export function JournalPanel({ asset }: { asset: Asset }) {
  const { data: journals, isLoading } = useAssetJournals(asset.id);
  const retry = useRetryJournal();
  const trash = useTrashJournal();
  const toast = useToast();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [trashingId, setTrashingId] = useState<string | null>(null);

  async function doRetry(id: string) {
    setRetryingId(id);
    try {
      const res = await retry.mutateAsync(id);
      toast(res.status === 'accepted' ? 'success' : 'error', res.status === 'accepted' ? 'Berhasil dikirim ulang.' : 'Masih belum berhasil.');
    } catch {
      toast('error', 'Gagal mengirim ulang.');
    } finally {
      setRetryingId(null);
    }
  }

  async function doTrash(id: string) {
    setTrashingId(id);
    try {
      await trash.mutateAsync(id);
      toast('success', 'Dipindahkan ke Trashed.');
    } catch {
      toast('error', 'Gagal memindahkan ke Trashed.');
    } finally {
      setTrashingId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Jurnal ke Akunta"
        subtitle="Peristiwa ekonomi aset ini (perolehan & pelepasan). Depresiasi diringkas per periode di tab Depresiasi."
      />
      <JournalLog
        journals={journals}
        isLoading={isLoading}
        onRetry={doRetry}
        retryingId={retryingId}
        onTrash={doTrash}
        trashingId={trashingId}
        emptyText="Belum ada jurnal untuk aset ini."
      />
    </Card>
  );
}
