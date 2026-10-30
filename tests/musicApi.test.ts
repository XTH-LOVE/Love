import { describe, expect, it } from 'vitest'
import { isUsableAudioUrl } from '../app/utils/musicApi'

describe('music API playback URL validation', () => {
  it('accepts absolute http(s) media URLs', () => {
    expect(isUsableAudioUrl('https://cdn.example.test/song.mp3')).toBe(true)
    expect(isUsableAudioUrl(' http://cdn.example.test/song.m4a ')).toBe(true)
  })

  it('rejects empty, non-http, and API placeholder values', () => {
    expect(isUsableAudioUrl('')).toBe(false)
    expect(isUsableAudioUrl(null)).toBe(false)
    expect(isUsableAudioUrl('about:blank')).toBe(false)
    expect(isUsableAudioUrl('javascript:alert(1)')).toBe(false)
  })
})
