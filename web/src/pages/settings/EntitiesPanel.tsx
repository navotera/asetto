import { useState } from 'react';
import { useEntities } from '@/api/queries';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import { Card, CardHeader, Button, LoadingBlock, EmptyState, Badge } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { EntityFormModal } from '@/pages/EntityFormModal';

/**
 * Entity (company/PT) management — the Asetto counterpart of Akunta's workspace
 * settings. Each entity id is sent to Akunta as `source_entity_id` and mapped
 * there (Auto Mapping) to an Akunta entity.
 */
export function EntitiesPanel() {
  const { data: entities, isLoading } = useEntities();
  const { activeEntityId, setActiveEntityId } = useActiveEntity();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Entitas"
        subtitle="Perusahaan (PT) yang aset & jurnalnya dipisahkan. Dipetakan di Akunta lewat Auto Mapping."
        action={<Button onClick={() => setAddOpen(true)}>+ Tambah Entitas</Button>}
      />
      {isLoading ? (
        <LoadingBlock />
      ) : !entities || entities.length === 0 ? (
        <EmptyState title="Belum ada entitas" description="Tambahkan entitas pertama untuk memisahkan aset per perusahaan." icon="◌" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nama</Th>
              <Th>ID (source_entity_id)</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => {
              const active = e.id === activeEntityId;
              return (
                <Tr key={e.id}>
                  <Td>
                    <span className="font-semibold text-text-strong">{e.name}</span>
                    {active && <span className="ml-2 inline-block align-middle"><Badge tone="primary">Aktif</Badge></span>}
                  </Td>
                  <Td className="font-mono text-xs text-text-muted">{e.id}</Td>
                  <Td align="right">
                    <button
                      onClick={() => setActiveEntityId(active ? null : e.id)}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {active ? 'Lihat semua' : 'Jadikan aktif'}
                    </button>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <EntityFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(e) => setActiveEntityId(e.id)} />
    </Card>
  );
}
