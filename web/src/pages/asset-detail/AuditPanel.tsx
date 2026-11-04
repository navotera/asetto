import { useAssetAudit } from '@/api/queries';
import { Card, CardHeader, Badge, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/format';
import type { Asset } from '@/api/types';

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const actionMeta: Record<string, { label: string; tone: Tone }> = {
  created: { label: 'Dibuat', tone: 'success' },
  updated: { label: 'Diubah', tone: 'info' },
  condition: { label: 'Kondisi', tone: 'warning' },
  reassigned: { label: 'Pelimpahan', tone: 'primary' },
  photo_added: { label: 'Foto +', tone: 'neutral' },
  photo_removed: { label: 'Foto −', tone: 'neutral' },
  purchase: { label: 'Pembelian', tone: 'info' },
  disposed: { label: 'Pelepasan', tone: 'danger' },
  depreciation: { label: 'Depresiasi', tone: 'neutral' },
};

export function AuditPanel({ asset }: { asset: Asset }) {
  const { data: entries, isLoading } = useAssetAudit(asset.id);

  return (
    <Card>
      <CardHeader title="Audit Trail" subtitle="Riwayat aktivitas pada aset ini (terbaru di atas)." />
      {isLoading ? (
        <LoadingBlock />
      ) : !entries || entries.length === 0 ? (
        <EmptyState title="Belum ada aktivitas" description="Perubahan pada aset akan tercatat di sini." icon="≡" />
      ) : (
        <ul className="flex flex-col px-5 py-4">
          {entries.map((e, i) => {
            const meta = actionMeta[e.action] ?? { label: e.action, tone: 'neutral' as Tone };
            return (
              <li key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  {i < entries.length - 1 && <span className="w-px flex-1 bg-border-soft" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-xs text-text-muted">{formatDateTime(e.created_at)}</span>
                  </div>
                  <div className="mt-1 text-sm text-text-default">{e.description ?? '—'}</div>
                  {e.actor_name && <div className="text-[11px] text-text-muted">oleh {e.actor_name}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
