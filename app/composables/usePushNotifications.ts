import { notifySystem } from './useSystemAlerts'
import { startNativeIncomingAlert, stopNativeIncomingAlert } from './useAndroidCallControls'

let listenersReady = false
let registrationPromise: Promise<boolean> | null = null

async function isNativeAndroid() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

export function usePushNotifications() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  async function saveToken(token: string) {
    if (!$supabase || !profile.value?.id || !profile.value.coupleId || !token) return
    await $supabase.from('push_tokens').upsert({
      user_id: profile.value.id,
      couple_id: profile.value.coupleId,
      platform: 'android',
      token,
      device_label: navigator.userAgent.slice(0, 120),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'token' }).then(({ error }) => { if (error) console.warn('[push] token save failed', error.message) })
  }

  async function handleIncoming(data: Record<string, string>) {
    if (data.type !== 'incoming_call') return
    await startNativeIncomingAlert()
    await notifySystem(`${data.callerName || 'TA'} 发来${data.mode === 'video' ? '视频' : '语音'}来电`, '点击 Love小家 返回接听', 2301)
  }

  async function register() {
    if (registrationPromise) return registrationPromise
    if (demoMode.value || !(await isNativeAndroid()) || !$supabase || !profile.value?.coupleId) return false
    registrationPromise = (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const permission = await PushNotifications.checkPermissions()
      const nextPermission = permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale'
        ? await PushNotifications.requestPermissions()
        : permission
      if (nextPermission.receive !== 'granted') return false
      if (!listenersReady) {
        listenersReady = true
        await PushNotifications.addListener('registration', event => { void saveToken(event.value) })
        await PushNotifications.addListener('registrationError', error => console.warn('[push] registration failed', error))
        await PushNotifications.addListener('pushNotificationReceived', notification => { void handleIncoming(notification.data as Record<string, string>) })
        await PushNotifications.addListener('pushNotificationActionPerformed', event => { void handleIncoming(event.notification.data as Record<string, string>) })
      }
      await PushNotifications.register()
      return true
    })().catch(error => { console.warn('[push] setup failed', error); return false })
    return registrationPromise
  }

  async function unregister() {
    if (!$supabase || !profile.value?.id) return
    await $supabase.from('push_tokens').delete().eq('user_id', profile.value.id).eq('platform', 'android')
    await stopNativeIncomingAlert()
  }

  return { register, unregister }
}
