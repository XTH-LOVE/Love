export type ZegoRoomKind = 'call' | 'live'

export function zegoRoomIdForCouple(coupleId: string, roomKind: unknown): string | null {
  if (!/^[0-9a-f-]{36}$/i.test(coupleId)) return null
  if (roomKind === 'call') return `love-home-${coupleId}`
  if (roomKind === 'live') return `love-home-live-${coupleId}`
  return null
}

export function zegoPrivilegePayload(roomId: string, canPublish: boolean) {
  return JSON.stringify({
    room_id: roomId,
    privilege: { 1: 1, 2: canPublish ? 1 : 0 },
    stream_id_list: null,
  })
}
