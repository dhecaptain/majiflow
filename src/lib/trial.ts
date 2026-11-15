const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DURATION_DAYS = 14;

export interface TrialProgress {
  daysUsed: number;
  daysRemaining: number;
  percentUsed: number;
  expired: boolean;
}

export function getTrialProgress(
  startedAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  now = new Date()
): TrialProgress | null {
  if (!startedAt || !endsAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(endsAt).getTime();
  const current = now.getTime();
  if (![start, end, current].every(Number.isFinite) || end <= start) return null;

  const duration = end - start;
  const elapsed = Math.min(Math.max(current - start, 0), duration);
  const daysRemaining = current >= end ? 0 : Math.ceil((end - current) / DAY_MS);
  const daysUsed = Math.min(TRIAL_DURATION_DAYS, Math.max(0, TRIAL_DURATION_DAYS - daysRemaining));

  return {
    daysUsed,
    daysRemaining,
    percentUsed: Math.round((elapsed / duration) * 100),
    expired: current >= end,
  };
}
