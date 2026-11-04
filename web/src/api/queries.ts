import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Asset,
  AssetCategory,
  Custodian,
  DashboardSummary,
  DepreciationRun,
  Disposal,
  DisposalType,
  JournalEntry,
  Me,
} from './types';

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  assets: ['assets'] as const,
  asset: (id: string) => ['assets', id] as const,
  categories: ['categories'] as const,
  custodians: ['custodians'] as const,
  depreciationPending: ['depreciation', 'pending'] as const,
  depreciationPreview: (period: string) => ['depreciation', 'preview', period] as const,
  depreciationRuns: ['depreciation', 'runs'] as const,
  disposals: ['disposals'] as const,
  journals: ['journals'] as const,
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

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<DashboardSummary>('/dashboard') });

export const useAssets = () =>
  useQuery({ queryKey: keys.assets, queryFn: () => api.get<Asset[]>('/assets') });

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => api.get<AssetCategory[]>('/categories') });

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
  return useMutation({
    mutationFn: (v: { id: string; custodian_id: string | null; location?: string }) =>
      api.post<Asset>(`/assets/${v.id}/reassign`, v),
    onSuccess: invalidate,
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
