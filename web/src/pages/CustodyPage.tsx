import { useState } from 'react';
import { useAssets, useCustodians, useReassign } from '@/api/queries';
import { PageHeader, Card, LoadingBlock, Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Spinner } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import type { Asset } from '@/api/types';

export default function CustodyPage() {
  const { data: assets, isLoading } = useAssets();
  const { data: custodians } = useCustodians();
  const reassign = useReassign();
  const toast = useToast();

  const [target, setTarget] = useState<Asset | null>(null);
  const [custodianId, setCustodianId] = useState('');
  const [location, setLocation] = useState('');

  const active = (assets ?? []).filter((a) => a.status === 'active');
  const custodianName = (id: string | null) => custodians?.find((c) => c.id === id)?.name ?? '— belum ditentukan —';

  function open(a: Asset) {
    setTarget(a);
    setCustodianId(a.custodian_id ?? '');
    setLocation(a.location);
  }

  async function submit() {
    if (!target) return;
    try {
      await reassign.mutateAsync({ id: target.id, custodian_id: custodianId || null, location });
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
                  <Td>{custodianName(a.custodian_id)}</Td>
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
            <Select value={custodianId} onChange={(e) => setCustodianId(e.target.value)}>
              <option value="">— belum ditentukan —</option>
              {custodians?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'person' ? 'Personil' : 'Entitas'})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lokasi">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
