import { reactive, ref } from 'vue'

export type SpaceServiceKey = 'supabase' | 'media' | 'push' | 'call'
export type SpaceServiceState = 'checking' | 'ok' | 'warning' | 'error' | 'offline'
export type SpaceService = { state: SpaceServiceState; detail: string }

const services = reactive<Record<SpaceServiceKey, SpaceService>>({
  supabase: { state: 'checking', detail: '等待检查' },
  media: { state: 'checking', detail: '等待检查' },
  push: { state: 'checking', detail: '等待检查' },
  call: { state: 'checking', detail: '等待检查' },
})
const networkOnline = ref(true)
const lastSyncAt = ref('')
let listenersReady = false

function withTimeout<T>(promise: Promise<T>, timeout = 8000) {
  return Promise.race([promise, new Promise<T | null>(resolve => globalThis.setTimeout(() => resolve(null), timeout))])
}

function saveLastSync() {
  if (typeof window === 'undefined') return
  lastSyncAt.value = new Date().toISOString()
  try { window.localStorage.setItem('couple-space-last-sync-at', lastSyncAt.value) } catch {}
}

function setupNetworkListeners() {
  if (!import.meta.client || listenersReady) return
  listenersReady = true
  networkOnline.value = navigator.onLine
  window.addEventListener('online', () => { networkOnline.value = true })
  window.addEventListener('offline', () => { networkOnline.value = false })
  try { lastSyncAt.value = window.localStorage.getItem('couple-space-last-sync-at') || '' } catch {}
}

async function checkPushPermission() {
  if (!import.meta.client) return { state: 'checking' as const, detail: '等待浏览器加载' }
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const permission = await PushNotifications.checkPermissions()
      if (permission.receive === 'granted') return { state: 'ok' as const, detail: 'Android 推送权限已开启' }
      if (permission.receive === 'denied') return { state: 'error' as const, detail: '系统已拒绝推送权限' }
      return { state: 'warning' as const, detail: '尚未允许 Android 推送' }
    }
  } catch {}
  if (typeof Notification === 'undefined') return { state: 'warning' as const, detail: '当前环境不支持系统通知' }
  if (Notification.permission === 'granted') return { state: 'ok' as const, detail: '浏览器通知权限已开启' }
  if (Notification.permission === 'denied') return { state: 'error' as const, detail: '浏览器已拒绝通知权限' }
  return { state: 'warning' as const, detail: '尚未允许浏览器通知' }
}

export function useSpaceStatus() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const config = useRuntimeConfig()

  async function refresh() {
    setupNetworkListeners()
    if (!networkOnline.value) {
      services.supabase = { state: 'offline', detail: '设备当前处于离线状态' }
      services.media = { state: 'offline', detail: '等待网络恢复' }
      services.call = { state: 'offline', detail: '等待网络恢复' }
      services.push = await checkPushPermission()
      return
    }
    services.supabase = { state: 'checking', detail: '正在检查数据库连接' }
    services.media = { state: 'checking', detail: '正在检查私有图片服务' }
    services.call = { state: 'checking', detail: '正在检查通话配置' }
    services.push = await checkPushPermission()
    if (!$supabase || demoMode.value) {
      services.supabase = { state: 'warning', detail: '当前为本地演示模式' }
      services.media = { state: 'warning', detail: '演示媒体保存在本机' }
      services.call = { state: 'warning', detail: '登录并绑定情侣空间后可用' }
      saveLastSync()
      return
    }
    const memberCheck = await withTimeout($supabase.from('couple_members').select('user_id', { count: 'exact', head: true }).eq('user_id', profile.value?.id || ''))
    if (!memberCheck) services.supabase = { state: 'error', detail: '数据库请求超时' }
    else if (memberCheck.error) services.supabase = { state: 'error', detail: '数据库连接失败，请重试' }
    else services.supabase = { state: 'ok', detail: 'Supabase 数据库连接正常' }
    const coupleId = profile.value?.coupleId
    const mediaCheck = coupleId ? await withTimeout($supabase.storage.from('album-media').list(coupleId, { limit: 1 })) : null
    if (!coupleId) services.media = { state: 'warning', detail: '绑定情侣空间后检查媒体服务' }
    else if (!mediaCheck) services.media = { state: 'error', detail: '图片服务请求超时' }
    else if (mediaCheck.error) services.media = { state: 'error', detail: '私有图片服务不可用' }
    else services.media = { state: 'ok', detail: '私有图片服务连接正常' }
    if (!coupleId || !Number(config.public.zegoAppId)) services.call = { state: 'error', detail: 'ZEGO AppID 或情侣空间未配置' }
    else services.call = { state: 'ok', detail: 'ZEGO Token 服务已配置，可发起通话' }
    saveLastSync()
  }

  async function testCallService() {
    if (!$supabase || !profile.value?.coupleId) {
      services.call = { state: 'warning', detail: '请先登录并绑定情侣空间' }
      return false
    }
    services.call = { state: 'checking', detail: '正在请求 ZEGO Token 服务' }
    const response = await withTimeout($supabase.functions.invoke('zego-token', { body: { roomId: 'status-' + profile.value.coupleId, userName: profile.value.displayName || 'Love小家' } }))
    if (!response) { services.call = { state: 'error', detail: 'Token 服务请求超时' }; return false }
    if (response.error || !response.data?.token) { services.call = { state: 'error', detail: 'Token 服务未返回有效凭据' }; return false }
    services.call = { state: 'ok', detail: 'ZEGO Token 服务响应正常' }
    return true
  }

  return { services, networkOnline, lastSyncAt, refresh, testCallService }
}
