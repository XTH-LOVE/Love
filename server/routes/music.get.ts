// Nitro 服务端路由：音乐 API 代理（dev 与 preview 环境使用）
// 生产环境（Cloudflare Pages 静态部署）由 functions/music.ts 提供同名代理
// 为浏览器端解决第三方音乐 API 的 CORS 问题

const UPSTREAM = 'https://music-api.gdstudio.xyz/api.php'

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }

  try {
    const upstream = await fetch(`${UPSTREAM}?${search.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://music.gdstudio.xyz/',
      },
      signal: AbortSignal.timeout(15000),
    })
    const data = await upstream.json()
    setHeader(event, 'Cache-Control', 'public, max-age=300')
    return data
  } catch (e) {
    setResponseStatus(event, 502)
    return { error: (e as Error)?.message || 'upstream error' }
  }
})
