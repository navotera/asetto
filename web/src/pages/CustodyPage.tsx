import { useState } from 'react';
import { useAssets, useReassign } from '@/api/queries';
import { PageHeader, Card, LoadingBlock, Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Spinner } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import { ResponsiblePicker, type ResponsibleValue } from '@/components/ResponsiblePicker';
import type { Asset } from '@/api/types';

export default function CustodyPage() {
  const { data: assets, isLoading } = useAssets();
  const reassign = useReassign();
  const toast = useToast();

  const [target, setTarget] = useState<Asset | null>(null);
  const [responsible, setResponsible] = useState<ResponsibleValue>({ type: null, id: null });
  const [location, setLocation] = useState('');

  const active = (assets ?? []).filter((a) => a.status === 'active');

  function open(a: Asset) {
    setTarget(a);
    setResponsible({ type: a.responsible_type ?? null, id: a.responsible_user_id ?? a.responsible_team_id ?? null });
    setLocation(a.location);
  }

  async function submit() {
    if (!target) return;
    try {
      await reassign.mutateAsync({ id: target.id, responsible_type: responsible.type, responsible_id: responsible.id, location });
      toast('success', `Tanggung jawab ${target.code} dilimpahkan.`);
      setTarget(null);
    } catch {
      toast('error', 'Gagal melimpahkan.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Pelimpahan Tanggung Jawab"
        description="Alihkan penanggung jawab aset ke entitas kantor atau personil."
      />
      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Aset</Th>
                <Th>Penanggung Jawab</Th>
                <Th>Lokasi</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {active.map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <div className="font-semibold text-text-strong">{a.name}</div>
                    <div className="font-mono text-xs text-text-muted">{a.code}</div>
                  </Td>
                  <Td>{a.responsible_name ?? '—'}</Td>
                  <Td>{a.location}</Td>
                  <Td align="right">
                    <Button variant="secondary" className="px-3 py-1" onClick={() => open(a)}>Limpahkan</Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={target ? `Limpahkan ${target.code}` : ''}
        description="Pilih penanggung jawab baru dan lokasi penempatan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>Batal</Button>
            <Button onClick={submit} disabled={reassign.isPending}>
              {reassign.isPending && <Spinner />} Simpan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Penanggung Jawab Baru">
            <ResponsiblePicker entityId={target?.entity_id ?? null} value={responsible} onChange={setResponsible} />
          </Field>
          <Field label="Lokasi">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
