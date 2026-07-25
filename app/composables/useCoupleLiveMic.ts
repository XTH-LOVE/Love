import { notifySystem } from './useSystemAlerts'

export type LiveMicStatus = 'idle' | 'broadcasting' | 'listening'

const liveStatus = ref<LiveMicStatus>('idle')
const liveError = ref('')
const liveMuted = ref(false)
const liveRemoteMuted = ref(false)
const liveRemoteName = ref('TA')
const liveNeedsGesture = ref(false)

let signalChannel: any = null
let channelReady: Promise<void> | null = null
let engine: any = null
let roomId = ''
let localStream: MediaStream | null = null
let localStreamId = ''
let remoteStreamIds = new Set<string>()
let remoteStreams = new Map<string, MediaStream>()
let audioElement: HTMLAudioElement | null = null
let ignoreCurrentLive = false
let loginInFlight = false
let startInFlight = false
let listenInFlight = false

function readableError(error: any, fallback: string) {
  const code = Number(error?.code ?? error?.errorCode ?? 0)
  const message = String(error?.message || error?.msg || '').toLowerCase()
  if (code === 1102026 || message.includes('cancel login')) return 'ZEGO 登录被取消，上一条连接正在释放，请等待 1 秒后重试。'
  if (typeof error === 'string' && error.trim()) return error
  const detail = [error?.message, error?.msg, error?.errorMessage, error?.extendedData]
    .find(value => typeof value === 'string' && value.trim())
  return detail ? String(detail) : fallback
}

function coupleRoomId(coupleId: string) {
  return `love-home-live-${coupleId}`.slice(0, 120)
}

function getAudioElement() {
  if (!import.meta.client) return null
  if (audioElement) return audioElement
  audioElement = document.createElement('audio')
  audioElement.autoplay = true
  audioElement.playsInline = true
  audioElement.setAttribute('playsinline', '')
  audioElement.setAttribute('aria-hidden', 'true')
  audioElement.style.position = 'fixed'
  audioElement.style.width = '1px'
  audioElement.style.height = '1px'
  audioElement.style.opacity = '0.01'
  audioElement.style.pointerEvents = 'none'
  document.body.appendChild(audioElement)
  return audioElement
}

async function playAudio() {
  const audio = getAudioElement()
  if (!audio || !audio.srcObject) return false
  try {
    await audio.play()
    liveNeedsGesture.value = false
    return true
  } catch {
    liveNeedsGesture.value = true
    return false
  }
}

