import { requestSystemAlerts } from './useSystemAlerts'
import type { SharedEvent } from './useSharedCalendar'

const enabled = ref(false)
const busy = ref(false)
const storageKey = 'couple-space-calendar-reminders-enabled'
const scheduledIds = new Set<number>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function notificationId(key: string) {
  let hash = 2166136261
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return 10000 + Math.abs(hash % 2000000000)
}

function isNative() {
  return import('@capacitor/core').then(({ Capacitor }) => Capacitor.isNativePlatform()).catch(() => false)
}

function clearWebTimers() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

function eventDateTime(event: SharedEvent) {
  const [year, month, day] = event.eventDate.split('-').map(Number)
  const [hour, minute] = (event.eventTime || '09:00').split(':').map(Number)
  return new Date(year!, month! - 1, day!, hour!, minute!)
}

export function useSharedCalendarReminders() {
  if (import.meta.client && localStorage.getItem(storageKey) === '1') enabled.value = true

  async function schedule(events: SharedEvent[]) {
    if (!import.meta.client || !enabled.value) return
    const now = Date.now()
    const reminders = events.flatMap(event => event.reminderMinutes.map(minutes => {
      const at = eventDateTime(event)
      at.setMinutes(at.getMinutes() - minutes)
      return { id: notificationId(`${event.id}:${event.eventDate}:${minutes}`), title: event.title, at, minutes }
    })).filter(item => item.at.getTime() > now).sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60)

    if (await isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.cancel({ notifications: [...scheduledIds].map(id => ({ id })) }).catch(() => undefined)
      if (reminders.length) {
        await LocalNotifications.schedule({
          notifications: reminders.map(item => ({
            id: item.id,
            title: `${item.title} 提醒`,
            body: item.minutes === 0 ? '现在开始你们的安排。' : `还有 ${item.minutes < 60 ? `${item.minutes} 分钟` : item.minutes % 1440 === 0 ? `${item.minutes / 1440} 天` : `${Math.round(item.minutes / 60)} 小时`}就要开始了。`,
            schedule: { at: item.at, allowWhileIdle: true },
            channelId: 'love-home-alerts',
            extra: { eventId: item.id },
          })),
        })
      }
      scheduledIds.clear()
      reminders.forEach(item => scheduledIds.add(item.id))
      return
    }

    clearWebTimers()
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const scheduleWebReminder = (item: typeof reminders[number]) => {
      const remaining = item.at.getTime() - Date.now()
      if (remaining <= 0) {
        new Notification(`${item.title} 提醒`, { body: '现在开始你们的安排。', tag: `calendar-${item.id}`, icon: '/favicon.ico' })
        timers.delete(item.id)
        return
      }
      const timer = setTimeout(() => scheduleWebReminder(item), Math.min(remaining, 2147480000))
      timers.set(item.id, timer)
    }
    reminders.forEach(scheduleWebReminder)
  }

  async function enable(events: SharedEvent[]) {
    busy.value = true
    try {
      if (!(await requestSystemAlerts())) return false
      enabled.value = true
      localStorage.setItem(storageKey, '1')
      await schedule(events)
      return true
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    enabled.value = false
    if (import.meta.client) localStorage.removeItem(storageKey)
    clearWebTimers()
    if (await isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.cancel({ notifications: [...scheduledIds].map(id => ({ id })) }).catch(() => undefined)
      scheduledIds.clear()
    }
  }

  return { enabled, busy, schedule, enable, disable }
}
