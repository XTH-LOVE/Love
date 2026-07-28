export type ChatMessage = {
  id: string
  senderId: string
  content: string
  mediaPath: string
  mediaUrl: string
  mediaType: 'image' | 'video' | 'audio' | ''
  legacyMedia: boolean
  readAt: string
  createdAt: string
}

export type LiveLocation = {
  lat: number
  lng: number
  accuracy: number
  updatedAt: string
  sharing: boolean
}

export function normalizeMessageContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.content === 'string') return record.content
  }
  return String(value)
}

export function mapMessageRow(row: any, now = new Date().toISOString()): ChatMessage {
  const path = row?.media_path || row?.image_path || ''
  const mediaType = row?.media_type || (path ? 'image' : '')
  return {
    id: String(row?.id || crypto.randomUUID()),
    senderId: String(row?.sender_id || ''),
    content: normalizeMessageContent(row?.content),
    mediaPath: String(path || ''),
    mediaUrl: '',
    mediaType: mediaType === 'video' || mediaType === 'audio' ? mediaType : mediaType === 'image' ? 'image' : '',
    legacyMedia: !row?.media_path && Boolean(row?.image_path),
    readAt: String(row?.read_at || ''),
    createdAt: String(row?.created_at || now),
  }
}

export function appendUniqueMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  return messages.some(message => message.id === incoming.id) ? messages : [...messages, incoming]
}

export function updateMessageReadAt(messages: ChatMessage[], id: string, readAt: string): ChatMessage[] {
  return messages.map(message => message.id === id ? { ...message, readAt } : message)
}

export function unreadMessageIds(messages: ChatMessage[], selfId?: string): string[] {
  return messages.filter(message => message.senderId !== selfId && !message.readAt).map(message => message.id)
}

export function parseLiveLocation(payload: any, selfId?: string): { senderId: string; location?: LiveLocation; stopped: boolean } | null {
  const senderId = String(payload?.senderId || '')
  if (!senderId || senderId === selfId) return null
  if (payload?.sharing === false) return { senderId, stopped: true }
  const rawLat = payload?.lat
  const rawLng = payload?.lng
  const rawAccuracy = payload?.accuracy
  if ([rawLat, rawLng, rawAccuracy].some(value => value == null || value === '')) return null
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  const accuracy = Number(rawAccuracy)
  if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return {
    senderId,
    stopped: false,
    location: {
      lat,
      lng,
      accuracy: Math.max(0, accuracy),
      updatedAt: String(payload?.updatedAt || new Date().toISOString()),
      sharing: true,
    },
  }
}
