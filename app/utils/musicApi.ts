// 统一音乐 API 客户端（GD Studio API 协议），支持网易云 / JOOX 双音源
// 端点降级策略：优先同源代理（绕 CORS），失败后直连，失败节点进入冷却期

export type MusicSource = 'netease' | 'joox' | 'higequ'

export interface MusicTrack {
  id: string
  name: string
  artist: string[]
  album: string
  picId: string
  coverUrl?: string
  urlId: string
  lyricId: string
  source: MusicSource
}

export interface MusicPlaylist {
  id: string
  name: string
  coverUrl: string
  description: string
  creatorName: string
  trackCount: number
  playCount: number
  source: 'netease'
}

export const MUSIC_SOURCES: { value: MusicSource; label: string }[] = [
  { value: 'netease', label: '网易云' },
  { value: 'joox', label: 'JOOX' },
  { value: 'higequ', label: 'Hi歌' },
]

export function isUsableAudioUrl(value: unknown): value is string {
  return typeof value === 'string'
    && /^https?:\/\//i.test(value.trim())
    && !/^(?:about:|javascript:)/i.test(value.trim())
}

const DIRECT_API_URL = 'https://music-api.gdstudio.xyz/api.php'
// 同源代理路径：开发环境走 Nuxt devProxy，生产环境走 Cloudflare Pages Function
const PROXY_API_URL = '/music'
const HIGEQU_PROXY_API_URL = '/music-higequ'
const ENDPOINTS = [PROXY_API_URL, DIRECT_API_URL]

const REQUEST_TIMEOUT_MS = 9000
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000
const PIC_CACHE_KEY = 'couple-space-music-pics-v1'
const PIC_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const URL_CACHE_KEY = 'couple-space-music-urls-v1'
const URL_CACHE_TTL = 15 * 60 * 1000
const picCache = new Map<string, { url: string; at: number }>()
const urlCache = new Map<string, { url: string; at: number }>()
const picPending = new Map<string, Promise<string | null>>()
const urlPending = new Map<string, Promise<string | null>>()
let picCacheLoaded = false
let urlCacheLoaded = false

function loadPicCache() {
  if (picCacheLoaded || !import.meta.client) return
  picCacheLoaded = true
  try {
    const entries = JSON.parse(localStorage.getItem(PIC_CACHE_KEY) || '{}') as Record<string, { url: string; at: number }>
    const now = Date.now()
    Object.entries(entries).forEach(([key, value]) => {
      if (value?.url && now - Number(value.at) < PIC_CACHE_TTL) picCache.set(key, value)
    })
  } catch { /* Storage may be unavailable. */ }
}

