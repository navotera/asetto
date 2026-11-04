import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { api } from '@/api/client';
import { useColorMode, setColorMode } from '@/hooks/useColorMode';
import { navGroups } from './nav';
import { EntitySwitcher } from './EntitySwitcher';

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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border-soft bg-topbar-bg/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-primary-light"
          aria-label="Sembunyikan/tampilkan menu"
          title="Sembunyikan/tampilkan menu"
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
        <EntitySwitcher />
        <UserMenu name={me?.name ?? '—'} email={me?.email} role={me?.role ?? me?.roles?.[0] ?? 'Pengguna'} />
      </div>
    </header>
  );
}

function UserMenu({ name, email, role }: { name: string; email?: string; role: string }) {
  const [open, setOpen] = useState(false);
  const mode = useColorMode();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg border border-border-soft px-2.5 py-1.5 hover:bg-primary-light"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu akun — ${name}`}
      >
        <div aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {name.slice(0, 1)}
        </div>
        <div className="hidden leading-tight text-left sm:block">
          <div className="text-xs font-semibold text-text-strong">{name}</div>
          <div className="text-[10px] text-text-muted">{role}</div>
        </div>
        <span aria-hidden="true" className="text-[10px] text-text-muted">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-border-soft bg-card-bg shadow-card">
          <div className="border-b border-border-soft px-4 py-3">
            <div className="text-sm font-semibold text-text-strong">{name}</div>
            {email && <div className="truncate text-xs text-text-muted">{email}</div>}
            <div className="mt-1 text-[11px] text-text-muted">Peran: {role}</div>
          </div>
          <div className="px-4 py-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted/80">Tema</div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setColorMode('light')}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${mode === 'light' ? 'border-primary bg-primary-light text-primary' : 'border-border-default text-text-muted hover:bg-primary-light'}`}
              >
                ☀ Terang
              </button>
              <button
                onClick={() => setColorMode('dark')}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${mode === 'dark' ? 'border-primary bg-primary-light text-primary' : 'border-border-default text-text-muted hover:bg-primary-light'}`}
              >
                ☾ Gelap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
