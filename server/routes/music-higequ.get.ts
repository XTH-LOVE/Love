// Hi歌服务端适配器：浏览器不直接请求 higequ.com，避免 CORS 和页面解析暴露到客户端。
const HIGEQU_BASE = 'https://higequ.com'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

function decodeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

async function fetchHtml(path: string) {
  const response = await fetch(`${HIGEQU_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw createError({ statusCode: response.status, statusMessage: `Hi歌请求失败：HTTP ${response.status}` })
  return response.text()
}

function parseSearch(html: string) {
  const ridPattern = /data-rid\s*=\s*["']([^"']+)["']/gi
  const rows: Array<Record<string, string>> = []
  const matches = Array.from(html.matchAll(ridPattern))
  matches.forEach((match, index) => {
    const rid = match[1].trim()
    const start = (match.index || 0) + match[0].length
    const next = matches[index + 1]?.index ?? html.length
    const block = html.slice(start, next)
    const classText = (className: string) => {
      const found = block.match(new RegExp(`<[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</[^>]+>`, 'i'))
      return decodeHtml(found?.[1] || '')
    }
    const name = classText('result-title')
    if (!name) return
    rows.push({
      id: rid,
      name,
      artist: classText('result-artist'),
      album: classText('result-album').replace(/^专辑[:：]\s*/, ''),
      pic_id: rid,
      url_id: rid,
      lyric_id: rid,
    })
  })
  return rows
}

function parseDetail(html: string) {
  // Hi歌改版后由 `const encodedUrl = "..."` 注入播放器，兼容旧版 code 写法。
  const code = html.match(/(?:let|const|var)\s+(?:encodedUrl|code)\s*=\s*["']([^"']+)["']/i)?.[1]
  let audioUrl = ''
  if (code) {
    try {
      audioUrl = Buffer.from(code, 'base64').toString('utf8')
    } catch { /* malformed source page */ }
  }
  const coverUrl = html.match(/id=["']album-cover["'][^>]*src=["']([^"']+)["']/i)?.[1] || ''
  const lyrics = Array.from(html.matchAll(/<[^>]*class=["'][^"']*\blyric-line\b[^"']*["'][^>]*data-time=["']([^"']+)["'][^>]*>([\s\S]*?)<\/[^>]+>/gi))
    .map(match => {
      const seconds = Number(match[1])
      const text = decodeHtml(match[2])
      if (!Number.isFinite(seconds) || !text) return ''
      const minutes = Math.floor(seconds / 60)
      const remainder = (seconds - minutes * 60).toFixed(2).padStart(5, '0')
      return `[${String(minutes).padStart(2, '0')}:${remainder}]${text}`
    })
    .filter(Boolean)
    .join('\n')
  return {
    url: isHttpUrl(audioUrl) ? audioUrl.replace(/^http:/i, 'https:') : '',
    pic: isHttpUrl(coverUrl) ? coverUrl.replace(/^http:/i, 'https:') : '',
    lyric: lyrics,
  }
}

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const type = String(query.types || '')
  const id = encodeURIComponent(String(query.id || ''))
  try {
    if (type === 'search') {
      const name = encodeURIComponent(String(query.name || ''))
      const page = Math.max(1, Number(query.pages) || 1)
      const html = await fetchHtml(`/s/${name}/${page}/`)
      return parseSearch(html)
    }
    if (!id) return { error: '缺少 Hi歌歌曲 id' }
    const html = await fetchHtml(`/player/${id}/`)
    const detail = parseDetail(html)
    if (type === 'url') return { url: detail.url }
    if (type === 'pic') return { url: detail.pic }
    if (type === 'lyric') return { lyric: detail.lyric, tlyric: '' }
    return { error: '不支持的 Hi歌请求类型' }
  } catch (error: any) {
    setResponseStatus(event, Number(error?.statusCode) || 502)
    return { error: error?.statusMessage || error?.message || 'Hi歌请求失败' }
  }
})
