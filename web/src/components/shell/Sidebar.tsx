import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useCan } from '@/api/queries';
import { navGroups, type NavItem } from './nav';

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  // Match on path-segment boundaries so "/aset" stays active on "/aset/:id"
  // but NOT on a sibling like "/aset-saya".
  return (item.match ?? [item.href]).some((m) => pathname === m || pathname.startsWith(m + '/'));
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const { can } = useCan();

  const groups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((i) => !i.perm || can(i.perm)) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border-soft transition-transform',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{ background: 'var(--a-sidebar-gradient)' }}
    >
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-black text-white shadow-sm">
          A
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-text-strong">Asetto</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Manajemen Aset</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted/80">
              {group.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-default hover:bg-primary-light hover:text-primary',
                    )}
                  >
                    <span aria-hidden="true" className={cn('w-4 text-center text-base', active ? 'text-white' : 'text-text-muted')}>
                      {item.icon}
                    </span>
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-soft px-5 py-3 text-[10px] text-text-muted">
        Child app ekosistem Akunta · v0.1.0
      </div>
    </aside>
  );
}
