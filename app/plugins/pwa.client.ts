export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  if (!['http:', 'https:'].includes(window.location.protocol)) return
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
})
