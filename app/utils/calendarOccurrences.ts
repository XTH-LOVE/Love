export type RecurringCalendarEvent<T extends {
  eventDate: string
  repeatRule: string
  repeatUntil?: string
  status?: string
}> = T & { eventDate: string }

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function expandCalendarOccurrences<T extends {
  eventDate: string
  repeatRule: string
  repeatUntil?: string
  status?: string
}>(events: T[], from: Date, to: Date): RecurringCalendarEvent<T>[] {
  const result: RecurringCalendarEvent<T>[] = []
  for (const event of events) {
    const start = new Date(`${event.eventDate}T12:00:00`)
    const until = event.repeatUntil ? new Date(`${event.repeatUntil}T12:00:00`) : to
    if (event.repeatRule === 'none') {
      if (start >= from && start <= to && event.status !== 'cancelled') result.push(event as RecurringCalendarEvent<T>)
      continue
    }
    const stop = until < to ? until : to
    const cursor = new Date(start < from ? from : start)
    cursor.setHours(12, 0, 0, 0)
    while (cursor <= stop) {
      const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
      const cursorUtc = Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
      const dayDelta = Math.floor((cursorUtc - startUtc) / 86400000)
      const matches = event.repeatRule === 'daily'
        || (event.repeatRule === 'weekdays' && cursor.getDay() !== 0 && cursor.getDay() !== 6)
        || (event.repeatRule === 'weekly' && dayDelta % 7 === 0)
        || (event.repeatRule === 'monthly' && cursor.getDate() === start.getDate())
        || (event.repeatRule === 'yearly' && cursor.getMonth() === start.getMonth() && cursor.getDate() === start.getDate())
      if (matches && event.status !== 'cancelled') result.push({ ...event, eventDate: localDateKey(cursor) } as RecurringCalendarEvent<T>)
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return result
}
