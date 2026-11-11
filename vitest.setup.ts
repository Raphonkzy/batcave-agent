import { afterEach } from 'vitest'
import { resetDataStore } from './src/data-store.ts'

// The shared data store lives in module state; start every test from an empty one.
afterEach(() => { resetDataStore() })

const storage = new Map<string, string>()
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() { return storage.size },
    },
  })
}
