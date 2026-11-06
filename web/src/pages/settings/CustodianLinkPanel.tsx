import { useCustodians, useRoleManagement, useLinkCustodian, useAutoLinkCustodians } from '@/api/queries';
import { Card, CardHeader, Select, LoadingBlock, Button, Spinner } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast';

export function CustodianLinkPanel() {
  const { data: custodians, isLoading } = useCustodians();
  const { data: roleData } = useRoleManagement();
  const link = useLinkCustodian();
  const autoLink = useAutoLinkCustodians();
  const toast = useToast();

  // Candidate users = everyone synced from Ecopa (assigned + unassigned).
  const users = [
    ...(roleData?.users ?? []).map((u) => ({ id: u.user_id, name: u.name, email: u.email })),
    ...(roleData?.unassigned_users ?? []).map((u) => ({ id: u.user_id, name: u.name, email: u.email })),
  ];

  const persons = (custodians ?? []).filter((c) => c.type === 'person');

  async function setLink(custodianId: string, userId: string) {
    try {
      await link.mutateAsync({ custodian_id: custodianId, user_id: userId || null });
      toast('success', 'Tautan custodian diperbarui.');
    } catch {
      toast('error', 'Gagal menautkan custodian.');
    }
  }

  async function runAutoLink() {
    try {
      const res = await autoLink.mutateAsync();
      toast(res.linked > 0 ? 'success' : 'error', res.linked > 0 ? `${res.linked} custodian tertaut otomatis via email.` : 'Tidak ada custodian yang cocok via email.');
    } catch {
      toast('error', 'Gagal menautkan otomatis.');
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Tautan Custodian → User"
        subtitle="Tautkan personil (custodian) ke akun user Ecopa agar mereka melihat “Aset Saya”. Pakai email untuk menautkan otomatis."
        action={
          <Button variant="secondary" onClick={runAutoLink} disabled={autoLink.isPending}>
            {autoLink.isPending && <Spinner />} Tautkan otomatis via email
          </Button>
        }
      />
      {isLoading ? (
        <LoadingBlock />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Custodian (Personil)</Th>
              <Th>Email</Th>
              <Th>Departemen</Th>
              <Th align="right">Tautan User Ecopa</Th>
            </tr>
          </thead>
          <tbody>
            {persons.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <div className="font-semibold text-text-strong">{c.name}</div>
                  <div className="font-mono text-xs text-text-muted">{c.code}</div>
                </Td>
                <Td className="text-text-muted">{c.email ?? '—'}</Td>
                <Td>{c.department ?? '—'}</Td>
                <Td align="right">
                  <Select
                    value={c.user_id ?? ''}
                    onChange={(e) => setLink(c.id, e.target.value)}
                    className="min-w-[14rem]"
                  >
                    <option value="">— tidak tertaut —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </Select>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
