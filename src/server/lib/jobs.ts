export const MAX_JOB_ATTEMPTS = 3;

export interface RetryDecision {
  attempts: number;
  retryAt: number | null;
  final: boolean;
}

export function decideRetry(previousAttempts: number, now: number): RetryDecision {
  const attempts = previousAttempts + 1;
  if (attempts >= MAX_JOB_ATTEMPTS) {
    return { attempts, retryAt: null, final: true };
  }

  const backoffMs = attempts * attempts * 30_000;
  return { attempts, retryAt: now + backoffMs, final: false };
}
