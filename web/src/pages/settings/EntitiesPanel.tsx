import { useState } from 'react';
import { useEntities, useSetEntityEnabled, useSetDefaultEntity } from '@/api/queries';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import { Card, CardHeader, Button, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import { EntityFormModal } from '@/pages/EntityFormModal';
import { cn } from '@/lib/cn';

/** Small on/off switch. */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-border-default',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/**
 * Entity (company/PT) management — the Asetto counterpart of Akunta's workspace
 * settings. Each entity id is sent to Akunta as `source_entity_id` and mapped
 * there (Auto Mapping) to an Akunta entity. Toggle an entity on/off to control
 * whether it can be picked in the top switcher, and mark one as the default.
 */
export function EntitiesPanel() {
  const { data: entities, isLoading } = useEntities();
  const { activeEntityId, setActiveEntityId } = useActiveEntity();
  const setEnabled = useSetEntityEnabled();
  const setDefault = useSetDefaultEntity();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await setEnabled.mutateAsync({ id, enabled });
      // If the active entity was just disabled, drop it so the switcher re-picks.
      if (!enabled && id === activeEntityId) setActiveEntityId(null);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal mengubah status entitas.');
    }
  }

  async function handleSetDefault(id: string, name: string) {
    try {
      await setDefault.mutateAsync(id);
      toast('success', `"${name}" dijadikan entitas default.`);
    } catch {
      toast('error', 'Gagal menetapkan default.');
    }
  }

  const busy = setEnabled.isPending || setDefault.isPending;

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
              <Th align="center">Aktif</Th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => (
              <Tr key={e.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-strong">{e.name}</span>
                    {e.is_default ? (
                      <span className="inline-flex items-center rounded-md bg-success-light px-2 py-0.5 text-xs font-semibold text-success">
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(e.id, e.name)}
                        disabled={busy || !e.enabled}
                        className="text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline"
                        title={e.enabled ? 'Jadikan entitas default' : 'Aktifkan dulu untuk menjadikan default'}
                      >
                        Set default
                      </button>
                    )}
                  </div>
                </Td>
                <Td className="font-mono text-xs text-text-muted">{e.id}</Td>
                <Td align="center">
                  <Toggle
                    checked={e.enabled}
                    disabled={busy}
                    onChange={(v) => handleToggle(e.id, v)}
                    label={`Aktifkan ${e.name}`}
                  />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <EntityFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(e) => setActiveEntityId(e.id)} />
    </Card>
  );
}
