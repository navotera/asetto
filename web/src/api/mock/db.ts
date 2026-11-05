/**
 * In-browser mock database for the Asetto SPA.
 *
 * It mirrors the *real* flow: an economic event (acquisition, depreciation,
 * disposal) is emitted to Akunta's Auto Mapping ingest as raw business JSON —
 * NO account codes; the Akunta admin maps fields → accounts once per
 * `source_type`. Here that ingest lands in an in-memory "outbox" with an
 * idempotency key (queued → accepted), so the whole flow is visible without a
 * backend.
 */
import type {
  Asset,
  AssetCategory,
  Custodian,
  DashboardSummary,
  DepreciationLine,
  DepreciationRun,
  Disposal,
  DisposalType,
  Entity,
  JournalEntry,
  Me,
} from '../types';

let seq = 1000;
const id = (prefix: string) => `${prefix}_${++seq}`;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

// Companies the assets belong to. The id is Asetto's own, human-readable slug
// (e.g. "PT Guna Dharma" → ent_guna_dharma_x7k2); Akunta maps it via Auto Mapping.
const entities: Entity[] = [
  { id: 'ent_asetto_nusantara', name: 'PT Asetto Nusantara' },
  { id: 'ent_mitra_sejahtera', name: 'PT Mitra Sejahtera' },
];

/** Readable, unique entity id derived from the name — mirrors the backend. */
function entitySlugId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\b(pt|cv|ud|pd|tbk|persero)\b\.?/g, ' ') // drop legal-form words
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const slug = (base || 'entitas').slice(0, 24).replace(/_+$/, '');
  let candidate = `ent_${slug}_${Math.random().toString(36).slice(2, 6)}`;
  while (entities.some((e) => e.id === candidate)) {
    candidate = `ent_${slug}_${Math.random().toString(36).slice(2, 6)}`;
  }
  return candidate;
}

const categories: AssetCategory[] = [
  { id: 'cat_kendaraan', code: 'KND', name: 'Kendaraan', default_method: 'straight_line', default_useful_life_months: 96 },
  { id: 'cat_komputer', code: 'KMP', name: 'Komputer & IT', default_method: 'declining_balance', default_useful_life_months: 48 },
  { id: 'cat_mebel', code: 'MBL', name: 'Mebel & Perlengkapan', default_method: 'straight_line', default_useful_life_months: 60 },
  { id: 'cat_mesin', code: 'MSN', name: 'Mesin Produksi', default_method: 'straight_line', default_useful_life_months: 120 },
];

const custodians: Custodian[] = [
  { id: 'cus_ops', type: 'entity', code: 'DEPT-OPS', name: 'Divisi Operasional' },
  { id: 'cus_it', type: 'entity', code: 'DEPT-IT', name: 'Divisi Teknologi' },
  { id: 'cus_fin', type: 'entity', code: 'DEPT-FIN', name: 'Divisi Keuangan' },
  { id: 'cus_budi', type: 'person', code: 'EMP-0012', name: 'Budi Santoso', department: 'Operasional' },
  { id: 'cus_sari', type: 'person', code: 'EMP-0048', name: 'Sari Wijaya', department: 'Teknologi' },
];

function seedAsset(
  partial: Omit<Asset, 'accumulated_depreciation' | 'book_value' | 'status' | 'last_depreciated_period' | 'entity_id'> &
    Partial<Pick<Asset, 'accumulated_depreciation' | 'last_depreciated_period' | 'entity_id'>>,
): Asset {
  const accumulated = partial.accumulated_depreciation ?? 0;
  return {
    status: 'active',
    last_depreciated_period: null,
    entity_id: entities[0].id,
    ...partial,
    accumulated_depreciation: accumulated,
    book_value: partial.acquisition_cost - accumulated,
  };
}

