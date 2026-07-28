export type MediaTransform = { width?: number; height?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' }
type SupabaseLike = { supabaseUrl?: string; storage: { from: (bucket: string) => { upload: (path: string, file: File, options?: { contentType?: string; upsert?: boolean }) => Promise<{ error?: any }>; createSignedUrl: (path: string, expiresIn: number, options?: { transform?: MediaTransform }) => Promise<{ data?: { signedUrl?: string } | null; error?: unknown }>; createSignedUrls?: (paths: string[], expiresIn: number, options?: { transform?: MediaTransform }) => Promise<{ data?: Array<{ path?: string; signedUrl?: string }> | null; error?: unknown }> } }; auth?: { getSession: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } }
let resumableUploadsDisabled = false

type CachedUrl = { url: string; expiresAt: number }
const signedUrlCache = new Map<string, CachedUrl>()
const pendingUrlRequests = new Map<string, Promise<string>>()
// Supabase signs media URLs for 24 hours. Keep the browser-side URL cache
// shorter than that so a refreshed page can render without another round trip.
const CACHE_TTL = 20 * 60 * 60 * 1000
const REQUEST_TIMEOUT = 8000
const PERSISTED_CACHE_KEY = 'couple-space-media-url-cache-v2'
const MEDIA_CACHE_NAME = 'couple-space-media-v1'
const MEDIA_CACHE_INDEX_KEY = 'couple-space-media-cache-index-v1'
const MEDIA_CACHE_MAX_ENTRIES = 300
let persistedCacheLoaded = false
const mediaObjectUrlCache = new Map<string, string>()
const pendingMediaCacheRequests = new Map<string, Promise<string>>()

function cacheKey(bucket: string, path: string, transform?: MediaTransform) { return `${bucket}:${path}:${JSON.stringify(transform || {})}` }
function isPreviewPath(path: string) { return /(?:^|\/)(?:thumb|medium)\.(?:avif|webp|jpe?g|png)$/i.test(path) }
function shouldCacheMedia(path: string, transform?: MediaTransform) { return Boolean(transform) || isPreviewPath(path) }
function loadPersistedCache() {
  if (persistedCacheLoaded || typeof window === 'undefined') return
  persistedCacheLoaded = true
  try {
    const raw = window.localStorage.getItem(PERSISTED_CACHE_KEY) || window.sessionStorage.getItem(PERSISTED_CACHE_KEY)
    const entries = raw ? JSON.parse(raw) as Record<string, CachedUrl> : {}
    const now = Date.now()
    Object.entries(entries).forEach(([key, value]) => {
      if (value?.url && Number(value.expiresAt) > now) signedUrlCache.set(key, { url: value.url, expiresAt: Number(value.expiresAt) })
    })
  } catch { /* Storage can be unavailable in private browsing. */ }
}
function cacheUrl(key: string, url: string, expiresAt = Date.now() + CACHE_TTL) {
  // Refresh insertion order so the newest 300 entries survive the size cap.
  signedUrlCache.delete(key)
  signedUrlCache.set(key, { url, expiresAt })
  if (typeof window === 'undefined') return
  try {
    const entries = Array.from(signedUrlCache.entries()).slice(-300)
    const serialized = JSON.stringify(Object.fromEntries(entries))
    window.localStorage.setItem(PERSISTED_CACHE_KEY, serialized)
    // Keep a session copy for browsers that block persistent storage.
    window.sessionStorage.setItem(PERSISTED_CACHE_KEY, serialized)
  } catch { /* Storage can be unavailable in private browsing. */ }
}
async function withTimeout<T>(promise: Promise<T>, timeout = REQUEST_TIMEOUT): Promise<T | null> {
  return Promise.race([promise, new Promise<null>(resolve => globalThis.setTimeout(() => resolve(null), timeout))])
}

function mediaCacheRequest(key: string) {
  return `${window.location.origin}/__couple-space-media/${encodeURIComponent(key)}`
}

async function readCachedMedia(key: string) {
  if (!import.meta.client || !('caches' in window)) return ''
  const current = mediaObjectUrlCache.get(key)
  if (current) return current
  try {
    const cache = await window.caches.open(MEDIA_CACHE_NAME)
    const response = await cache.match(mediaCacheRequest(key))
    if (!response) return ''
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    mediaObjectUrlCache.set(key, objectUrl)
    return objectUrl
  } catch { return '' }
}

async function trimMediaCache(cache: Cache) {
  try {
    const raw = window.localStorage.getItem(MEDIA_CACHE_INDEX_KEY)
    const index = raw ? JSON.parse(raw) as string[] : []
    const next = [...new Set(index)].slice(-MEDIA_CACHE_MAX_ENTRIES)
    const stale = index.filter(key => !next.includes(key))
    await Promise.all(stale.map(key => cache.delete(mediaCacheRequest(key))))
    window.localStorage.setItem(MEDIA_CACHE_INDEX_KEY, JSON.stringify(next))
  } catch { /* Cache eviction is best effort. */ }
}

async function materializeMediaUrl(key: string, signedUrl: string, cacheable: boolean) {
  if (!cacheable || !import.meta.client || !('caches' in window)) return signedUrl

  // A local hit can be used immediately. For a miss, do not make the first
  // paint wait for a second full download: the signed URL is already a valid
  // image source, while Cache Storage is warmed in the background.
  const cached = await readCachedMedia(key)
  if (cached) return cached
  const pending = pendingMediaCacheRequests.get(key)
  if (!pending) {
    const request = (async () => {
      try {
        const response = await fetch(signedUrl, { cache: 'force-cache' })
        if (!response.ok) return signedUrl
        const cache = await window.caches.open(MEDIA_CACHE_NAME)
        await cache.put(mediaCacheRequest(key), response.clone())
        const index = JSON.parse(window.localStorage.getItem(MEDIA_CACHE_INDEX_KEY) || '[]') as string[]
        index.push(key)
        window.localStorage.setItem(MEDIA_CACHE_INDEX_KEY, JSON.stringify(index.slice(-MEDIA_CACHE_MAX_ENTRIES)))
        await trimMediaCache(cache)
      } catch {
        // Cache warming is best effort. The signed URL remains the source.
      } finally { pendingMediaCacheRequests.delete(key) }
      return signedUrl
    })()
    pendingMediaCacheRequests.set(key, request)
    // Deliberately do not await this request: returning the signed URL lets
    // the browser start decoding the image immediately.
    void request
  }
  return signedUrl
}

export async function clearCachedMedia(path?: string) {
  if (!import.meta.client || !('caches' in window)) return
  try {
    const matches = (key: string) => !path || key.includes(path)
    for (const [key, objectUrl] of mediaObjectUrlCache) if (matches(key)) { URL.revokeObjectURL(objectUrl); mediaObjectUrlCache.delete(key) }
    for (const key of signedUrlCache.keys()) if (matches(key)) signedUrlCache.delete(key)
    const persisted = JSON.parse(window.localStorage.getItem(PERSISTED_CACHE_KEY) || '{}') as Record<string, CachedUrl>
    Object.keys(persisted).forEach(key => { if (matches(key)) delete persisted[key] })
    window.localStorage.setItem(PERSISTED_CACHE_KEY, JSON.stringify(persisted))
    const cache = await window.caches.open(MEDIA_CACHE_NAME)
    const keys = await cache.keys()
    await Promise.all(keys.filter(request => !path || decodeURIComponent(request.url.split('/').pop() || '').includes(path)).map(request => cache.delete(request)))
  } catch { /* Cache cleanup is best effort. */ }
}

export function mediaBucketForPath(path: string, legacy = false) {
  if (legacy && !path.includes('/album-media/') && !path.startsWith('album-media/')) return 'memory-photos'
  return path.includes('/album-media/') || path.startsWith('album-media/') ? 'album-media' : 'memory-photos'
}

export async function createMediaSignedUrl(supabase: SupabaseLike | null | undefined, path: string, bucket?: string, transform?: MediaTransform, expiresIn = 86400) {
  if (!supabase || !path) return ''
  loadPersistedCache()
  const targetBucket = bucket || mediaBucketForPath(path)
  const key = cacheKey(targetBucket, path, transform)
  const cachedMedia = await readCachedMedia(key)
  if (cachedMedia) return cachedMedia
  const cached = signedUrlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return materializeMediaUrl(key, cached.url, shouldCacheMedia(path, transform))
  const pending = pendingUrlRequests.get(key)
  if (pending) return pending
  const request = (async () => {
    try {
      const response = await withTimeout(supabase.storage.from(targetBucket).createSignedUrl(path, expiresIn, transform ? { transform } : undefined))
      if (response && response.data?.signedUrl) { cacheUrl(key, response.data.signedUrl); return materializeMediaUrl(key, response.data.signedUrl, shouldCacheMedia(path, transform)) }
      // Image transformation can be unavailable for an older bucket or a
      // regional edge. Fall back to the original signed object instead of
      // leaving the tile spinning forever.
      if (transform) {
        const fallback = await withTimeout(supabase.storage.from(targetBucket).createSignedUrl(path, expiresIn))
        const url = fallback?.data?.signedUrl || ''
        if (url) { cacheUrl(key, url); cacheUrl(cacheKey(targetBucket, path), url) }
        return url ? materializeMediaUrl(key, url, shouldCacheMedia(path, transform)) : ''
      }
      return ''
    } catch { return '' }
    finally { pendingUrlRequests.delete(key) }
  })()
  pendingUrlRequests.set(key, request)
  return request
}

export async function createMediaSignedUrls(supabase: SupabaseLike | null | undefined, items: Array<{ path: string; bucket?: string; transform?: MediaTransform }>, expiresIn = 86400) {
  const result = new Map<string, string>()
  if (!supabase || !items.length) return result
  loadPersistedCache()
  const groups = new Map<string, Array<{ path: string; transform?: MediaTransform }>>()
  for (const item of items.filter(item => item.path)) {
    const bucket = item.bucket || mediaBucketForPath(item.path)
    const key = `${bucket}:${JSON.stringify(item.transform || {})}`
    const list = groups.get(key) || []
    list.push({ path: item.path, transform: item.transform })
    groups.set(key, list)
  }
  await Promise.all(Array.from(groups.entries()).map(async ([key, group]) => {
    const bucket = key.split(':', 1)[0]!
    const api = supabase.storage.from(bucket)
   const uncached: Array<{ path: string; transform?: MediaTransform }> = []
    const uncachedItems = await Promise.all(group.map(async item => {
      const itemKey = cacheKey(bucket, item.path, item.transform)
      const cachedMedia = await readCachedMedia(itemKey)
      if (cachedMedia) { result.set(`${bucket}:${item.path}`, cachedMedia); return null }
      const cached = signedUrlCache.get(itemKey)
      if (cached && cached.expiresAt > Date.now()) { result.set(`${bucket}:${item.path}`, await materializeMediaUrl(itemKey, cached.url, shouldCacheMedia(item.path, item.transform))); return null }
      return item
    }))
    uncached.push(...uncachedItems.filter((item): item is { path: string; transform?: MediaTransform } => Boolean(item)))
    if (!uncached.length) return
    if (api.createSignedUrls) {
      const response = await withTimeout(api.createSignedUrls(uncached.map(item => item.path), expiresIn, uncached[0]?.transform ? { transform: uncached[0].transform } : undefined).catch(() => null))
      await Promise.all((response?.data || []).filter(item => item.path && item.signedUrl).map(async item => {
        const transform = uncached.find(candidate => candidate.path === item.path)?.transform
        const itemKey = cacheKey(bucket, item.path!, transform)
        cacheUrl(itemKey, item.signedUrl!)
        result.set(`${bucket}:${item.path}`, await materializeMediaUrl(itemKey, item.signedUrl!, shouldCacheMedia(item.path!, transform)))
      }))
    }
    if (!api.createSignedUrls || responseHasMissing(result, bucket, uncached)) {
      await Promise.all(uncached.filter(item => !result.has(`${bucket}:${item.path}`)).map(async item => {
        const url = await createMediaSignedUrl(supabase, item.path, bucket, item.transform, expiresIn)
        if (url) result.set(`${bucket}:${item.path}`, url)
      }))
    }
  }))
  return result
}

function responseHasMissing(result: Map<string, string>, bucket: string, items: Array<{ path: string }>) { return items.some(item => !result.has(`${bucket}:${item.path}`)) }

export async function refreshMediaElement(event: Event, supabase: SupabaseLike | null | undefined, path: string, bucket?: string, transform?: MediaTransform) {
  const element = event.currentTarget as (HTMLImageElement | HTMLVideoElement | HTMLAudioElement) | null
  if (!element || !path || element.dataset.mediaRetried === '1') return false
  element.dataset.mediaRetried = '1'
  const nextUrl = await createMediaSignedUrl(supabase, path, bucket, transform)
  if (!nextUrl) return false
  element.src = nextUrl
  if (element instanceof HTMLVideoElement) element.load()
  return true
}

/** Shrink camera images before upload so future loads are CDN-sized by default. */
export async function prepareImageForUpload(file: File, maxSide = 1920, quality = 0.82) {
  // Keep animated GIFs intact; canvas compression would flatten them to one frame.
  if (file.type === 'image/gif') return file
  if (!import.meta.client || !file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / bitmap.width, maxSide / bitmap.height)
    if (scale === 1 && file.size <= 2.5 * 1024 * 1024) { bitmap.close(); return file }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) { bitmap.close(); return file }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}

