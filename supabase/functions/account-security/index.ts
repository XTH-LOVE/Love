import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = request.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: '需要登录后操作' }, 401)
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: '登录已失效，请重新登录' }, 401)
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

    if (action === 'delete-account') {
      if (String(body.confirmation || '') !== '删除我的账户') return json({ error: '请输入“删除我的账户”确认操作' }, 400)
      const { error: prepareError } = await userClient.rpc('prepare_account_deletion')
      if (prepareError) throw prepareError
      const { error } = await admin.auth.admin.deleteUser(user.id)
      if (error) throw error
      return json({ success: true })
    }

    if (action === 'login-anomaly') {
      const userAgent = String(body.userAgent || '').slice(0, 300)
      await admin.from('profiles').update({ last_login_user_agent: userAgent, last_login_at: new Date().toISOString() }).eq('id', user.id)
      return json({ success: true })
    }

    return json({ error: '不支持的操作' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : '安全操作失败，请稍后重试' }, 500)
  }
})
