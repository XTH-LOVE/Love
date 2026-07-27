import { notifySystem, requestSystemAlerts } from './useSystemAlerts'

const enabled = ref(false)
const busy = ref(false)
const timer = ref<ReturnType<typeof setTimeout> | null>(null)
const reminderId = 94021
const storageKey = 'couple-space-streak-reminder'

function nextAt(hour: number, minute: number) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1)
  return date
}
async function isNative() {
  try { const { Capacitor } = await import('@capacitor/core'); return Capacitor.isNativePlatform() } catch { return false }
}
function clearWebTimer() { if (timer.value) clearTimeout(timer.value); timer.value = null }

export function useStreakReminders() {
  if (import.meta.client && localStorage.getItem(storageKey) === '1') enabled.value = true
  async function schedule(hour = 20, minute = 30) {
    if (!import.meta.client || !enabled.value) return
    const date = nextAt(hour, minute)
    if (await isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.cancel({ notifications: [{ id: reminderId }] }).catch(() => undefined)
      await LocalNotifications.schedule({ notifications: [{ id: reminderId, title: '今晚也续一颗火花', body: '如果今天还没和 TA 互动，去留一句话、发一张照片吧。', schedule: { at: date, repeats: true, allowWhileIdle: true }, channelId: 'love-home-alerts', sound: 'default' }] })
      return
    }
    clearWebTimer()
    timer.value = setTimeout(() => { void notifySystem('今晚也续一颗火花', '如果今天还没和 TA 互动，去留一句话、发一张照片吧。', reminderId); void schedule(hour, minute) }, Math.max(1000, date.getTime() - Date.now()))
  }
  async function enable(hour = 20, minute = 30) {
    busy.value = true
    try {
      if (!(await requestSystemAlerts())) return false
      enabled.value = true
      localStorage.setItem(storageKey, '1')
      await schedule(hour, minute)
      return true
    } finally { busy.value = false }
  }
  async function disable() {
    enabled.value = false
    if (import.meta.client) localStorage.removeItem(storageKey)
    clearWebTimer()
    if (await isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.cancel({ notifications: [{ id: reminderId }] }).catch(() => undefined)
    }
  }
  return { enabled, busy, enable, disable, schedule }
}
