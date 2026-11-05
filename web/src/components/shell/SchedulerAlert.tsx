import { Link } from 'react-router-dom';
import { useSchedulerHealth, useCan } from '@/api/queries';

/**
 * App-wide banner shown to admins when the OS cron is not driving the Laravel
 * scheduler (heartbeat stale/absent) — meaning the outbox flush and monthly
 * depreciation are not running.
 */
export function SchedulerAlert() {
  const { can } = useCan();
  const canManage = can('settings.manage');
  const { data } = useSchedulerHealth(canManage);

  if (!canManage || !data || data.scheduler.healthy) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-danger/30 bg-danger-light px-4 py-2 text-sm text-danger sm:px-6"
    >
      <span aria-hidden="true">⚠</span>
      <span>
        Cron belum disetup —{' '}
        <Link to="/pengaturan?section=cron" className="font-semibold underline underline-offset-2 hover:text-danger/80">
          detail
        </Link>
      </span>
    </div>
  );
}
