import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ImpersonationBanner } from './ImpersonationBanner';

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );

  return (
    <div className="min-h-screen bg-page-bg">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        open={sidebarOpen}
        onNavigate={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
        }}
      />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', sidebarOpen ? 'lg:pl-64' : 'pl-0')}>
        <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <ImpersonationBanner />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
