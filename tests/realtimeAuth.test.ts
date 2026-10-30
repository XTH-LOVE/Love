import { describe, expect, it, vi } from 'vitest'
import { realtimeErrorDetail, syncRealtimeAuth } from '../app/utils/realtimeAuth'

describe('Realtime private-channel auth', () => {
  it('syncs the current session token before subscribing', async () => {
    const setAuth = vi.fn().mockResolvedValue(undefined)
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } }) },
      realtime: { setAuth },
    }
    await expect(syncRealtimeAuth(client)).resolves.toBe('jwt-token')
    expect(setAuth).toHaveBeenCalledWith('jwt-token')
  })

  it('rejects when the session is missing', async () => {
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      realtime: { setAuth: vi.fn() },
    }
    await expect(syncRealtimeAuth(client)).rejects.toThrow('登录状态已失效')
  })

  it('extracts a bounded reason without requiring Error.message', () => {
    expect(realtimeErrorDetail({ reason: 'Unauthorized', code: 401 })).toContain('Unauthorized')
    expect(realtimeErrorDetail({ reason: 'x'.repeat(300) })).toHaveLength(240)
  })
})
