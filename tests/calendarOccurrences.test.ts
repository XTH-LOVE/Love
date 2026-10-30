import { describe, expect, it } from 'vitest'
import { expandCalendarOccurrences } from '../app/utils/calendarOccurrences'

const range = (from: number, to: number) => ({
  from: new Date(2026, 0, from, 12),
  to: new Date(2026, 0, to, 12),
})

describe('expandCalendarOccurrences', () => {
  it('keeps non-recurring events on their date', () => {
    const { from, to } = range(1, 31)
    const result = expandCalendarOccurrences([{ eventDate: '2026-01-07', repeatRule: 'none' }], from, to)
    expect(result.map(event => event.eventDate)).toEqual(['2026-01-07'])
  })

  it('expands daily and weekdays rules within the requested range', () => {
    const { from, to } = range(5, 11)
    const [daily, weekdays] = expandCalendarOccurrences([
      { eventDate: '2026-01-01', repeatRule: 'daily' },
      { eventDate: '2026-01-01', repeatRule: 'weekdays' },
    ], from, to).reduce((groups, event) => {
      const group = event.repeatRule === 'daily' ? groups[0]! : groups[1]!
      group.push(event.eventDate)
      return groups
    }, [[], []] as string[][])
    expect(daily).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'])
    expect(weekdays).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'])
  })

  it('expands weekly, monthly, and yearly rules', () => {
    const { from, to } = range(1, 31)
    const events = expandCalendarOccurrences([
      { eventDate: '2026-01-05', repeatRule: 'weekly' },
      { eventDate: '2025-12-31', repeatRule: 'monthly' },
      { eventDate: '2024-01-15', repeatRule: 'yearly' },
    ], from, to)
    expect(events.map(event => event.eventDate)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-01-31', '2026-01-15'])
  })

  it('honors end dates and omits cancelled events', () => {
    const { from, to } = range(1, 10)
    const events = expandCalendarOccurrences([
      { eventDate: '2026-01-01', repeatRule: 'daily', repeatUntil: '2026-01-03' },
      { eventDate: '2026-01-02', repeatRule: 'daily', status: 'cancelled' },
    ], from, to)
    expect(events.map(event => event.eventDate)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })
})
