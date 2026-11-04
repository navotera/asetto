import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface KebabItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** A ⋮ (kebab) button that opens a small dropdown of actions. */
export function KebabMenu({ items, label = 'Aksi' }: { items: KebabItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
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
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-primary-light hover:text-text-default"
        aria-label={label}
        title={label}
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-36 overflow-hidden rounded-lg border border-border-soft bg-card-bg py-1 shadow-card">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={cn(
                'block w-full px-3 py-2 text-left text-sm hover:bg-primary-light',
                it.danger ? 'text-danger' : 'text-text-default',
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
