import type { MusicSource, MusicTrack } from '~/utils/musicApi'
import { searchMusic, getSongUrlCached, getSongPicCached, getSongLyric } from '~/utils/musicApi'
import { estimateListeningPosition, sameMusicTrack, shouldApplyListeningEvent } from '~/utils/listenTogetherState'
import { migratePlaylist, rememberRecentTrack } from '~/utils/listenTogetherPlaylist'

// ---------- 模块级单例状态（跨组件共享，音乐在页面切换时继续播放） ----------
const currentTrack = ref<MusicTrack | null>(null)
const currentCover = ref('')
const lyricLines = ref<{ time: number; text: string; translation?: string }[]>([])
const isPlaying = ref(false)
const position = ref(0)
const duration = ref(0)
const queue = ref<MusicTrack[]>([])
const playlist = ref<MusicTrack[]>([])
const recentTracks = ref<MusicTrack[]>([])
const resolving = ref(false)
const playerError = ref('')
const volume = ref(1)
const muted = ref(false)
const repeatOne = ref(false)
const partnerListening = ref(false)
const synced = ref(false)
const syncStatus = ref<'offline' | 'connecting' | 'connected' | 'reconnecting'>('offline')
const sessionRevision = ref(0)
// 对端播放状态预览（在听什么歌、播放到哪里）
const partnerState = ref<{ track: MusicTrack; position: number; playing: boolean; sentAt: number } | null>(null)
const nowTick = ref(Date.now())

let audio: HTMLAudioElement | null = null
let channel: ReturnType<import('@supabase/supabase-js').SupabaseClient['channel']> | null = null
let suppressBroadcast = false
let positionTimer: ReturnType<typeof setInterval> | null = null
let driftTimer: ReturnType<typeof setInterval> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let reconnectListenersReady = false
let onlineHandler: (() => void) | null = null
let offlineHandler: (() => void) | null = null
let restoringSession = false
let recoveryPromise: Promise<void> | null = null
// 最近一次对端播放状态锚点，用于漂移校正
let remoteAnchor: { trackId: string; source: MusicTrack['source']; playing: boolean; position: number; sentAt: number } | null = null
const DRIFT_TOLERANCE_SEC = 1.5
const DRIFT_CHECK_INTERVAL_MS = 8000
const MAX_AUTO_RECONNECT_ATTEMPTS = 5
const PAGE_SIZE = 20
const RECENT_TRACK_LIMIT = 12
const FALLBACK_SOURCES: MusicSource[] = ['netease', 'higequ', 'joox']

type SyncEvent =
  | { type: 'play'; track: MusicTrack; position: number; sentAt: number; revision: number }
  | { type: 'pause'; position: number; sentAt: number; revision: number }
  | { type: 'resume'; position: number; sentAt: number; revision: number }
  | { type: 'seek'; position: number; sentAt: number; revision: number }
  | { type: 'queue'; queue: MusicTrack[]; sentAt: number; revision: number }
  | { type: 'stop'; sentAt: number; revision: number }
  | { type: 'state-request' }
  | { type: 'state'; track: MusicTrack; position: number; playing: boolean; sentAt: number; revision: number }

type SessionRow = {
  couple_id: string
  track: MusicTrack | null
  position: number
  playing: boolean
  queue: MusicTrack[]
  revision: number
  updated_at: string
}

function parseLrc(lrc: string): { time: number; text: string }[] {
  const lines: { time: number; text: string }[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const match = raw.match(/^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)$/)
    if (!match) continue
    const minutes = Number(match[1])
    const seconds = Number(match[2])
    const ms = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) : 0
    lines.push({ time: minutes * 60 + seconds + ms / 1000, text: match[4].trim() })
  }
  return lines.sort((a, b) => a.time - b.time)
}

