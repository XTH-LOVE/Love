import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildHeartAiPrompts, cleanDatePlanOutput, errorMessage, formatWebContext, getAiProviderConfig, parseSearchResults, shouldExpandDatePlan } from './helpers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function bounded(value: unknown, max: number, fallback = '') {
  const text = String(value ?? fallback).trim()
  return text.slice(0, max)
}

const requestBuckets = new Map<string, { startedAt: number; count: number }>()

function allowInMemory(key: string) {
  const now = Date.now()
  const current = requestBuckets.get(key)
  if (!current || now - current.startedAt >= 60_000) {
    requestBuckets.set(key, { startedAt: now, count: 1 })
    return true
  }
  if (current.count >= 8) return false
  current.count += 1
  return true
}

async function searchWeb(query: string, limit = 5) {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CoupleSpace Heart AI/1.0)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`网页检索失败：HTTP ${response.status}`)
  return parseSearchResults(await response.text(), limit)
}

async function searchDatePlanWeb(city: string, preferences: string) {
  const queries = [
    `${city} ${preferences} 情侣约会 景点 旅游攻略`,
    `${city} 情侣约会 餐厅 咖啡 活动 推荐`,
    `${city} 室内约会 雨天 景点 展览 体验`,
  ]
  const settled = await Promise.allSettled(queries.map(query => searchWeb(query, 6)))
  const merged = settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  const seen = new Set<string>()
  return merged.filter(item => {
    const key = item.url || `${item.title}\n${item.snippet}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 16)
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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: allowed, error: limitError } = await admin.rpc('consume_edge_rate_limit', {
      p_key: `heart-ai:${member.couple_id}:${user.id}`,
      p_window_seconds: 60,
      p_max_attempts: 8,
    })
    if (limitError) {
      console.warn('heart-ai rate limit RPC unavailable; using isolate-local fallback', errorMessage(limitError))
    }
    if (limitError ? !allowInMemory(`${member.couple_id}:${user.id}`) : !allowed) {
      return new Response(JSON.stringify({ error: 'AI 请求过于频繁，请稍后再试' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } })
    }
    const today = new Date().toISOString().slice(0, 10)
    const category = bounded(body.category, 40, '日常与回忆')
    const city = bounded(body.city, 40, '未指定')
    const budget = bounded(body.budget, 40, '适中')
    const time = bounded(body.time, 40, '半天')
    const date = bounded(body.date, 20, today)
    const startTime = bounded(body.startTime, 10, '10:00')
    const preferences = bounded(body.preferences, 200, '轻松浪漫')
    const text = bounded(body.text, 2000)
    const material = bounded(body.material, 3000)
    const style = bounded(body.style, 40, '自然温柔')
    const recipient = bounded(body.recipient, 40, '亲爱的')
    const writingLength = Math.min(800, Math.max(100, Number(body.length) || 400))
    const webResults = feature === 'date_plan' && city !== '未指定'
      ? await searchDatePlanWeb(city, preferences)
      : []
    const webContext = formatWebContext(webResults)
    const prompt = buildHeartAiPrompts({
      feature, today, date, startTime, category, city, budget, time, preferences, text, material, style, recipient,
      tone: bounded(body.tone, 40, '温柔真诚'), writingLength,
    }, webContext)
    if (!prompt) throw new Error('不支持的 AI 功能')

    const ai = getAiProviderConfig(name => Deno.env.get(name))
    const { provider, label, apiKey, baseUrl, model } = ai
    if (!apiKey) throw new Error(`服务端尚未配置 ${provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'MIMO_API_KEY'}`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), feature === 'date_plan' ? 60_000 : 30_000)
    const maxTokens = feature === 'date_plan' ? 4200 : Math.min(2200, writingLength * 2)
    let aiResponse: Response
    try {
      aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
          temperature: feature === 'date_plan' ? 0.55 : 0.75,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!aiResponse.ok) throw new Error(`${label} 请求失败：${aiResponse.status} ${(await aiResponse.text()).slice(0, 300)}`)
    const result = await aiResponse.json()
    const rawOutput = result.choices?.[0]?.message?.content?.trim()
    let output = feature === 'date_plan' && rawOutput ? cleanDatePlanOutput(rawOutput) : rawOutput
    if (!output) throw new Error(`${label} 未返回内容`)

    if (feature === 'date_plan' && shouldExpandDatePlan(output)) {
      const expandController = new AbortController()
      const expandTimeout = setTimeout(() => expandController.abort(), 45_000)
      try {
        const expandResponse = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: `${prompt.user}\n\n上一版内容过短，请在不编造事实、不重复空话的前提下补全到至少 1200 个汉字，保留已有地点和时间，补足每一站的推荐理由、停留时长、两人费用、衔接方式、预算拆分、雨天备选和出发前核验事项。只返回完整方案正文。` },
            ],
            temperature: 0.5,
            max_tokens: maxTokens,
          }),
          signal: expandController.signal,
        })
        if (expandResponse.ok) {
          const expanded = (await expandResponse.json()).choices?.[0]?.message?.content?.trim()
          if (expanded) output = cleanDatePlanOutput(expanded)
        } else {
          console.warn(`${label} date plan expansion failed`, expandResponse.status)
        }
      } catch (expandError) {
        console.warn(`${label} date plan expansion failed`, errorMessage(expandError))
      } finally {
        clearTimeout(expandTimeout)
      }
    }

    await supabase.from('ai_generations').insert({ couple_id: member.couple_id, user_id: user.id, feature, input_summary: prompt.user.slice(0, 300), output, provider, model })
    return new Response(JSON.stringify({ output, model }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'AI 服务响应超时，请稍后重试'
      : errorMessage(error).slice(0, 500)
    console.error('heart-ai failed', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
