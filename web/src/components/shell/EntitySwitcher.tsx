import { useEffect, useRef, useState } from 'react';
import { useEntities, useMe, useCan } from '@/api/queries';
import { useActiveEntity } from '@/hooks/useActiveEntity';
import { EntityFormModal } from '@/pages/EntityFormModal';
import { cn } from '@/lib/cn';

/**
 * Active-entity switcher in the topbar (mirrors Akunta's workspace switcher,
 * contextual to Asetto's entities). Picking an entity scopes list views; admins
 * can add a new entity inline. Placed just before the user menu.
 */
export function EntitySwitcher() {
  const { data: entities } = useEntities();
  const { data: me } = useMe();
  const { can } = useCan();
  const { activeEntityId, setActiveEntityId } = useActiveEntity();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canManage = me?.app_role === 'admin' || can('settings.manage');
  const list = entities ?? [];
  const active = list.find((e) => e.id === activeEntityId) ?? null;
  const label = active?.name ?? 'Semua Entitas';
  const badge = active ? active.name.charAt(0).toUpperCase() : '∗';

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // If the active entity vanished (deleted elsewhere), fall back to "all".
  useEffect(() => {
    if (activeEntityId && entities && !entities.some((e) => e.id === activeEntityId)) {
      setActiveEntityId(null);
    }
  }, [activeEntityId, entities, setActiveEntityId]);

  function pick(id: string | null) {
    setActiveEntityId(id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-lg border border-border-soft bg-card-bg px-2.5 text-sm font-medium text-text-default hover:border-primary"
        aria-label={`Entitas aktif: ${label}. Ganti entitas`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded bg-primary/15 text-[11px] font-bold text-primary">
          {badge}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{label}</span>
        <span aria-hidden="true" className="text-[10px] text-text-muted">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-border-soft bg-card-bg shadow-card">
          <div className="border-b border-border-soft px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted/80">
            Pilih Entitas ({list.length})
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            <li>
              <button
                onClick={() => pick(null)}
                role="option"
                aria-selected={activeEntityId === null}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-primary-light',
                  activeEntityId === null ? 'font-semibold text-primary' : 'text-text-default',
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary">∗</span>
                <span className="flex-1">Semua Entitas</span>
                {activeEntityId === null && <span className="text-primary">✓</span>}
              </button>
            </li>
            {list.map((e) => {
              const selected = e.id === activeEntityId;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => pick(e.id)}
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-primary-light',
                      selected ? 'font-semibold text-primary' : 'text-text-default',
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary">
                      {e.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    {selected && <span className="text-primary">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {canManage && (
            <div className="border-t border-border-soft p-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  setAddOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-primary-light"
              >
                <span className="text-base leading-none">＋</span> Tambah Entitas
              </button>
            </div>
          )}
        </div>
      )}

      <EntityFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(e) => setActiveEntityId(e.id)} />
    </div>
  );
}