const assets: Asset[] = [
  seedAsset({
    id: 'ast_1',
    code: 'AST-0001',
    name: 'Toyota Avanza B 1234 XYZ',
    category_id: 'cat_kendaraan',
    acquisition_date: '2023-02-10',
    acquisition_cost: 240_000_000,
    salvage_value: 24_000_000,
    useful_life_months: 96,
    method: 'straight_line',
    condition: 'good',
    custodian_id: 'cus_ops',
    location: 'Kantor Pusat — Jakarta',
    serial_number: 'VIN-AVZ-2023-0098',
    accumulated_depreciation: 72_000_000,
    last_depreciated_period: '2026-10',
  }),
  seedAsset({
    id: 'ast_2',
    code: 'AST-0002',
    name: 'MacBook Pro 14 M3',
    entity_id: 'ent_mitra_sejahtera',
    category_id: 'cat_komputer',
    acquisition_date: '2024-06-01',
    acquisition_cost: 38_000_000,
    salvage_value: 3_000_000,
    useful_life_months: 48,
    method: 'declining_balance',
    condition: 'good',
    custodian_id: 'cus_sari',
    location: 'Kantor Pusat — Jakarta',
    serial_number: 'C02-MBP-7781',
    accumulated_depreciation: 11_200_000,
    last_depreciated_period: '2026-10',
  }),
  seedAsset({
    id: 'ast_3',
    code: 'AST-0003',
    name: 'Meja Kerja Eksekutif (set 10)',
    category_id: 'cat_mebel',
    acquisition_date: '2022-09-15',
    acquisition_cost: 45_000_000,
    salvage_value: 2_000_000,
    useful_life_months: 60,
    method: 'straight_line',
    condition: 'needs_repair',
    custodian_id: 'cus_fin',
    location: 'Kantor Pusat — Lantai 3',
    accumulated_depreciation: 36_833_333,
    last_depreciated_period: '2026-10',
  }),
  seedAsset({
    id: 'ast_4',
    code: 'AST-0004',
    name: 'Mesin CNC Router 1325',
    category_id: 'cat_mesin',
    acquisition_date: '2021-11-20',
    acquisition_cost: 520_000_000,
    salvage_value: 40_000_000,
    useful_life_months: 120,
    method: 'straight_line',
    condition: 'good',
    custodian_id: 'cus_ops',
    location: 'Pabrik — Bekasi',
    serial_number: 'CNC-1325-0442',
    accumulated_depreciation: 236_000_000,
    last_depreciated_period: '2026-10',
  }),
  seedAsset({
    id: 'ast_5',
    code: 'AST-0005',
    name: 'Server Dell PowerEdge R760',
    entity_id: 'ent_mitra_sejahtera',
    category_id: 'cat_komputer',
    acquisition_date: '2025-01-05',
    acquisition_cost: 95_000_000,
    salvage_value: 8_000_000,
    useful_life_months: 48,
    method: 'declining_balance',
    condition: 'good',
    custodian_id: 'cus_it',
    location: 'Ruang Server — Jakarta',
    serial_number: 'DELL-R760-1180',
    accumulated_depreciation: 28_900_000,
    last_depreciated_period: '2026-10',
  }),
  seedAsset({
    id: 'ast_6',
    code: 'AST-0006',
    name: 'Forklift Toyota 2.5T',
    category_id: 'cat_mesin',
    acquisition_date: '2020-03-12',
    acquisition_cost: 310_000_000,
    salvage_value: 25_000_000,
    useful_life_months: 120,
    method: 'straight_line',
    condition: 'idle',
    custodian_id: 'cus_ops',
    location: 'Gudang — Bekasi',
    accumulated_depreciation: 190_000_000,
    last_depreciated_period: '2026-10',
  }),
];

// --- Dummy bulk data (dev only) — to eyeball long lists / pagination. ---
// Remove this block to go back to the 6 hand-written seed assets.
const DUMMY_NAMES = [
  'Laptop Lenovo ThinkPad', 'Monitor LG 27"', 'Printer Canon', 'Meja Kerja', 'Kursi Ergonomis',
  'AC Daikin 1PK', 'Proyektor Epson', 'Router Mikrotik', 'Server HP ProLiant', 'Scanner Fujitsu',
  'Kamera CCTV Hikvision', 'Genset Honda', 'Forklift Hyster', 'Mobil Operasional', 'Motor Dinas',
];
const DUMMY_CONDITIONS: Asset['condition'][] = ['good', 'good', 'good', 'needs_repair', 'idle', 'broken'];
for (let i = 0; i < 100; i++) {
  const n = i + 7;
  const cat = categories[i % categories.length];
  const cust = custodians[i % custodians.length];
  const ent = entities[i % entities.length];
  const baseCost = 2_000_000 + (i % 25) * 1_500_000;
  const year = 2019 + (i % 7);
  const month = (i % 12) + 1;
  assets.push(
    seedAsset({
      id: `ast_${n}`,
      code: `AST-${String(n).padStart(4, '0')}`,
      name: `${DUMMY_NAMES[i % DUMMY_NAMES.length]} ${n}`,
      entity_id: ent.id,
      category_id: cat.id,
      acquisition_date: `${year}-${String(month).padStart(2, '0')}-15`,
      acquisition_cost: baseCost,
      salvage_value: Math.round(baseCost * 0.1),
      useful_life_months: cat.default_useful_life_months,
      method: cat.default_method,
      condition: DUMMY_CONDITIONS[i % DUMMY_CONDITIONS.length],
      custodian_id: cust.id,
      location: `Lokasi ${1 + (i % 5)}`,
      accumulated_depreciation: Math.round((baseCost * (i % 7)) / 10),
      last_depreciated_period: '2026-10',
    }),
  );
}

const runs: DepreciationRun[] = [];
const disposals: Disposal[] = [];
const journals: JournalEntry[] = [];

// --- asset control center (mock, in-memory) ---
const custodyHistory: Record<string, any[]> = {};
const assetPhotos: Record<string, any[]> = {};
const assetPurchases: Record<string, any> = {};
const settings = { mode: 'auto_post' as 'auto_post' | 'draft', disk: 'public', disks: ['public', 's3'] };

// Mock Ecopa integration state — starts unconfigured so the setup wizard is
// visible in mock mode; registering simulates an instant approval.
let integration = {
  configured: false,
  integration_status: null as 'on' | 'off' | null,
  registration_status: null as 'pending' | 'active' | 'rejected' | null,
  registration_message: null as string | null,
  name: 'Asetto',
  slug: 'asetto',
  ecopa_url: 'https://home.opensynergic.com',
  base_url: '',
  redirect_uri: '',
  webhook_url: '',
  sso_ready: false,
  webhook_ready: false,
};

const custodianNameById = (id: string | null) => custodians.find((c) => c.id === id)?.name ?? null;

const assetAudit: Record<string, any[]> = {};
function auditPush(assetId: string, action: string, description: string) {
  (assetAudit[assetId] ??= []).push({
    id: id('aud'),
    action,
    description,
    actor_name: 'Dede Nugroho',
    created_at: new Date().toISOString(),
  });
}

