import { useMe, useStopImpersonation } from '@/api/queries';

export function ImpersonationBanner() {
  const { data: me } = useMe();
  const stop = useStopImpersonation();

  if (!me?.is_impersonating) return null;

  async function back() {
    try {
      await stop.mutateAsync();
    } finally {
      window.location.href = '/';
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-warning-light px-4 py-2 text-sm text-warning sm:px-6">
      <span>
        Anda melihat aplikasi sebagai <strong>{me.name}</strong>
        {me.role ? ` (${me.role})` : ''}.
      </span>
      <button
        onClick={back}
        disabled={stop.isPending}
        className="shrink-0 rounded-md bg-warning px-3 py-1 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50"
      >
        Kembali ke akun admin
      </button>
    </div>
  );
}
