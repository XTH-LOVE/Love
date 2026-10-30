const VERSION = 'love-home-shell-v2'
const CORE_ASSETS = [
  '/manifest.webmanifest',
  '/couplespace-mark.svg',
  '/desktop-icon.png',
  '/favicon.ico',
]

const isDevelopmentHost = ['localhost', '127.0.0.1'].includes(self.location.hostname)

if (isDevelopmentHost) {
  // Never keep a cache-first worker active in Nuxt/Vite development. It can
  // serve stale virtual modules before the app has a chance to clean itself up.
  self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting())
  })

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.filter(key => key.startsWith('love-home-shell-')).map(key => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
        .then(clients => Promise.all(clients.map(client => client.navigate(client.url).catch(() => undefined)))),
    )
  })
} else {
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(VERSION)
        .then(cache => cache.addAll(CORE_ASSETS))
        .then(() => self.skipWaiting()),
    )
  })

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.filter(key => key.startsWith('love-home-shell-') && key !== VERSION).map(key => caches.delete(key))))
        .then(() => self.clients.claim()),
    )
  })

  self.addEventListener('fetch', event => {
    const request = event.request
    if (request.method !== 'GET') return

    const url = new URL(request.url)
    if (url.origin !== self.location.origin) return

    // Supabase signed media already has its own bounded Cache Storage layer.
    // Avoid duplicating private photos, videos, audio, or API responses here.
    if (request.destination === 'image' || request.destination === 'video' || request.destination === 'audio' || url.pathname.startsWith('/api/')) return

    // Navigation requests: network-first with cache fallback.
    // Always fetch fresh HTML so asset hashes match the current deployment.
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then(response => {
            const copy = response.clone()
            void caches.open(VERSION).then(cache => cache.put(request, copy))
            return response
          })
          .catch(() => caches.match(request)
            .then(cached => cached || new Response('Love小家当前离线，请稍后重试。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))),
      )
      return
    }

    // Content-hashed /_nuxt/ assets are immutable: cache-first, network fallback.
    // Never synthesize error responses — let the browser surface real failures.
    if (url.pathname.startsWith('/_nuxt/') || CORE_ASSETS.includes(url.pathname)) {
      event.respondWith(
        caches.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone()
              void caches.open(VERSION).then(cache => cache.put(request, copy))
            }
            return response
          })
        }),
      )
    }
  })
}
