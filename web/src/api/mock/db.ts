/**
 * In-browser mock database for the Asetto SPA.
 *
 * It intentionally models the *real* flow: a depreciation run produces a
 * balanced journal that an Asetto backend would push to Akunta server-to-server
 * (via the PHP `api-client`). Here that push lands in an in-memory "outbox" with
 * an idempotency key, so the whole depreciation → jurnal-ke-Akunta path is
 * visible without a backend.
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
  JournalEntry,
  JournalLine,
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

const categories: AssetCategory[] = [
  {
    id: 'cat_kendaraan',
    code: 'KND',
    name: 'Kendaraan',
    default_method: 'straight_line',
    default_useful_life_months: 96,
    akunta_asset_account: '1-30003',
    akunta_accum_dep_account: '1-30903',
    akunta_dep_expense_account: '6-20003',
  },
  {
    id: 'cat_komputer',
    code: 'KMP',
    name: 'Komputer & IT',
    default_method: 'declining_balance',
    default_useful_life_months: 48,
    akunta_asset_account: '1-30002',
    akunta_accum_dep_account: '1-30902',
    akunta_dep_expense_account: '6-20002',
  },
  {
    id: 'cat_mebel',
    code: 'MBL',
    name: 'Mebel & Perlengkapan',
    default_method: 'straight_line',
    default_useful_life_months: 60,
    akunta_asset_account: '1-30001',
    akunta_accum_dep_account: '1-30901',
    akunta_dep_expense_account: '6-20001',
  },
  {
    id: 'cat_mesin',
    code: 'MSN',
    name: 'Mesin Produksi',
    default_method: 'straight_line',
    default_useful_life_months: 120,
    akunta_asset_account: '1-30004',
    akunta_accum_dep_account: '1-30904',
    akunta_dep_expense_account: '6-20004',
  },
];

const custodians: Custodian[] = [
  { id: 'cus_ops', type: 'entity', code: 'DEPT-OPS', name: 'Divisi Operasional' },
  { id: 'cus_it', type: 'entity', code: 'DEPT-IT', name: 'Divisi Teknologi' },
  { id: 'cus_fin', type: 'entity', code: 'DEPT-FIN', name: 'Divisi Keuangan' },
  { id: 'cus_budi', type: 'person', code: 'EMP-0012', name: 'Budi Santoso', department: 'Operasional' },
  { id: 'cus_sari', type: 'person', code: 'EMP-0048', name: 'Sari Wijaya', department: 'Teknologi' },
];

/** Account display names so journals read nicely without a real COA service. */
const accountNames: Record<string, string> = {
  '1-10001': 'Kas & Bank',
  '1-30001': 'Mebel & Perlengkapan',
  '1-30002': 'Komputer & Peralatan IT',
  '1-30003': 'Kendaraan',
  '1-30004': 'Mesin Produksi',
  '1-30901': 'Akum. Depresiasi — Mebel',
  '1-30902': 'Akum. Depresiasi — Komputer',
  '1-30903': 'Akum. Depresiasi — Kendaraan',
  '1-30904': 'Akum. Depresiasi — Mesin',
  '6-20001': 'Beban Depresiasi — Mebel',
  '6-20002': 'Beban Depresiasi — Komputer',
  '6-20003': 'Beban Depresiasi — Kendaraan',
  '6-20004': 'Beban Depresiasi — Mesin',
  '8-10001': 'Laba Pelepasan Aset',
  '9-10001': 'Rugi Pelepasan Aset',
};
const accountName = (code: string) => accountNames[code] ?? code;

