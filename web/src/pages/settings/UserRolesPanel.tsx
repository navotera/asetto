import { useState } from 'react';
import {
  useRoleManagement,
  useAssignRole,
  useUpdateAssignment,
  useImpersonate,
} from '@/api/queries';
import { Card, CardHeader, Button, Select, Input, Badge, LoadingBlock, Spinner } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';

export function UserRolesPanel() {
  const { data, isLoading } = useRoleManagement();
  const assign = useAssignRole();
  const updateAssignment = useUpdateAssignment();
  const impersonate = useImpersonate();
  const toast = useToast();

  const [tab, setTab] = useState<'assigned' | 'available'>('assigned');
  const [availableRole, setAvailableRole] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [emailRole, setEmailRole] = useState('');

  const roles = data?.roles ?? [];

  async function changeRole(assignmentId: string, roleId: string | null) {
    try {
      await updateAssignment.mutateAsync({ assignment_id: assignmentId, role_id: roleId });
      toast('success', 'Role diperbarui.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal memperbarui role.');
    }
  }

  async function assignTo(userId: string, roleId: string) {
    if (!roleId) return;
    try {
      await assign.mutateAsync({ user_id: userId, role_id: roleId });
      toast('success', 'User di-assign.');
    } catch {
      toast('error', 'Gagal assign user.');
    }
  }

  async function assignViaEmail() {
    if (!email || !emailRole) return;
    try {
      await assign.mutateAsync({ email, role_id: emailRole });
      toast('success', `Role di-assign ke ${email}.`);
      setEmail('');
      setEmailRole('');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal assign via email.');
    }
  }

  async function doImpersonate(assignmentId: string) {
    try {
      await impersonate.mutateAsync(assignmentId);
      // Reload so the whole app re-renders as the impersonated user.
      window.location.href = '/';
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal impersonate.');
    }
  }

  if (isLoading) {
    return <Card><LoadingBlock /></Card>;
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="User & Roles"
        subtitle="Identitas user dari Ecopa; role Asetto ditentukan admin. Email hanya jalur opsional."
      />

      <div className="flex gap-1 border-b border-border-soft px-5 pt-3">
        {([['assigned', `Assigned (${data?.users.length ?? 0})`], ['available', `Available (${data?.unassigned_users.length ?? 0})`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-default'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'assigned' ? (
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th align="center">Level Ecopa</Th>
              <Th>Role Asetto</Th>
              <Th align="center">Status</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <Tr key={u.assignment_id}>
                <Td>
                  <div className="font-semibold text-text-strong">{u.name}</div>
                  <div className="text-xs text-text-muted">{u.email}</div>
                </Td>
                <Td align="center">
                  <Badge tone={u.ecopa_role === 'admin' ? 'info' : 'neutral'}>{u.ecopa_role ?? '—'}</Badge>
                </Td>
                <Td>
                  <Select
                    value={u.role_id ?? ''}
                    disabled={!u.can_update_role || updateAssignment.isPending}
                    onChange={(e) => changeRole(u.assignment_id, e.target.value || null)}
                    className="min-w-[10rem]"
                  >
                    <option value="">Belum diberi role</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </Td>
                <Td align="center">
                  {u.disabled_at ? <Badge tone="danger">Dinonaktifkan</Badge> : <Badge tone="success">Aktif</Badge>}
                </Td>
                <Td align="right">
                  {u.can_impersonate ? (
                    <Button variant="ghost" className="px-2 py-1" onClick={() => doImpersonate(u.assignment_id)}>
                      Impersonate
                    </Button>
                  ) : '—'}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>ID Ecopa</Th>
              <Th align="right">Assign Role</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {(data?.unassigned_users ?? []).map((u) => (
              <Tr key={u.assignment_id}>
                <Td>
                  <div className="font-semibold text-text-strong">{u.name}</div>
                  <div className="text-xs text-text-muted">{u.email}</div>
                </Td>
                <Td className="font-mono text-xs text-text-muted">{u.ecopa_user_id ?? '—'}</Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    <Select
                      value={availableRole[u.user_id] ?? ''}
                      onChange={(e) => setAvailableRole((s) => ({ ...s, [u.user_id]: e.target.value }))}
                      className="min-w-[9rem]"
                    >
                      <option value="">Pilih role…</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                    <Button
                      className="px-3 py-1.5"
                      disabled={!availableRole[u.user_id] || assign.isPending}
                      onClick={() => assignTo(u.user_id, availableRole[u.user_id])}
                    >
                      Assign
                    </Button>
                  </div>
                </Td>
                <Td align="right">
                  {u.can_impersonate ? (
                    <Button variant="ghost" className="px-2 py-1" onClick={() => doImpersonate(u.assignment_id)}>
                      Impersonate
                    </Button>
                  ) : '—'}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="flex flex-col gap-2 border-t border-border-soft px-5 py-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-text-default">Assign via email (opsional)</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@perusahaan.com" />
        </div>
        <Select value={emailRole} onChange={(e) => setEmailRole(e.target.value)} className="sm:w-48">
          <option value="">Pilih role…</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Button onClick={assignViaEmail} disabled={!email || !emailRole || assign.isPending}>
          {assign.isPending && <Spinner />} Assign
        </Button>
      </div>
    </Card>
  );
}
