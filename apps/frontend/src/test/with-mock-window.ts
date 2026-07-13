type Listener = (event: Event) => void;

export class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

export type MockedWindow = {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  dispatchEvent: (event: Event) => boolean;
};

export function createWindowMock(): MockedWindow {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const listenersByEvent = new Map<string, Set<Listener>>();

  return {
    localStorage,
    sessionStorage,
    addEventListener: (type: string, listener: Listener) => {
      const listeners = listenersByEvent.get(type) ?? new Set<Listener>();
      listeners.add(listener);
      listenersByEvent.set(type, listeners);
    },
    removeEventListener: (type: string, listener: Listener) => {
      const listeners = listenersByEvent.get(type);
      if (!listeners) {
        return;
      }

      listeners.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      const listeners = listenersByEvent.get(event.type);
      if (!listeners) {
        return true;
      }

      listeners.forEach((listener) => listener(event));
      return true;
    },
  };
}
