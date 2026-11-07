import { useState } from 'react';
import { useCustodyHistory, useReassign } from '@/api/queries';
import { Card, CardHeader, Button, Field, Input, Select, Textarea, Spinner, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { ConditionBadge } from '@/components/ui/badges';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import { ResponsiblePicker, type ResponsibleValue } from '@/components/ResponsiblePicker';
import { formatDateTime } from '@/lib/format';
import type { Asset, AssetCondition } from '@/api/types';

const CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: 'good', label: 'Baik' },
  { value: 'needs_repair', label: 'Perlu Perbaikan' },
  { value: 'broken', label: 'Rusak' },
  { value: 'idle', label: 'Tidak Terpakai' },
];

export function CustodyPanel({ asset }: { asset: Asset }) {
  const { data: history, isLoading } = useCustodyHistory(asset.id);
  const reassign = useReassign();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [responsible, setResponsible] = useState<ResponsibleValue>({ type: null, id: null });
  const [location, setLocation] = useState(asset.location);
  const [condition, setCondition] = useState<AssetCondition>(asset.condition);
  const [notes, setNotes] = useState('');

  function openModal() {
    setResponsible({ type: asset.responsible_type ?? null, id: asset.responsible_user_id ?? asset.responsible_team_id ?? null });
    setLocation(asset.location);
    setCondition(asset.condition);
    setNotes('');
    setOpen(true);
  }

  async function submit() {
    try {
      await reassign.mutateAsync({
        id: asset.id,
        responsible_type: responsible.type,
        responsible_id: responsible.id,
        location,
        condition_at_handover: condition,
        notes: notes || undefined,
      });
      toast('success', 'Tanggung jawab dilimpahkan.');
      setOpen(false);
    } catch {
      toast('error', 'Gagal melimpahkan.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Penanggung Jawab Saat Ini"
          action={<Button variant="secondary" onClick={openModal}>Limpahkan</Button>}
        />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-text-muted">Penanggung jawab</div>
            <div className="text-sm font-semibold text-text-strong">{asset.responsible_name ?? '— belum ditentukan —'}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Lokasi</div>
            <div className="text-sm text-text-default">{asset.location || '—'}</div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Riwayat Pelimpahan" subtitle="Termasuk kondisi aset saat serah-terima." />
        {isLoading ? (
          <LoadingBlock />
        ) : !history || history.length === 0 ? (
          <EmptyState title="Belum ada riwayat" description="Pelimpahan tanggung jawab akan tercatat di sini." icon="⇄" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>Dari</Th>
                <Th>Ke</Th>
                <Th>Lokasi</Th>
                <Th align="center">Kondisi</Th>
                <Th>Catatan</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <Tr key={h.id}>
                  <Td className="whitespace-nowrap text-xs text-text-muted">{formatDateTime(h.handed_at)}</Td>
                  <Td>{h.from_name ?? '—'}</Td>
                  <Td className="font-medium text-text-strong">{h.to_name ?? '—'}</Td>
                  <Td className="text-xs">{h.to_location ?? '—'}</Td>
                  <Td align="center">{h.condition_at_handover ? <ConditionBadge condition={h.condition_at_handover} /> : '—'}</Td>
                  <Td className="text-xs text-text-muted">{h.notes ?? '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Limpahkan ${asset.code}`}
        description="Pilih penanggung jawab baru, lokasi, dan kondisi aset saat serah-terima."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={reassign.isPending}>
              {reassign.isPending && <Spinner />} Simpan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Penanggung Jawab Baru" hint="User atau Team dari entitas aset ini.">
            <ResponsiblePicker entityId={asset.entity_id} value={responsible} onChange={setResponsible} />
          </Field>
          <Field label="Lokasi">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Kondisi saat serah-terima">
            <Select value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Catatan (opsional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kondisi khusus, kelengkapan, dsb." />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
