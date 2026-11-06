import { useRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { formatISODate } from '@/lib/format';

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-active shadow-sm',
  secondary: 'bg-card-bg text-text-default border border-border-default hover:bg-primary-light',
  ghost: 'text-text-muted hover:bg-primary-light hover:text-primary',
  danger: 'bg-danger text-white hover:brightness-95 shadow-sm',
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-card border border-border-soft bg-card-bg shadow-card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-soft px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-text-strong">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Badge
type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
const tones: Record<Tone, string> = {
  primary: 'bg-primary-light text-primary',
  success: 'bg-success-light text-success',
  danger: 'bg-danger-light text-danger',
  warning: 'bg-warning-light text-warning',
  info: 'bg-info-light text-info',
  neutral: 'bg-border-soft text-text-muted',
};
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- StatCard
export function StatCard({
  label,
  value,
  hint,
  tone = 'primary',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
        {icon && (
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-base', tones[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-text-strong">{value}</div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </Card>
  );
}

// ---------------------------------------------------------------- Page header
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-strong">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Fields
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-text-default">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

const fieldClass =
  'w-full rounded-lg border border-border-default bg-field-bg px-3 py-2 text-sm text-text-default outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, props.className)} />;
}

/** Group a whole-number value with thousand dots (Indonesian): 240000000 → "240.000.000". */
export function groupThousands(value: string | number): string {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digits === '') return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * A numeric text field that shows a thousand-separator mask (dots every 3
 * digits) while keeping the stored value digit-only. `onChange` receives an
 * `{ target: { value } }` with the raw digits, so it drops into the same
 * handlers a `type="number"` <Input> used.
 */
export function NumberInput({
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
}) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={groupThousands(value)}
      onChange={(e) => onChange({ target: { value: e.target.value.replace(/\D/g, '') } })}
      className={cn(fieldClass, props.className)}
    />
  );
}
/**
 * A date field that DISPLAYS the configured app date format (General settings)
 * while keeping its stored value as an ISO "YYYY-MM-DD" string. Selection uses
 * the native date picker, so `onChange` emits `{ target: { value } }` with the
 * ISO date — a drop-in for the `<Input type="date">` it replaces. The native
 * control is kept (transparent, on top) for accessibility and keyboard entry.
 */
export function DateInput({
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  className,
  disabled,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string | null | undefined;
  onChange: (e: { target: { value: string } }) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const iso = value ?? '';
  const display = formatISODate(iso);
  const openPicker = () => {
    const el = ref.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };
  return (
    <div
      className={cn(
        fieldClass,
        'relative flex cursor-pointer items-center gap-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      onClick={openPicker}
    >
      <span className={cn('flex-1 truncate', !display && 'text-text-muted')}>{display || placeholder}</span>
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-text-muted"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <input
        {...props}
        ref={ref}
        type="date"
        value={iso}
        disabled={disabled}
        onChange={(e) => onChange({ target: { value: e.target.value } })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldClass, props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldClass, 'min-h-[72px]', props.className)} />;
}

// ---------------------------------------------------------------- Misc
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <div className="text-3xl opacity-50">{icon}</div>}
      <p className="text-sm font-semibold text-text-default">{title}</p>
      {description && <p className="max-w-sm text-xs text-text-muted">{description}</p>}
    </div>
  );
}

export function LoadingBlock({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
      <Spinner /> {label}
    </div>
  );
}
