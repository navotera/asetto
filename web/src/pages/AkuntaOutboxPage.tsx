import { useState } from 'react';
import { useJournals, useRetryJournal } from '@/api/queries';
import { PageHeader, Card, CardHeader, LoadingBlock, EmptyState, Button, Badge, StatCard, Spinner } from '@/components/ui/primitives';
import { JournalStatusBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { formatIDR, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import type { JournalEntry } from '@/api/types';

export default function AkuntaOutboxPage() {
  const { data: journals, isLoading } = useJournals();
  const retry = useRetryJournal();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const posted = (journals ?? []).filter((j) => j.status === 'posted').length;
  const queued = (journals ?? []).filter((j) => j.status === 'queued').length;
  const failed = (journals ?? []).filter((j) => j.status === 'failed').length;

  async function doRetry(id: string) {
    try {
      const res = await retry.mutateAsync(id);
      toast(res.status === 'posted' ? 'success' : 'error', res.status === 'posted' ? 'Jurnal berhasil dikirim ulang.' : 'Masih gagal.');
    } catch {
      toast('error', 'Gagal mengirim ulang.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Outbox Jurnal Akunta"
        description="Jurnal yang Asetto kirim ke Akunta sebagai general ledger (server-to-server via api-client)."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Terkirim" value={posted} tone="success" icon="✓" />
        <StatCard label="Antre" value={queued} tone="warning" icon="…" />
        <StatCard label="Gagal" value={failed} tone="danger" icon="!" />
      </div>

      <Card>
        <CardHeader title="Daftar jurnal" subtitle="Klik baris untuk melihat ayat debit/kredit." />
        {isLoading ? (
          <LoadingBlock />
        ) : !journals || journals.length === 0 ? (
          <EmptyState
            title="Outbox kosong"
            description="Jurnal akan muncul setelah Anda memposting depresiasi atau mencatat pelepasan aset."
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
  const total = journal.lines.reduce((s, l) => s + l.debit, 0);
  return (
    <>
      <Tr className="cursor-pointer">
        <Td>
          <button onClick={onToggle} className="text-left font-semibold text-text-strong hover:text-primary">
            <span className="mr-1 inline-block text-text-muted">{expanded ? '▾' : '▸'}</span>
            {journal.memo}
          </button>
          {journal.akunta_journal_no && (
            <div className="pl-4 font-mono text-xs text-text-muted">{journal.akunta_journal_no}</div>
          )}
        </Td>
        <Td align="center">
          <Badge tone={journal.source === 'depreciation' ? 'primary' : 'info'}>
            {journal.source === 'depreciation' ? 'Depresiasi' : 'Pelepasan'}
          </Badge>
        </Td>
        <Td>{formatDate(journal.date)}</Td>
        <Td align="right" className="font-mono">{formatIDR(total)}</Td>
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
            <table className="w-full max-w-2xl text-sm">
              <thead>
                <tr className="text-xs uppercase text-text-muted">
                  <th className="py-1 text-left font-semibold">Akun</th>
                  <th className="py-1 text-right font-semibold">Debit</th>
                  <th className="py-1 text-right font-semibold">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {journal.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1">
                      <span className="font-mono text-xs text-text-muted">{l.account_code}</span> {l.account_name}
                    </td>
                    <td className="py-1 text-right font-mono">{l.debit ? formatIDR(l.debit) : ''}</td>
                    <td className="py-1 text-right font-mono">{l.credit ? formatIDR(l.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
