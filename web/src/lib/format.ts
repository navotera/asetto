import { useSyncExternalStore } from 'react';

/** Rupiah, no decimals — matches how Akunta renders money in list views. */
export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

// ---------------------------------------------------------------------------
// Configurable date format (PHP-style tokens, Indonesian names)
// ---------------------------------------------------------------------------

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * App-wide date format (from General settings, default "d F Y"). Kept as a tiny
 * reactive store so changing it re-renders every date shown in the app, and
 * cached in localStorage so it applies from the first render after a reload
 * (restoreDateFormat() runs before mount) instead of flashing the default.
 */
let dateFormat = 'd F Y';
const DF_KEY = 'asetto:date-format';
const dfListeners = new Set<() => void>();

/** Called once from main.tsx before React mounts to avoid a flash of the default. */
export function restoreDateFormat() {
  try {
    const stored = localStorage.getItem(DF_KEY);
    if (stored && stored.trim()) dateFormat = stored.trim();
  } catch {
    /* private mode / blocked storage — ignore */
  }
}

export function setDateFormat(fmt: string | null | undefined) {
  if (!fmt || !fmt.trim()) return;
  const next = fmt.trim();
  if (next === dateFormat) return;
  dateFormat = next;
  try {
    localStorage.setItem(DF_KEY, next);
  } catch {
    /* ignore */
  }
  dfListeners.forEach((l) => l());
}

export function getDateFormat() {
  return dateFormat;
}

/** Subscribe to the app date format; re-renders the caller when it changes. */
export function useDateFormat(): string {
  return useSyncExternalStore(
    (cb) => {
      dfListeners.add(cb);
      return () => dfListeners.delete(cb);
    },
    () => dateFormat,
    () => dateFormat,
  );
}

/** Render a Date using a PHP-style format string (subset) with Indonesian names. */
export function formatWithPattern(d: Date, fmt: string): string {
  let out = '';
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i];
    if (c === '\\') {
      out += fmt[++i] ?? '';
      continue;
    }
    switch (c) {
      case 'd': out += pad(d.getDate()); break;
      case 'j': out += String(d.getDate()); break;
      case 'D': out += DAYS_SHORT[d.getDay()]; break;
      case 'l': out += DAYS[d.getDay()]; break;
      case 'F': out += MONTHS[d.getMonth()]; break;
      case 'M': out += MONTHS_SHORT[d.getMonth()]; break;
      case 'm': out += pad(d.getMonth() + 1); break;
      case 'n': out += String(d.getMonth() + 1); break;
      case 'Y': out += String(d.getFullYear()); break;
      case 'y': out += pad(d.getFullYear() % 100); break;
      case 'H': out += pad(d.getHours()); break;
      case 'i': out += pad(d.getMinutes()); break;
      case 's': out += pad(d.getSeconds()); break;
      default: out += c;
    }
  }
  return out;
}

/** Parse a date-only "YYYY-MM-DD" (or any ISO) string as a LOCAL Date. */
export function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

/**
 * "YYYY-MM-DD" → the configured date format, parsed in local time.
 * Empty input → "" (for use inside form controls, unlike formatDate's "—").
 */
export function formatISODate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseLocalDate(iso);
  return Number.isNaN(d.getTime()) ? '' : formatWithPattern(d, dateFormat);
}

/** ISO date string → formatted per the configured date format (default "d F Y"). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatWithPattern(d, dateFormat);
}

/** ISO datetime → configured date format + " HH:mm". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatWithPattern(d, dateFormat + ' H:i');
}

/**
 * Asset age from an acquisition date to today, in Indonesian:
 * "3 tahun 2 bulan", "5 bulan", or "Baru" for under a month.
 */
export function formatAge(iso: string | null | undefined): string {
  if (!iso) return '—';
  const start = parseLocalDate(iso);
  if (Number.isNaN(start.getTime())) return '—';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return '—';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0 && rem === 0) return 'Baru';
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (rem > 0) parts.push(`${rem} bulan`);
  return parts.join(' ');
}

/** "2026-11" → "November 2026". */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  );
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`;
}
