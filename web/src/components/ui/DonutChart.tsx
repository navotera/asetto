/** Lightweight themeable donut/pie chart (inline SVG, no chart library). */

export interface DonutSegment {
  label: string;
  value: number;
  /** CSS color — use the theme variables, e.g. 'var(--a-primary)'. */
  color: string;
}

/** Categorical palette (reads well in light + dark). */
export const CHART_PALETTE = [
  'var(--a-primary)',
  'var(--a-info)',
  'var(--a-warning)',
  'var(--a-success)',
  '#0ea5e9',
  '#f97316',
  '#8b5cf6',
  '#ec4899',
];

export function DonutChart({
  segments,
  size = 184,
  thickness = 30,
  centerLabel,
  centerValue,
  formatValue = (v) => String(v),
  emptyLabel = 'Tidak ada data',
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  formatValue?: (v: number) => string;
  emptyLabel?: string;
}) {
  const data = segments.filter((s) => s.value > 0);
  const total = data.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const cx = size / 2;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 px-5 py-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={centerLabel}>
          <g transform={`rotate(-90 ${cx} ${cx})`}>
            {total === 0 ? (
              <circle cx={cx} cy={cx} r={radius} fill="none" stroke="var(--a-border-soft)" strokeWidth={thickness} />
            ) : (
              data.map((s, i) => {
                const dash = (s.value / total) * circ;
                const el = (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cx}
                    r={radius}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${circ - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return el;
              })
            )}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue !== undefined && (
            <span className="text-lg font-bold tracking-tight text-text-strong">{centerValue}</span>
          )}
          {centerLabel && <span className="mt-0.5 text-[11px] font-medium text-text-muted">{centerLabel}</span>}
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {data.length === 0 ? (
          <li className="text-sm text-text-muted">{emptyLabel}</li>
        ) : (
          data.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-text-default">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="shrink-0 font-semibold text-text-strong">{formatValue(s.value)}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
