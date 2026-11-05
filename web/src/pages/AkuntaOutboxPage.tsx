import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useJournals, useRetryJournal, useTrashJournal, useAssets, useCan } from '@/api/queries';
import { PageHeader, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { JournalLog, type AssetLinkResolver } from '@/components/JournalLog';

export default function AkuntaOutboxPage() {
  const { data: journals, isLoading } = useJournals();
  const { data: assets } = useAssets();
  const { can } = useCan();
  const retry = useRetryJournal();
  const trash = useTrashJournal();
  const toast = useToast();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [trashingId, setTrashingId] = useState<string | null>(null);

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
    <div>
      <PageHeader
        title="Peristiwa Ekonomi → Akunta"
        description="Antrean sinkronisasi peristiwa ekonomis aset (perolehan, depresiasi, pelepasan) ke Auto Mapping Akunta. Klik baris untuk melihat payload yang dikirim."
        actions={
          can('settings.manage') ? (
            <Link
              to="/pengaturan?section=sinkron"
              title="Pengaturan sinkronisasi Akunta"
              aria-label="Pengaturan sinkronisasi Akunta"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-text-muted hover:bg-primary-light hover:text-primary"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          ) : undefined
        }
      />
      <Card>
        <JournalLog
          journals={journals}
          isLoading={isLoading}
          onRetry={doRetry}
          retryingId={retryingId}
          onTrash={doTrash}
          trashingId={trashingId}
          assetLink={assetLink}
          emptyText="Peristiwa muncul setelah Anda mencatat pembelian, memposting depresiasi, atau mencatat pelepasan."
        />
      </Card>
    </div>
  );
}