/** Upload through Supabase Storage's Tus endpoint with automatic chunk retry.
 * Falls back to the regular Storage upload when the project/client does not
 * expose a resumable endpoint (for example an older local Supabase stack).
 */
export async function uploadMediaResumable(supabase: SupabaseLike | null | undefined, bucket: string, path: string, file: File, onProgress?: (value: number) => void, upsert = false) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const fallback = () => supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert })
  const endpoint = supabase.supabaseUrl ? `${String(supabase.supabaseUrl).replace(/\/$/, '')}/storage/v1/upload/resumable` : ''
  let accessToken = ''
  try { accessToken = String((await supabase.auth?.getSession())?.data?.session?.access_token || '') } catch { /* Use fallback below. */ }
  if (!endpoint || !accessToken || !import.meta.client || resumableUploadsDisabled) return fallback()
  try {
    const { Upload } = await import('tus-js-client')
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint,
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        removeFingerprintOnSuccess: true,
        headers: { authorization: `Bearer ${accessToken}`, 'x-upsert': String(upsert) },
        metadata: { bucketName: bucket, objectName: path, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
        onError: reject,
        onProgress: (bytesUploaded: number, bytesTotal: number) => onProgress?.(bytesTotal ? Math.round(bytesUploaded / bytesTotal * 100) : 0),
        onSuccess: () => resolve(),
      })
      upload.start()
    })
    return { error: null }
  } catch (error: any) {
    const status = Number(error?.originalResponse?.getStatus?.() || error?.status || 0)
    // Some hosted Supabase projects expose Storage uploads but disable the
    // Tus resumable endpoint. Remember that capability failure for this tab
    // and use the regular upload path without retrying a doomed request.
    if ([401, 403].includes(status)) resumableUploadsDisabled = true
    if (![401, 403, 404, 405, 501].includes(status)) throw error
    return fallback()
  }
}

