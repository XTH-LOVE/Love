import { describe, expect, it } from 'vitest'
import { extractZegoErrorCode, validateZegoAuth, zegoErrorMessage } from '../app/utils/zegoDiagnostics'

describe('ZEGO diagnostics', () => {
  it('extracts nested and message error codes', () => {
    expect(extractZegoErrorCode({ errorCode: 1100001 })).toBe(1100001)
    expect(extractZegoErrorCode({ message: 'liveroom error（错误码 1102016）' })).toBe(1102016)
    expect(extractZegoErrorCode({ data: { code: 1102016 } })).toBe(1102016)
  })

  it('turns token errors into actionable Chinese diagnostics', () => {
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
