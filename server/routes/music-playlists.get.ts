// 网易云歌单代理：搜索使用网易云官方接口，详情与歌曲使用 GD Studio 数据。
// 统一在服务端请求，避免浏览器直连网易云时被 CORS 或 mixed content 拦截。

const NETEASE_SEARCH_API = 'https://music.163.com/api/search/get/web'
const GD_PLAYLIST_API = 'https://music-api.gdstudio.xyz/api.php'

function positiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Referer: 'https://music.163.com/',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const action = String(query.action || 'search')

  try {
    if (action === 'search' || action === 'discover') {
      const keyword = String(query.q || '').trim()
      if (action === 'search' && !keyword) return { result: { playlists: [], playlistCount: 0 }, code: 200 }
      const page = positiveInt(query.page, 1, 1000)
      const count = positiveInt(query.count, 20, 50)
      const params = action === 'search'
        ? new URLSearchParams({
            s: keyword,
            type: '1000',
            offset: String((page - 1) * count),
            limit: String(count),
          })
        : new URLSearchParams({
            cat: String(query.category || '全部'),
            order: String(query.order || 'hot'),
            offset: String((page - 1) * count),
            limit: String(count),
          })
      const data = await fetchJson(`${action === 'search' ? NETEASE_SEARCH_API : 'https://music.163.com/api/playlist/list'}?${params.toString()}`)
      setHeader(event, 'Cache-Control', 'public, max-age=120')
      return data
    }

    const id = String(query.id || '').trim()
    if (!/^\d+$/.test(id)) {
      setResponseStatus(event, 400)
      return { error: 'invalid playlist id' }
    }

    const params = new URLSearchParams({ types: 'playlist', source: 'netease', id })
    const data = await fetchJson(`${GD_PLAYLIST_API}?${params.toString()}`) as {
      playlist?: { tracks?: unknown[] }
    }
    const playlist = data?.playlist
    if (!playlist) {
      setResponseStatus(event, 404)
      return { error: 'playlist not found' }
    }

    if (action === 'detail') {
      const { tracks: _tracks, ...metadata } = playlist
      setHeader(event, 'Cache-Control', 'public, max-age=300')
      return { playlist: metadata, code: 200 }
    }

    if (action === 'tracks') {
      const page = positiveInt(query.page, 1, 1000)
      const count = positiveInt(query.count, 50, 100)
      const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
      const start = (page - 1) * count
      setHeader(event, 'Cache-Control', 'public, max-age=300')
      return {
        playlist: { ...playlist, tracks: undefined },
        tracks: tracks.slice(start, start + count),
        total: tracks.length,
        code: 200,
      }
    }

    setResponseStatus(event, 400)
    return { error: 'unsupported action' }
  } catch (error) {
    setResponseStatus(event, 502)
    return { error: (error as Error)?.message || 'playlist upstream error' }
  }
})
