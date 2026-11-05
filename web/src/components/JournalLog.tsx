import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Spinner, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { JournalStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatDate } from '@/lib/format';
import type { JournalEntry, JournalSource, JournalStatus } from '@/api/types';

const sourceMeta: Record<JournalSource, { tone: 'primary' | 'info' | 'success'; label: string }> = {
  acquisition: { tone: 'success', label: 'Perolehan' },
  depreciation: { tone: 'primary', label: 'Depresiasi' },
  disposal: { tone: 'info', label: 'Pelepasan' },
};

const STATUS_TABS: { key: JournalStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'accepted', label: 'Berhasil' },
  { key: 'queued', label: 'Antre' },
  { key: 'failed', label: 'Gagal' },
  { key: 'rejected', label: 'Ditolak' },
];

function eventAmount(j: JournalEntry): number {
  const p = j.payload ?? {};
  for (const k of ['amount', 'cost']) {
    const v = p[k];
    if (typeof v === 'number') return v;
  }
  return 0;
}

/** Resolve the asset a journal points at (acquisition/disposal carry an asset id). */
export type AssetLinkResolver = (j: JournalEntry) => { to: string; label: string } | null;

export function JournalLog({
  journals,
  isLoading,
  onRetry,
  retryingId,
  assetLink,
  emptyText = 'Belum ada peristiwa.',
}: {
  journals: JournalEntry[] | undefined;
  isLoading?: boolean;
  onRetry: (id: string) => void;
  retryingId?: string | null;
  assetLink?: AssetLinkResolver;
  emptyText?: string;
}) {
  const [tab, setTab] = useState<JournalStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = journals ?? [];
  const count = (s: JournalStatus) => list.filter((j) => j.status === s).length;
  const rows = tab === 'all' ? list : list.filter((j) => j.status === tab);

  return (
    <div>
      {/* Status tabs with a subtle count badge each. */}
      <div className="flex flex-wrap gap-1 border-b border-border-soft px-2">
        {STATUS_TABS.map((t) => {
          const n = t.key === 'all' ? list.length : count(t.key);
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                '-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ' +
                (active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-default')
              }
            >
              {t.label}
              <span className="rounded-full bg-border-soft px-1.5 text-[10px] font-semibold tabular-nums text-text-muted">
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title={tab === 'all' ? 'Kosong' : 'Tidak ada pada status ini'} description={emptyText} icon="⤤" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Memo</Th>
              <Th align="center">Jenis</Th>
              <Th>Tanggal</Th>
              <Th align="right">Nilai</Th>
              <Th align="center">Status</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => {
              const meta = sourceMeta[j.source];
              const link = assetLink?.(j) ?? null;
              const canRetry = j.status === 'failed' || j.status === 'rejected';
              const isOpen = expanded === j.id;
              return (
                <Fragment key={j.id}>
                  <Tr>
                    <Td>
                      <button
                        onClick={() => setExpanded(isOpen ? null : j.id)}
                        className="text-left font-semibold text-text-strong hover:text-primary"
                      >
                        <span className="mr-1 inline-block text-text-muted">{isOpen ? '▾' : '▸'}</span>
                        {j.memo}
                      </button>
                      <div className="pl-4 font-mono text-xs text-text-muted">{j.source_type}</div>
                      {link && (
                        <Link to={link.to} className="pl-4 text-xs font-semibold text-primary hover:underline">
                          → {link.label}
                        </Link>
                      )}
                    </Td>
                    <Td align="center"><Badge tone={meta.tone}>{meta.label}</Badge></Td>
                    <Td>{formatDate(j.date)}</Td>
                    <Td align="right" className="font-mono">{formatIDR(eventAmount(j))}</Td>
                    <Td align="center"><JournalStatusBadge status={j.status} /></Td>
                    <Td align="right">
                      {canRetry ? (
                        <Button
                          variant="secondary"
                          className="px-3 py-1"
                          onClick={() => onRetry(j.id)}
                          disabled={retryingId === j.id}
                        >
                          {retryingId === j.id && <Spinner />} Kirim ulang
                        </Button>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </Td>
                  </Tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="border-b border-border-soft bg-page-bg/60 px-6 py-4">
                        {j.last_error && <p className="mb-3 text-sm text-danger">Kesalahan terakhir: {j.last_error}</p>}
                        {j.akunta_raw_id && (
                          <p className="mb-2 font-mono text-xs text-text-muted">Akunta raw id: {j.akunta_raw_id}</p>
                        )}
                        <div className="mb-2 font-mono text-xs text-text-muted">Idempotency: {j.idempotency_key}</div>
                        <table className="w-full max-w-2xl text-sm">
                          <thead>
                            <tr className="text-xs uppercase text-text-muted">
                              <th className="py-1 text-left font-semibold">Field</th>
                              <th className="py-1 text-left font-semibold">Nilai (yang dikirim)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(j.payload ?? {}).map(([k, v]) => (
                              <tr key={k}>
                                <td className="py-1 pr-6 font-mono text-xs text-text-muted">{k}</td>
                                <td className="py-1 font-mono">{typeof v === 'number' ? formatIDR(v) : String(v)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {link && (
                          <Link to={link.to} className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
                            → Buka {link.label}
                          </Link>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
