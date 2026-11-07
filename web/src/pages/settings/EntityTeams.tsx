import { useState } from 'react';
import { useEntityTeams, useTeamMutations } from '@/api/queries';
import { Input, Select, Button, Spinner, LoadingBlock, EmptyState } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { Team } from '@/api/types';

/** Manage an entity's teams (create/rename/delete) and their members. */
export function EntityTeams({ entityId }: { entityId: string }) {
  const { data, isLoading } = useEntityTeams(entityId);
  const { create, rename, remove, addMember, removeMember } = useTeamMutations(entityId);
  const toast = useToast();

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [memberPick, setMemberPick] = useState<Record<string, string>>({});

  const teams = data?.teams ?? [];
  const entityUsers = data?.entity_users ?? [];
  const busy = create.isPending || rename.isPending || remove.isPending || addMember.isPending || removeMember.isPending;

  async function createTeam() {
    if (!newName.trim()) return;
    try {
      await create.mutateAsync(newName.trim());
      setNewName('');
      toast('success', 'Team dibuat.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal membuat team.');
    }
  }

  async function saveRename() {
    if (!editing || !editing.name.trim()) return;
    try {
      await rename.mutateAsync({ id: editing.id, name: editing.name.trim() });
      setEditing(null);
      toast('success', 'Nama team diperbarui.');
    } catch {
      toast('error', 'Gagal mengubah nama team.');
    }
  }

  async function deleteTeam(t: Team) {
    if (!confirm(`Hapus team "${t.name}"?`)) return;
    try {
      await remove.mutateAsync(t.id);
      toast('success', 'Team dihapus.');
    } catch {
      toast('error', 'Gagal menghapus team.');
    }
  }

  async function addMemberTo(teamId: string) {
    const userId = memberPick[teamId];
    if (!userId) return;
    try {
      await addMember.mutateAsync({ teamId, userId });
      setMemberPick((s) => ({ ...s, [teamId]: '' }));
      toast('success', 'Anggota ditambahkan.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menambahkan anggota.');
    }
  }

  async function removeMemberFrom(teamId: string, userId: string) {
    try {
      await removeMember.mutateAsync({ teamId, userId });
    } catch {
      toast('error', 'Gagal melepas anggota.');
    }
  }

  return (
    <div className="px-5 py-4">
      {/* Create a team */}
      <div className="mb-4 flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-text-default">Team baru</span>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="mis. Tim Operasional" onKeyDown={(e) => e.key === 'Enter' && createTeam()} />
        </label>
        <Button onClick={createTeam} disabled={busy || !newName.trim()}>
          {create.isPending && <Spinner />} Buat Team
        </Button>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : teams.length === 0 ? (
        <EmptyState title="Belum ada team" description="Buat team pertama untuk mengelompokkan pengguna entitas ini." icon="♦" />
      ) : (
        <div className="flex flex-col gap-3">
          {teams.map((t) => {
            const memberIds = new Set(t.members.map((m) => m.user_id));
            const assignable = entityUsers.filter((u) => !memberIds.has(u.user_id));
            return (
              <div key={t.id} className="rounded-lg border border-border-soft p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  {editing?.id === t.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input value={editing.name} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} className="max-w-xs" />
                      <Button className="px-2.5 py-1 text-xs" onClick={saveRename} disabled={busy}>Simpan</Button>
                      <button onClick={() => setEditing(null)} className="text-xs text-text-muted hover:underline">Batal</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-strong">{t.name}</span>
                      <span className="rounded-full bg-border-soft px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">{t.member_count} anggota</span>
                      <button onClick={() => setEditing({ id: t.id, name: t.name })} className="text-xs font-semibold text-primary hover:underline">Ubah nama</button>
                    </div>
                  )}
                  <button onClick={() => deleteTeam(t)} disabled={busy} className="text-xs font-semibold text-danger hover:underline disabled:opacity-50">Hapus</button>
                </div>

                {/* Members */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {t.members.length === 0 ? (
                    <span className="text-xs text-text-muted">Belum ada anggota.</span>
                  ) : (
                    t.members.map((m) => (
                      <span key={m.user_id} className="inline-flex items-center gap-1 rounded-md bg-primary-light px-2 py-0.5 text-xs text-primary">
                        {m.name}
                        <button onClick={() => removeMemberFrom(t.id, m.user_id)} disabled={busy} title="Lepas" className="font-bold hover:text-danger">×</button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add member */}
                <div className="flex items-center gap-2">
                  <Select
                    value={memberPick[t.id] ?? ''}
                    onChange={(e) => setMemberPick((s) => ({ ...s, [t.id]: e.target.value }))}
                    className="max-w-xs"
                    disabled={assignable.length === 0}
                  >
                    <option value="">{assignable.length === 0 ? '— semua user entitas sudah jadi anggota —' : '— tambah anggota —'}</option>
                    {assignable.map((u) => (
                      <option key={u.user_id} value={u.user_id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>
                    ))}
                  </Select>
                  <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => addMemberTo(t.id)} disabled={busy || !memberPick[t.id]}>
                    Tambah
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
