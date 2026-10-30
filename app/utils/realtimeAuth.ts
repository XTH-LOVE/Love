type RealtimeAuthClient = {
  auth?: {
    getSession: () => Promise<{ data?: { session?: { access_token?: string } | null }; error?: unknown }>
  }
  realtime?: {
    setAuth: (token: string | null) => Promise<void>
  }
}

/** Keep private-channel authorization in sync with the current Supabase session. */
export async function syncRealtimeAuth(client: RealtimeAuthClient | null | undefined) {
  if (!client?.auth?.getSession || !client.realtime?.setAuth) return ''
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  const token = String(data?.session?.access_token || '').trim()
  if (!token) throw new Error('Supabase 登录状态已失效，请重新登录后再发起通话')
  await client.realtime.setAuth(token)
  return token
}

function stringifyError(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Error) return value.message.trim()
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    const fields = ['reason', 'message', 'error', 'code', 'status', 'details', 'hint']
      .map(key => object[key])
      .filter(value => value !== undefined && value !== null && String(value).trim())
    if (fields.length) return fields.map(value => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(' · ')
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

/** Extract a safe, token-free reason from Supabase Realtime callback errors. */
export function realtimeErrorDetail(error: unknown) {
  const detail = stringifyError(error)
  return detail.length > 240 ? `${detail.slice(0, 237)}...` : detail
}

