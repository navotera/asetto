/** Domain types for the Asetto asset sub-ledger. */

export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'none';
export type AssetCondition = 'good' | 'needs_repair' | 'broken' | 'idle';
export type AssetStatus = 'active' | 'disposed';
export type CustodianType = 'entity' | 'person';

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  default_method: DepreciationMethod;
  default_useful_life_months: number;
  /** Akun GL di Akunta yang dipakai saat posting jurnal. */
  akunta_asset_account: string;
  akunta_accum_dep_account: string;
  akunta_dep_expense_account: string;
}

export interface Custodian {
  id: string;
  type: CustodianType;
  code: string;
  name: string;
  department?: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  category_id: string;
  acquisition_date: string; // ISO date
  acquisition_cost: number;
  salvage_value: number;
  useful_life_months: number;
  method: DepreciationMethod;
  condition: AssetCondition;
  custodian_id: string | null;
  location: string;
  serial_number?: string;
  notes?: string;
  status: AssetStatus;
  /** Derived, kept denormalised for list views. */
  accumulated_depreciation: number;
  book_value: number;
  /** Period (YYYY-MM) of the last posted depreciation for this asset. */
  last_depreciated_period: string | null;
}

export interface DepreciationLine {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  category_name: string;
  amount: number;
  book_value_before: number;
  book_value_after: number;
}

export type RunStatus = 'draft' | 'posted';

export interface DepreciationRun {
  id: string;
  period: string; // YYYY-MM
  status: RunStatus;
  total_amount: number;
  lines: DepreciationLine[];
  journal_id: string | null;
  created_at: string;
  posted_at: string | null;
}

export type DisposalType = 'sale' | 'writeoff';

export interface Disposal {
  id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  date: string;
  type: DisposalType;
  proceeds: number;
  book_value_at_disposal: number;
  gain_loss: number; // positive = gain
  journal_id: string | null;
  status: RunStatus;
}

export type JournalStatus = 'queued' | 'posted' | 'failed';
export type JournalSource = 'depreciation' | 'disposal';

export interface JournalLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

/**
 * A journal the Asetto backend would push to Akunta server-to-server via the
 * PHP `api-client` package. In mock mode these live in an in-browser "outbox"
 * so the depreciation → jurnal flow is visible end-to-end.
 */
export interface JournalEntry {
  id: string;
  idempotency_key: string;
  source: JournalSource;
  source_ref: string;
  date: string;
  memo: string;
  status: JournalStatus;
  akunta_journal_no: string | null;
  lines: JournalLine[];
  created_at: string;
  posted_at: string | null;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  app_role: 'admin' | 'user';
  roles: string[];
}

export interface DashboardSummary {
  asset_count: number;
  active_count: number;
  total_acquisition_cost: number;
  total_book_value: number;
  total_accumulated_depreciation: number;
  disposed_this_year: number;
  condition_breakdown: Record<AssetCondition, number>;
  pending_depreciation_period: string | null;
  akunta_queued: number;
  recent_journals: JournalEntry[];
  book_value_by_category: Array<{ category: string; book_value: number }>;
}