function persistPicCache() {
  if (!import.meta.client) return
  try {
    const entries = Array.from(picCache.entries()).slice(-200)
    localStorage.setItem(PIC_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch { /* Cache persistence is best effort. */ }
}

function loadUrlCache() {
  if (urlCacheLoaded || !import.meta.client) return
  urlCacheLoaded = true
  try {
    const entries = JSON.parse(localStorage.getItem(URL_CACHE_KEY) || '{}') as Record<string, { url: string; at: number }>
    const now = Date.now()
    Object.entries(entries).forEach(([key, value]) => {
      if (value?.url && now - Number(value.at) < URL_CACHE_TTL) urlCache.set(key, value)
    })
  } catch { /* Storage may be unavailable. */ }
}

function persistUrlCache() {
  if (!import.meta.client) return
  try { localStorage.setItem(URL_CACHE_KEY, JSON.stringify(Object.fromEntries(Array.from(urlCache.entries()).slice(-80)))) } catch { /* Best effort. */ }
}

interface RawApiTrack {
  id: string
  name: string
  artist: string[] | string
  album: string
  pic_id: string
  pic_url?: string
  picUrl?: string
  cover_url?: string
  coverUrl?: string
  url_id: string
  lyric_id: string
  source: string
}

interface RawNeteasePlaylistTrack {
  id?: string | number
  name?: string
  ar?: Array<{ name?: string }>
  artists?: Array<{ name?: string }>
  al?: { name?: string; pic?: string | number; picUrl?: string }
  album?: { name?: string; pic?: string | number; picUrl?: string }
}

interface RawNeteasePlaylist {
  id?: string | number
  name?: string
  coverImgUrl?: string
  coverUrl?: string
  description?: string | null
  creator?: { nickname?: string }
  trackCount?: number
  playCount?: number
  tracks?: RawNeteasePlaylistTrack[]
}

function httpsUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^http:\/\//i, 'https://')
}

export function normalizeNeteasePlaylist(raw: RawNeteasePlaylist | null | undefined): MusicPlaylist | null {
  if (!raw?.id || !raw.name) return null
  return {
    id: String(raw.id),
    name: String(raw.name),
    coverUrl: httpsUrl(raw.coverImgUrl || raw.coverUrl),
    description: typeof raw.description === 'string' ? raw.description : '',
    creatorName: raw.creator?.nickname || '网易云用户',
    trackCount: Number.isFinite(Number(raw.trackCount)) ? Number(raw.trackCount) : 0,
    playCount: Number.isFinite(Number(raw.playCount)) ? Number(raw.playCount) : 0,
    source: 'netease',
  }
}

export function normalizeNeteasePlaylistTrack(raw: RawNeteasePlaylistTrack | null | undefined): MusicTrack | null {
  if (!raw?.id || !raw.name) return null
  const artists = Array.isArray(raw.ar) ? raw.ar : raw.artists
  const album = raw.al || raw.album
  const rawPicId = String(album?.pic ?? '')
  const directCover = httpsUrl(album?.picUrl) || (isUsableAudioUrl(rawPicId) ? httpsUrl(rawPicId) : '')
  return {
    id: String(raw.id),
    name: String(raw.name),
    artist: (artists || []).map(item => item?.name || '').filter(Boolean),
    album: album?.name || '',
    picId: directCover ? '' : rawPicId,
    coverUrl: directCover,
    urlId: String(raw.id),
    lyricId: String(raw.id),
    source: 'netease',
  }
}

interface NeteasePlaylistSearchResponse {
  result?: { playlists?: RawNeteasePlaylist[] }
}

interface NeteasePlaylistDetailResponse {
  playlist?: RawNeteasePlaylist
}

interface NeteasePlaylistTracksResponse {
  playlist?: RawNeteasePlaylist
  tracks?: RawNeteasePlaylistTrack[]
  total?: number
}

const PLAYLIST_API_URL = '/music-playlists'

// 失败端点冷却记录（内存级，页面刷新即重置）
const endpointFailures = new Map<string, number>()

function activeEndpoints(now = Date.now()): string[] {
  const healthy: string[] = []
  const cooling: string[] = []
  for (const endpoint of ENDPOINTS) {
    const until = endpointFailures.get(endpoint)
    if (!until || until <= now) {
      endpointFailures.delete(endpoint)
      healthy.push(endpoint)
    } else {
      cooling.push(endpoint)
    }
  }
  return [...healthy, ...cooling]
}

function markFailure(endpoint: string) {
  endpointFailures.set(endpoint, Date.now() + FAILURE_COOLDOWN_MS)
}

function markSuccess(endpoint: string) {
  endpointFailures.delete(endpoint)
}

function buildUrl(base: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  return `${base}?${search.toString()}`
}

async function requestJson<T>(params: Record<string, string | number | undefined>, signal?: AbortSignal): Promise<T> {
  const source = params.source
  if (source === 'higequ') {
    return requestJsonFromEndpoints<T>([HIGEQU_PROXY_API_URL], params, signal)
  }
  return requestJsonFromEndpoints<T>(ENDPOINTS, params, signal)
}

async function requestJsonFromEndpoints<T>(
  endpoints: string[],
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown = new Error('没有可用的音乐 API 端点')
  const orderedEndpoints = endpoints === ENDPOINTS ? activeEndpoints() : endpoints
  for (const endpoint of orderedEndpoints) {
    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
    const url = buildUrl(endpoint, params)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as T
      markSuccess(endpoint)
      return data
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' && signal?.aborted) throw e
      markFailure(endpoint)
      lastError = e
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
  throw lastError
}

function normalizeTrack(raw: RawApiTrack, source: MusicSource): MusicTrack {
  const rawPicId = String(raw.pic_id ?? '')
  const directCover = httpsUrl(raw.pic_url || raw.picUrl || raw.cover_url || raw.coverUrl)
    || (isUsableAudioUrl(rawPicId) ? httpsUrl(rawPicId) : '')
  return {
    id: String(raw.id),
    name: raw.name,
    artist: Array.isArray(raw.artist) ? raw.artist : [raw.artist || ''],
    album: raw.album || '',
    picId: directCover ? '' : rawPicId,
    coverUrl: directCover,
    urlId: String(raw.url_id ?? raw.id),
    lyricId: String(raw.lyric_id ?? raw.id),
    source,
  }
}

export async function searchMusic(query: string, source: MusicSource, page = 1, count = 20, signal?: AbortSignal): Promise<MusicTrack[]> {
  const raw = await requestJson<RawApiTrack[]>({ types: 'search', name: query, count, pages: page, source }, signal)
  if (!Array.isArray(raw)) return []
  return raw.map(item => normalizeTrack(item, source))
}

async function requestPlaylistJson<T>(
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  return requestJsonFromEndpoints<T>([PLAYLIST_API_URL], params, signal)
}

export async function searchPlaylists(
  query: string,
  page = 1,
  count = 20,
  signal?: AbortSignal,
): Promise<MusicPlaylist[]> {
  const raw = await requestPlaylistJson<NeteasePlaylistSearchResponse>({
    action: 'search',
    q: query,
    page,
    count,
  }, signal)
  const items = raw?.result?.playlists
  if (!Array.isArray(items)) return []
  return items.map(normalizeNeteasePlaylist).filter((item): item is MusicPlaylist => Boolean(item))
}

export async function discoverPlaylists(
  category = '全部',
  page = 1,
  count = 20,
  signal?: AbortSignal,
): Promise<MusicPlaylist[]> {
  const raw = await requestPlaylistJson<{ playlists?: RawNeteasePlaylist[] }>({
    action: 'discover',
    category,
    page,
    count,
  }, signal)
  const items = raw?.playlists
  if (!Array.isArray(items)) return []
  return items.map(normalizeNeteasePlaylist).filter((item): item is MusicPlaylist => Boolean(item))
}

export async function getPlaylistDetail(id: string, signal?: AbortSignal): Promise<MusicPlaylist | null> {
  if (!id) return null
  const raw = await requestPlaylistJson<NeteasePlaylistDetailResponse>({
    action: 'detail',
    id,
  }, signal)
  return normalizeNeteasePlaylist(raw?.playlist)
}

export async function getPlaylistTracks(
  id: string,
  page = 1,
  count = 50,
  signal?: AbortSignal,
): Promise<MusicTrack[]> {
  if (!id) return []
  const raw = await requestPlaylistJson<NeteasePlaylistTracksResponse>({
    action: 'tracks',
    id,
    page,
    count,
  }, signal)
  const items = Array.isArray(raw?.tracks) ? raw.tracks : raw?.playlist?.tracks
  if (!Array.isArray(items)) return []
  return items.map(normalizeNeteasePlaylistTrack).filter((item): item is MusicTrack => Boolean(item))
}

export async function getSongUrl(track: MusicTrack, bitrate = 192): Promise<string | null> {
  const json = await requestJson<{ url?: string }>({ types: 'url', id: track.urlId, br: bitrate, source: track.source })
  return isUsableAudioUrl(json.url) ? json.url.trim() : null
}

export async function getSongPic(track: MusicTrack, size = 500): Promise<string | null> {
  if (track.coverUrl) return track.coverUrl
  if (!track.picId) return null
  const json = await requestJson<{ url?: string }>({ types: 'pic', id: track.picId, size, source: track.source })
  return httpsUrl(json.url) || null
}

export async function getSongUrlCached(track: MusicTrack, bitrate = 192, force = false): Promise<string | null> {
  loadUrlCache()
  const key = `${track.source}:${track.urlId}:${bitrate}`
  if (force) urlCache.delete(key)
  const cached = urlCache.get(key)
  if (cached && Date.now() - cached.at < URL_CACHE_TTL) return cached.url
  if (!force) {
    const pending = urlPending.get(key)
    if (pending) return pending
  }
  const request = getSongUrl(track, bitrate)
    .then(url => {
      if (url) { urlCache.set(key, { url, at: Date.now() }); persistUrlCache() }
      return url
    })
    .finally(() => { urlPending.delete(key) })
  urlPending.set(key, request)
  return request
}

/** Cached cover lookup: covers are stable enough to survive page changes and refreshes. */
export async function getSongPicCached(track: MusicTrack, size = 500): Promise<string | null> {
  loadPicCache()
  const key = `${track.source}:${track.picId || track.coverUrl || track.id}:${size}`
  if (!track.picId && !track.coverUrl) return null
  const cached = picCache.get(key)
  if (cached && Date.now() - cached.at < PIC_CACHE_TTL) return cached.url
  const pending = picPending.get(key)
  if (pending) return pending
  const request = getSongPic(track, size)
    .then(url => {
      if (url) {
        picCache.set(key, { url, at: Date.now() })
        persistPicCache()
      }
      return url
    })
    .finally(() => { picPending.delete(key) })
  picPending.set(key, request)
  return request
}

export async function getSongLyric(track: MusicTrack): Promise<{ lyric: string; tlyric: string } | null> {
  const json = await requestJson<{ lyric?: string; tlyric?: string }>({ types: 'lyric', id: track.lyricId, source: track.source })
  return { lyric: json.lyric ?? '', tlyric: json.tlyric ?? '' }
}
