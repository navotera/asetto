/**
 * Spreadsheet import/export for assets (Excel .xlsx / .csv) using SheetJS.
 *
 * The exported file is a valid import template: the same column set round-trips.
 * Parsing happens here in the browser; the parsed rows are posted to
 * `POST /assets/import` where the backend (or the mock store) is the
 * authoritative validator. Human-readable names/codes are used for entity,
 * category and custodian so the file is editable by hand; the importer resolves
 * them back to ids.
 */
import * as XLSX from 'xlsx';
import type { Asset, AssetCategory, Entity, DepreciationMethod, AssetCondition } from '@/api/types';

export interface SheetColumn {
  header: string;
  key: string;
}

/** The import/export column contract, in display order. */
export const ASSET_COLUMNS: SheetColumn[] = [
  { header: 'Kode', key: 'code' },
  { header: 'Nama Aset', key: 'name' },
  { header: 'Entitas', key: 'entity' },
  { header: 'Kategori', key: 'category' },
  { header: 'Tanggal Perolehan', key: 'acquisition_date' },
  { header: 'Nilai Perolehan', key: 'acquisition_cost' },
  { header: 'Nilai Residu', key: 'salvage_value' },
  { header: 'Masa Manfaat (bln)', key: 'useful_life_months' },
  { header: 'Metode Depresiasi', key: 'method' },
  { header: 'Kondisi', key: 'condition' },
  { header: 'Lokasi', key: 'location' },
  { header: 'Nomor Seri', key: 'serial_number' },
  { header: 'Catatan', key: 'notes' },
];

export const METHOD_EXPORT_LABELS: Record<DepreciationMethod, string> = {
  straight_line: 'Garis Lurus',
  declining_balance: 'Saldo Menurun',
  none: 'Tidak Didepresiasi',
};

export const CONDITION_EXPORT_LABELS: Record<AssetCondition, string> = {
  good: 'Baik',
  needs_repair: 'Perlu Perbaikan',
  broken: 'Rusak',
  idle: 'Tidak Terpakai',
};

export type RawRow = Record<string, string>;

interface Lookups {
  categories: AssetCategory[];
  entities: Entity[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a JS Date (from Excel) or an ISO-ish string to YYYY-MM-DD. */
function toDateString(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value ?? '').trim();
}

/** Header text (trimmed, lowercased) → our column key. Also accepts the key. */
function headerKeyMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const col of ASSET_COLUMNS) {
    map[col.header.toLowerCase()] = col.key;
    map[col.key.toLowerCase()] = col.key;
  }
  return map;
}

// --------------------------------------------------------------------------
// Export
// --------------------------------------------------------------------------

function assetToRow(asset: Asset, lk: Lookups): (string | number)[] {
  const entity = lk.entities.find((e) => e.id === asset.entity_id);
  const category = lk.categories.find((c) => c.id === asset.category_id);
  const money = (v: number | null | undefined) => (v === null || v === undefined ? '' : v);

  return [
    asset.code,
    asset.name,
    entity?.name ?? asset.entity_id,
    category?.name ?? '',
    asset.acquisition_date,
    money(asset.acquisition_cost),
    money(asset.salvage_value),
    asset.useful_life_months,
    METHOD_EXPORT_LABELS[asset.method] ?? asset.method,
    CONDITION_EXPORT_LABELS[asset.condition] ?? asset.condition,
    asset.location ?? '',
    asset.serial_number ?? '',
    asset.notes ?? '',
  ];
}

/** Build a reference sheet so hand-editors know the valid codes/names. */
function referenceSheet(lk: Lookups): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];
  rows.push(['Entitas (nama)']);
  for (const e of lk.entities) rows.push([e.name]);
  rows.push([]);
  rows.push(['Kategori (kode — nama)']);
  for (const c of lk.categories) rows.push([`${c.code} — ${c.name}`]);
  rows.push([]);
  rows.push(['Metode Depresiasi', ...Object.values(METHOD_EXPORT_LABELS)]);
  rows.push(['Kondisi', ...Object.values(CONDITION_EXPORT_LABELS)]);
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildWorkbook(dataRows: (string | number)[][], lk: Lookups): XLSX.WorkBook {
  const header = ASSET_COLUMNS.map((c) => c.header);
  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  ws['!cols'] = ASSET_COLUMNS.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aset');
  XLSX.utils.book_append_sheet(wb, referenceSheet(lk), 'Referensi');
  return wb;
}

/** Export the given assets to an .xlsx download. */
export function exportAssetsXlsx(assets: Asset[], lk: Lookups, filename?: string): void {
  const rows = assets.map((a) => assetToRow(a, lk));
  const wb = buildWorkbook(rows, lk);
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename ?? `aset-asetto-${stamp}.xlsx`);
}

/** Download an empty template (header + one example row + reference sheet). */
export function downloadTemplateXlsx(lk: Lookups): void {
  const exampleEntity = lk.entities[0]?.name ?? 'PT Contoh';
  const exampleCategory = lk.categories[0]?.code ?? 'KMP';
  const example: (string | number)[] = [
    '', // Kode — biarkan kosong agar dibuat otomatis
    'Contoh: Laptop Dell Latitude',
    exampleEntity,
    exampleCategory,
    new Date().toISOString().slice(0, 10),
    15000000,
    1000000,
    48,
    'Garis Lurus',
    'Baik',
    'Kantor Pusat — Lantai 3',
    'SN-CONTOH-001',
    '',
  ];
  const wb = buildWorkbook([example], lk);
  XLSX.writeFile(wb, 'template-impor-aset.xlsx');
}

// --------------------------------------------------------------------------
// Import (parse)
// --------------------------------------------------------------------------

/** Parse an uploaded .xlsx/.csv file into raw rows keyed by our column keys. */
export async function parseAssetFile(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
  if (matrix.length === 0) return [];

  const keyMap = headerKeyMap();
  const headerRow = (matrix[0] as unknown[]).map((h) => String(h ?? '').trim().toLowerCase());
  const colKeys = headerRow.map((h) => keyMap[h] ?? null);

  const rows: RawRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r] as unknown[];
    const row: RawRow = {};
    let hasValue = false;
    for (let c = 0; c < colKeys.length; c++) {
      const key = colKeys[c];
      if (!key) continue;
      const cell = cells[c];
      const value = key === 'acquisition_date' ? toDateString(cell) : String(cell ?? '').trim();
      if (value !== '') hasValue = true;
      row[key] = value;
    }
    if (hasValue) rows.push(row);
  }
  return rows;
}

// --------------------------------------------------------------------------
// Import result types (mirror the backend / mock response)
// --------------------------------------------------------------------------

export interface ImportRowResult {
  row: number;
  name: string;
  valid: boolean;
  errors: string[];
  resolved?: Record<string, unknown>;
}

export interface ImportResult {
  committed: boolean;
  created?: number;
  skipped?: number;
  summary: { total: number; valid: number; invalid: number };
  rows: ImportRowResult[];
}
