import { describe, expect, it } from 'vitest'
import { occurrence, daysUntil, type Anniversary } from '../app/composables/useAnniversaries'
import { mediaBucketForPath } from '../app/composables/useMediaUrls'

// ─── Anniversary helpers ────────────────────────────────────────────

function makeAnniversary(overrides: Partial<Anniversary> = {}): Anniversary {
  return {
    id: 'ann-1',
    title: '测试纪念日',
    eventDate: '2023-06-15',
    kind: 'anniversary',
    recurring: false,
    note: '',
    createdBy: 'user-1',
    ...overrides,
  }
}

describe('occurrence', () => {
  it('returns the exact date for non-recurring events', () => {
    const event = makeAnniversary({ eventDate: '2024-03-20', recurring: false })
    const result = occurrence(event)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(2) // March = 2
    expect(result.getDate()).toBe(20)
  })

  it('returns this year\'s date when the recurring event has not passed yet', () => {
    const today = new Date()
    const futureMonth = String(today.getMonth() + 2).padStart(2, '0') // two months from now
    const futureDay = '15'
    const event = makeAnniversary({
      eventDate: `2020-${futureMonth}-${futureDay}`,
      recurring: true,
    })
    const result = occurrence(event)
    expect(result.getFullYear()).toBe(today.getFullYear())
  })

  it('returns next year\'s date when the recurring event has already passed', () => {
    const today = new Date()
    const pastMonth = String(Math.max(1, today.getMonth())).padStart(2, '0') // earlier this year
    const event = makeAnniversary({
      eventDate: `2020-${pastMonth}-01`,
      recurring: true,
    })
    const result = occurrence(event)
    // If the past event's month is before the current month, it should be next year
    if (Number(pastMonth) <= today.getMonth() + 1) {
      expect(result.getFullYear()).toBe(today.getFullYear() + 1)
    }
  })
})

describe('daysUntil', () => {
  it('returns 0 for an event happening today', () => {
    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const event = makeAnniversary({
      eventDate: `${today.getFullYear()}-${month}-${day}`,
      recurring: false,
    })
    expect(daysUntil(event)).toBe(0)
  })

  it('returns a positive number for future events', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const month = String(future.getMonth() + 1).padStart(2, '0')
    const day = String(future.getDate()).padStart(2, '0')
    const event = makeAnniversary({
      eventDate: `${future.getFullYear()}-${month}-${day}`,
      recurring: false,
    })
    const result = daysUntil(event)
    expect(result).toBeGreaterThanOrEqual(29)
    expect(result).toBeLessThanOrEqual(31)
  })

  it('never returns negative values', () => {
    const past = makeAnniversary({ eventDate: '2020-01-01', recurring: false })
    expect(daysUntil(past)).toBe(0)
  })
})

// ─── Media URL helpers ──────────────────────────────────────────────

describe('mediaBucketForPath', () => {
  it('returns "album-media" for paths containing /album-media/', () => {
    expect(mediaBucketForPath('couples/123/album-media/photo.jpg')).toBe('album-media')
  })

  it('returns "album-media" for paths starting with album-media/', () => {
    expect(mediaBucketForPath('album-media/video.mp4')).toBe('album-media')
  })

  it('returns "memory-photos" for other paths', () => {
    expect(mediaBucketForPath('couples/123/memory-photo.jpg')).toBe('memory-photos')
    expect(mediaBucketForPath('avatars/user-1/photo.jpg')).toBe('memory-photos')
  })

  it('supports legacy bucket override for non-album paths', () => {
    expect(mediaBucketForPath('some/path', true)).toBe('memory-photos')
    expect(mediaBucketForPath('album-media/file.jpg', true)).toBe('album-media')
  })
})