export type PreparedImageVariants = { thumb: File; medium: File; original: File }

/**
 * Create CDN-sized image variants before upload. The original file is kept as
 * a compressed, bounded copy; list views should only ever request thumb.
 */
export async function prepareImageVariants(file: File): Promise<PreparedImageVariants> {
  if (!import.meta.client || !file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return { thumb: file, medium: file, original: file }
  }
  try {
    const bitmap = await createImageBitmap(file)
    const encode = async (maxSide: number, quality: number, suffix: string) => {
      const scale = Math.min(1, maxSide / bitmap.width, maxSide / bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) return file
      // JPEG has no alpha; white avoids a black background for transparent PNGs.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) return file
      const name = (file.name.replace(/\.[^.]+$/, '') || 'photo') + suffix + '.jpg'
      return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
    }
    const [thumb, medium, original] = await Promise.all([
      encode(480, 0.68, '-thumb'),
      encode(1280, 0.80, '-medium'),
      encode(2560, 0.86, '-original'),
    ])
    bitmap.close()
    return { thumb, medium, original }
  } catch {
    return { thumb: file, medium: file, original: file }
  }
}

/** Best-effort browser video compression for large uploads. Falls back to the original file when capture is unavailable. */
export async function prepareVideoForUpload(file: File, maxBytes = 40 * 1024 * 1024) {
  if (!import.meta.client || !file.type.startsWith('video/') || file.size <= maxBytes || typeof MediaRecorder === 'undefined') return file
  const canCapture = typeof HTMLVideoElement !== 'undefined' && 'captureStream' in HTMLVideoElement.prototype
  if (!canCapture) return file
  const sourceUrl = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.src = sourceUrl
    video.playsInline = true
    video.muted = true
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('视频读取失败')) })
    const stream = (video as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream()
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type)) || ''
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_800_000, audioBitsPerSecond: 96_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    const stopped = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error('视频压缩失败')) })
    recorder.start(250)
    await video.play()
    await new Promise<void>(resolve => { video.onended = () => resolve() })
    recorder.stop()
    await stopped
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
    if (!blob.size || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') || 'video'
    return new File([blob], `${name}.webm`, { type: blob.type, lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

/** Extract a lightweight first-frame cover so video grids never start as a black tile. */
export async function createVideoPoster(file: File, maxSide = 960): Promise<File | null> {
  if (!import.meta.client || !file.type.startsWith('video/')) return null
  const sourceUrl = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.src = sourceUrl; video.muted = true; video.playsInline = true
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('视频封面读取失败')) })
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    video.currentTime = Math.min(0.2, duration > 0 ? duration / 3 : 0.2)
    await new Promise<void>((resolve, reject) => { video.onseeked = () => resolve(); video.onerror = () => reject(new Error('视频封面定位失败')) })
    const sourceWidth = video.videoWidth || maxSide; const sourceHeight = video.videoHeight || maxSide
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(sourceWidth * scale)); canvas.height = Math.max(1, Math.round(sourceHeight * scale))
    const context = canvas.getContext('2d'); if (!context) return null
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78))
    return blob ? new File([blob], 'poster.jpg', { type: 'image/jpeg' }) : null
  } catch { return null } finally { URL.revokeObjectURL(sourceUrl) }
}

export function revealVideoFrame(event: Event) {
  const video = event.currentTarget as HTMLVideoElement
  const reveal = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return
    video.currentTime = Math.min(0.15, video.duration / 2)
    void video.play().then(() => { video.pause() }).catch(() => undefined)
  }
  if (video.readyState >= 2) reveal()
  else video.addEventListener('loadeddata', reveal, { once: true })
}
