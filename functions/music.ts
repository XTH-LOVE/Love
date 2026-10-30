// Cloudflare Pages Function：音乐 API 代理
// 为浏览器端解决第三方音乐 API 的 CORS 问题，并透传查询参数
// 部署后访问路径：/music?types=search&name=xxx&source=netease ...

const UPSTREAM = 'https://music-api.gdstudio.xyz/api.php'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const target = `${UPSTREAM}?${url.searchParams.toString()}`

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://music.gdstudio.xyz/',
      },
      signal: AbortSignal.timeout(10000),
    })
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.ok ? 200 : upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || 'upstream error' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
