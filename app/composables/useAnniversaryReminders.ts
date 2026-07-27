import { notifySystem, requestSystemAlerts } from './useSystemAlerts'
import { occurrence, type Anniversary } from './useAnniversaries'

const enabled = ref(false)
const busy = ref(false)
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const scheduledIds = new Set<number>()
const reminderStorageKey = 'couple-space-anniversary-reminders-enabled'

function reminderId(value: string) {
  let hash = 2166136261
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return 3000 + Math.abs(hash % 900000)
}

function nextReminder(event: Anniversary) {
  const date = occurrence(event)
  const now = new Date()
  date.setHours(9, 0, 0, 0)
  if (date <= now) date.setDate(date.getDate() + 1)
  return date
}

async function isNative() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function clearWebTimers() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

async function scheduleNative(events: Anniversary[]) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const notifications = events.slice(0, 24).map(event => {
    const date = nextReminder(event)
    const days = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000))
    return {
      id: reminderId(event.id),
      title: `${event.title} 提醒`,
      body: days === 0 ? '今天就是特别的日子，记得和 TA 说一句爱你。' : `还有 ${days} 天，一起为这一天留一点时间。`,
      schedule: { at: date, allowWhileIdle: true },
      channelId: 'love-home-alerts',
      sound: 'default',
      extra: { anniversaryId: event.id },
    }
  })
  if (!notifications.length) return
  await LocalNotifications.cancel({ notifications: [...scheduledIds].map(id => ({ id })) }).catch(() => undefined)
  await LocalNotifications.schedule({ notifications })
  scheduledIds.clear()
  notifications.forEach(item => scheduledIds.add(item.id))
}

function scheduleWeb(events: Anniversary[]) {
  clearWebTimers()
  for (const event of events.slice(0, 12)) {
    const date = nextReminder(event)
    const delay = Math.max(1000, date.getTime() - Date.now())
    const timer = setTimeout(() => {
      if (Date.now() + 1000 < date.getTime()) {
        scheduleWeb(events)
        return
      }
      void notifySystem(`${event.title} 提醒`, '今天是你们的特别日子，去和 TA 分享一句心意吧。', reminderId(event.id))
      if (event.recurring) scheduleWeb(events)
    }, Math.min(delay, 2147483647))
    timers.set(event.id, timer)
  }
}

export function useAnniversaryReminders() {
  if (import.meta.client && localStorage.getItem(reminderStorageKey) === '1') enabled.value = true

  async function enable(events: Anniversary[]) {
    busy.value = true
    try {
      if (!(await requestSystemAlerts())) return false
      enabled.value = true
      localStorage.setItem(reminderStorageKey, '1')
      await schedule(events)
      return true
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    enabled.value = false
    if (import.meta.client) localStorage.removeItem(reminderStorageKey)
    clearWebTimers()
    if (await isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.cancel({ notifications: [...scheduledIds].map(id => ({ id })) }).catch(() => undefined)
      scheduledIds.clear()
    }
  }

  async function schedule(events: Anniversary[]) {
    if (!import.meta.client || !enabled.value) return
    if (await isNative()) await scheduleNative(events)
    else scheduleWeb(events)
  }

  async function sync(events: Anniversary[]) {
    if (import.meta.client && localStorage.getItem(reminderStorageKey) === '1') {
      enabled.value = true
      await schedule(events)
    }
  }

  return { enabled, busy, enable, disable, schedule, sync }
}
