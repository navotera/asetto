import { Fragment, useState } from 'react';
import {
  useEntities,
  useSetEntityEnabled,
  useSetDefaultEntity,
  useEntityUsers,
  useAssignEntityUser,
  useUnassignEntityUser,
} from '@/api/queries';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import { Card, CardHeader, Button, LoadingBlock, EmptyState, Toggle, Select, Spinner } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import { EntityFormModal } from '@/pages/EntityFormModal';
import { cn } from '@/lib/cn';

/** Assigned-user management for one entity — shown when its row is clicked. */
function EntityUsersManager({ entityId, entityName }: { entityId: string; entityName: string }) {
  const { data, isLoading } = useEntityUsers(entityId);
  const assign = useAssignEntityUser(entityId);
  const unassign = useUnassignEntityUser(entityId);
  const toast = useToast();
  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState('');

  const roles = data?.roles ?? [];
  const assignable = data?.assignable ?? [];
  const assigned = data?.assigned ?? [];
  const effectiveRole = roleId || roles[0]?.id || '';

  async function add() {
    if (!userId) {
      toast('error', 'Pilih pengguna dulu.');
      return;
    }
    try {
      await assign.mutateAsync({ user_id: userId, role_id: effectiveRole });
      setUserId('');
      toast('success', 'Pengguna ditambahkan ke entitas.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menambahkan pengguna.');
    }
  }

  async function remove(uid: string, name: string | null) {
    try {
      await unassign.mutateAsync(uid);
      toast('success', `${name ?? 'Pengguna'} dilepas dari entitas.`);
    } catch {
      toast('error', 'Gagal melepas pengguna.');
    }
  }

  const busy = assign.isPending || unassign.isPending;

  return (
    <div className="border-t border-border-soft bg-page-bg/40 px-5 py-4">
      <h4 className="mb-3 text-sm font-semibold text-text-strong">Pengguna — {entityName}</h4>

      {/* Add a synced user to this entity. */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-text-default">Tambah pengguna</span>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={assignable.length === 0}>
            <option value="">{assignable.length === 0 ? '— semua pengguna sudah ditambahkan —' : '— pilih pengguna —'}</option>
            {assignable.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>
            ))}
          </Select>
        </label>
        <label className="sm:w-48">
          <span className="mb-1 block text-xs font-semibold text-text-default">Role</span>
          <Select value={effectiveRole} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </label>
        <Button onClick={add} disabled={busy || !userId}>
          {assign.isPending && <Spinner />} Tambah
        </Button>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : assigned.length === 0 ? (
        <p className="py-2 text-sm text-text-muted">Belum ada pengguna di entitas ini.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-soft">
          <Table>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Role</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((u) => (
                <Tr key={u.assignment_id}>
                  <Td>
                    <span className="font-semibold text-text-strong">{u.name}</span>
                    {u.email && <div className="text-xs text-text-muted">{u.email}</div>}
                  </Td>
                  <Td>{u.role_name ?? '—'}</Td>
                  <Td align="right">
                    <button
                      onClick={() => remove(u.user_id, u.name)}
                      disabled={busy}
                      className="text-sm font-semibold text-danger hover:underline disabled:opacity-50"
                    >
                      Lepas
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

/**
 * Entity (company/PT) management. Toggle an entity on/off to control whether it
 * can be picked in the top switcher, mark one as the default, and click a row to
 * manage which Ecopa-synced users may access it (and with which role).
 */
export function EntitiesPanel() {
  const { data: entities, isLoading } = useEntities();
  const { setActiveEntityId } = useActiveEntity();
  const setEnabled = useSetEntityEnabled();
  const setDefault = useSetDefaultEntity();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await setEnabled.mutateAsync({ id, enabled });
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
        subtitle="Klik entitas untuk mengelola penggunanya. Hanya pengguna yang sudah di-assign Ecopa yang bisa ditambahkan."
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
              <Th align="center">Jumlah User</Th>
              <Th align="center">Aktif</Th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => {
              const expanded = expandedId === e.id;
              return (
                <Fragment key={e.id}>
                  <Tr>
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedId(expanded ? null : e.id)}
                          className="flex items-center gap-1.5 text-left hover:text-primary"
                          title="Kelola pengguna entitas"
                        >
                          <span aria-hidden className="text-[10px] text-text-muted">{expanded ? '▾' : '▸'}</span>
                          <span className="font-semibold text-text-strong">{e.name}</span>
                        </button>
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
                      <button
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-border-soft px-2 py-0.5 text-xs font-semibold text-text-muted hover:bg-primary-light hover:text-primary"
                        title="Lihat pengguna"
                      >
                        {e.user_count ?? 0}
                      </button>
                    </Td>
                    <Td align="center">
                      <Toggle
                        checked={e.enabled}
                        disabled={busy}
                        onChange={(v) => handleToggle(e.id, v)}
                        label={`Aktifkan ${e.name}`}
                      />
                    </Td>
                  </Tr>
                  {expanded && (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <EntityUsersManager entityId={e.id} entityName={e.name} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
      <EntityFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(e) => setActiveEntityId(e.id)} />
    </Card>
  );
}
