const MOTION_SETTING_KEY = 'couple-space-reduced-motion'

export function useMotionSettings() {
  const userReducedMotion = useState<boolean>('couple-space-user-reduced-motion', () => false)
  const prefersReducedMotion = ref(false)
  const motionReady = ref(false)
  let mediaQuery: MediaQueryList | undefined

  function readPreference() {
    if (!import.meta.client) return
    userReducedMotion.value = localStorage.getItem(MOTION_SETTING_KEY) === '1'
  }

  function syncSystemPreference(event?: MediaQueryList | MediaQueryListEvent) {
    prefersReducedMotion.value = Boolean(event?.matches ?? mediaQuery?.matches)
    motionReady.value = true
  }

  onMounted(() => {
    readPreference()
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    syncSystemPreference(mediaQuery)
    mediaQuery.addEventListener('change', syncSystemPreference)
  })

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', syncSystemPreference)
    mediaQuery = undefined
  })

  const reducedMotion = computed(() => userReducedMotion.value || prefersReducedMotion.value)
  const shouldAnimate = computed(() => !reducedMotion.value)

  function setReducedMotion(value: boolean) {
    userReducedMotion.value = value
    if (import.meta.client) {
      localStorage.setItem(MOTION_SETTING_KEY, value ? '1' : '0')
    }
  }

  function toggleReducedMotion() {
    setReducedMotion(!userReducedMotion.value)
  }

  return {
    reducedMotion,
    prefersReducedMotion,
    shouldAnimate,
    motionReady,
    setReducedMotion,
    toggleReducedMotion,
  }
}
