async function clearDevelopmentServiceWorkers() {
  if (!('serviceWorker' in navigator)) return false
  const registrations = await navigator.serviceWorker.getRegistrations()
  const localRegistrations = registrations.filter(registration => {
    try { return new URL(registration.scope).origin === window.location.origin }
    catch { return false }
  })
  const unregistered = await Promise.all(localRegistrations.map(registration => registration.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('love-home-shell-')).map(key => caches.delete(key)))
  }
  return unregistered.some(Boolean)
}

export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  if (!['http:', 'https:'].includes(window.location.protocol)) return

  // A cache-first service worker is useful for production assets but breaks
  // Nuxt/Vite HMR by serving stale /_nuxt/ modules during local development.
  if (import.meta.dev || ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    const reloadKey = 'couplespace-dev-sw-cleaned'
    if (sessionStorage.getItem(reloadKey) !== '1') {
      sessionStorage.setItem(reloadKey, '1')
      void clearDevelopmentServiceWorkers().then(changed => {
        if (changed || navigator.serviceWorker.controller) window.location.reload()
      }).catch(() => undefined)
    }
    return
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
})
