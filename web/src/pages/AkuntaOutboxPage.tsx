import { useState } from 'react';
import { useJournals, useRetryJournal } from '@/api/queries';
import { PageHeader, Card, CardHeader, LoadingBlock, EmptyState, Button, Badge, StatCard, Spinner } from '@/components/ui/primitives';
import { JournalStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import type { JournalEntry, JournalSource } from '@/api/types';

const sourceMeta: Record<JournalSource, { tone: 'primary' | 'info' | 'success'; label: string }> = {
  acquisition: { tone: 'success', label: 'Perolehan' },
  depreciation: { tone: 'primary', label: 'Depresiasi' },
  disposal: { tone: 'info', label: 'Pelepasan' },
};

/** Monetary magnitude of an event, read from the raw business payload. */
function eventAmount(j: JournalEntry): number {
  const p = j.payload ?? {};
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = p[k];
      if (typeof v === 'number') return v;
    }
    return 0;
  };
  // acquisition/depreciation carry `amount`; disposal carries `cost`.
  return first('amount', 'cost');
}

export default function AkuntaOutboxPage() {
  const { data: journals, isLoading } = useJournals();
  const retry = useRetryJournal();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const accepted = (journals ?? []).filter((j) => j.status === 'accepted').length;
  const queued = (journals ?? []).filter((j) => j.status === 'queued').length;
  const failed = (journals ?? []).filter((j) => j.status === 'failed').length;

  async function doRetry(id: string) {
    try {
      const res = await retry.mutateAsync(id);
      toast(
        res.status === 'accepted' ? 'success' : 'error',
        res.status === 'accepted' ? 'Event berhasil dikirim ulang ke Akunta.' : 'Masih gagal.',
      );
    } catch {
      toast('error', 'Gagal mengirim ulang.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Outbox Jurnal Akunta"
        description="Peristiwa ekonomis aset yang Asetto kirim ke Auto Mapping Akunta (tanpa kode akun — admin Akunta yang memetakan field ke akun)."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Diterima" value={accepted} tone="success" icon="✓" />
        <StatCard label="Antre" value={queued} tone="warning" icon="…" />
        <StatCard label="Gagal" value={failed} tone="danger" icon="!" />
      </div>

      <Card>
        <CardHeader title="Daftar event" subtitle="Klik baris untuk melihat payload bisnis yang dikirim." />
        {isLoading ? (
          <LoadingBlock />
        ) : !journals || journals.length === 0 ? (
          <EmptyState
            title="Outbox kosong"
            description="Event akan muncul setelah Anda mencatat pembelian, memposting depresiasi, atau mencatat pelepasan aset."
            icon="⤤"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Memo</Th>
                <Th align="center">Sumber</Th>
                <Th>Tanggal</Th>
                <Th align="right">Nilai</Th>
                <Th>Idempotency Key</Th>
                <Th align="center">Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {journals.map((j) => (
                <JournalRow
                  key={j.id}
                  journal={j}
                  expanded={expanded === j.id}
                  onToggle={() => setExpanded(expanded === j.id ? null : j.id)}
                  onRetry={() => doRetry(j.id)}
                  retrying={retry.isPending}
                />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function JournalRow({
  journal,
  expanded,
  onToggle,
  onRetry,
  retrying,
}: {
  journal: JournalEntry;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const meta = sourceMeta[journal.source];
  const entries = Object.entries(journal.payload ?? {});
  return (
    <>
      <Tr className="cursor-pointer">
        <Td>
          <button onClick={onToggle} className="text-left font-semibold text-text-strong hover:text-primary">
            <span className="mr-1 inline-block text-text-muted">{expanded ? '▾' : '▸'}</span>
            {journal.memo}
          </button>
          <div className="pl-4 font-mono text-xs text-text-muted">{journal.source_type}</div>
          {journal.akunta_raw_id && (
            <div className="pl-4 font-mono text-xs text-text-muted">raw: {journal.akunta_raw_id}</div>
          )}
        </Td>
        <Td align="center">
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </Td>
        <Td>{formatDate(journal.date)}</Td>
        <Td align="right" className="font-mono">{formatIDR(eventAmount(journal))}</Td>
        <Td className="font-mono text-xs text-text-muted">{journal.idempotency_key}</Td>
        <Td align="center"><JournalStatusBadge status={journal.status} /></Td>
        <Td align="right">
          {journal.status === 'failed' ? (
            <Button variant="secondary" className="px-3 py-1" onClick={onRetry} disabled={retrying}>
              {retrying && <Spinner />} Kirim ulang
            </Button>
          ) : (
            <span className="text-xs text-text-muted">—</span>
          )}
        </Td>
      </Tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="border-b border-border-soft bg-page-bg/60 px-6 py-4">
            {journal.last_error && (
              <p className="mb-3 text-sm text-danger">Kesalahan terakhir: {journal.last_error}</p>
            )}
            <table className="w-full max-w-2xl text-sm">
              <thead>
                <tr className="text-xs uppercase text-text-muted">
                  <th className="py-1 text-left font-semibold">Field</th>
                  <th className="py-1 text-left font-semibold">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-1 pr-6 font-mono text-xs text-text-muted">{k}</td>
                    <td className="py-1 font-mono">
                      {typeof v === 'number' ? formatIDR(v) : String(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 max-w-2xl text-xs text-text-muted">
              Asetto tidak mengirim kode akun. Admin Akunta memetakan field di atas ke akun GL sekali per tipe sumber
              (<span className="font-mono">{journal.source_type}</span>) melalui fitur Auto Mapping.
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
