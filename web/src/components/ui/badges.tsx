import { Badge } from './primitives';
import type { AssetCondition, AssetStatus, JournalStatus } from '@/api/types';

const conditionMeta: Record<AssetCondition, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  good: { tone: 'success', label: 'Baik' },
  needs_repair: { tone: 'warning', label: 'Perlu Perbaikan' },
  broken: { tone: 'danger', label: 'Rusak' },
  idle: { tone: 'neutral', label: 'Tidak Terpakai' },
};
export function ConditionBadge({ condition }: { condition: AssetCondition }) {
  const m = conditionMeta[condition];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return status === 'active' ? <Badge tone="primary">Aktif</Badge> : <Badge tone="neutral">Dilepas</Badge>;
}

const journalMeta: Record<JournalStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  posted: { tone: 'success', label: 'Terkirim' },
  queued: { tone: 'warning', label: 'Antre' },
  failed: { tone: 'danger', label: 'Gagal' },
};
export function JournalStatusBadge({ status }: { status: JournalStatus }) {
  const m = journalMeta[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
