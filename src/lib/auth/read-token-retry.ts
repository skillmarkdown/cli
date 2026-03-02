export function isReadTokenRetryableStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

interface CallWithReadTokenRetryInput<T> {
  request: (idToken?: string) => Promise<T>;
  resolveReadIdToken?: () => Promise<string | null>;
  shouldRetry: (error: unknown) => boolean;
  idToken?: string;
}

interface CallWithReadTokenRetryResult<T> {
  result: T;
  idToken?: string;
}

export async function callWithReadTokenRetry<T>(
  input: CallWithReadTokenRetryInput<T>,
): Promise<CallWithReadTokenRetryResult<T>> {
  try {
    return {
      result: await input.request(input.idToken),
      idToken: input.idToken,
    };
  } catch (error) {
    if (!input.resolveReadIdToken || !input.shouldRetry(error)) {
      throw error;
    }

    if (input.idToken) {
      throw error;
    }

    const resolvedIdToken = await input.resolveReadIdToken();
    if (!resolvedIdToken) {
      throw error;
    }

    return {
      result: await input.request(resolvedIdToken),
      idToken: resolvedIdToken,
    };
  }
}