const PERMISSION_CATALOG = [
  { code: 'asset.read', group: 'Aset', label: 'Lihat daftar & detail aset' },
  { code: 'asset.read_own', group: 'Aset', label: 'Lihat aset tanggung jawab sendiri' },
  { code: 'asset.view_value', group: 'Aset', label: 'Lihat nilai & angka aset' },
  { code: 'asset.manage', group: 'Aset', label: 'Kelola aset' },
  { code: 'disposal.manage', group: 'Aset', label: 'Pelepasan & penjualan aset' },
  { code: 'depreciation.run', group: 'Depresiasi', label: 'Jalankan & setujui depresiasi' },
  { code: 'journal.read', group: 'Integrasi', label: 'Lihat outbox jurnal Akunta' },
  { code: 'settings.manage', group: 'Pengaturan', label: 'Kelola pengaturan, role, & custodian' },
];
const ALL_CODES = PERMISSION_CATALOG.map((p) => p.code);

const me: Me = {
  id: 'usr_1',
  name: 'Dede Nugroho',
  email: 'dede.nugroho@leconfe.com',
  app_role: 'admin',
  roles: ['Admin'],
  role: 'Admin',
  permissions: ALL_CODES,
  is_impersonating: false,
  impersonator: null,
};

// Mock role-permission state (admin bypasses — shown as all).
const rolePerms: Record<string, string[]> = {
  asset_manager: ['asset.read', 'asset.view_value', 'asset.manage', 'disposal.manage', 'depreciation.run', 'journal.read'],
  asset_user: ['asset.read_own'],
};

// ---------------------------------------------------------------------------
// Depreciation engine
// ---------------------------------------------------------------------------

/** Monthly depreciation for a single asset given its current book value. */
function monthlyDepreciation(asset: Asset): number {
  if (asset.method === 'none' || asset.status === 'disposed') return 0;
  const depreciableFloor = asset.salvage_value;
  const remaining = asset.book_value - depreciableFloor;
  if (remaining <= 0) return 0;

  let amount: number;
  if (asset.method === 'straight_line') {
    amount = (asset.acquisition_cost - asset.salvage_value) / asset.useful_life_months;
  } else {
    // Double-declining on current book value, expressed monthly.
    const annualRate = 2 / (asset.useful_life_months / 12);
    amount = (asset.book_value * annualRate) / 12;
  }
  // Never depreciate below the salvage floor in the final month.
  return Math.round(clamp(amount, 0, remaining));
}

