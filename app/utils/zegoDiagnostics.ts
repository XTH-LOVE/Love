export type ZegoAuthPayload = {
  token: string
  legacyToken?: string
  appId: number
  roomId: string
}

export function extractZegoErrorCode(error: any): number {
  const candidates = [error?.errorCode, error?.code, error?.data?.errorCode, error?.data?.code]
  for (const candidate of candidates) {
    const code = Number(candidate)
    if (Number.isFinite(code) && code > 0) return code
  }
  const text = [error?.message, error?.msg, error?.errorMessage, error?.extendedData, error].map(value => String(value || '')).join(' ')
  const match = text.match(/\b(1100001|1102016|\d{6,})\b/)
  return match ? Number(match[1]) : 0
}

export function zegoErrorMessage(code: number): string {
  if (code === 1100001) return 'ZEGO 缺少 Token：请部署 zego-token Edge Function，并配置 ZEGO_APP_ID 与 ZEGO_SERVER_SECRET。不要把 AppSign 当作 Token。'
  if (code === 1102016) return 'ZEGO Token 无效或已过期：请确认 Edge Function 使用的 AppID 与网页配置一致，并重新部署 Token Function。'
  return code ? `ZEGO 通话失败（错误码 ${code}）` : ''
}

export function validateZegoAuth(data: any, configuredAppId?: number): ZegoAuthPayload {
  const token = typeof data?.token === 'string' ? data.token.trim() : ''
  const legacyToken = typeof data?.legacyToken === 'string' ? data.legacyToken.trim() : ''
  const appId = Number(data?.appId)
  const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : ''
  if (!token && !legacyToken) throw new Error('ZEGO Token 响应为空，请检查 zego-token Edge Function')
  if (token && !token.startsWith('04')) throw new Error('ZEGO Token 格式不正确，Token04 必须以 04 开头')
  if (!Number.isInteger(appId) || appId <= 0) throw new Error('ZEGO Token 返回的 AppID 无效')
  if (configuredAppId && appId !== configuredAppId) throw new Error(`ZEGO AppID 不一致：网页配置为 ${configuredAppId}，Edge Function 返回为 ${appId}`)
  if (!roomId) throw new Error('ZEGO Token 响应缺少房间 ID')
  return { token, legacyToken: legacyToken || undefined, appId, roomId }
}
