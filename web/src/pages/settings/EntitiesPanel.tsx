import { useState } from 'react';
import {
  useEntities,
  useSetEntityEnabled,
  useSetDefaultEntity,
  useEntityUsers,
  useAssignEntityUser,
  useUnassignEntityUser,
} from '@/api/queries';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import { Card, CardHeader, Button, LoadingBlock, EmptyState, Toggle, Select, Badge } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';
import { EntityFormModal } from '@/pages/EntityFormModal';
import type { Entity } from '@/api/types';

/**
 * Focused single-entity page: manage which Ecopa-synced users may access this
 * entity, with Assigned / Available tabs like the User & Roles screen.
 */
function EntityUsersPage({ entity, onBack }: { entity: Entity; onBack: () => void }) {
  const { data, isLoading } = useEntityUsers(entity.id);
  const assign = useAssignEntityUser(entity.id);
  const unassign = useUnassignEntityUser(entity.id);
  const toast = useToast();

  const [tab, setTab] = useState<'assigned' | 'available'>('assigned');
  const [availableRole, setAvailableRole] = useState<Record<string, string>>({});

  const roles = data?.roles ?? [];
  const assigned = data?.assigned ?? [];
  const assignable = data?.assignable ?? [];
  const defaultRoleId = roles[0]?.id ?? '';
  const busy = assign.isPending || unassign.isPending;

  async function setRole(userId: string, roleId: string) {
    try {
      await assign.mutateAsync({ user_id: userId, role_id: roleId });
      toast('success', 'Role diperbarui.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal memperbarui role.');
    }
  }

  async function addUser(userId: string, roleId: string) {
    if (!roleId) return;
    try {
      await assign.mutateAsync({ user_id: userId, role_id: roleId });
      toast('success', 'Pengguna ditambahkan ke entitas.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menambahkan pengguna.');
    }
  }

  async function remove(userId: string, name: string | null) {
    try {
      await unassign.mutateAsync(userId);
      toast('success', `${name ?? 'Pengguna'} dilepas dari entitas.`);
    } catch {
      toast('error', 'Gagal melepas pengguna.');
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-4">
        <div className="min-w-0">
          <button onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            ← Kembali ke Daftar Entitas
          </button>
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-text-strong">{entity.name}</h3>
            {entity.is_default && (
              <span className="inline-flex items-center rounded-md bg-success-light px-2 py-0.5 text-xs font-semibold text-success">Default</span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-text-muted">{entity.id}</p>
        </div>
      </div>

      {/* Tabs mirror the User & Roles screen. */}
      <div className="flex gap-1 border-b border-border-soft px-5 pt-3">
        {([['assigned', `Assigned (${assigned.length})`], ['available', `Available (${assignable.length})`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-default'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : tab === 'assigned' ? (
        assigned.length === 0 ? (
          <EmptyState title="Belum ada pengguna" description="Tambahkan pengguna dari tab Available." icon="♙" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th align="center">Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((u) => (
                <Tr key={u.assignment_id}>
                  <Td>
                    <div className="font-semibold text-text-strong">{u.name}</div>
                    <div className="text-xs text-text-muted">{u.email}</div>
                  </Td>
                  <Td>
                    <Select
                      value={u.role_id ?? ''}
                      disabled={busy}
                      onChange={(e) => setRole(u.user_id, e.target.value)}
                      className="min-w-[10rem]"
                    >
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  </Td>
                  <Td align="center">
                    {u.disabled_at ? <Badge tone="danger">Dinonaktifkan</Badge> : <Badge tone="success">Aktif</Badge>}
                  </Td>
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
        )
      ) : assignable.length === 0 ? (
        <EmptyState title="Tidak ada pengguna tersedia" description="Semua pengguna tersinkron sudah ditambahkan ke entitas ini." icon="✓" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th align="right">Assign Role</Th>
            </tr>
          </thead>
          <tbody>
            {assignable.map((u) => (
              <Tr key={u.user_id}>
                <Td>
                  <div className="font-semibold text-text-strong">{u.name}</div>
                  <div className="text-xs text-text-muted">{u.email}</div>
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    <Select
                      value={availableRole[u.user_id] ?? defaultRoleId}
                      onChange={(e) => setAvailableRole((s) => ({ ...s, [u.user_id]: e.target.value }))}
                      className="min-w-[9rem]"
                    >
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                    <Button
                      className="px-3 py-1.5"
                      disabled={busy}
                      onClick={() => addUser(u.user_id, availableRole[u.user_id] ?? defaultRoleId)}
                    >
                      Assign
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

/**
 * Entity (company/PT) management. Toggle an entity on/off to control whether it
 * can be picked in the top switcher, mark one as the default, and click an
 * entity name to open its focused user-management page.
 */
export function EntitiesPanel() {
  const { data: entities, isLoading } = useEntities();
  const { setActiveEntityId } = useActiveEntity();
  const setEnabled = useSetEntityEnabled();
  const setDefault = useSetDefaultEntity();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = entities?.find((e) => e.id === selectedId) ?? null;

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

  // Focused single-entity page.
  if (selected) {
    return <EntityUsersPage entity={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <Card>
      <CardHeader
        title="Entitas"
        subtitle="Klik nama entitas untuk mengelola penggunanya. Hanya pengguna yang sudah di-assign Ecopa yang bisa ditambahkan."
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
            {entities.map((e) => (
              <Tr key={e.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedId(e.id)}
                      className="text-left font-semibold text-text-strong hover:text-primary hover:underline"
                      title="Kelola pengguna entitas"
                    >
                      {e.name}
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
                    onClick={() => setSelectedId(e.id)}
                    className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-border-soft px-2 py-0.5 text-xs font-semibold text-text-muted hover:bg-primary-light hover:text-primary"
                    title="Kelola pengguna"
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
            ))}
          </tbody>
        </Table>
      )}
      <EntityFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(e) => setActiveEntityId(e.id)} />
    </Card>
  );
}