function mergeLyricTranslations(
  lines: { time: number; text: string }[],
  translations: { time: number; text: string }[],
) {
  if (!translations.length) return lines
  let translationIndex = 0
  return lines.map(line => {
    while (
      translationIndex + 1 < translations.length
      && Math.abs(translations[translationIndex + 1].time - line.time) <= Math.abs(translations[translationIndex].time - line.time)
    ) {
      translationIndex++
    }
    const translation = translations[translationIndex]
    return {
      ...line,
      translation: translation && Math.abs(translation.time - line.time) <= 0.8 ? translation.text : undefined,
    }
  })
}

export function useListenTogether() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  function playlistStorageKey() {
    return `couplespace-listen-playlist:${profile.value?.coupleId || 'local'}`
  }

  function recentStorageKey() {
    return `couplespace-listen-recent:${profile.value?.coupleId || 'local'}`
  }

  function readStoredTracks(key: string): MusicTrack[] {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(stored) ? stored : []
    } catch {
      return []
    }
  }

  function loadPlaylist() {
    if (!import.meta.client) return
    const key = playlistStorageKey()
    let stored = readStoredTracks(key)
    // Before the couple profile is available, older sessions are stored under
    // `local`. Migrate that data once the shared couple id is known so the
    // user's existing collection does not appear to vanish after sign-in.
    if (!stored.length && profile.value?.coupleId) {
      const localTracks = readStoredTracks('couplespace-listen-playlist:local')
      const migrated = migratePlaylist(stored, localTracks)
      if (migrated.length) {
        stored = migrated
        try { localStorage.setItem(key, JSON.stringify(stored)) } catch { /* best effort */ }
      }
    }
    playlist.value = stored
    recentTracks.value = readStoredTracks(recentStorageKey()).slice(0, RECENT_TRACK_LIMIT)
  }

  function persistPlaylist() {
    if (!import.meta.client) return
    try { localStorage.setItem(playlistStorageKey(), JSON.stringify(playlist.value)) } catch { /* Storage is best effort. */ }
  }

  function persistRecentTracks() {
    if (!import.meta.client) return
    try { localStorage.setItem(recentStorageKey(), JSON.stringify(recentTracks.value)) } catch { /* best effort */ }
  }

  function rememberTrack(track: MusicTrack) {
    recentTracks.value = rememberRecentTrack(recentTracks.value, track, RECENT_TRACK_LIMIT)
    persistRecentTracks()
  }

  watch(() => profile.value?.coupleId, loadPlaylist, { immediate: true })
  watch(
    () => [profile.value?.coupleId, profile.value?.id, demoMode.value] as const,
    ([coupleId, memberId, isDemo], previous) => {
      if (coupleId && memberId && (!previous || coupleId !== previous[0] || memberId !== previous[1] || isDemo !== previous[2])) {
        void connectSync()
      } else if (!coupleId && previous?.[0]) {
        void disconnectSync()
      }
    },
  )

  // ---------- 音频元素管理 ----------
  function ensureAudio(): HTMLAudioElement {
    if (audio) return audio
    const el = new Audio()
    el.preload = 'auto'
    el.volume = volume.value
    el.muted = muted.value
    el.addEventListener('timeupdate', () => { position.value = el.currentTime })
    el.addEventListener('durationchange', () => { if (Number.isFinite(el.duration)) duration.value = el.duration })
    el.addEventListener('play', () => { isPlaying.value = true })
    el.addEventListener('pause', () => { isPlaying.value = false })
    el.addEventListener('error', () => {
      if (currentTrack.value) void recoverPlayback()
    })
    el.addEventListener('ended', () => { handleEnded() })
    audio = el
    return el
  }

  function setVolume(next: number) {
    const value = Math.max(0, Math.min(1, Number(next) || 0))
    volume.value = value
    muted.value = value === 0
    if (audio) {
      audio.volume = value
      audio.muted = muted.value
    }
  }

  function toggleMute() {
    muted.value = !muted.value
    if (audio) audio.muted = muted.value
  }

  function startPositionTicker() {
    if (positionTimer) return
    positionTimer = setInterval(() => {
      nowTick.value = Date.now()
      if (audio && !audio.paused) position.value = audio.currentTime
    }, 500)
  }

  /** 每 5 秒向对端广播自己的播放状态，供对方预览在听什么歌 */
  function startHeartbeat() {
    if (heartbeatTimer) return
    heartbeatTimer = setInterval(() => {
      if (!currentTrack.value || !audio || demoMode.value || !channel || suppressBroadcast) return
      channel.send({
        type: 'broadcast',
        event: 'sync',
          payload: { type: 'state', track: currentTrack.value, position: audio.currentTime, playing: !audio.paused, sentAt: Date.now(), revision: sessionRevision.value } satisfies SyncEvent,
      }).catch(() => undefined)
    }, 5000)
  }

  function startDriftChecker() {
    if (driftTimer) return
    driftTimer = setInterval(() => {
      if (!audio || audio.paused || !remoteAnchor || !currentTrack.value) return
      if (!remoteAnchor.playing || remoteAnchor.trackId !== currentTrack.value.id || remoteAnchor.source !== currentTrack.value.source) return
      const expected = remoteAnchor.position + (Date.now() - remoteAnchor.sentAt) / 1000
      if (Math.abs(audio.currentTime - expected) > DRIFT_TOLERANCE_SEC && expected < (duration.value || Infinity)) {
        audio.currentTime = expected
        position.value = expected
      }
    }, DRIFT_CHECK_INTERVAL_MS)
  }

  // ---------- Realtime 同步 ----------
  function channelName() {
    return profile.value?.coupleId ? `listen-together:${profile.value.coupleId}` : null
  }

  function updatePresence() {
    if (!channel || demoMode.value || !profile.value?.id) return
    void channel.track({
      listening: Boolean(currentTrack.value),
      playing: Boolean(currentTrack.value && audio && !audio.paused),
      at: new Date().toISOString(),
    }).catch(() => undefined)
  }

  function scheduleReconnect() {
    if (demoMode.value || !$supabase || !profile.value?.coupleId || reconnectTimer) return
    if (reconnectAttempt >= MAX_AUTO_RECONNECT_ATTEMPTS) {
      syncStatus.value = 'offline'
      synced.value = false
      return
    }
    const attempt = reconnectAttempt++
    syncStatus.value = 'reconnecting'
    const delay = Math.min(30000, 800 * (2 ** attempt))
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void disconnectSync(false).then(() => connectSync())
    }, delay)
  }

  function installReconnectListeners() {
    if (!import.meta.client || reconnectListenersReady) return
    onlineHandler = () => {
      reconnectAttempt = 0
      syncStatus.value = 'reconnecting'
      // The old channel can remain allocated while the browser is offline.
      // Recreate it explicitly so Supabase Presence/Broadcast resumes reliably.
      void retrySync()
    }
    offlineHandler = () => { syncStatus.value = 'offline'; synced.value = false }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    reconnectListenersReady = true
  }

  async function restoreSession() {
    if (restoringSession || !$supabase || demoMode.value || !profile.value?.coupleId) return
    restoringSession = true
    try {
      const { data, error } = await $supabase.from('listening_sessions')
        .select('couple_id, track, position, playing, queue, revision, updated_at')
        .eq('couple_id', profile.value.coupleId)
        .maybeSingle()
      if (error) throw error
      const row = data as SessionRow | null
      if (!row || row.revision < sessionRevision.value) return
      sessionRevision.value = Number(row.revision) || 0
      queue.value = Array.isArray(row.queue) ? row.queue : []
      if (row.track) {
        partnerState.value = { track: row.track, position: Number(row.position) || 0, playing: Boolean(row.playing), sentAt: Date.parse(row.updated_at) || Date.now() }
        const sameLocalTrack = sameMusicTrack(currentTrack.value, row.track)
        if (!sameLocalTrack || !audio || audio.src === '') {
          await playLocal(row.track, Number(row.position) || 0, false)
        }
        if (row.playing && (!audio || audio.paused)) playerError.value = '已恢复一起听状态，点击播放继续'
      }
    } catch (error: any) {
      // Migration may not have been applied yet; realtime and local playback remain usable.
      if (!/schema cache|does not exist|relation/i.test(String(error?.message || ''))) playerError.value = '一起听状态恢复失败，可继续手动播放'
    } finally {
      restoringSession = false
    }
  }

  function nextRevision() {
    sessionRevision.value = Math.max(sessionRevision.value + 1, Date.now())
    return sessionRevision.value
  }

  function persistSession(revision: number) {
    if (!$supabase || demoMode.value || !profile.value?.coupleId || !profile.value.id) return
    void $supabase.rpc('save_listening_session', {
      p_couple_id: profile.value.coupleId,
      p_track: currentTrack.value,
      p_position: Number(position.value) || 0,
      p_playing: Boolean(isPlaying.value),
      p_queue: queue.value,
      p_revision: revision,
    }).then(({ error }) => {
      if (error && !/schema cache|does not exist|function/i.test(error.message)) playerError.value = '一起听状态保存失败，稍后会自动重试'
    })
  }

  async function connectSync() {
    if (demoMode.value) {
      // Demo playback is local by design; do not present it as a network failure.
      syncStatus.value = 'connected'
      synced.value = true
      return
    }
    if (channel || !$supabase) return
    const name = channelName()
    if (!name || !profile.value?.id) return
    // Install this before the online check so an initially offline page can recover.
    installReconnectListeners()
    if (import.meta.client && !navigator.onLine) {
      syncStatus.value = 'offline'
      synced.value = false
      return
    }
    syncStatus.value = reconnectAttempt ? 'reconnecting' : 'connecting'
    const ch = $supabase.channel(name, {
      config: { private: true, presence: { key: profile.value.id }, broadcast: { self: false } },
    })
    ch.on('broadcast', { event: 'sync' }, (payload: { payload: SyncEvent }) => handleRemote(payload.payload))
    const refreshPresence = () => {
      const state = ch.presenceState() as Record<string, Array<{ listening?: boolean; playing?: boolean }>>
      const ids = Object.keys(state)
      const partner = Object.entries(state).find(([id]) => id !== profile.value?.id)
      partnerListening.value = Boolean(partner?.[1]?.some(item => item.listening))
      synced.value = ids.length > 0
    }
    ch.on('presence', { event: 'sync' }, refreshPresence)
    ch.on('presence', { event: 'join' }, refreshPresence)
    ch.on('presence', { event: 'leave' }, refreshPresence)
    channel = ch
    ch.subscribe(async (status: string) => {
      if (channel !== ch) return
       if (status === 'SUBSCRIBED') { reconnectAttempt = 0; syncStatus.value = 'connected'; synced.value = true; updatePresence(); await restoreSession() }
       if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { syncStatus.value = 'reconnecting'; synced.value = false; scheduleReconnect() }
     })
    startPositionTicker()
    startDriftChecker()
    startHeartbeat()
  }

  async function disconnectSync(removeNetworkListeners = true) {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    if (channel && $supabase) await $supabase.removeChannel(channel).catch(() => undefined)
    channel = null
    syncStatus.value = 'offline'
    partnerListening.value = false
    synced.value = false
    partnerState.value = null
    if (positionTimer) { clearInterval(positionTimer); positionTimer = null }
    if (driftTimer) { clearInterval(driftTimer); driftTimer = null }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
    if (removeNetworkListeners && import.meta.client && reconnectListenersReady) {
      if (onlineHandler) window.removeEventListener('online', onlineHandler)
      if (offlineHandler) window.removeEventListener('offline', offlineHandler)
      onlineHandler = null; offlineHandler = null; reconnectListenersReady = false
    }
  }

  async function retrySync() {
    reconnectAttempt = 0
    await disconnectSync()
    await connectSync()
  }

  function broadcast(event: SyncEvent) {
    if (suppressBroadcast || demoMode.value || !channel) return
    channel.send({ type: 'broadcast', event: 'sync', payload: event }).catch(() => undefined)
  }

  /** 一键加入：请求对端同步当前播放状态 */
  function requestPartnerState() {
    if (demoMode.value || !channel) return
    channel.send({ type: 'broadcast', event: 'sync', payload: { type: 'state-request' } satisfies SyncEvent }).catch(() => undefined)
  }

  // ---------- 播放控制 ----------
  async function resolveUrlWithRetry(track: MusicTrack, force: boolean): Promise<string | null> {
    return getSongUrlCached(track, 192, force)
  }

  function normalizedText(value: string) {
    const simplified = value
      .replace(/[傑杰]/g, '杰')
      .replace(/[倫伦]/g, '伦')
      .replace(/[説說]/g, '说')
      .replace(/[華华]/g, '华')
      .replace(/[專专]/g, '专')
      .replace(/[輯辑]/g, '辑')
      .replace(/[葉叶]/g, '叶')
      .replace(/[樂乐]/g, '乐')
      .replace(/[臺台]/g, '台')
      .replace(/[裡里]/g, '里')
    return simplified.toLowerCase().replace(/[\s\-_.·•，。！？!?,：:（）()[\]【】]/g, '')
  }

  function sourceLabel(source: MusicSource) {
    return source === 'netease' ? '网易云' : source === 'higequ' ? 'Hi歌' : 'JOOX'
  }

  function isLikelySameSong(candidate: MusicTrack, track: MusicTrack) {
    const wantedName = normalizedText(track.name)
    const candidateName = normalizedText(candidate.name)
    if (!wantedName || !candidateName) return false
    const nameMatches = candidateName === wantedName
      || candidateName.includes(wantedName)
      || wantedName.includes(candidateName)
    const wantedArtist = normalizedText(track.artist[0] || '')
    const candidateArtists = candidate.artist.map(normalizedText)
    const artistMatches = !wantedArtist || candidateArtists.some(artist => {
      if (!artist) return false
      if (artist.includes(wantedArtist) || wantedArtist.includes(artist)) return true
      // Netease sometimes labels 周杰伦 as Jay, while JOOX/Hi歌 use the Chinese name.
      return (wantedArtist === '周杰伦' && artist === 'jay')
        || (wantedArtist === 'jay' && artist === '周杰伦')
    })
    return nameMatches && artistMatches
  }

  /**
   * GD Studio occasionally returns search results whose source has no playable
   * URL (currently common for JOOX). Resolve the selected source first, then
   * search the same song on the remaining providers and validate each URL.
   */
  async function resolvePlayableTrack(track: MusicTrack, force = false): Promise<{ track: MusicTrack; url: string } | null> {
    let ownUrl: string | null = null
    try {
      ownUrl = await resolveUrlWithRetry(track, force)
    } catch {
      // A provider may fail with HTTP 4xx/5xx instead of returning an empty URL.
    }
    if (ownUrl) return { track, url: ownUrl }

    const sources = FALLBACK_SOURCES.filter(source => source !== track.source)
    const query = [track.name, track.artist[0]].filter(Boolean).join(' ')
    for (const source of sources) {
      let candidates: MusicTrack[]
      try {
        candidates = await searchMusic(query, source, 1, 10)
      } catch {
        continue
      }
      const matches = candidates.filter(candidate => isLikelySameSong(candidate, track)).slice(0, 3)
      if (!matches.length) continue
      try {
        return await Promise.any(matches.map(async candidate => {
          const url = await resolveUrlWithRetry(candidate, true)
          if (!url) throw new Error('候选音源不可播放')
          return { track: candidate, url }
        }))
      } catch {
        // Keep the provider priority while trying a small candidate set concurrently.
      }
    }
    return null
  }

  async function loadMeta(track: MusicTrack) {
    currentCover.value = ''
    lyricLines.value = []
    getSongPicCached(track).then(pic => {
      if (sameMusicTrack(currentTrack.value, track) && pic) currentCover.value = pic
    }).catch(() => undefined)
    getSongLyric(track).then(lrc => {
      if (!sameMusicTrack(currentTrack.value, track) || !lrc?.lyric) return
      lyricLines.value = mergeLyricTranslations(parseLrc(lrc.lyric), parseLrc(lrc.tlyric || ''))
    }).catch(() => undefined)
  }

  /** 点播一首歌：解析播放链接并同步给伴侣 */
  async function playTrack(track: MusicTrack, startAt = 0) {
    if (!import.meta.client) return
    resolving.value = true
    playerError.value = ''
    try {
      const playable = await resolvePlayableTrack(track)
      if (!playable) {
        playerError.value = '当前音源没有可播放地址，其他音源也暂时不可用，请换一首试试'
        return
      }
      const el = ensureAudio()
      currentTrack.value = playable.track
      rememberTrack(playable.track)
      duration.value = 0
      el.src = playable.url
      el.currentTime = startAt
      let started = true
      try { await el.play() } catch {
        started = false
        playerError.value = '浏览器阻止了自动播放，请点一下播放按钮'
      }
      position.value = startAt
      loadMeta(playable.track)
      if (started) {
        const revision = nextRevision()
        updatePresence()
        persistSession(revision)
        broadcast({ type: 'play', track: playable.track, position: startAt, sentAt: Date.now(), revision })
      }
    } catch (e) {
      playerError.value = (e as Error)?.message || '播放失败'
    } finally {
      resolving.value = false
    }
  }

  async function togglePlay() {
    if (!audio || !currentTrack.value) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        playerError.value = '浏览器阻止了播放，请再次点击播放按钮'
        return
      }
      const revision = nextRevision(); updatePresence(); persistSession(revision)
      broadcast({ type: 'resume', position: audio.currentTime, sentAt: Date.now(), revision })
    } else {
      audio.pause()
      const revision = nextRevision(); updatePresence(); persistSession(revision)
      broadcast({ type: 'pause', position: audio.currentTime, sentAt: Date.now(), revision })
    }
  }

  function seek(seconds: number) {
    if (!audio || !currentTrack.value) return
    const target = Math.max(0, Math.min(seconds, duration.value || seconds))
    audio.currentTime = target
    position.value = target
    const revision = nextRevision(); persistSession(revision)
    broadcast({ type: 'seek', position: target, sentAt: Date.now(), revision })
  }

  function stopSession() {
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    currentTrack.value = null
    currentCover.value = ''
    lyricLines.value = []
    isPlaying.value = false
    position.value = 0
    duration.value = 0
    remoteAnchor = null
    const revision = nextRevision(); updatePresence(); persistSession(revision)
    broadcast({ type: 'stop', sentAt: Date.now(), revision })
  }

  // ---------- 播放队列 ----------
  function enqueue(track: MusicTrack) {
    if (queue.value.some(t => t.id === track.id && t.source === track.source)) return
    queue.value = [...queue.value, track]
    const revision = nextRevision(); persistSession(revision)
    broadcast({ type: 'queue', queue: queue.value, sentAt: Date.now(), revision })
  }

  /** Replace the waiting queue in one sync event, matching native playlist playback. */
  function replaceQueue(tracks: MusicTrack[]) {
    const next: MusicTrack[] = []
    for (const track of tracks) {
      if (!next.some(item => item.id === track.id && item.source === track.source)) next.push(track)
    }
    queue.value = next
    const revision = nextRevision(); persistSession(revision)
    broadcast({ type: 'queue', queue: next, sentAt: Date.now(), revision })
  }

  function removeFromQueue(index: number) {
    queue.value = queue.value.filter((_, i) => i !== index)
    const revision = nextRevision(); persistSession(revision)
    broadcast({ type: 'queue', queue: queue.value, sentAt: Date.now(), revision })
  }

  function isInPlaylist(track: MusicTrack) {
    return playlist.value.some(item => sameMusicTrack(item, track))
  }

  function togglePlaylist(track: MusicTrack) {
    if (isInPlaylist(track)) {
      playlist.value = playlist.value.filter(item => !sameMusicTrack(item, track))
    } else {
      playlist.value = [...playlist.value, track]
    }
    persistPlaylist()
  }

  function moveQueueItem(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= queue.value.length || toIndex < 0 || toIndex >= queue.value.length || fromIndex === toIndex) return
    const next = [...queue.value]
    const [item] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, item)
    queue.value = next
    const revision = nextRevision(); persistSession(revision)
    broadcast({ type: 'queue', queue: next, sentAt: Date.now(), revision })
  }

  function handleEnded() {
    if (repeatOne.value && currentTrack.value) {
      void playTrack(currentTrack.value)
      return
    }
    const next = queue.value[0]
    if (next) {
      // 双方几乎同时收到 ended，各自出队一次即可保持一致
      queue.value = queue.value.slice(1)
      void playTrack(next)
    } else {
      isPlaying.value = false
    }
  }

  /** 手动跳到队列下一首（双方各自出队一次，保持一致） */
  function playNext() {
    const next = queue.value[0]
    if (!next) return
    queue.value = queue.value.slice(1)
    void playTrack(next)
  }

  /** 回到最近播放中的上一首；没有上一首时将当前歌曲归零。 */
  function playPrevious() {
    if (!currentTrack.value) return
    const currentIndex = recentTracks.value.findIndex(track => sameMusicTrack(track, currentTrack.value!))
    const previous = recentTracks.value[currentIndex >= 0 ? currentIndex + 1 : 1]
    if (previous) {
      void playTrack(previous)
      return
    }
    if (audio) {
      audio.currentTime = 0
      position.value = 0
    }
  }

  function toggleRepeatOne() {
    repeatOne.value = !repeatOne.value
  }

  // ---------- 接收对端事件 ----------
  function handleRemote(event: SyncEvent) {
    // 状态心跳用于预览，即使版本相同也要更新；控制事件才按版本丢弃旧包。
    if (!shouldApplyListeningEvent(event, sessionRevision.value)) return
    if ('revision' in event) sessionRevision.value = Math.max(sessionRevision.value, Number(event.revision))
    suppressBroadcast = true
    try {
      if (event.type === 'play') {
        remoteAnchor = { trackId: event.track.id, source: event.track.source, playing: true, position: event.position, sentAt: event.sentAt }
        partnerState.value = { track: event.track, position: event.position, playing: true, sentAt: event.sentAt }
        const sameSong = currentTrack.value && currentTrack.value.id === event.track.id && currentTrack.value.source === event.track.source
        const elapsed = Math.max(0, (Date.now() - event.sentAt) / 1000)
        const startAt = event.position + elapsed
        if (sameSong && audio) {
          // 同一首歌：校正位置与播放状态
          if (Math.abs(audio.currentTime - startAt) > DRIFT_TOLERANCE_SEC) audio.currentTime = startAt
          if (audio.paused) void audio.play().catch(() => undefined)
        } else {
          void playLocal(event.track, startAt)
        }
        // 若播放的是队列头部，本地同步出队
        if (queue.value[0] && queue.value[0].id === event.track.id && queue.value[0].source === event.track.source) {
          queue.value = queue.value.slice(1)
        }
      } else if (event.type === 'pause') {
        if (audio && !audio.paused) audio.pause()
        if (partnerState.value) partnerState.value = { ...partnerState.value, playing: false }
        remoteAnchor = remoteAnchor ? { ...remoteAnchor, playing: false } : null
      } else if (event.type === 'resume') {
        if (audio && audio.paused && currentTrack.value) void audio.play().catch(() => undefined)
        if (partnerState.value) partnerState.value = { ...partnerState.value, playing: true, position: event.position, sentAt: event.sentAt }
        if (remoteAnchor) remoteAnchor = { ...remoteAnchor, playing: true, position: event.position, sentAt: event.sentAt }
      } else if (event.type === 'seek') {
        if (audio && currentTrack.value) {
          const elapsed = Math.max(0, (Date.now() - event.sentAt) / 1000)
          audio.currentTime = event.position + (isPlaying.value ? elapsed : 0)
          position.value = audio.currentTime
        }
        if (partnerState.value) partnerState.value = { ...partnerState.value, position: event.position, sentAt: event.sentAt }
        if (remoteAnchor) remoteAnchor = { ...remoteAnchor, position: event.position, sentAt: event.sentAt }
      } else if (event.type === 'queue') {
        queue.value = event.queue
      } else if (event.type === 'state') {
        // 对端状态心跳：仅更新预览，不干预本地播放（除非本地正在同步同一首歌则用于漂移参考）
        partnerState.value = { track: event.track, position: event.position, playing: event.playing, sentAt: event.sentAt }
      } else if (event.type === 'stop') {
        if (audio) audio.pause()
        currentTrack.value = null
        isPlaying.value = false
        position.value = 0
        remoteAnchor = null
        partnerState.value = null
      } else if (event.type === 'state-request') {
        // 对方点击了一键加入：把自己当前的播放状态同步过去（绕过 suppressBroadcast 直接发送）
        if (currentTrack.value && audio && channel && !demoMode.value) {
          const reply: SyncEvent = { type: 'play', track: currentTrack.value, position: audio.currentTime, sentAt: Date.now(), revision: sessionRevision.value }
          channel.send({ type: 'broadcast', event: 'sync', payload: reply }).catch(() => undefined)
        }
      }
    } finally {
      suppressBroadcast = false
    }
  }

  /** 应用对端点播，不再回广播 */
  async function playLocal(track: MusicTrack, startAt: number, autoplay = true) {
    try {
      const playable = await resolvePlayableTrack(track)
      if (!playable) return
      const el = ensureAudio()
      currentTrack.value = playable.track
      el.src = playable.url
      el.currentTime = startAt
      if (autoplay) await el.play().catch(() => undefined)
      position.value = startAt
      loadMeta(playable.track)
    } catch { /* 对端点播失败静默，等待用户手动重试 */ }
  }

  async function recoverPlayback() {
    if (recoveryPromise || !currentTrack.value || !audio) return
    const track = currentTrack.value
    const wasPlaying = !audio.paused || isPlaying.value
    const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : position.value
    recoveryPromise = (async () => {
      playerError.value = '播放链接已刷新，正在重新连接…'
      for (const delay of [0, 1000, 3000]) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay))
        try {
          const playable = await resolvePlayableTrack(track, true)
          if (!playable || !sameMusicTrack(currentTrack.value, track)) continue
          const switchedSource = !sameMusicTrack(playable.track, track)
          currentTrack.value = playable.track
          audio!.src = playable.url
          audio!.currentTime = resumeAt
          if (wasPlaying) await audio!.play()
          loadMeta(playable.track)
          playerError.value = switchedSource
            ? `原音源不可用，已切换到${sourceLabel(playable.track.source)}`
            : ''
          return
        } catch { /* Try again with a fresh signed URL. */ }
      }
      playerError.value = '播放链接暂时不可用，请稍后点击播放重试'
    })().finally(() => { recoveryPromise = null })
    await recoveryPromise
  }

  // ---------- 搜索 ----------
  async function search(query: string, source: MusicTrack['source'], page = 1, signal?: AbortSignal) {
    return searchMusic(query, source, page, PAGE_SIZE, signal)
  }

  const currentLyricIndex = computed(() => {
    const lines = lyricLines.value
    if (!lines.length) return -1
    let index = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= position.value) index = i
      else break
    }
    return index
  })

  /** 对端当前估算播放位置（依赖 nowTick 每 500ms 跳动） */
  const partnerProgress = computed(() => {
    const state = partnerState.value
    if (!state) return 0
    return estimateListeningPosition(state, nowTick.value)
  })

  return {
    currentTrack, currentCover, lyricLines, currentLyricIndex,
    isPlaying, position, duration, queue, playlist, recentTracks, resolving, playerError, volume, muted, repeatOne,
    partnerListening, synced, syncStatus, partnerState, partnerProgress,
    connectSync, disconnectSync,
    retrySync,
    playTrack, togglePlay, seek, stopSession, playPrevious, playNext, setVolume, toggleMute, toggleRepeatOne,
    enqueue, replaceQueue, removeFromQueue, moveQueueItem, isInPlaylist, togglePlaylist, search, requestPartnerState,
  }
}
