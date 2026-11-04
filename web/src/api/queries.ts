import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  AppSettings,
  Asset,
  AssetCategory,
  AssetDepreciationEntry,
  AssetPhoto,
  AssetPurchase,
  Custodian,
  CustodyHandover,
  DashboardSummary,
  DepreciationRun,
  Disposal,
  DisposalType,
  Entity,
  JournalEntry,
  Me,
  MyAsset,
  AssetAuditEntry,
  PermissionMatrix,
  RoleManagementData,
} from './types';

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  assets: ['assets'] as const,
  asset: (id: string) => ['assets', id] as const,
  categories: ['categories'] as const,
  entities: ['entities'] as const,
  custodians: ['custodians'] as const,
  custodyHistory: (id: string) => ['assets', id, 'custody'] as const,
  assetAudit: (id: string) => ['assets', id, 'audit'] as const,
  assetPhotos: (id: string) => ['assets', id, 'photos'] as const,
  assetDepreciation: (id: string) => ['assets', id, 'depreciation'] as const,
  assetPurchase: (id: string) => ['assets', id, 'purchase'] as const,
  settings: ['settings'] as const,
  depreciationPending: ['depreciation', 'pending'] as const,
  depreciationPreview: (period: string) => ['depreciation', 'preview', period] as const,
  depreciationRuns: ['depreciation', 'runs'] as const,
  disposals: ['disposals'] as const,
  journals: ['journals'] as const,
  myAssets: ['assets', 'mine'] as const,
  roleManagement: ['role-management'] as const,
  permissionMatrix: ['permission-matrix'] as const,
};

/** Invalidate everything a posting touches — assets, dashboard, outbox, runs. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.assets });
    qc.invalidateQueries({ queryKey: keys.dashboard });
    qc.invalidateQueries({ queryKey: keys.journals });
    qc.invalidateQueries({ queryKey: keys.depreciationRuns });
    qc.invalidateQueries({ queryKey: keys.depreciationPending });
    qc.invalidateQueries({ queryKey: keys.disposals });
  };
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.get<Me>('/me') });

/** Permission helper derived from the current user. */
export function useCan() {
  const { data: me } = useMe();
  const perms = me?.permissions ?? [];
  const isAdmin = me?.app_role === 'admin' || me?.role === 'Admin';
  return {
    me,
    isAdmin,
    can: (permission: string) => isAdmin || perms.includes(permission),
  };
}

// --- role management (admin) ---
export const useRoleManagement = () =>
  useQuery({ queryKey: keys.roleManagement, queryFn: () => api.get<RoleManagementData>('/role-management') });

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { user_id?: string; ecopa_user_id?: string; email?: string; role_id: string }) =>
      api.post('/role-management/assign', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.roleManagement }),
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { assignment_id: string; role_id: string | null }) =>
      api.patch(`/role-management/${v.assignment_id}`, { role_id: v.role_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.roleManagement }),
  });
}

export function useImpersonate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => api.post(`/role-management/${assignmentId}/impersonate`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useStopImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/role-management/stop-impersonation'),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- permission matrix (admin) ---
export const usePermissionMatrix = () =>
  useQuery({ queryKey: keys.permissionMatrix, queryFn: () => api.get<PermissionMatrix>('/permission-matrix') });

export function useSaveRoleMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { role_code: string; permissions: string[] }) =>
      api.put<PermissionMatrix>(`/permission-matrix/${v.role_code}`, { permissions: v.permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.permissionMatrix });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useLinkCustodian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { custodian_id: string; user_id?: string | null; ecopa_user_id?: string | null }) =>
      api.patch(`/custodians/${v.custodian_id}`, { user_id: v.user_id ?? null, ecopa_user_id: v.ecopa_user_id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.custodians }),
  });
}

export const useMyAssets = () =>
  useQuery({ queryKey: keys.myAssets, queryFn: () => api.get<MyAsset[]>('/assets/mine') });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<DashboardSummary>('/dashboard') });

export const useAssets = () =>
  useQuery({ queryKey: keys.assets, queryFn: () => api.get<Asset[]>('/assets') });

export const useAsset = (id: string) =>
  useQuery({ queryKey: keys.asset(id), queryFn: () => api.get<Asset>(`/assets/${id}`), enabled: !!id });

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => api.get<AssetCategory[]>('/categories') });

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AssetCategory> & { id?: string }) =>
      input.id ? api.patch<AssetCategory>(`/categories/${input.id}`, input) : api.post<AssetCategory>('/categories', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export const useEntities = () =>
  useQuery({ queryKey: keys.entities, queryFn: () => api.get<Entity[]>('/entities') });

export function useSaveEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.post<Entity>('/entities', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.entities }),
  });
}

