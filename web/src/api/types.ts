/** Domain types for the Asetto asset sub-ledger. */

/** A server-side paginated page of T (mirrors the backend envelope). */
export interface Paginated<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** Public Ecopa integration status (no secrets) — drives the setup wizard. */
export interface IntegrationStatus {
  configured: boolean;
  integration_status: 'on' | 'off' | null;
  registration_status: 'pending' | 'active' | 'rejected' | null;
  registration_message: string | null;
  name: string;
  slug: string;
  ecopa_url: string;
  base_url: string;
  redirect_uri: string;
  webhook_url: string;
  sso_ready: boolean;
  webhook_ready: boolean;
}

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
  asset_count?: number | null;
}

/** A company (PT) that an asset — and its journals — belong to. The id is
 *  Asetto's own; it is sent to Akunta as `source_entity_id`, which the Akunta
 *  admin maps once to an Akunta entity (AutoMappingEntityLink). */
export interface Entity {
  id: string;
  name: string;
}

export interface Custodian {
  id: string;
  type: CustodianType;
  code: string;
  name: string;
  department?: string | null;
  user_id?: string | null;
  ecopa_user_id?: string | null;
  user_name?: string | null;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  entity_id: string;
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
  /** True when monetary fields are nulled for a viewer without asset.view_value. */
  values_hidden?: boolean;
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

export type JournalStatus = 'queued' | 'accepted' | 'failed' | 'rejected';
export type JournalSource = 'acquisition' | 'depreciation' | 'disposal';

/**
 * A business event Asetto emits to Akunta's Auto Mapping ingest endpoint
 * server-to-server (NO account codes — the Akunta admin maps fields → accounts
 * once per `source_type`). The outbox makes the flow visible and resilient:
 * `queued` → `accepted` (202, Akunta returns `akunta_raw_id`) or `failed`.
 */
export interface JournalEntry {
  id: string;
  idempotency_key: string;
  source: JournalSource;
  source_type: string;
  source_ref: string;
  entity_id: string;
  date: string;
  memo: string;
  status: JournalStatus;
  akunta_raw_id: string | null;
  payload: Record<string, unknown>;
  last_error?: string | null;
  created_at: string;
  posted_at: string | null;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  app_role: 'admin' | 'user';
  roles: string[];
  role?: string | null;
  permissions: string[];
  is_impersonating: boolean;
  impersonator?: { id: string; name: string } | null;
}

export interface RoleOption {
  id: string;
  code: string;
  name: string;
}

export interface ManagedUser {
  assignment_id: string;
  user_id: string;
  ecopa_user_id: string | null;
  name: string | null;
  email: string | null;
  ecopa_role: string | null;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  disabled_at: string | null;
  can_update_role: boolean;
  can_impersonate: boolean;
}

export interface UnassignedUser {
  assignment_id: string;
  user_id: string;
  ecopa_user_id: string | null;
  name: string | null;
  email: string | null;
  can_impersonate?: boolean;
}

export interface RoleManagementData {
  users: ManagedUser[];
  unassigned_users: UnassignedUser[];
  roles: RoleOption[];
}

export interface PermCatalogItem {
  code: string;
  group: string;
  label: string;
}

export interface MatrixRole {
  code: string;
  name: string;
  is_preset: boolean;
  editable: boolean;
  permissions: string[];
}

export interface PermissionMatrix {
  catalog: PermCatalogItem[];
  roles: MatrixRole[];
}

export interface MyAsset {
  id: string;
  code: string;
  name: string;
  category_name: string | null;
  condition: AssetCondition;
  location: string;
  status: AssetStatus;
  acquisition_date: string;
}

export interface CustodyHandover {
  id: string;
  from_custodian_id: string | null;
  from_custodian_name: string | null;
  to_custodian_id: string | null;
  to_custodian_name: string | null;
  from_location: string | null;
  to_location: string | null;
  condition_at_handover: AssetCondition | null;
  notes: string | null;
  handed_at: string | null;
}

export interface AssetPhoto {
  id: string;
  url: string | null;
  thumb_url: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  created_at: string | null;
}

export interface AssetPurchase {
  id: string;
  vendor: string | null;
  invoice_no: string | null;
  purchase_date: string | null;
  amount: number;
  notes: string | null;
  proof_url: string | null;
  proof_thumb_url: string | null;
  proof_type: 'image' | 'pdf' | null;
}

export interface AssetAuditEntry {
  id: string;
  action: string;
  description: string | null;
  actor_name: string | null;
  created_at: string | null;
}

export interface AssetDepreciationEntry {
  period: string | null;
  status: RunStatus;
  amount: number;
  book_value_before: number;
  book_value_after: number;
  journal_id: string | null;
  posted_at: string | null;
}

/** Per-economic-event Akunta sync toggles. */
export interface SyncSettings {
  acquisition: boolean;
  depreciation: boolean;
  disposal: boolean;
}

export interface AppSettings {
  mode: 'auto_post' | 'draft';
  disk: string;
  disks?: string[];
  sync?: SyncSettings;
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
