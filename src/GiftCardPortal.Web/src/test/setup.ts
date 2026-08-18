import "@testing-library/jest-dom/vitest";

/*
 * Node 26 defines its own `localStorage` global, and it shadows the one jsdom
 * builds for the test document. Node's version needs `--localstorage-file` and
 * is `undefined` without it, so any code that reads a browser preference finds
 * nothing where a browser would find storage.
 *
 * jsdom's implementation is the one the tests want, so it is put back. This is
 * about the runtime, not about the portal: nothing here changes what the
 * application does in a browser.
 */
if (typeof globalThis.localStorage === "undefined") {
  class MemoryStorage implements Storage {
    #entries = new Map<string, string>();

    get length() {
      return this.#entries.size;
    }

    clear() {
      this.#entries.clear();
    }

    getItem(key: string) {
      return this.#entries.get(key) ?? null;
    }

    key(index: number) {
      return [...this.#entries.keys()][index] ?? null;
    }

    removeItem(key: string) {
      this.#entries.delete(key);
    }

    setItem(key: string, value: string) {
      this.#entries.set(key, String(value));
    }
  }

  for (const name of ["localStorage", "sessionStorage"] as const) {
    // A fresh instance per property so the two do not share entries, and a
    // Proxy so `Object.keys(localStorage)` reads the stored keys the way it
    // does in a browser.
    const storage = new MemoryStorage();
    const view = new Proxy(storage, {
      get: (target, property) => {
        const value = Reflect.get(target, property) as unknown;
        return typeof value === "function"
          ? (value as () => unknown).bind(target)
          : (value ?? target.getItem(String(property)) ?? undefined);
      },
      ownKeys: (target) =>
        Array.from(
          { length: target.length },
          (_, index) => target.key(index) ?? "",
        ),
      getOwnPropertyDescriptor: (target, property) => {
        const value = target.getItem(String(property));
        return value === null
          ? undefined
          : { value, enumerable: true, configurable: true, writable: true };
      },
    });
    Object.defineProperty(globalThis, name, {
      value: view,
      configurable: true,
      writable: true,
    });
  }
}