export const useCustodians = () =>
  useQuery({ queryKey: keys.custodians, queryFn: () => api.get<Custodian[]>('/custodians') });

export function useSaveAsset() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Partial<Asset> & { id?: string }) =>
      input.id ? api.patch<Asset>(`/assets/${input.id}`, input) : api.post<Asset>('/assets', input),
    onSuccess: invalidate,
  });
}

export function useDeleteAsset() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.del(`/assets/${id}`), onSuccess: invalidate });
}

export function useSetCondition() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { id: string; condition: Asset['condition'] }) =>
      api.post<Asset>(`/assets/${v.id}/condition`, { condition: v.condition }),
    onSuccess: invalidate,
  });
}

export function useReassign() {
  const invalidate = useInvalidateAll();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      id: string;
      custodian_id: string | null;
      location?: string;
      condition_at_handover?: Asset['condition'];
      notes?: string;
    }) => api.post<Asset>(`/assets/${v.id}/reassign`, v),
    onSuccess: (_data, v) => {
      invalidate();
      qc.invalidateQueries({ queryKey: keys.custodyHistory(v.id) });
      qc.invalidateQueries({ queryKey: keys.asset(v.id) });
    },
  });
}

// --- asset control center ---
export const useCustodyHistory = (assetId: string) =>
  useQuery({
    queryKey: keys.custodyHistory(assetId),
    enabled: !!assetId,
    queryFn: () => api.get<CustodyHandover[]>(`/assets/${assetId}/custody-history`),
  });

export const useAssetDepreciation = (assetId: string) =>
  useQuery({
    queryKey: keys.assetDepreciation(assetId),
    enabled: !!assetId,
    queryFn: () => api.get<AssetDepreciationEntry[]>(`/assets/${assetId}/depreciation`),
  });

export const useAssetAudit = (assetId: string) =>
  useQuery({
    queryKey: keys.assetAudit(assetId),
    enabled: !!assetId,
    queryFn: () => api.get<AssetAuditEntry[]>(`/assets/${assetId}/audit`),
  });

export const useAssetPhotos = (assetId: string) =>
  useQuery({
    queryKey: keys.assetPhotos(assetId),
    enabled: !!assetId,
    queryFn: () => api.get<AssetPhoto[]>(`/assets/${assetId}/photos`),
  });

export function useUploadPhoto(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.upload<AssetPhoto>(`/assets/${assetId}/photos`, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.assetPhotos(assetId) }),
  });
}

export function useDeletePhoto(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api.del(`/photos/${photoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.assetPhotos(assetId) }),
  });
}

export const useAssetPurchase = (assetId: string) =>
  useQuery({
    queryKey: keys.assetPurchase(assetId),
    enabled: !!assetId,
    queryFn: () => api.get<AssetPurchase | null>(`/assets/${assetId}/purchase`),
  });

export function useSavePurchase(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.upload<AssetPurchase>(`/assets/${assetId}/purchase`, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.assetPurchase(assetId) }),
  });
}

// --- settings ---
export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api.get<AppSettings>('/settings') });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Partial<Pick<AppSettings, 'mode' | 'disk'>>) => api.put<AppSettings>('/settings', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
}

// --- depreciation ---
export const usePendingPeriod = () =>
  useQuery({
    queryKey: keys.depreciationPending,
    queryFn: () => api.get<{ period: string | null }>('/depreciation/pending'),
  });

export const useDepreciationPreview = (period: string | null) =>
  useQuery({
    queryKey: keys.depreciationPreview(period ?? 'none'),
    enabled: !!period,
    queryFn: () =>
      api.get<{ period: string; lines: DepreciationRun['lines']; total_amount: number }>(
        `/depreciation/preview?period=${period}`,
      ),
  });

export const useDepreciationRuns = () =>
  useQuery({ queryKey: keys.depreciationRuns, queryFn: () => api.get<DepreciationRun[]>('/depreciation/runs') });

export function usePostDepreciation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (period: string) => api.post<DepreciationRun>('/depreciation/runs', { period }),
    onSuccess: invalidate,
  });
}

// --- disposals ---
export const useDisposals = () =>
  useQuery({ queryKey: keys.disposals, queryFn: () => api.get<Disposal[]>('/disposals') });

export function useCreateDisposal() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { asset_id: string; date: string; type: DisposalType; proceeds: number }) =>
      api.post<Disposal>('/disposals', v),
    onSuccess: invalidate,
  });
}

// --- akunta outbox ---
export const useJournals = () =>
  useQuery({ queryKey: keys.journals, queryFn: () => api.get<JournalEntry[]>('/journals') });

export function useRetryJournal() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.post<JournalEntry>(`/journals/${id}/retry`),
    onSuccess: invalidate,
  });
}
