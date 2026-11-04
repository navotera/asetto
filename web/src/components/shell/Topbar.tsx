import { useLocation } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { api } from '@/api/client';
import { useColorMode, toggleColorMode } from '@/hooks/useColorMode';
import { navGroups } from './nav';

function currentTitle(pathname: string): string {
  for (const g of navGroups) {
    for (const item of g.items) {
      if (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) return item.label;
    }
  }
  return 'Asetto';
}

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { pathname } = useLocation();
  const { data: me } = useMe();
  const mode = useColorMode();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border-soft bg-topbar-bg/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-primary-light lg:hidden"
          aria-label="Menu"
        >
          ☰
        </button>
        <h2 className="text-sm font-semibold text-text-strong sm:text-base">{currentTitle(pathname)}</h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {api.mode === 'mock' && (
          <span className="hidden rounded-md bg-warning-light px-2 py-1 text-[11px] font-semibold text-warning sm:inline">
            MODE MOCK
          </span>
        )}
        <button
          onClick={toggleColorMode}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-primary-light"
          aria-label="Ganti tema"
          title={mode === 'dark' ? 'Mode terang' : 'Mode gelap'}
        >
          {mode === 'dark' ? '☀' : '☾'}
        </button>
        <div className="flex items-center gap-2.5 rounded-lg border border-border-soft px-2.5 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {me?.name?.slice(0, 1) ?? '?'}
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-xs font-semibold text-text-strong">{me?.name ?? '—'}</div>
            <div className="text-[10px] text-text-muted">{me?.roles?.[0] ?? 'Pengguna'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
