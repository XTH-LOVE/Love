import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 8
const requestBuckets = new Map<string, { startedAt: number; count: number }>()

function bounded(value: unknown, max: number, fallback = '') {
  const text = String(value ?? fallback).trim()
  return text.slice(0, max)
}

function allowRequest(key: string) {
  const now = Date.now()
  const current = requestBuckets.get(key)
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 })
    return true
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false
  current.count += 1
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('FUNCTIONS_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('请先登录')
    const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', user.id).single()
    if (!member) throw new Error('请先绑定情侣空间')

    const body = await req.json().catch(() => ({}))
    const feature = body.feature as string
    if (typeof feature !== 'string' || feature.length > 32) throw new Error('不支持的 AI 功能')
    if (!allowRequest(`${member.couple_id}:${user.id}`)) {
      return new Response(JSON.stringify({ error: 'AI 请求过于频繁，请稍后再试' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } })
    }
    const category = bounded(body.category, 40, '日常与回忆')
    const city = bounded(body.city, 40, '未指定')
    const budget = bounded(body.budget, 40, '适中')
    const time = bounded(body.time, 40, '半天')
    const preferences = bounded(body.preferences, 200, '轻松浪漫')
    const text = bounded(body.text, 2000)
    const material = bounded(body.material, 3000)
    const style = bounded(body.style, 40, '自然温柔')
    const recipient = bounded(body.recipient, 40, '亲爱的')
    const writingLength = Math.min(800, Math.max(100, Number(body.length) || 400))
    const prompts: Record<string, { system: string; user: string }> = {
      daily_question: {
        system: '你是情侣互动问题策划师。只生成一个温柔、有趣、适合双方分别回答的问题。避免评判、控制、隐私逼问、性暗示和心理诊断。只返回问题正文，不要标题和解释。',
        user: `为一对情侣生成今天的问题。偏好分类：${category}。问题应在40个汉字以内。`,
      },
      date_plan: {
        system: '你是情侣约会策划师。直接输出精简、具体、可执行的中文方案，不要思考过程，不要长篇解释。',
        user: `城市：${city}；预算：${budget}；时间：${time}；偏好：${preferences}。请在400字以内按时间、地点、费用、备选方案输出。`,
      },
      express: {
        system: '你帮助用户润色情侣消息。保持原意，不操纵、不道德绑架，不替用户虚构承诺。只返回润色后的消息。',
        user: `语气：${bounded(body.tone, 40, '温柔真诚')}。原文：${text}`,
      },
      diary: {
        system: '你是共同日记写作者。根据用户主动提供的素材，写一篇温柔真实的中文情侣日记，不虚构未提供的事实。',
        user: `素材：${material}。文风：${style}。写约${writingLength}字，只输出日记正文。`,
      },
      love_letter: {
        system: '你是情书写作者。根据用户提供的真实素材写真诚克制的中文情书，不虚构经历，不道德绑架，只输出正文。',
        user: `想表达的内容：${material}。称呼：${recipient}。语气：${style}。写约${writingLength}字。`,
      },
    }
    const prompt = prompts[feature]
    if (!prompt) throw new Error('不支持的 AI 功能')

    const apiKey = Deno.env.get('MIMO_API_KEY')
    const baseUrl = (Deno.env.get('MIMO_BASE_URL') || 'https://api.xiaomimimo.com/v1').replace(/\/$/, '')
    const model = Deno.env.get('MIMO_MODEL') || 'mimo-v2.5'
    if (!apiKey) throw new Error('服务端尚未配置 MIMO_API_KEY')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    let aiResponse: Response
    try {
      aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], temperature: 0.7, max_tokens: feature === 'date_plan' ? 650 : Math.min(1800, writingLength * 2) }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!aiResponse.ok) throw new Error(`MiMo 请求失败：${aiResponse.status} ${(await aiResponse.text()).slice(0, 300)}`)
    const result = await aiResponse.json()
    const output = result.choices?.[0]?.message?.content?.trim()
    if (!output) throw new Error('MiMo 未返回内容')

    await supabase.from('ai_generations').insert({ couple_id: member.couple_id, user_id: user.id, feature, input_summary: prompt.user.slice(0, 300), output, provider: 'xiaomi-mimo', model })
    return new Response(JSON.stringify({ output, model }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'AI 服务响应超时，请稍后重试'
      : error instanceof Error ? error.message.slice(0, 500) : '未知错误'
    console.error('heart-ai failed', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
