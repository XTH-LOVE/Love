// Cloudflare Pages Function 版本的 Hi歌适配器，与 server/routes/music-higequ.get.ts 保持同一协议。
const HIGEQU_BASE = 'https://higequ.com'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

function decodeHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim()
}

async function fetchHtml(path: string) {
  const response = await fetch(`${HIGEQU_BASE}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' } })
  if (!response.ok) throw new Error(`Hi歌请求失败：HTTP ${response.status}`)
  return response.text()
}

function parseSearch(html: string) {
  const matches = Array.from(html.matchAll(/data-rid\s*=\s*["']([^"']+)["']/gi))
  return matches.flatMap((match, index) => {
    const start = (match.index || 0) + match[0].length
    const block = html.slice(start, matches[index + 1]?.index ?? html.length)
    const text = (className: string) => decodeHtml(block.match(new RegExp(`<[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</[^>]+>`, 'i'))?.[1] || '')
    const name = text('result-title')
    return name ? [{ id: match[1].trim(), name, artist: text('result-artist'), album: text('result-album').replace(/^专辑[:：]\s*/, ''), pic_id: match[1].trim(), url_id: match[1].trim(), lyric_id: match[1].trim() }] : []
  })
}

function parseDetail(html: string) {
  // Hi歌改版后由 `const encodedUrl = "..."` 注入播放器，兼容旧版 code 写法。
  const code = html.match(/(?:let|const|var)\s+(?:encodedUrl|code)\s*=\s*["']([^"']+)["']/i)?.[1]
  let url = ''
  if (code) {
    try { url = atob(code) } catch { /* malformed source page */ }
  }
  const pic = html.match(/id=["']album-cover["'][^>]*src=["']([^"']+)["']/i)?.[1] || ''
  const lyric = Array.from(html.matchAll(/<[^>]*class=["'][^"']*\blyric-line\b[^"']*["'][^>]*data-time=["']([^"']+)["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)).map(match => {
    const seconds = Number(match[1]); const text = decodeHtml(match[2]); if (!Number.isFinite(seconds) || !text) return ''
    const minute = Math.floor(seconds / 60); return `[${String(minute).padStart(2, '0')}:${(seconds - minute * 60).toFixed(2).padStart(5, '0')}]${text}`
  }).filter(Boolean).join('\n')
  return { url: /^https?:\/\//i.test(url) ? url.replace(/^http:/i, 'https:') : '', pic: /^https?:\/\//i.test(pic) ? pic.replace(/^http:/i, 'https:') : '', lyric }
}

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const query = new URL(request.url).searchParams
  try {
    const type = query.get('types') || ''
    if (type === 'search') return Response.json(parseSearch(await fetchHtml(`/s/${encodeURIComponent(query.get('name') || '')}/${Math.max(1, Number(query.get('pages')) || 1)}/`)), { headers: cors })
    const detail = parseDetail(await fetchHtml(`/player/${encodeURIComponent(query.get('id') || '')}/`))
    const body = type === 'url' ? { url: detail.url } : type === 'pic' ? { url: detail.pic } : { lyric: detail.lyric, tlyric: '' }
    return Response.json(body, { headers: cors })
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Hi歌请求失败' }, { status: 502, headers: cors })
  }
}
