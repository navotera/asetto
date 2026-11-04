import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { cn } from '@/lib/cn';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        className={cn(
          'w-full rounded-card border border-border-soft bg-card-bg shadow-pop',
          size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-text-strong">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="text-xl leading-none text-text-muted hover:text-text-default" aria-label="Tutup">
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border-soft px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