function seedAsset(
  partial: Omit<Asset, 'accumulated_depreciation' | 'book_value' | 'status' | 'last_depreciated_period'> &
    Partial<Pick<Asset, 'accumulated_depreciation' | 'last_depreciated_period'>>,
): Asset {
  const accumulated = partial.accumulated_depreciation ?? 0;
  return {
    status: 'active',
    last_depreciated_period: null,
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

const runs: DepreciationRun[] = [];
const disposals: Disposal[] = [];
const journals: JournalEntry[] = [];

const me: Me = {
  id: 'usr_1',
  name: 'Dede Nugroho',
  email: 'dede.nugroho@leconfe.com',
  app_role: 'admin',
  roles: ['Asset Manager'],
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

function buildDepreciationJournal(run: DepreciationRun): JournalEntry {
  // Group amounts by category so each category hits its own GL accounts.
  const byCategory = new Map<string, number>();
  for (const line of run.lines) {
    const asset = assets.find((a) => a.id === line.asset_id)!;
    byCategory.set(asset.category_id, (byCategory.get(asset.category_id) ?? 0) + line.amount);
  }
  const jlines: JournalLine[] = [];
  for (const [categoryId, amount] of byCategory) {
    const cat = categories.find((c) => c.id === categoryId)!;
    jlines.push({
      account_code: cat.akunta_dep_expense_account,
      account_name: accountName(cat.akunta_dep_expense_account),
      debit: amount,
      credit: 0,
    });
    jlines.push({
      account_code: cat.akunta_accum_dep_account,
      account_name: accountName(cat.akunta_accum_dep_account),
      debit: 0,
      credit: amount,
    });
  }
  const now = new Date().toISOString();
  const [y, m] = run.period.split('-').map(Number);
  return {
    id: id('jrn'),
    idempotency_key: `dep:${run.period}`,
    source: 'depreciation',
    source_ref: run.id,
    date: new Date(y, m, 0).toISOString().slice(0, 10), // last day of the period
    memo: `Beban depresiasi periode ${run.period}`,
    status: 'queued',
    akunta_journal_no: null,
    lines: jlines,
    created_at: now,
    posted_at: null,
  };
}

/** Simulate the server-to-server push to Akunta. ~1 in 12 queued pushes "fail"
 *  so the retry UI has something to show; retry always succeeds. */
function pushToAkunta(journal: JournalEntry, forceOk = false) {
  const ok = forceOk || Math.random() > 0.08;
  if (ok) {
    journal.status = 'posted';
    journal.akunta_journal_no = `AKT-JV-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
    journal.posted_at = new Date().toISOString();
  } else {
    journal.status = 'failed';
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
    akunta_queued: journals.filter((j) => j.status !== 'posted').length,
    recent_journals: [...journals].reverse().slice(0, 5),
    book_value_by_category: [...byCat.entries()].map(([category, book_value]) => ({ category, book_value })),
  };
}

// ---------------------------------------------------------------------------
// Public store API (used by the mock router)
// ---------------------------------------------------------------------------

export const db = {
  me: () => me,
  categories: () => categories,
  custodians: () => custodians,
  accountName,

  listAssets: () => [...assets].sort((a, b) => a.code.localeCompare(b.code)),
  getAsset: (assetId: string) => assets.find((a) => a.id === assetId) ?? null,

  createAsset(input: Partial<Asset>): Asset {
    const n = assets.length + 1;
    const asset = seedAsset({
      id: id('ast'),
      code: input.code || `AST-${String(n).padStart(4, '0')}`,
      name: input.name || 'Aset Baru',
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
    return asset;
  },

  updateAsset(assetId: string, input: Partial<Asset>): Asset {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) throw new ApiMockError(404, 'Aset tidak ditemukan');
    Object.assign(asset, input);
    asset.book_value = asset.acquisition_cost - asset.accumulated_depreciation;
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
    return asset;
  },

  reassign(assetId: string, custodianId: string | null, location?: string): Asset {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) throw new ApiMockError(404, 'Aset tidak ditemukan');
    asset.custodian_id = custodianId;
    if (location) asset.location = location;
    return asset;
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
    }
    // Build + push the journal to Akunta.
    const journal = buildDepreciationJournal(run);
    pushToAkunta(journal);
    journals.push(journal);
    run.journal_id = journal.id;
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

    // Balanced disposal journal.
    const lines: JournalLine[] = [
      {
        account_code: cat.akunta_accum_dep_account,
        account_name: accountName(cat.akunta_accum_dep_account),
        debit: asset.accumulated_depreciation,
        credit: 0,
      },
    ];
    if (proceeds > 0) {
      lines.push({ account_code: '1-10001', account_name: accountName('1-10001'), debit: proceeds, credit: 0 });
    }
    if (gainLoss < 0) {
      lines.push({ account_code: '9-10001', account_name: accountName('9-10001'), debit: -gainLoss, credit: 0 });
    }
    lines.push({
      account_code: cat.akunta_asset_account,
      account_name: accountName(cat.akunta_asset_account),
      debit: 0,
      credit: asset.acquisition_cost,
    });
    if (gainLoss > 0) {
      lines.push({ account_code: '8-10001', account_name: accountName('8-10001'), debit: 0, credit: gainLoss });
    }

    const now = new Date().toISOString();
    const journal: JournalEntry = {
      id: id('jrn'),
      idempotency_key: `disp:${asset.id}:${input.date}`,
      source: 'disposal',
      source_ref: asset.code,
      date: input.date,
      memo: `${input.type === 'sale' ? 'Penjualan' : 'Penghapusan'} aset ${asset.code}`,
      status: 'queued',
      akunta_journal_no: null,
      lines,
      created_at: now,
      posted_at: null,
    };
    pushToAkunta(journal);
    journals.push(journal);

    asset.status = 'disposed';
    asset.condition = 'idle';

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
    if (journal.status === 'posted') return journal;
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
