import { vi } from 'vitest'
import * as Vue from 'vue'

// Provide Nuxt auto-import globals for composable tests
const globals = ['ref', 'reactive', 'computed', 'watch', 'watchEffect', 'toRef', 'toRefs', 'isRef', 'shallowRef', 'triggerRef', 'unref', 'proxyRefs'] as const
for (const name of globals) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, { value: (Vue as any)[name] ?? vi.fn(), configurable: true })
  }
}

// Stub useNuxtApp for composable modules that call it at module scope
if (!('useNuxtApp' in globalThis)) {
  (globalThis as any).useNuxtApp = () => ({ $supabase: null })
}
