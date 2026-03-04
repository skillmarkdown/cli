export function createCachedReadTokenResolver(
  resolveReadIdToken: () => Promise<string | null>,
): () => Promise<string | null> {
  let cachedReadIdToken: string | null = null;
  let readTokenPromise: Promise<string | null> | null = null;

  return () => {
    if (cachedReadIdToken) {
      return Promise.resolve(cachedReadIdToken);
    }
    if (!readTokenPromise) {
      readTokenPromise = resolveReadIdToken()
        .then((token) => {
          if (token) {
            cachedReadIdToken = token;
          }
          return token;
        })
        .finally(() => {
          readTokenPromise = null;
        });
    }
    return readTokenPromise;
  };
}
