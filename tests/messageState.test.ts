import { describe, expect, it } from 'vitest'
import {
  appendUniqueMessage,
  mapMessageRow,
  normalizeMessageContent,
  parseLiveLocation,
  unreadMessageIds,
  updateMessageReadAt,
} from '../app/utils/messageState'

describe('message state normalization', () => {
  it('normalizes string, object and null content safely', () => {
    expect(normalizeMessageContent('hello')).toBe('hello')
    expect(normalizeMessageContent({ text: 'from payload' })).toBe('from payload')
    expect(normalizeMessageContent({ content: 'nested' })).toBe('nested')
    expect(normalizeMessageContent(null)).toBe('')
  })

  it('maps legacy image rows without throwing on missing fields', () => {
    const message = mapMessageRow({ id: 'm1', sender_id: 'u1', image_path: 'old/a.jpg', content: { text: '旧照片' } }, '2026-01-01T00:00:00.000Z')
    expect(message).toMatchObject({
      id: 'm1',
      senderId: 'u1',
      content: '旧照片',
      mediaPath: 'old/a.jpg',
      mediaType: 'image',
      legacyMedia: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('deduplicates realtime inserts and updates read state immutably', () => {
    const first = mapMessageRow({ id: 'm1', sender_id: 'u1', content: 'hi' })
    const duplicate = appendUniqueMessage([first], { ...first, content: 'duplicate' })
    expect(duplicate).toHaveLength(1)
    expect(updateMessageReadAt([first], 'm1', '2026-01-01T00:00:00.000Z')[0]?.readAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('returns only partner unread message ids', () => {
    const messages = [
      mapMessageRow({ id: 'mine', sender_id: 'me', content: 'sent', read_at: '' }),
      mapMessageRow({ id: 'unread', sender_id: 'partner', content: 'new', read_at: '' }),
      mapMessageRow({ id: 'read', sender_id: 'partner', content: 'old', read_at: '2026-01-01' }),
    ]
    expect(unreadMessageIds(messages, 'me')).toEqual(['unread'])
  })

  it('rejects invalid location payloads and ignores self broadcasts', () => {
    expect(parseLiveLocation({ senderId: 'partner', lat: 31, lng: 121, accuracy: 8 }, 'me')).toMatchObject({
      senderId: 'partner',
      location: { lat: 31, lng: 121, accuracy: 8, sharing: true },
    })
    expect(parseLiveLocation({ senderId: 'partner', lat: 31, lng: 121, accuracy: null }, 'me')).toBeNull()
    expect(parseLiveLocation({ senderId: 'me', lat: 31, lng: 121, accuracy: 8 }, 'me')).toBeNull()
    expect(parseLiveLocation({ senderId: 'partner', sharing: false }, 'me')).toMatchObject({ senderId: 'partner', stopped: true })
  })
})
