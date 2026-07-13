type FetchFn = typeof fetch;

export type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

export function withMockFetch<T>(
  implementation: (call: FetchCall) => Promise<Response>,
  fn: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch as FetchFn;

  (globalThis as { fetch: FetchFn }).fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ input, init });
    return implementation({ input, init });
  }) as FetchFn;

  return fn(calls).finally(() => {
    (globalThis as { fetch: FetchFn }).fetch = originalFetch;
  });
}
