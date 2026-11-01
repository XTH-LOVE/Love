type AppUpdateManifest = {
  version: string
  buildId?: string
  title?: string
  notes?: string[]
  apkUrl?: string
  desktopUrl?: string
  webUrl?: string
  publishedAt?: string
  mandatory?: boolean
}

function versionParts(value: string) {
  return value.split('.').map(part => Number.parseInt(part, 10) || 0)
}

function isNewer(remote: string, local: string) {
  const a = versionParts(remote)
  const b = versionParts(local)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0)
  }
  return false
}

export function useAppUpdate() {
  const config = useRuntimeConfig()
  const manifest = ref<AppUpdateManifest | null>(null)
  const checking = ref(false)
  const dismissedVersion = ref('')
  const currentVersion = String(config.public.appVersion || '1.0.0')
  const currentBuildId = String(config.public.appBuild || 'local')
  const updateUrl = String(config.public.updateManifestUrl || '')
  const isAndroid = computed(() => import.meta.client && /Android/i.test(navigator.userAgent))
  const remoteIsNewer = computed(() => {
    if (!manifest.value) return false
    if (isNewer(manifest.value.version, currentVersion)) return true
    return Boolean(!isAndroid.value && manifest.value.buildId && currentBuildId !== 'local' && manifest.value.buildId !== currentBuildId)
  })
  const dismissedKey = computed(() => `couple-space-update-dismissed:${manifest.value?.version || ''}:${manifest.value?.buildId || ''}`)
  const available = computed(() => Boolean(remoteIsNewer.value && dismissedVersion.value !== dismissedKey.value))

  function loadDismissed() {
    if (!import.meta.client) return
    dismissedVersion.value = localStorage.getItem('couple-space-update-dismissed') || ''
  }

  async function check() {
    if (!import.meta.client || !updateUrl || checking.value) return
    checking.value = true
    try {
      const response = await fetch(`${updateUrl}${updateUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) return
      const next = await response.json() as AppUpdateManifest
      if (next?.version && isNewer(next.version, currentVersion)) manifest.value = next
    } catch {
      // Update checks are best-effort and must never block login or app startup.
    } finally {
      checking.value = false
    }
  }

  function dismiss() {
    if (!manifest.value) return
    dismissedVersion.value = dismissedKey.value
    if (import.meta.client) localStorage.setItem('couple-space-update-dismissed', dismissedVersion.value)
  }

  async function openUpdate() {
    const isElectron = /Electron/i.test(navigator.userAgent)
    const webUrl = manifest.value?.webUrl
    const sameOrigin = Boolean(webUrl && new URL(webUrl, window.location.href).origin === window.location.origin)
    if (!isAndroid.value && !isElectron && sameOrigin) {
      await navigator.serviceWorker?.getRegistration('/')?.then(registration => registration?.update()).catch(() => undefined)
      window.location.reload()
      return
    }
    const target = isAndroid.value
      ? manifest.value?.apkUrl || manifest.value?.webUrl
      : isElectron
        ? manifest.value?.desktopUrl || manifest.value?.webUrl || updateUrl
        : manifest.value?.webUrl || updateUrl
    if (!target) return
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  onMounted(loadDismissed)

  return { currentVersion, currentBuildId, manifest, checking, available, isAndroid, check, dismiss, openUpdate }
}
