import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
const internalEmail = (username: string) => `account.${username}@users.love-home.invalid`
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('')
const recoveryCode = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x => (x % 36).toString(36).toUpperCase()).join('').match(/.{1,4}/g)!.join('-')
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const username = normalize(String(body.username || ''))
    if (!/^[a-z0-9_]{4,20}$/.test(username)) return json({ error: '账号名需要 4-20 位，只能使用字母、数字和下划线' }, 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { data: allowed, error: limitError } = await admin.rpc('consume_edge_rate_limit', {
      p_key: `account-auth:${clientIp}:${action}:${username}`,
      p_window_seconds: 600,
      p_max_attempts: 5,
    })
    if (limitError) throw limitError
    if (!allowed) return json({ error: '操作过于频繁，请 10 分钟后再试' }, 429)

    if (action === 'register') {
      const password = String(body.password || '')
      const displayName = String(body.displayName || '').trim()
      if (password.length < 8 || password.length > 128) return json({ error: '密码需要 8-128 位' }, 400)
      if (!displayName || displayName.length > 40) return json({ error: '请输入 1-40 位称呼' }, 400)
      const code = recoveryCode()
      const recoveryHash = await digest(`${username}:${code.replaceAll('-', '')}`)
      const { data: created, error } = await admin.auth.admin.createUser({
        email: internalEmail(username), password, email_confirm: true,
        user_metadata: { display_name: displayName, login_type: 'username', username },
      })
      if (error) return json({ error: '账号创建失败，请检查账号信息后重试' }, 400)
      const { data: account, error: lookupError } = await admin.from('account_usernames').select('user_id').eq('username', username).single()
      if (lookupError || !account) {
        if (created.user) await admin.auth.admin.deleteUser(created.user.id)
        return json({ error: '账号创建失败，请稍后重试' }, 500)
      }
      const { error: recoveryError } = await admin.from('account_recovery_codes').insert({
        user_id: account.user_id,
        recovery_hash: recoveryHash,
      })
      if (recoveryError) {
        await admin.auth.admin.deleteUser(account.user_id)
        return json({ error: '账号创建失败，请稍后重试' }, 500)
      }
      return json({ recoveryCode: code })
    }

    if (action === 'recover') {
      const code = String(body.recoveryCode || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
      const password = String(body.newPassword || '')
      if (code.length !== 16 || password.length < 8 || password.length > 128) return json({ error: '恢复码或新密码格式不正确' }, 400)
      const expected = await digest(`${username}:${code}`)
      const { data: targetId, error: consumeError } = await admin.rpc('consume_account_recovery', {
        p_username: username,
        p_recovery_hash: expected,
      })
      if (consumeError) throw consumeError
      if (!targetId) {
        await new Promise(resolve => setTimeout(resolve, 700))
        return json({ error: '账号名或恢复码不正确' }, 400)
      }
      const { error } = await admin.auth.admin.updateUserById(String(targetId), { password })
      if (error) {
        await admin.from('account_recovery_codes').upsert({ user_id: targetId, recovery_hash: expected })
        throw error
      }
      return json({ success: true })
    }
    return json({ error: '不支持的操作' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: '服务暂时不可用，请稍后重试' }, 500)
  }
})
