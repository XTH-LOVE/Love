import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
const internalEmail = (username: string) => `account.${username}@users.love-home.invalid`
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('')
const recoveryCode = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x => (x % 36).toString(36).toUpperCase()).join('').match(/.{1,4}/g)!.join('-')
const RATE_WINDOW_MS = 10 * 60_000
const MAX_ATTEMPTS_PER_WINDOW = 5
const attempts = new Map<string, { startedAt: number; count: number }>()

function allowAttempt(key: string) {
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 })
    return true
  }
  if (current.count >= MAX_ATTEMPTS_PER_WINDOW) return false
  current.count += 1
  return true
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const username = normalize(String(body.username || ''))
    if (!/^[a-z0-9_]{4,20}$/.test(username)) return json({ error: '账号名需要 4-20 位，只能使用字母、数字和下划线' }, 400)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!allowAttempt(`${clientIp}:${action}`)) return json({ error: '操作过于频繁，请 10 分钟后再试' }, 429)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    if (action === 'register') {
      const password = String(body.password || '')
      const displayName = String(body.displayName || '').trim()
      if (password.length < 8 || password.length > 128) return json({ error: '密码需要 8-128 位' }, 400)
      if (!displayName || displayName.length > 40) return json({ error: '请输入 1-40 位称呼' }, 400)
      const code = recoveryCode()
      const { error } = await admin.auth.admin.createUser({
        email: internalEmail(username), password, email_confirm: true,
        user_metadata: { display_name: displayName, login_type: 'username', username },
        app_metadata: { recovery_hash: await digest(`${username}:${code.replaceAll('-', '')}`) },
      })
      if (error) return json({ error: '账号创建失败，请检查账号信息后重试' }, 400)
      return json({ recoveryCode: code })
    }

    if (action === 'recover') {
      const code = String(body.recoveryCode || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
      const password = String(body.newPassword || '')
      if (code.length !== 16 || password.length < 8 || password.length > 128) return json({ error: '恢复码或新密码格式不正确' }, 400)
      const { data: account, error: lookupError } = await admin.from('account_usernames').select('user_id').eq('username', username).maybeSingle()
      if (lookupError) throw lookupError
      const targetId = account?.user_id as string | undefined
      const { data: targetUser, error: userError } = targetId ? await admin.auth.admin.getUserById(targetId) : { data: { user: null }, error: null }
      if (userError) throw userError
      const expected = await digest(`${username}:${code}`)
      if (!targetUser.user || targetUser.user.app_metadata?.recovery_hash !== expected) {
        await new Promise(resolve => setTimeout(resolve, 700))
        return json({ error: '账号名或恢复码不正确' }, 400)
      }
      const { error } = await admin.auth.admin.updateUserById(targetUser.user.id, { password })
      if (error) throw error
      return json({ success: true })
    }
    return json({ error: '不支持的操作' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: '服务暂时不可用，请稍后重试' }, 500)
  }
})
