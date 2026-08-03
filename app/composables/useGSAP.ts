type GsapStatic = typeof import('gsap').gsap
type GsapContext = ReturnType<GsapStatic['context']>
type GsapMatchMedia = ReturnType<GsapStatic['matchMedia']>
type ScrollTriggerInstance = typeof import('gsap/ScrollTrigger').ScrollTrigger

type GsapNuxtApp = {
  $gsap?: GsapStatic
  $scrollTrigger?: ScrollTriggerInstance
}

/**
 * Client-safe GSAP access for Vue/Nuxt components.
 *
 * Components should create animations in onMounted and pass their root element
 * to context() so selectors cannot escape the component. The returned context
 * must be reverted from onUnmounted.
 */
export function useGSAP() {
  const nuxtApp = useNuxtApp() as unknown as GsapNuxtApp
  // The client plugin provides the real instance. The typed fallback keeps
  // setup code import-safe during SSR; animation callbacks are client-guarded.
  const instance = nuxtApp.$gsap ?? ({} as GsapStatic)
  const scrollTrigger = nuxtApp.$scrollTrigger

  function context(scope: Element | null | undefined, setup: () => void): GsapContext | undefined {
    if (!import.meta.client || !scope) return undefined
    return instance.context(setup, scope)
  }

  function matchMedia(): GsapMatchMedia | undefined {
    if (!import.meta.client) return undefined
    return instance.matchMedia()
  }

  async function lazyLoadPlugin<T = unknown>(plugin: string): Promise<T> {
    if (!import.meta.client) throw new Error(`GSAP plugin "${plugin}" requires a browser`)

    const loaders: Record<string, () => Promise<unknown>> = {
      Flip: () => import('gsap/Flip').then(module => module.Flip),
      Observer: () => import('gsap/Observer').then(module => module.Observer),
      ScrollToPlugin: () => import('gsap/ScrollToPlugin').then(module => module.ScrollToPlugin),
      SplitText: () => import('gsap/SplitText').then(module => module.SplitText),
    }
    const loader = loaders[plugin]
    if (!loader) throw new Error(`Unsupported GSAP plugin: ${plugin}`)
    const loaded = await loader()
    instance.registerPlugin(loaded as never)
    return loaded as T
  }

  return {
    gsap: instance,
    ScrollTrigger: scrollTrigger,
    context,
    matchMedia,
    lazyLoadPlugin,
  }
}
