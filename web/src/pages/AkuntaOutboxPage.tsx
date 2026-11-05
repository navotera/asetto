import { useMemo, useState } from 'react';
import { useJournals, useRetryJournal, useAssets } from '@/api/queries';
import { PageHeader, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { JournalLog, type AssetLinkResolver } from '@/components/JournalLog';

export default function AkuntaOutboxPage() {
  const { data: journals, isLoading } = useJournals();
  const { data: assets } = useAssets();
  const retry = useRetryJournal();
  const toast = useToast();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const assetById = useMemo(() => new Map((assets ?? []).map((a) => [a.id, a])), [assets]);

  // Acquisition/disposal events carry an asset id in source_ref; depreciation
  // carries a run id (aggregated per entity×category), so it has no single asset.
  const assetLink: AssetLinkResolver = (j) => {
    if (j.source !== 'acquisition' && j.source !== 'disposal') return null;
    const a = assetById.get(j.source_ref);
    return { to: `/aset/${j.source_ref}`, label: a ? `${a.code} — ${a.name}` : 'Detail aset' };
  };

  async function doRetry(id: string) {
    setRetryingId(id);
    try {
      const res = await retry.mutateAsync(id);
      toast(
        res.status === 'accepted' ? 'success' : 'error',
        res.status === 'accepted' ? 'Berhasil dikirim ulang ke Akunta.' : 'Masih belum berhasil.',
      );
    } catch {
      toast('error', 'Gagal mengirim ulang.');
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Peristiwa Ekonomi → Akunta"
        description="Antrean sinkronisasi peristiwa ekonomis aset (perolehan, depresiasi, pelepasan) ke Auto Mapping Akunta. Klik baris untuk melihat payload yang dikirim."
      />
      <Card>
        <JournalLog
          journals={journals}
          isLoading={isLoading}
          onRetry={doRetry}
          retryingId={retryingId}
          assetLink={assetLink}
          emptyText="Peristiwa muncul setelah Anda mencatat pembelian, memposting depresiasi, atau mencatat pelepasan."
        />
      </Card>
    </div>
  );
}
