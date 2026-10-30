import { describe, expect, it } from 'vitest'
import { extractZegoErrorCode, validateZegoAuth, zegoErrorMessage } from '../app/utils/zegoDiagnostics'
import { zegoPrivilegePayload, zegoRoomIdForCouple } from '../supabase/functions/_shared/zegoRoom'

describe('ZEGO diagnostics', () => {
  it('extracts nested and message error codes', () => {
    expect(extractZegoErrorCode({ errorCode: 1100001 })).toBe(1100001)
    expect(extractZegoErrorCode({ message: 'liveroom error（错误码 1102016）' })).toBe(1102016)
    expect(extractZegoErrorCode({ data: { code: 1102016 } })).toBe(1102016)
  })

  it('turns token errors into actionable Chinese diagnostics', () => {
    expect(zegoErrorMessage(1001004)).toContain('ZEGO AppID 鉴权失败')
    expect(zegoErrorMessage(1001005)).toContain('ZEGO AppSign 鉴权失败')
    expect(zegoErrorMessage(1100001)).toContain('缺少 Token')
    expect(zegoErrorMessage(1102016)).toContain('Token 无效或已过期')
  })

  it('validates Token04, app id and room id before SDK login', () => {
    expect(validateZegoAuth({ token: '04token', appId: 1962051148, roomId: 'love-home-couple' }, 1962051148)).toMatchObject({ appId: 1962051148 })
    expect(() => validateZegoAuth({ token: '', appId: 1962051148, roomId: 'room' })).toThrow('Token 响应为空')
    expect(() => validateZegoAuth({ token: 'bad', appId: 1962051148, roomId: 'room' })).toThrow('格式不正确')
    expect(() => validateZegoAuth({ token: '04token', appId: 1, roomId: 'room' }, 1962051148)).toThrow('AppID 不一致')
    expect(() => validateZegoAuth({ token: '04token', appId: 1962051148, roomId: '' })).toThrow('房间 ID')
  })
})

describe('ZEGO room authorization', () => {
  const coupleId = '123e4567-e89b-12d3-a456-426614174000'

  it('derives only the supported rooms from the authenticated couple id', () => {
    expect(zegoRoomIdForCouple(coupleId, 'call')).toBe(`love-home-${coupleId}`)
    expect(zegoRoomIdForCouple(coupleId, 'live')).toBe(`love-home-live-${coupleId}`)
    expect(zegoRoomIdForCouple(coupleId, 'arbitrary-room')).toBeNull()
    expect(zegoRoomIdForCouple('../other-couple', 'call')).toBeNull()
  })

  it('binds Token04 privileges to one room and can disable publishing', () => {
    expect(JSON.parse(zegoPrivilegePayload(`love-home-${coupleId}`, false))).toEqual({
      room_id: `love-home-${coupleId}`,
      privilege: { 1: 1, 2: 0 },
      stream_id_list: null,
    })
  })
})