function nextPeriodFor(asset: Asset): string {
  if (!asset.last_depreciated_period) {
    const d = new Date(asset.acquisition_date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const [y, m] = asset.last_depreciated_period.split('-').map(Number);
  const nd = new Date(y, m, 1); // m is 1-based → this is the following month
  return `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
}

/** The earliest period that still has at least one asset awaiting depreciation. */
function pendingPeriod(): string | null {
  const periods = assets
    .filter((a) => a.status === 'active' && a.method !== 'none' && a.book_value > a.salvage_value)
    .map(nextPeriodFor)
    .sort();
  return periods[0] ?? null;
}

function buildRunLines(period: string): DepreciationLine[] {
  const lines: DepreciationLine[] = [];
  for (const asset of assets) {
    if (asset.status !== 'active' || asset.method === 'none') continue;
    if (nextPeriodFor(asset) !== period) continue;
    const amount = monthlyDepreciation(asset);
    if (amount <= 0) continue;
    const category = categories.find((c) => c.id === asset.category_id)!;
    lines.push({
      asset_id: asset.id,
      asset_code: asset.code,
      asset_name: asset.name,
      category_name: category.name,
      amount,
      book_value_before: asset.book_value,
      book_value_after: asset.book_value - amount,
    });
  }
  return lines;
}

const entityName = (entityId: string) => entities.find((e) => e.id === entityId)?.name ?? entityId;

/** Create an outbox event (Auto Mapping ingest payload) and try to deliver it. */
function emitEvent(
  e: {
    source: JournalEntry['source'];
    source_type: string;
    source_ref: string;
    entity_id: string;
    idempotency_key: string;
    date: string;
    memo: string;
    payload: Record<string, unknown>;
  },
  forceOk = false,
): JournalEntry {
  const now = new Date().toISOString();
  const journal: JournalEntry = {
    id: id('jrn'),
    idempotency_key: e.idempotency_key,
    source: e.source,
    source_type: e.source_type,
    source_ref: e.source_ref,
    entity_id: e.entity_id,
    date: e.date,
    memo: e.memo,
    status: 'queued',
    akunta_raw_id: null,
    payload: e.payload,
    last_error: null,
    created_at: now,
    posted_at: null,
  };
  pushToAkunta(journal, forceOk);
  journals.push(journal);
  return journal;
}

/** One depreciation event per (entity × category), mirroring the backend. */
function emitDepreciationEvents(run: DepreciationRun) {
  const byGroup = new Map<string, { entity_id: string; category: AssetCategory; amount: number }>();
  for (const line of run.lines) {
    const asset = assets.find((a) => a.id === line.asset_id)!;
    const category = categories.find((c) => c.id === asset.category_id)!;
    const key = `${asset.entity_id}|${category.id}`;
    const g = byGroup.get(key) ?? { entity_id: asset.entity_id, category, amount: 0 };
    g.amount += line.amount;
    byGroup.set(key, g);
  }
  const [y, m] = run.period.split('-').map(Number);
  const date = new Date(y, m, 0).toISOString().slice(0, 10); // last day of the period
  for (const g of byGroup.values()) {
    if (g.amount <= 0) continue;
    const memo = `Depresiasi ${g.category.name} periode ${run.period}`;
    emitEvent({
      source: 'depreciation',
      source_type: 'asetto.depreciation',
      source_ref: run.id,
      entity_id: g.entity_id,
      idempotency_key: `asetto:dep:${g.entity_id}:${run.period}:${g.category.code}`,
      date,
      memo,
      payload: {
        event: 'depreciation',
        period: run.period,
        category_code: g.category.code,
        category_name: g.category.name,
        entity: entityName(g.entity_id),
        date,
        amount: g.amount,
        memo,
      },
    });
  }
}

/** Simulate ingest to Akunta. ~1 in 12 queued pushes "fail" so the retry UI has
 *  something to show; retry always succeeds (202 → accepted + raw_id). */
function pushToAkunta(journal: JournalEntry, forceOk = false) {
  const ok = forceOk || Math.random() > 0.08;
  if (ok) {
    journal.status = 'accepted';
    journal.akunta_raw_id = `raw_${new Date().getFullYear()}_${String(++seq).padStart(5, '0')}`;
    journal.last_error = null;
    journal.posted_at = new Date().toISOString();
  } else {
    journal.status = 'failed';
    journal.last_error = 'Akunta tidak merespons (simulasi offline).';
  }
}

// ---------------------------------------------------------------------------
// Derived / summary
// ---------------------------------------------------------------------------

function categoryName(categoryId: string) {
  return categories.find((c) => c.id === categoryId)?.name ?? '—';
}

function dashboard(): DashboardSummary {
  const active = assets.filter((a) => a.status === 'active');
  const conditionBreakdown = { good: 0, needs_repair: 0, broken: 0, idle: 0 };
  for (const a of active) conditionBreakdown[a.condition] += 1;

  const byCat = new Map<string, number>();
  for (const a of active) byCat.set(categoryName(a.category_id), (byCat.get(categoryName(a.category_id)) ?? 0) + a.book_value);

  const thisYear = new Date().getFullYear();
  return {
    asset_count: assets.length,
    active_count: active.length,
    total_acquisition_cost: active.reduce((s, a) => s + a.acquisition_cost, 0),
    total_book_value: active.reduce((s, a) => s + a.book_value, 0),
    total_accumulated_depreciation: active.reduce((s, a) => s + a.accumulated_depreciation, 0),
    disposed_this_year: disposals.filter((d) => new Date(d.date).getFullYear() === thisYear).length,
    condition_breakdown: conditionBreakdown,
    pending_depreciation_period: pendingPeriod(),
    akunta_queued: journals.filter((j) => j.status !== 'accepted').length,
    recent_journals: [...journals].reverse().slice(0, 5),
    book_value_by_category: [...byCat.entries()].map(([category, book_value]) => ({ category, book_value })),
  };
}

// ---------------------------------------------------------------------------
// Bulk import (mirrors backend AssetImportController)
// ---------------------------------------------------------------------------

const METHOD_IMPORT_LABELS: Record<string, Asset['method']> = {
  'garis lurus': 'straight_line',
  straight_line: 'straight_line',
  'saldo menurun': 'declining_balance',
  declining_balance: 'declining_balance',
  'tidak didepresiasi': 'none',
  'tanpa depresiasi': 'none',
  none: 'none',
};

const CONDITION_IMPORT_LABELS: Record<string, Asset['condition']> = {
  baik: 'good',
  good: 'good',
  'perlu perbaikan': 'needs_repair',
  needs_repair: 'needs_repair',
  rusak: 'broken',
  broken: 'broken',
  'tidak terpakai': 'idle',
  idle: 'idle',
};

function parseAmount(text: string): number | null {
  const clean = String(text ?? '').replace(/[^0-9-]/g, '');
  if (clean === '' || clean === '-') return null;
  return Number(clean);
}

function parseDate(text: string): string | null {
  const t = String(text ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return isValidDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return isValidDate(+y, +mo, +d) ? `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}` : null;
  }
  return null;
}

function isValidDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function resolveImportRow(raw: Record<string, string>): { data: Record<string, any>; errors: string[] } {
  const errors: string[] = [];
  const data: Record<string, any> = {};
  const get = (k: string) => String(raw[k] ?? '').trim();
  const lc = (s: string) => s.toLowerCase();

  data.code = get('code');

  const name = get('name');
  if (!name) errors.push('Nama aset wajib diisi.');
  data.name = name;

  const entityText = get('entity');
  if (!entityText) errors.push('Entitas wajib diisi.');
  else {
    const e = entities.find((x) => x.id === entityText || lc(x.name) === lc(entityText));
    if (!e) errors.push(`Entitas "${entityText}" tidak dikenal.`);
    else data.entity_id = e.id;
  }

  const categoryText = get('category');
  if (!categoryText) errors.push('Kategori wajib diisi.');
  else {
    const c = categories.find(
      (x) => x.id === categoryText || lc(x.code) === lc(categoryText) || lc(x.name) === lc(categoryText),
    );
    if (!c) errors.push(`Kategori "${categoryText}" tidak dikenal.`);
    else data.category_id = c.id;
  }

  const dateText = get('acquisition_date');
  if (!dateText) errors.push('Tanggal perolehan wajib diisi.');
  else {
    const d = parseDate(dateText);
    if (!d) errors.push(`Tanggal perolehan "${dateText}" tidak valid (gunakan YYYY-MM-DD).`);
    else data.acquisition_date = d;
  }

  const costText = get('acquisition_cost');
  if (!costText) errors.push('Nilai perolehan wajib diisi.');
  else {
    const v = parseAmount(costText);
    if (v === null || v < 0) errors.push(`Nilai perolehan "${costText}" tidak valid.`);
    else data.acquisition_cost = v;
  }

  const salvageText = get('salvage_value');
  if (!salvageText) data.salvage_value = 0;
  else {
    const v = parseAmount(salvageText);
    if (v === null || v < 0) errors.push(`Nilai residu "${salvageText}" tidak valid.`);
    else data.salvage_value = v;
  }

  const lifeText = get('useful_life_months');
  if (!lifeText) data.useful_life_months = 60;
  else {
    const v = parseAmount(lifeText);
    if (v === null || v < 1) errors.push(`Masa manfaat "${lifeText}" tidak valid.`);
    else data.useful_life_months = v;
  }

  const methodText = get('method');
  if (!methodText) data.method = 'straight_line';
  else if (METHOD_IMPORT_LABELS[lc(methodText)]) data.method = METHOD_IMPORT_LABELS[lc(methodText)];
  else errors.push(`Metode "${methodText}" tidak dikenal (Garis Lurus / Saldo Menurun / Tidak Didepresiasi).`);

  const conditionText = get('condition');
  if (!conditionText) data.condition = 'good';
  else if (CONDITION_IMPORT_LABELS[lc(conditionText)]) data.condition = CONDITION_IMPORT_LABELS[lc(conditionText)];
  else errors.push(`Kondisi "${conditionText}" tidak dikenal (Baik / Perlu Perbaikan / Rusak / Tidak Terpakai).`);

  const custodianText = get('custodian');
  if (!custodianText) data.custodian_id = null;
  else {
    const c = custodians.find(
      (x) => x.id === custodianText || lc(x.code) === lc(custodianText) || lc(x.name) === lc(custodianText),
    );
    if (!c) errors.push(`Penanggung jawab "${custodianText}" tidak dikenal.`);
    else data.custodian_id = c.id;
  }

  data.location = get('location');
  data.serial_number = get('serial_number') || undefined;
  data.notes = get('notes') || undefined;

  return { data, errors };
}

// ---------------------------------------------------------------------------
// Public store API (used by the mock router)
// ---------------------------------------------------------------------------

export const db = {
  me: () => me,
  categories: () => categories.map((c) => ({ ...c, asset_count: assets.filter((a) => a.category_id === c.id).length })),
  custodians: () => custodians,
  entities: () => entities,
  createEntity(input: { name?: string }): Entity {
    const name = input.name?.trim() || 'Entitas Baru';
    const e: Entity = { id: entitySlugId(name), name };
    entities.push(e);
    return e;
  },

  createCategory(input: Partial<AssetCategory>): AssetCategory {
    const c: AssetCategory = {
      id: id('cat'),
      code: input.code || `CAT-${categories.length + 1}`,
      name: input.name || 'Kategori Baru',
      default_method: input.default_method || 'straight_line',
      default_useful_life_months: input.default_useful_life_months ?? 60,
    };
    categories.push(c);
    return c;
  },
  updateCategory(categoryId: string, input: Partial<AssetCategory>): AssetCategory {
    const c = categories.find((x) => x.id === categoryId);
    if (!c) throw new ApiMockError(404, 'Kategori tidak ditemukan');
    Object.assign(c, input);
    return c;
  },
  deleteCategory(categoryId: string) {
    if (assets.some((a) => a.category_id === categoryId)) {
      throw new ApiMockError(422, 'Kategori masih dipakai aset — tidak dapat dihapus.');
    }
    const i = categories.findIndex((x) => x.id === categoryId);
    if (i !== -1) categories.splice(i, 1);
    return { ok: true };
  },

  /**
   * Asset list. Without `page`/`per_page` returns the full (sorted) array —
   * used by reports & pickers. With them, applies filters + sort and returns a
   * paginated envelope { items, page, per_page, total, last_page }. Mirrors the
   * backend AssetController@index exactly.
   */
  listAssets(params: Record<string, string> = {}) {
    let list = [...assets];

    const search = (params.search ?? '').toLowerCase().trim();
    if (search) list = list.filter((a) => a.name.toLowerCase().includes(search) || a.code.toLowerCase().includes(search));
    if (params.category_id) list = list.filter((a) => a.category_id === params.category_id);
    if (params.status) list = list.filter((a) => a.status === params.status);
    if (params.condition) list = list.filter((a) => a.condition === params.condition);
    if (params.custodian_id) list = list.filter((a) => (a.custodian_id ?? '') === params.custodian_id);
    if (params.entity_id) list = list.filter((a) => a.entity_id === params.entity_id);

    const accessors: Record<string, (a: Asset) => string | number> = {
      code: (a) => a.code,
      name: (a) => a.name.toLowerCase(),
      category: (a) => categoryName(a.category_id).toLowerCase(),
      custodian: (a) => (custodianNameById(a.custodian_id) ?? '').toLowerCase(),
      acquisition_cost: (a) => a.acquisition_cost ?? 0,
      book_value: (a) => a.book_value ?? 0,
      condition: (a) => a.condition,
      status: (a) => a.status,
    };
    const acc = accessors[params.sort ?? 'code'] ?? accessors.code;
    const dir = params.dir === 'desc' ? -1 : 1;
    list.sort((x, y) => {
      const av = acc(x), bv = acc(y);
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });

    const paginated = params.page !== undefined || params.per_page !== undefined;
    if (!paginated) return list;

    const perPage = Math.min(100, Math.max(1, Number(params.per_page) || 25));
    const page = Math.max(1, Number(params.page) || 1);
    const total = list.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const start = (page - 1) * perPage;
    return { items: list.slice(start, start + perPage), page, per_page: perPage, total, last_page: lastPage };
  },
  getAsset: (assetId: string) => assets.find((a) => a.id === assetId) ?? null,

  createAsset(input: Partial<Asset>): Asset {
    const n = assets.length + 1;
    const asset = seedAsset({
      id: id('ast'),
      code: input.code || `AST-${String(n).padStart(4, '0')}`,
      name: input.name || 'Aset Baru',
      entity_id: input.entity_id || entities[0].id,
      category_id: input.category_id || categories[0].id,
      acquisition_date: input.acquisition_date || new Date().toISOString().slice(0, 10),
      acquisition_cost: input.acquisition_cost ?? 0,
      salvage_value: input.salvage_value ?? 0,
      useful_life_months: input.useful_life_months ?? 60,
      method: input.method || 'straight_line',
      condition: input.condition || 'good',
      custodian_id: input.custodian_id ?? null,
      location: input.location || '—',
      serial_number: input.serial_number,
      notes: input.notes,
    });
    assets.push(asset);
    auditPush(asset.id, 'created', 'Aset dibuat.');
    return asset;
  },

  importAssets(rows: Record<string, string>[], commit: boolean) {
    const existingCodes = new Set(assets.map((a) => a.code.toLowerCase()));
    const seenCodes = new Map<string, number>();

    const results = rows.map((raw, i) => {
      const { data, errors } = resolveImportRow(raw ?? {});
      const code = String(data.code ?? '').toLowerCase();
      if (code) {
        if (existingCodes.has(code)) errors.push('Kode sudah dipakai aset lain.');
        else if (seenCodes.has(code)) errors.push(`Kode ganda di dalam berkas (baris ${(seenCodes.get(code) ?? 0) + 1}).`);
        else seenCodes.set(code, i);
      }
      return { row: i + 1, input: raw, name: data.name ?? (raw?.name ?? ''), resolved: data, errors, valid: errors.length === 0 };
    });

    const valid = results.filter((r) => r.valid);
    const summary = { total: results.length, valid: valid.length, invalid: results.length - valid.length };

    if (!commit) return { committed: false, summary, rows: results };

    let created = 0;
    for (const r of valid) {
      const d = r.resolved;
      db.createAsset({
        code: d.code || undefined,
        name: d.name,
        entity_id: d.entity_id,
        category_id: d.category_id,
        acquisition_date: d.acquisition_date,
        acquisition_cost: d.acquisition_cost,
        salvage_value: d.salvage_value,
        useful_life_months: d.useful_life_months,
        method: d.method,
        condition: d.condition,
        custodian_id: d.custodian_id,
        location: d.location,
        serial_number: d.serial_number,
        notes: d.notes,
      });
      created++;
    }
    return { committed: true, created, skipped: summary.invalid, summary, rows: results };
  },

  updateAsset(assetId: string, input: Partial<Asset>): Asset {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) throw new ApiMockError(404, 'Aset tidak ditemukan');
    Object.assign(asset, input);
    asset.book_value = asset.acquisition_cost - asset.accumulated_depreciation;
    auditPush(asset.id, 'updated', 'Data aset diperbarui.');
    return asset;
  },

  deleteAsset(assetId: string): void {
    const i = assets.findIndex((a) => a.id === assetId);
    if (i === -1) throw new ApiMockError(404, 'Aset tidak ditemukan');
    if (assets[i].accumulated_depreciation > 0) {
      throw new ApiMockError(422, 'Aset sudah terdepresiasi — gunakan pelepasan, bukan hapus.');
    }
    assets.splice(i, 1);
  },

  setCondition(assetId: string, condition: Asset['condition']): Asset {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) throw new ApiMockError(404, 'Aset tidak ditemukan');
    asset.condition = condition;
    auditPush(asset.id, 'condition', `Kondisi diubah menjadi ${condition}.`);
    return asset;
  },

  reassign(assetId: string, body: { custodian_id?: string | null; location?: string; condition_at_handover?: Asset['condition']; notes?: string }): Asset {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) throw new ApiMockError(404, 'Aset tidak ditemukan');

    const custodianId = body.custodian_id ?? null;
    (custodyHistory[assetId] ??= []).push({
      id: id('hov'),
      from_custodian_id: asset.custodian_id,
      from_custodian_name: custodianNameById(asset.custodian_id),
      to_custodian_id: custodianId,
      to_custodian_name: custodianNameById(custodianId),
      from_location: asset.location,
      to_location: body.location ?? asset.location,
      condition_at_handover: body.condition_at_handover ?? asset.condition,
      notes: body.notes ?? null,
      handed_at: new Date().toISOString(),
    });

    asset.custodian_id = custodianId;
    if (body.location) asset.location = body.location;
    if (body.condition_at_handover) asset.condition = body.condition_at_handover;
    auditPush(assetId, 'reassigned', `Tanggung jawab dilimpahkan${body.condition_at_handover ? ` · kondisi ${body.condition_at_handover}` : ''}.`);
    return asset;
  },

  custodyHistory: (assetId: string) => [...(custodyHistory[assetId] ?? [])].reverse(),
  assetAudit: (assetId: string) => [...(assetAudit[assetId] ?? [])].reverse(),

  // --- photos (ephemeral object URLs) ---
  listPhotos: (assetId: string) => [...(assetPhotos[assetId] ?? [])].reverse(),
  addPhoto(assetId: string, body: any) {
    const file = body.photo;
    const url = file?.url ?? null;
    const photo = {
      id: id('pho'),
      url,
      thumb_url: url,
      caption: body.caption ?? null,
      width: null,
      height: null,
      taken_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    (assetPhotos[assetId] ??= []).push(photo);
    auditPush(assetId, 'photo_added', body.caption ? `Foto ditambahkan: ${body.caption}` : 'Foto ditambahkan.');
    return photo;
  },
  deletePhoto(photoId: string) {
    for (const key of Object.keys(assetPhotos)) {
      const i = assetPhotos[key].findIndex((p) => p.id === photoId);
      if (i !== -1) {
        assetPhotos[key].splice(i, 1);
        return { ok: true };
      }
    }
    return { ok: true };
  },

  // --- per-asset depreciation history (derived from runs) ---
  assetDepreciation(assetId: string) {
    const entries: any[] = [];
    for (const run of runs) {
      const line = run.lines.find((l) => l.asset_id === assetId);
      if (!line) continue;
      entries.push({
        period: run.period,
        status: run.status,
        amount: line.amount,
        book_value_before: line.book_value_before,
        book_value_after: line.book_value_after,
        journal_id: run.journal_id,
        posted_at: run.posted_at,
      });
    }
    return entries.sort((a, b) => (b.period < a.period ? -1 : 1));
  },

  // --- purchase ---
  getPurchase: (assetId: string) => assetPurchases[assetId] ?? null,
  savePurchase(assetId: string, body: any) {
    const existing = assetPurchases[assetId] ?? { id: id('pur') };
    const proof = body.proof;
    const purchase = {
      ...existing,
      vendor: body.vendor ?? existing.vendor ?? null,
      invoice_no: body.invoice_no ?? existing.invoice_no ?? null,
      purchase_date: body.purchase_date ?? existing.purchase_date ?? null,
      amount: body.amount !== undefined ? Number(body.amount) : existing.amount ?? 0,
      notes: body.notes ?? existing.notes ?? null,
    };
    if (proof?.url) {
      const isImage = String(proof.mime ?? '').startsWith('image/');
      purchase.proof_url = proof.url;
      purchase.proof_thumb_url = isImage ? proof.url : null;
      purchase.proof_type = isImage ? 'image' : 'pdf';
    }
    assetPurchases[assetId] = purchase;
    auditPush(assetId, 'purchase', 'Data pembelian diperbarui.');

    // Acquisition event (B) is emitted when purchase data is entered.
    const asset = assets.find((a) => a.id === assetId);
    const amount = Number(purchase.amount) || 0;
    if (asset && amount > 0) {
      const cat = categories.find((c) => c.id === asset.category_id);
      const date = purchase.purchase_date ?? asset.acquisition_date;
      const memo = `Perolehan aset ${asset.code}`;
      emitEvent({
        source: 'acquisition',
        source_type: 'asetto.acquisition',
        source_ref: asset.id,
        entity_id: asset.entity_id,
        idempotency_key: `asetto:acq:${asset.id}`,
        date,
        memo,
        payload: {
          event: 'acquisition',
          asset_id: asset.id,
          asset_code: asset.code,
          asset_name: asset.name,
          category_code: cat?.code,
          date,
          amount,
          memo,
        },
      });
    }
    return purchase;
  },

  // --- Ecopa integration (mock: register simulates instant approval) ---
  integrationStatus: () => ({ ...integration }),
  registerIntegration(body: { ecopa_url?: string; registration_token?: string; base_url?: string }) {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const base = (body.base_url || '').replace(/\/+$/, '') || fallbackOrigin;
    const ecopa = (body.ecopa_url || integration.ecopa_url).replace(/\/+$/, '');
    integration = {
      ...integration,
      configured: true,
      integration_status: 'on',
      registration_status: 'active',
      registration_message: null,
      ecopa_url: ecopa,
      base_url: base,
      redirect_uri: `${base}/auth/ecopa/callback`,
      webhook_url: `${base}/webhooks/ecopa`,
      sso_ready: true,
      webhook_ready: true,
    };
    return { ...integration };
  },
  cancelIntegration() {
    integration = {
      ...integration,
      configured: false,
      integration_status: null,
      registration_status: null,
      registration_message: null,
      base_url: '',
      redirect_uri: '',
      webhook_url: '',
      sso_ready: false,
      webhook_ready: false,
    };
    return { ...integration };
  },

  // --- settings ---
  getSettings: () => ({ ...settings }),
  saveSettings(patch: Partial<typeof settings>) {
    if (patch.mode) settings.mode = patch.mode;
    if (patch.disk) settings.disk = patch.disk;
    return { ...settings };
  },

  // --- rbac (mock: the mock user is admin with full access) ---
  myAssets: () => [],
  roleManagement: () => ({
    users: [{
      assignment_id: 'a1', user_id: 'usr_1', ecopa_user_id: 'ec-1',
      name: 'Dede Nugroho', email: 'dede.nugroho@leconfe.com', ecopa_role: 'admin',
      role_id: 'role_admin', role_code: 'admin', role_name: 'Admin',
      disabled_at: null, can_update_role: false, can_impersonate: false,
    }],
    unassigned_users: [],
    roles: [
      { id: 'role_admin', code: 'admin', name: 'Admin' },
      { id: 'role_mgr', code: 'asset_manager', name: 'Asset Manager' },
      { id: 'role_user', code: 'asset_user', name: 'User' },
    ],
  }),
  assignRole: () => ({ ok: true }),
  updateAssignment: () => ({ ok: true }),
  impersonate: () => ({ ok: true }),
  stopImpersonation: () => ({ ok: true }),
  permissionMatrix: () => ({
    catalog: PERMISSION_CATALOG,
    roles: [
      { code: 'admin', name: 'Admin', is_preset: true, editable: false, permissions: ALL_CODES },
      { code: 'asset_manager', name: 'Asset Manager', is_preset: true, editable: true, permissions: rolePerms.asset_manager },
      { code: 'asset_user', name: 'User', is_preset: true, editable: true, permissions: rolePerms.asset_user },
    ],
  }),
  saveRoleMatrix(roleCode: string, permissions: string[]) {
    if (rolePerms[roleCode]) rolePerms[roleCode] = permissions;
    return db.permissionMatrix();
  },
  linkCustodian(custodianId: string, userId: string | null) {
    const c = custodians.find((x) => x.id === custodianId) as any;
    if (c) c.user_id = userId || null;
    return c ?? { ok: true };
  },

  // --- depreciation ---
  pendingPeriod,
  listRuns: () => [...runs].reverse(),
  getRun: (runId: string) => runs.find((r) => r.id === runId) ?? null,

  previewRun(period: string) {
    const lines = buildRunLines(period);
    return {
      period,
      lines,
      total_amount: lines.reduce((s, l) => s + l.amount, 0),
    };
  },

  postRun(period: string): DepreciationRun {
    if (runs.some((r) => r.period === period && r.status === 'posted')) {
      throw new ApiMockError(422, `Periode ${period} sudah pernah diposting.`);
    }
    const lines = buildRunLines(period);
    if (lines.length === 0) {
      throw new ApiMockError(422, `Tidak ada aset yang perlu didepresiasi untuk ${period}.`);
    }
    const now = new Date().toISOString();
    const run: DepreciationRun = {
      id: id('run'),
      period,
      status: 'posted',
      total_amount: lines.reduce((s, l) => s + l.amount, 0),
      lines,
      journal_id: null,
      created_at: now,
      posted_at: now,
    };
    // Apply to assets.
    for (const line of lines) {
      const asset = assets.find((a) => a.id === line.asset_id)!;
      asset.accumulated_depreciation += line.amount;
      asset.book_value = asset.acquisition_cost - asset.accumulated_depreciation;
      asset.last_depreciated_period = period;
      auditPush(asset.id, 'depreciation', `Depresiasi ${period}: Rp ${line.amount.toLocaleString('id-ID')}`);
    }
    // Emit one Auto Mapping event per (entity × category) to Akunta.
    const before = journals.length;
    emitDepreciationEvents(run);
    run.journal_id = journals[before]?.id ?? null;
    runs.push(run);
    return run;
  },

  // --- disposals ---
  listDisposals: () => [...disposals].reverse(),

  createDisposal(input: { asset_id: string; date: string; type: DisposalType; proceeds: number }): Disposal {
    const asset = assets.find((a) => a.id === input.asset_id);
    if (!asset) throw new ApiMockError(404, 'Aset tidak ditemukan');
    if (asset.status === 'disposed') throw new ApiMockError(422, 'Aset sudah dilepas.');

    const bookValue = asset.book_value;
    const proceeds = input.type === 'writeoff' ? 0 : input.proceeds;
    const gainLoss = proceeds - bookValue;
    const cat = categories.find((c) => c.id === asset.category_id)!;

    const scenario =
      input.type === 'writeoff' ? 'writeoff' : gainLoss > 0.005 ? 'sale_gain' : gainLoss < -0.005 ? 'sale_loss' : 'sale_even';
    const memo = `${input.type === 'sale' ? 'Penjualan' : 'Penghapusan'} aset ${asset.code}`;

    // Auto Mapping payload — only legs with a value > 0 (ingest rejects zeros).
    const payload: Record<string, unknown> = {
      event: 'disposal',
      scenario,
      asset_id: asset.id,
      asset_code: asset.code,
      asset_name: asset.name,
      category_code: cat.code,
      date: input.date,
      cost: asset.acquisition_cost,
      memo,
    };
    if (asset.accumulated_depreciation > 0) payload.accumulated = asset.accumulated_depreciation;
    if (proceeds > 0) payload.proceeds = proceeds;
    if (gainLoss > 0.005) payload.gain = gainLoss;
    else if (gainLoss < -0.005) payload.loss = -gainLoss;

    const journal = emitEvent({
      source: 'disposal',
      source_type: 'asetto.disposal',
      source_ref: asset.id,
      entity_id: asset.entity_id,
      idempotency_key: `asetto:disp:${asset.id}:${input.date}`,
      date: input.date,
      memo,
      payload,
    });

    asset.status = 'disposed';
    asset.condition = 'idle';
    auditPush(asset.id, 'disposed', input.type === 'sale' ? 'Aset dijual (pelepasan).' : 'Aset dihapuskan (write-off).');

    const disposal: Disposal = {
      id: id('disp'),
      asset_id: asset.id,
      asset_code: asset.code,
      asset_name: asset.name,
      date: input.date,
      type: input.type,
      proceeds,
      book_value_at_disposal: bookValue,
      gain_loss: gainLoss,
      journal_id: journal.id,
      status: 'posted',
    };
    disposals.push(disposal);
    return disposal;
  },

  // --- akunta outbox ---
  listJournals: () => [...journals].reverse(),
  getJournal: (journalId: string) => journals.find((j) => j.id === journalId) ?? null,
  retryJournal(journalId: string): JournalEntry {
    const journal = journals.find((j) => j.id === journalId);
    if (!journal) throw new ApiMockError(404, 'Jurnal tidak ditemukan');
    if (journal.status === 'accepted') return journal;
    pushToAkunta(journal, true);
    return journal;
  },

  dashboard,
};

export class ApiMockError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
