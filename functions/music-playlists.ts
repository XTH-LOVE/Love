// Cloudflare Pages Function：网易云歌单搜索、详情与歌曲列表代理。

const NETEASE_SEARCH_API = 'https://music.163.com/api/search/get/web'
const GD_PLAYLIST_API = 'https://music-api.gdstudio.xyz/api.php'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

function positiveInt(value: string | null, fallback: number, max: number) {
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
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  const url = new URL(request.url)
  const action = url.searchParams.get('action') || 'search'

  try {
    let data: unknown
    if (action === 'search' || action === 'discover') {
      const keyword = (url.searchParams.get('q') || '').trim()
      if (action === 'search' && !keyword) data = { result: { playlists: [], playlistCount: 0 }, code: 200 }
      else {
        const page = positiveInt(url.searchParams.get('page'), 1, 1000)
        const count = positiveInt(url.searchParams.get('count'), 20, 50)
        const params = action === 'search'
          ? new URLSearchParams({
              s: keyword,
              type: '1000',
              offset: String((page - 1) * count),
              limit: String(count),
            })
          : new URLSearchParams({
              cat: url.searchParams.get('category') || '全部',
              order: url.searchParams.get('order') || 'hot',
              offset: String((page - 1) * count),
              limit: String(count),
            })
        data = await fetchJson(`${action === 'search' ? NETEASE_SEARCH_API : 'https://music.163.com/api/playlist/list'}?${params.toString()}`)
      }
    } else {
      const id = (url.searchParams.get('id') || '').trim()
      if (!/^\d+$/.test(id)) {
        return new Response(JSON.stringify({ error: 'invalid playlist id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const params = new URLSearchParams({ types: 'playlist', source: 'netease', id })
      const raw = await fetchJson(`${GD_PLAYLIST_API}?${params.toString()}`) as { playlist?: { tracks?: unknown[] } }
      const playlist = raw?.playlist
      if (!playlist) {
        return new Response(JSON.stringify({ error: 'playlist not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (action === 'detail') {
        const { tracks: _tracks, ...metadata } = playlist
        data = { playlist: metadata, code: 200 }
      } else if (action === 'tracks') {
        const page = positiveInt(url.searchParams.get('page'), 1, 1000)
        const count = positiveInt(url.searchParams.get('count'), 50, 100)
        const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
        const start = (page - 1) * count
        data = { playlist: { ...playlist, tracks: undefined }, tracks: tracks.slice(start, start + count), total: tracks.length, code: 200 }
      } else {
        return new Response(JSON.stringify({ error: 'unsupported action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error)?.message || 'playlist upstream error' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