export function useCoupleLiveMic() {
  const { $supabase } = useNuxtApp()
  const config = useRuntimeConfig()
  const { profile, demoMode } = useCoupleAuth()

  function currentRoom() {
    return coupleRoomId(profile.value?.coupleId || 'demo')
  }

  async function broadcast(event: string, payload: Record<string, unknown> = {}) {
    if (!signalChannel) throw new Error('开麦信令尚未连接')
    const status = await signalChannel.send({
      type: 'broadcast',
      event,
      payload: { ...payload, senderId: profile.value?.id },
    })
    if (status !== 'ok') throw new Error(`开麦信令发送失败（${status || 'unknown'}）`)
  }

  async function getToken(targetRoom: string) {
    if (!$supabase) throw new Error('Supabase 尚未配置')
    const { data, error } = await $supabase.functions.invoke('zego-token', {
      body: { roomId: targetRoom, userName: profile.value?.displayName || 'Love小家' },
    })
    if (error) {
      let detail = error.message || 'ZEGO Token 获取失败'
      const response = (error as any).context
      if (response && typeof response.clone === 'function') {
        try {
          const body = await response.clone().json()
          if (body?.error || body?.message) detail = String(body.error || body.message)
          if (response.status) detail += `（HTTP ${response.status}）`
        } catch { /* Keep the SDK error. */ }
      }
      throw new Error(detail)
    }
    if (!data?.token || !data?.appId) throw new Error(data?.error || 'ZEGO Token 响应不完整')
    return { token: String(data.token), appId: Number(data.appId), roomId: String(data.roomId || targetRoom) }
  }

  async function ensureEngine(appId: number) {
    if (!import.meta.client) throw new Error('开麦功能只能在客户端使用')
    if (engine) return
    const { ZegoExpressEngine } = await import('zego-express-engine-webrtc')
    engine = new ZegoExpressEngine(appId, String(config.public.zegoServer || 'wss://webliveroom-api.zego.im/ws'))
    engine.on('roomStreamUpdate', async (streamRoom: string, updateType: string, streamList: Array<{ streamID: string }>) => {
      if (streamRoom !== roomId || updateType !== 'ADD') return
      for (const stream of streamList || []) {
        if (!stream.streamID || stream.streamID === localStreamId || remoteStreamIds.has(stream.streamID)) continue
        try {
          const remote = await engine.startPlayingStream(stream.streamID)
          remoteStreamIds.add(stream.streamID)
          remoteStreams.set(stream.streamID, remote)
          const audio = getAudioElement()
          if (audio) {
            audio.srcObject = remote
            await playAudio()
          }
          if (liveStatus.value === 'listening') {
            void notifySystem(`${liveRemoteName.value} 正在开麦`, liveRemoteMuted.value ? '对方暂时静音' : '已连接，可以直接听到声音', 2101)
          }
        } catch (error: any) {
          liveError.value = readableError(error, '远端开麦音频播放失败')
        }
      }
    })
    engine.on('roomStateUpdate', (streamRoom: string, state: string, errorCode: number, extendedData: string) => {
      if (streamRoom !== roomId || state !== 'DISCONNECTED') return
      if (errorCode) liveError.value = extendedData ? `${extendedData}（错误码 ${errorCode}）` : `开麦房间已断开（错误码 ${errorCode}）`
      // Do not call logoutRoom while loginRoom is still pending: ZEGO reports
      // that sequence as the misleading 1102026 "cancel login" error.
      if (loginInFlight) return
      cleanupRoom()
    })
    engine.on('publisherStateUpdate', (result: any) => {
      if (result?.streamID !== localStreamId || result?.state !== 'NO_PUBLISH' || !result?.errorCode) return
      liveError.value = readableError(result, `开麦推流失败（${result.errorCode}）`)
      cleanupRoom()
    })
  }

  async function joinRoom(publish: boolean) {
    const userId = String(profile.value?.id || '').trim()
    if (!userId) throw new Error('当前账号身份尚未加载完成，请刷新页面后再试')
    const targetRoom = currentRoom()
    const auth = await getToken(targetRoom)
    if (!Number.isFinite(auth.appId) || auth.appId <= 0) throw new Error('ZEGO AppID 无效')
    await ensureEngine(auth.appId)
    roomId = auth.roomId
    const user = { userID: userId, userName: profile.value?.displayName || 'Love小家' }
    loginInFlight = true
    let loggedIn = false
    try {
      loggedIn = await engine.loginRoom(roomId, auth.token, user, { userUpdate: true })
    } finally {
      loginInFlight = false
    }
    if (!loggedIn) throw new Error('开麦房间登录失败，请检查 ZEGO Token')
    if (!publish) {
      liveStatus.value = 'listening'
      await playAudio()
      return
    }
    localStream = await engine.createStream({ camera: { audio: true, video: false } })
    localStreamId = `live-audio-${userId}`
    if (!engine.startPublishingStream(localStreamId, localStream)) throw new Error('开麦音频发布失败')
    liveStatus.value = 'broadcasting'
  }

  async function beginListening(payload: any) {
    if (ignoreCurrentLive || liveStatus.value !== 'idle' || listenInFlight) return
    liveError.value = ''
    liveRemoteName.value = String(payload?.userName || 'TA')
    liveRemoteMuted.value = false
    listenInFlight = true
    try {
      await ensureLiveChannel()
      await joinRoom(false)
      void notifySystem(`${liveRemoteName.value} 正在开麦`, '无需接听，已自动进入收听状态', 2100)
    } catch (error: any) {
      liveError.value = readableError(error, '无法加入对方的开麦')
      cleanupRoom()
    } finally {
      listenInFlight = false
    }
  }

  async function ensureLiveChannel() {
    if (demoMode.value || !$supabase || !profile.value?.coupleId) return
    if (channelReady) return channelReady
    signalChannel = $supabase.channel(`zego-live:${profile.value.coupleId}`, { config: { broadcast: { self: false, ack: true } } })
      .on('broadcast', { event: 'live-start' }, ({ payload }: any) => {
        if (payload?.senderId === profile.value?.id) return
        void beginListening(payload)
      })
      .on('broadcast', { event: 'live-stop' }, ({ payload }: any) => {
        if (payload?.senderId === profile.value?.id) return
        ignoreCurrentLive = false
        cleanupRoom()
      })
      .on('broadcast', { event: 'live-mute' }, ({ payload }: any) => {
        if (payload?.senderId === profile.value?.id) return
        liveRemoteMuted.value = Boolean(payload?.muted)
      })
    channelReady = new Promise<void>((resolve, reject) => {
      signalChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') resolve()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') reject(new Error('开麦信令连接失败'))
      })
    }).catch(async error => {
      const failedChannel = signalChannel
      signalChannel = null
      channelReady = null
      if (failedChannel && $supabase) await $supabase.removeChannel(failedChannel)
      throw error
    })
    return channelReady
  }

  async function startLive() {
    if (liveStatus.value !== 'idle' || startInFlight) return
    if (demoMode.value || !$supabase || !profile.value?.coupleId) {
      liveError.value = '开麦需要登录并绑定情侣空间'
      return
    }
    liveError.value = ''
    ignoreCurrentLive = false
    startInFlight = true
    try {
      await ensureLiveChannel()
      await joinRoom(true)
      await broadcast('live-start', { roomId, userName: profile.value?.displayName || 'TA' })
      void notifySystem('已开始开麦', '对方无需接听即可收听', 2102)
    } catch (error: any) {
      liveError.value = readableError(error, '无法开始开麦')
      cleanupRoom()
    } finally {
      startInFlight = false
    }
  }

  async function stopLive() {
    const shouldBroadcast = liveStatus.value === 'broadcasting'
    if (shouldBroadcast && signalChannel) await broadcast('live-stop').catch(() => undefined)
    ignoreCurrentLive = liveStatus.value === 'listening'
    cleanupRoom()
  }

  function dismissLive() {
    if (liveStatus.value === 'listening') ignoreCurrentLive = true
    cleanupRoom()
  }

  function toggleLiveMute() {
    if (liveStatus.value !== 'broadcasting' || !localStream || !engine) return
    liveMuted.value = !liveMuted.value
    engine.mutePublishStreamAudio(localStream, liveMuted.value)
    void broadcast('live-mute', { muted: liveMuted.value }).catch(() => undefined)
  }

  async function resumeLiveAudio() {
    await playAudio()
  }

  function cleanupRoom() {
    if (localStream && engine && localStreamId) engine.stopPublishingStream(localStreamId)
    if (localStream && engine) engine.destroyStream(localStream)
    if (roomId && engine) engine.logoutRoom(roomId)
    remoteStreamIds.forEach(id => engine?.stopPlayingStream(id))
    localStream = null
    localStreamId = ''
    roomId = ''
    remoteStreamIds.clear()
    remoteStreams.clear()
    if (audioElement) { audioElement.pause(); audioElement.srcObject = null }
    liveMuted.value = false
    liveRemoteMuted.value = false
    liveNeedsGesture.value = false
    liveStatus.value = 'idle'
  }

  async function disconnectLive() {
    cleanupRoom()
    if (engine) { engine.destroyEngine(); engine = null }
    if (signalChannel && $supabase) await $supabase.removeChannel(signalChannel)
    signalChannel = null
    channelReady = null
    ignoreCurrentLive = false
    if (audioElement) { audioElement.remove(); audioElement = null }
    loginInFlight = false
    startInFlight = false
    listenInFlight = false
  }

  return {
    liveStatus,
    liveError,
    liveMuted,
    liveRemoteMuted,
    liveRemoteName,
    liveNeedsGesture,
    ensureLiveChannel,
    startLive,
    stopLive,
    dismissLive,
    toggleLiveMute,
    resumeLiveAudio,
    disconnectLive,
  }
}
