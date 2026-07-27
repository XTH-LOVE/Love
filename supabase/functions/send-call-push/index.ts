import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const encoder = new TextEncoder()

function base64Url(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToBytes(pem: string) {
  const clean = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const binary = atob(clean)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

async function getGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(serviceAccount.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${claim}`))
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${base64Url(new Uint8Array(signature))}` }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error(`FCM OAuth 获取失败（HTTP ${response.status}）`)
  return String(data.access_token)
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) throw new Error('请先登录')
    const body = await req.json().catch(() => ({}))
    const requestedCoupleId = String(body.coupleId || '')
    const { data: membership } = await authClient.from('couple_members').select('couple_id').eq('user_id', user.id).maybeSingle()
    const coupleId = String(membership?.couple_id || '')
    if (!coupleId || (requestedCoupleId && requestedCoupleId !== coupleId)) throw new Error('情侣空间校验失败')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)
    const { data: partners } = await serviceClient.from('couple_members').select('user_id').eq('couple_id', coupleId).neq('user_id', user.id)
    const partnerIds = (partners || []).map(row => String(row.user_id)).filter(Boolean)
    if (!partnerIds.length) return new Response(JSON.stringify({ sent: 0, reason: '暂无另一位情侣成员' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: tokens } = await serviceClient.from('push_tokens').select('token').in('user_id', partnerIds).eq('couple_id', coupleId).eq('platform', 'android')
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || ''
    if (!serviceAccountJson) return new Response(JSON.stringify({ sent: 0, configured: false, reason: 'FIREBASE_SERVICE_ACCOUNT_JSON 未配置' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const serviceAccount = JSON.parse(serviceAccountJson)
    const accessToken = await getGoogleAccessToken(serviceAccount)
    const projectId = String(serviceAccount.project_id || Deno.env.get('FIREBASE_PROJECT_ID') || '')
    if (!projectId) throw new Error('Firebase service account 缺少 project_id')
    let sent = 0
    for (const row of tokens || []) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: { token: row.token, data: { type: 'incoming_call', callId: String(body.callId || ''), mode: body.mode === 'video' ? 'video' : 'audio', callerName: String(body.callerName || 'TA') }, notification: { title: 'Love小家来电', body: `${String(body.callerName || 'TA')} 正在呼叫你` }, android: { priority: 'high', notification: { channel_id: 'love-home-incoming-call', sound: 'default', default_vibrate_timings: true } } } }),
      })
      if (response.ok) sent += 1
    }
    return new Response(JSON.stringify({ sent, configured: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'FCM 推送失败' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
