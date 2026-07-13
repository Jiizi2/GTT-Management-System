export function withLocationHostname<T>(
  hostname: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = (globalThis as { location?: unknown }).location;
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    writable: true,
    value: { hostname },
  });

  return fn().finally(() => {
    if (previous === undefined) {
      delete (globalThis as { location?: unknown }).location;
    } else {
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        writable: true,
        value: previous,
      });
    }
  });
}
