export const JWT_FUTURE_RETRY_DELAYS_MS = [1_000, 3_000, 7_000] as const;

export function isJwtIssuedAtFuture(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 'PGRST303' && candidate.message === 'JWT issued at future';
}

type RetryOptions = {
  delaysMs?: readonly number[];
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (attempt: number, delayMs: number) => void;
};

const sleepFor = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export async function retryJwtIssuedAtFuture<T>(
  operation: () => Promise<T>,
  getError: (result: T) => unknown,
  options: RetryOptions = {},
) {
  const delaysMs = options.delaysMs ?? JWT_FUTURE_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? sleepFor;
  let result = await operation();

  for (let index = 0; index < delaysMs.length && isJwtIssuedAtFuture(getError(result)); index += 1) {
    const delayMs = delaysMs[index];
    options.onRetry?.(index + 1, delayMs);
    await sleep(delayMs);
    result = await operation();
  }

  return result;
}
