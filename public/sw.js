const VERSION = 'love-home-shell-v1'
const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/couplespace-mark.svg',
  '/desktop-icon.png',
  '/favicon.ico',
]

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

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          void caches.open(VERSION).then(cache => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')
          .then(response => response || new Response('Love小家当前离线，请稍后重试。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))),
    )
    return
  }

  if (url.pathname.startsWith('/_nuxt/') || CORE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const update = fetch(request)
          .then(response => {
            if (response.ok) void caches.open(VERSION).then(cache => cache.put(request, response.clone()))
            return response
          })
          .catch(() => cached || new Response('', { status: 504, statusText: 'Offline asset unavailable' }))
        return cached || update
      }),
    )
  }
})
