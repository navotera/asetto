import { useEffect, useMemo, useState } from 'react';
import { usePermissionMatrix, useSaveRoleMatrix } from '@/api/queries';
import { Card, CardHeader, Button, Badge, LoadingBlock, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { PermCatalogItem } from '@/api/types';

export function RoleMatrixPanel() {
  const { data, isLoading } = usePermissionMatrix();
  const save = useSaveRoleMatrix();
  const toast = useToast();

  // Draft permission sets per editable role code.
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (data) {
      const next: Record<string, string[]> = {};
      for (const r of data.roles) if (r.editable) next[r.code] = [...r.permissions];
      setDraft(next);
    }
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map<string, PermCatalogItem[]>();
    for (const p of data?.catalog ?? []) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    }
    return [...map.entries()];
  }, [data]);

  function toggle(roleCode: string, code: string) {
    setDraft((d) => {
      const set = new Set(d[roleCode] ?? []);
      set.has(code) ? set.delete(code) : set.add(code);
      return { ...d, [roleCode]: [...set] };
    });
  }

  function isDirty(roleCode: string, original: string[]) {
    const a = [...(draft[roleCode] ?? [])].sort().join(',');
    const b = [...original].sort().join(',');
    return a !== b;
  }

  async function saveRole(roleCode: string) {
    try {
      await save.mutateAsync({ role_code: roleCode, permissions: draft[roleCode] ?? [] });
      toast('success', 'Izin role disimpan.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menyimpan izin.');
    }
  }

  if (isLoading || !data) {
    return <Card className="lg:col-span-2"><LoadingBlock /></Card>;
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Role Management" subtitle="Atur izin tiap role. Admin memiliki semua izin." />
      <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-3">
        {data.roles.map((role) => (
          <div key={role.code} className="rounded-lg border border-border-soft">
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-text-strong">{role.name}</div>
                <div className="text-[11px] text-text-muted">{role.editable ? 'Dapat diatur' : 'Semua izin (bawaan)'}</div>
              </div>
              {!role.editable && <Badge tone="info">Admin</Badge>}
            </div>
            <div className="flex flex-col gap-3 px-4 py-3">
              {groups.map(([group, perms]) => (
                <div key={group}>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted/80">{group}</div>
                  <div className="flex flex-col gap-1.5">
                    {perms.map((p) => {
                      const checked = role.editable
                        ? (draft[role.code] ?? []).includes(p.code)
                        : true;
                      return (
                        <label key={p.code} className="flex items-start gap-2 text-sm text-text-default">
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-primary"
                            checked={checked}
                            disabled={!role.editable}
                            onChange={() => toggle(role.code, p.code)}
                          />
                          <span className="leading-tight">{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {role.editable && (
              <div className="flex justify-end border-t border-border-soft px-4 py-2.5">
                <Button
                  className="px-3 py-1.5"
                  disabled={!isDirty(role.code, role.permissions) || save.isPending}
                  onClick={() => saveRole(role.code)}
                >
                  {save.isPending && <Spinner />} Simpan {role.name}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
