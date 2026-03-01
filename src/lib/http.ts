const DEFAULT_TIMEOUT_MS = 10_000;

interface FetchWithTimeoutOptions {
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const userSignal = init.signal;
  let abortListener: (() => void) | undefined;

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason);
    } else {
      abortListener = () => {
        controller.abort(userSignal.reason);
      };
      userSignal.addEventListener("abort", abortListener, { once: true });
    }
  }

  const timeout = setTimeout(() => {
    controller.abort(new Error(`request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && !userSignal?.aborted) {
      const timeoutError = new Error(`request timed out after ${timeoutMs}ms`) as Error & {
        cause?: unknown;
      };
      timeoutError.cause = error;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    if (userSignal && abortListener) {
      userSignal.removeEventListener("abort", abortListener);
    }
  }
}
