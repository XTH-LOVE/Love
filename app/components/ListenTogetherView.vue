<script setup lang="ts">
import { ArrowLeft, Bookmark, ChevronDown, ChevronUp, Heart, ListMusic, LoaderCircle, MessageCircle, Mic, Music2, Pause, Play, Plus, RefreshCw, Repeat1, Search, Send, SkipBack, SkipForward, Square, Trash2, Volume2, VolumeX, Wifi, WifiOff, X } from '@lucide/vue'
import { discoverPlaylists, getPlaylistDetail, getPlaylistTracks, getSongPicCached, MUSIC_SOURCES, searchPlaylists, type MusicPlaylist, type MusicSource, type MusicTrack } from '~/utils/musicApi'
import { shouldSendRecordedVoice } from '~/utils/musicRecording'
import { tracksAfterSelected } from '~/utils/listenTogetherPlaylist'

const { profile } = useCoupleAuth()
const { members } = useAccountManagement()
const {
  currentTrack, currentCover, lyricLines, currentLyricIndex,
  isPlaying, position, duration, queue, playlist, recentTracks, resolving, playerError, volume, muted, repeatOne,
  partnerListening, synced, syncStatus, partnerState, partnerProgress,
  connectSync, disconnectSync, retrySync,
  playTrack, togglePlay, seek, stopSession, playPrevious, playNext, setVolume, toggleMute, toggleRepeatOne,
  enqueue, replaceQueue, removeFromQueue, moveQueueItem, isInPlaylist, togglePlaylist, search, requestPartnerState,
} = useListenTogether()
const { messages, sending, chatError, audioLoading, audioErrors, load: loadChat, loadAudio, subscribe: subscribeChat, disconnect: disconnectChat, sendText, sendVoice } = useMusicChat()

const selfMember = computed(() => members.value.find(m => m.id === profile.value?.id) || members.value[0])
const partnerMember = computed(() => members.value.find(m => m.id !== profile.value?.id))

// ---------- 搜索与分页 ----------
const keyword = ref('')
const source = ref<MusicSource>('netease')
const searching = ref(false)
const loadingMore = ref(false)
const searchError = ref('')
const results = ref<MusicTrack[]>([])
const neteasePlaylists = ref<MusicPlaylist[]>([])
const selectedNeteasePlaylist = ref<MusicPlaylist | null>(null)
const neteasePlaylistTracks = ref<MusicTrack[]>([])
const playlistSearchKeyword = ref('')
const playlistCategory = ref('全部')
const playlistSearchPage = ref(1)
const playlistTracksPage = ref(1)
const playlistSearchLoading = ref(false)
const playlistTracksLoading = ref(false)
const playlistSearchError = ref('')
const playlistTracksError = ref('')
const hasMorePlaylists = ref(false)
const hasMorePlaylistTracks = ref(false)
const searched = ref(false)
const page = ref(1)
const hasMore = ref(false)
const libraryTab = ref<'search' | 'playlist'>('search')
type PlaylistCollection = 'home' | 'favorites' | 'recent' | 'netease'
const playlistPageOpen = ref(false)
const playlistCollection = ref<PlaylistCollection>('home')

let aborter: AbortController | null = null
let searchRequestId = 0

// ---------- 封面懒加载（并发 4） ----------
const coverMap = ref<Record<string, string>>({})
const failedPlaylistCovers = ref<Record<string, boolean>>({})
const coverLoading = new Set<string>()
let coverQueue: MusicTrack[] = []
let coverActive = 0

function queueCovers(tracks: MusicTrack[]) {
  for (const track of tracks) {
    const key = trackKey(track)
    if (!coverMap.value[key] && !coverLoading.has(key)) {
      coverLoading.add(key)
      coverQueue.push(track)
    }
  }
  pumpCovers()
}

function pumpCovers() {
  while (coverActive < 4 && coverQueue.length) {
    const track = coverQueue.shift()!
    coverActive++
    getSongPicCached(track)
      .then(url => { if (url) coverMap.value[trackKey(track)] = url })
      .catch(() => undefined)
      .finally(() => { coverLoading.delete(trackKey(track)); coverActive--; pumpCovers() })
  }
}

function handleTrackCoverError(key: string) {
  coverMap.value[key] = ''
}

function handleCurrentCoverError() {
  currentCover.value = ''
}

function handlePlaylistCoverError(id: string) {
  failedPlaylistCovers.value[id] = true
}

// ---------- 播放器页面 ----------
const playerOpen = ref(false)
const showLyrics = ref(false)
const chatPanelOpen = ref(false)
const queuePanelOpen = ref(false)
const playerChatListRef = ref<HTMLElement | null>(null)

// ---------- 歌词滚动（复刻 otter：自动居中 + 手动滚动暂停 + 基准线） ----------
const playerLyricBoxRef = ref<HTMLElement | null>(null)
const userScrollingLyrics = ref(false)
const lyricCenterIndex = ref(-1)
let lyricsAutoScrolling = false
let lyricsScrollTimer: ReturnType<typeof setTimeout> | null = null
let lyricAutoScrollTimer: ReturnType<typeof setTimeout> | null = null

function scheduleLyricAutoScrollReset(delay: number) {
  if (lyricAutoScrollTimer) clearTimeout(lyricAutoScrollTimer)
  lyricAutoScrollTimer = setTimeout(() => {
    lyricsAutoScrolling = false
    lyricAutoScrollTimer = null
  }, delay)
}

function onLyricsScroll() {
  if (lyricsAutoScrolling) return
  userScrollingLyrics.value = true
  if (lyricsScrollTimer) clearTimeout(lyricsScrollTimer)
  lyricsScrollTimer = setTimeout(() => { userScrollingLyrics.value = false; lyricCenterIndex.value = -1 }, 2000)
  const box = playerLyricBoxRef.value
  if (!box || !lyricLines.value.length) return
  const center = box.clientHeight / 2
  const lines = box.querySelectorAll('.lt-lyric-line')
  let best = -1
  let bestDist = Infinity
  lines.forEach((el, i) => {
    const node = el as HTMLElement
    const mid = node.offsetTop + node.clientHeight / 2 - box.scrollTop
    const dist = Math.abs(mid - center)
    if (dist < bestDist) { bestDist = dist; best = i }
  })
  lyricCenterIndex.value = best
}

watch(currentLyricIndex, index => {
  if (userScrollingLyrics.value || index < 0 || !playerOpen.value) return
  const box = playerLyricBoxRef.value
  if (!box) return
  const line = box.querySelectorAll('.lt-lyric-line')[index] as HTMLElement | undefined
  if (!line) return
  lyricsAutoScrolling = true
  box.scrollTo({ top: line.offsetTop - box.clientHeight * 0.25 + line.clientHeight / 2, behavior: 'smooth' })
  scheduleLyricAutoScrollReset(800)
})

function syncViewportLock() {
  if (!import.meta.client) return
  const locked = playerOpen.value || playlistPageOpen.value
  document.documentElement.classList.toggle('lt-player-lock', locked)
  document.body.classList.toggle('lt-player-lock', locked)
}

watch([playerOpen, playlistPageOpen], ([open]) => {
  if (open) {
    showLyrics.value = false
    userScrollingLyrics.value = false
    lyricCenterIndex.value = -1
    chatPanelOpen.value = false
    queuePanelOpen.value = false
  }
  syncViewportLock()
})

watch(currentTrack, () => {
  if (playerOpen.value) showLyrics.value = false
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.documentElement.classList.remove('lt-player-lock')
  document.body.classList.remove('lt-player-lock')
})

// 聊天抽屉打开或有新消息时自动滚到底部
watch([() => messages.value.length, chatPanelOpen], () => {
  nextTick(() => { const box = playerChatListRef.value; if (box) box.scrollTop = box.scrollHeight })
})

function seekLyric(line: { time: number }) {
  seek(line.time)
  userScrollingLyrics.value = false
  lyricCenterIndex.value = -1
}

function openQueuePanel() {
  queuePanelOpen.value = !queuePanelOpen.value
  if (queuePanelOpen.value) chatPanelOpen.value = false
}

function openChatPanel() {
  chatPanelOpen.value = !chatPanelOpen.value
  if (chatPanelOpen.value) queuePanelOpen.value = false
}

function playQueuedTrack(index: number) {
  const track = queue.value[index]
  if (!track) return
  removeFromQueue(index)
  void openTrack(track)
  queuePanelOpen.value = false
}

// Open the player before resolving a provider URL so a slow source lookup
// never looks like a navigation back to the home screen.
async function openTrack(track: MusicTrack) {
  playerOpen.value = true
  await nextTick()
  await playTrack(track)
}

// ---------- 房内聊天 ----------
const chatInput = ref('')
const chatListRef = ref<HTMLElement | null>(null)
const recording = ref(false)
const recordingStarting = ref(false)
const recordSeconds = ref(0)
let recordingRequestId = 0
let mediaRecorder: MediaRecorder | null = null
let recordTimer: ReturnType<typeof setInterval> | null = null
let recordStream: MediaStream | null = null
let activeRecording: { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; cancelled: boolean; seconds: number } | null = null
const playingAudioId = ref('')
let chatAudio: HTMLAudioElement | null = null

type AudioMessage = { id: string; audioPath?: string; audioUrl: string; kind?: 'audio' | 'text' }

async function playMessageAudio(message: AudioMessage) {
  if (!message.audioUrl) return
  if (playingAudioId.value === message.id) {
    chatAudio?.pause()
    playingAudioId.value = ''
    return
  }
  chatAudio?.pause()
  const player = new Audio(message.audioUrl)
  chatAudio = player
  player.preload = 'auto'
  const clearPlayingState = () => {
    if (chatAudio !== player) return
    chatAudio = null
    playingAudioId.value = ''
  }
  player.onended = clearPlayingState
  player.onerror = clearPlayingState
  playingAudioId.value = message.id
  void player.play().catch(clearPlayingState)
}

async function toggleMessageAudio(message: AudioMessage) {
  if (message.kind !== 'audio' && !message.audioPath) return
  if (!message.audioUrl) {
    const loaded = await loadAudio(message as any)
    if (!loaded || !message.audioUrl) return
  }
  await playMessageAudio(message)
}

async function retryMessageAudio(message: AudioMessage) {
  const loaded = await loadAudio(message as any, true)
  if (loaded) await playMessageAudio(message)
}

async function startRecording() {
  if (recording.value || recordingStarting.value) return
  recordingStarting.value = true
  const requestId = ++recordingRequestId
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (requestId !== recordingRequestId) {
      stream.getTracks().forEach(track => track.stop())
      return
    }
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    const context = { recorder, stream, chunks, cancelled: false, seconds: 0 }
    recordStream = stream
    mediaRecorder = recorder
    activeRecording = context
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      if (recordStream === stream) recordStream = null
      if (mediaRecorder === recorder) mediaRecorder = null
      if (activeRecording === context) activeRecording = null
      const seconds = context.seconds
      if (!shouldSendRecordedVoice(context.cancelled, seconds, chunks.length)) return
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      await sendVoice(blob, seconds)
    }
    recorder.start()
    recording.value = true
    recordSeconds.value = 0
    recordTimer = setInterval(() => {
      recordSeconds.value += 1
      if (recordSeconds.value >= 60) stopRecording()
    }, 1000)
  } catch {
    chatError.value = '无法访问麦克风，请检查浏览器权限'
  } finally {
    if (requestId === recordingRequestId) recordingStarting.value = false
  }
}

function stopRecording() {
  if (recordTimer) { clearInterval(recordTimer); recordTimer = null }
  const recorder = mediaRecorder
  if (activeRecording) activeRecording.seconds = recordSeconds.value
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  else {
    recordStream?.getTracks().forEach(track => track.stop())
    recordStream = null
  }
  recording.value = false
}

function cancelRecording() {
  if (recordingStarting.value) {
    recordingRequestId++
    recordingStarting.value = false
  }
  if (activeRecording) activeRecording.cancelled = true
  stopRecording()
}

async function submitChat() {
  const text = chatInput.value.trim()
  if (!text) return
  chatInput.value = ''
  await sendText(text)
}

watch(() => messages.value.length, () => {
  nextTick(() => { const box = chatListRef.value; if (box) box.scrollTop = box.scrollHeight })
})

function onPlayerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && playerOpen.value) {
    playerOpen.value = false
    chatPanelOpen.value = false
    queuePanelOpen.value = false
  }
}

// ---------- 生命周期 ----------
onMounted(() => {
  void connectSync()
  void loadChat()
  void subscribeChat()
  window.addEventListener('keydown', onPlayerKeydown)
})

onBeforeUnmount(() => {
  searchRequestId++
  aborter?.abort()
  aborter = null
  void disconnectSync()
  void disconnectChat()
  window.removeEventListener('keydown', onPlayerKeydown)
  recordingRequestId++
  if (activeRecording) activeRecording.cancelled = true
  stopRecording()
  chatAudio?.pause()
  if (lyricsScrollTimer) clearTimeout(lyricsScrollTimer)
  if (lyricAutoScrollTimer) clearTimeout(lyricAutoScrollTimer)
  lyricsAutoScrolling = false
})

function trackKey(track: MusicTrack) {
  return `${track.source}:${track.id}`
}

// 伴侣正在听的歌：加载封面预览
watch(partnerState, state => { if (state?.track) queueCovers([state.track]) })
watch(playlist, tracks => { if (tracks.length) queueCovers(tracks) }, { immediate: true })
watch(recentTracks, tracks => { if (tracks.length) queueCovers(tracks) }, { immediate: true })

async function handleSearch() {
  const query = keyword.value.trim()
  if (!query) {
    aborter?.abort()
    searchRequestId++
    results.value = []
    searched.value = false
    hasMore.value = false
    searchError.value = ''
    searching.value = false
    loadingMore.value = false
    return
  }
  aborter?.abort()
  const controller = new AbortController()
  aborter = controller
  const requestId = ++searchRequestId
  const requestedSource = source.value
  searching.value = true
  loadingMore.value = false
  searchError.value = ''
  try {
    const items = await search(query, requestedSource, 1, controller.signal)
    if (requestId !== searchRequestId || keyword.value.trim() !== query || source.value !== requestedSource) return
    results.value = items
    page.value = 1
    hasMore.value = items.length >= 20
    searched.value = true
    queueCovers(items)
  } catch (e) {
    if (requestId === searchRequestId && (e as Error)?.name !== 'AbortError') searchError.value = '搜索失败，请稍后再试'
  } finally {
    if (requestId === searchRequestId) {
      searching.value = false
      aborter = null
    }
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  const query = keyword.value.trim()
  if (!query) return
  aborter?.abort()
  const controller = new AbortController()
  aborter = controller
  const requestId = ++searchRequestId
  const requestedSource = source.value
  const requestedPage = page.value + 1
  loadingMore.value = true
  try {
    const items = await search(query, requestedSource, requestedPage, controller.signal)
    if (requestId !== searchRequestId || keyword.value.trim() !== query || source.value !== requestedSource) return
    results.value = [...results.value, ...items]
    page.value = requestedPage
    hasMore.value = items.length >= 20
    queueCovers(items)
  } catch (error) {
    if (requestId === searchRequestId && (error as Error)?.name !== 'AbortError') searchError.value = '加载更多失败，请重试'
  } finally {
    if (requestId === searchRequestId) {
      loadingMore.value = false
      aborter = null
    }
  }
}

function changeSource(nextSource: MusicSource) {
  if (source.value === nextSource) return
  source.value = nextSource
  aborter?.abort()
  aborter = null
  searchRequestId++
  searching.value = false
  loadingMore.value = false
  results.value = []
  page.value = 1
  hasMore.value = false
  searched.value = false
  searchError.value = ''
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function lyricLineStyle(index: number) {
  const current = currentLyricIndex.value
  if (current < 0) return undefined
  const distance = Math.abs(index - current)
  return {
    opacity: String(Math.max(0.26, 1 - distance * 0.15)),
    transform: `scale(${Math.max(0.94, 1 - distance * 0.012)})`,
  }
}

function onSeekClick(e: MouseEvent) {
  if (!duration.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  seek(ratio * duration.value)
}

function onVolumeInput(event: Event) {
  setVolume(Number((event.target as HTMLInputElement).value))
}

const nextTrack = computed(() => queue.value[0] || null)

const playlistDetailTracks = computed(() => {
  if (playlistCollection.value === 'favorites') return playlist.value
  if (playlistCollection.value === 'recent') return recentTracks.value
  return neteasePlaylistTracks.value
})

const playlistDetailTitle = computed(() => ({
  favorites: '我的收藏',
  recent: '最近播放',
  netease: selectedNeteasePlaylist.value?.name || '网易云歌单',
}[playlistCollection.value] || '音乐库'))

const playlistDetailSubtitle = computed(() => ({
  favorites: '你们一起收藏的歌曲',
  recent: '最近听过的音乐',
  netease: selectedNeteasePlaylist.value
    ? `${selectedNeteasePlaylist.value.creatorName} · ${formatPlayCount(selectedNeteasePlaylist.value.playCount)} 播放`
    : '从网易云音乐加载的歌单',
}[playlistCollection.value] || '把喜欢的音乐整理在一起'))

const libraryHeroTracks = computed(() => [...(playlist.value.length ? playlist.value : recentTracks.value)].slice(0, 4))

function collectionTracks(kind: Exclude<PlaylistCollection, 'home'>) {
  if (kind === 'favorites') return playlist.value
  if (kind === 'recent') return recentTracks.value
  return neteasePlaylistTracks.value
}

function openPlaylistPage() {
  playlistPageOpen.value = true
  playlistCollection.value = 'home'
  void loadNeteasePlaylists()
}

function closePlaylistPage() {
  playlistPageOpen.value = false
  playlistCollection.value = 'home'
}

function openPlaylistCollection(kind: Exclude<PlaylistCollection, 'home'>) {
  playlistCollection.value = kind
  if (kind === 'netease') {
    selectedNeteasePlaylist.value = null
    neteasePlaylistTracks.value = []
    playlistTracksError.value = ''
  }
}

function backPlaylistPage() {
  if (playlistCollection.value === 'home') closePlaylistPage()
  else playlistCollection.value = 'home'
}

function playCollection(kind: Exclude<PlaylistCollection, 'home'>) {
  const tracks = collectionTracks(kind)
  if (!tracks.length) return
  const [first, ...rest] = tracks
  replaceQueue(rest)
  void openTrack(first)
  playlistPageOpen.value = false
}

function enqueueCollection(kind: Exclude<PlaylistCollection, 'home'>) {
  const tracks = collectionTracks(kind)
  tracks.forEach(enqueue)
}

function playCurrentCollection() {
  if (playlistCollection.value !== 'home') playCollection(playlistCollection.value)
}

function playAndCloseLibrary(track: MusicTrack) {
  replaceQueue(tracksAfterSelected(playlistDetailTracks.value, track))
  void openTrack(track)
  playlistPageOpen.value = false
}

function formatPlayCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '暂无'
  if (value >= 100000000) return `${(value / 100000000).toFixed(1).replace(/\.0$/, '')} 亿`
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')} 万`
  return String(value)
}

const PLAYLIST_CATEGORIES = ['全部', '华语', '欧美', '日语', '韩语', '粤语', '轻音乐', 'ACG', '影视原声', '摇滚', '民谣', '电子', '说唱', '古典']

async function loadNeteasePlaylists(reset = true) {
  if (playlistSearchLoading.value) return
  const query = playlistSearchKeyword.value.trim()
  playlistSearchLoading.value = true
  playlistSearchError.value = ''
  const requestedPage = reset ? 1 : playlistSearchPage.value + 1
  try {
    let items: MusicPlaylist[] = []
    if (query) {
      items = await searchPlaylists(query, requestedPage, 18)
    } else {
      items = await discoverPlaylists(playlistCategory.value, requestedPage, 20)
    }
    neteasePlaylists.value = reset ? items : [...neteasePlaylists.value, ...items]
    playlistSearchPage.value = requestedPage
    hasMorePlaylists.value = items.length >= (query ? 18 : 20)
    if (!items.length && reset) playlistSearchError.value = '暂时没有找到歌单，请换个关键词试试'
    items.forEach(item => {
      if (item.coverUrl) coverMap.value[`playlist:${item.id}`] = item.coverUrl
    })
  } catch {
    if (reset) neteasePlaylists.value = []
    playlistSearchError.value = '网易云歌单加载失败，请稍后重试'
  } finally {
    playlistSearchLoading.value = false
  }
}

async function openNeteasePlaylist(item: MusicPlaylist) {
  selectedNeteasePlaylist.value = item
  playlistCollection.value = 'netease'
  neteasePlaylistTracks.value = []
  playlistTracksPage.value = 1
  hasMorePlaylistTracks.value = false
  playlistTracksError.value = ''
  playlistTracksLoading.value = true
  try {
    const detail = await getPlaylistDetail(item.id)
    if (detail) selectedNeteasePlaylist.value = { ...item, ...detail }
    const tracks = await getPlaylistTracks(item.id, 1, 50)
    neteasePlaylistTracks.value = tracks
    hasMorePlaylistTracks.value = tracks.length >= 50
    queueCovers(tracks)
  } catch {
    playlistTracksError.value = '歌单歌曲加载失败，请稍后重试'
  } finally {
    playlistTracksLoading.value = false
  }
}

async function loadMorePlaylistTracks() {
  const playlistId = selectedNeteasePlaylist.value?.id
  if (!playlistId || playlistTracksLoading.value || !hasMorePlaylistTracks.value) return
  playlistTracksLoading.value = true
  try {
    const nextPage = playlistTracksPage.value + 1
    const tracks = await getPlaylistTracks(playlistId, nextPage, 50)
    neteasePlaylistTracks.value = [...neteasePlaylistTracks.value, ...tracks]
    playlistTracksPage.value = nextPage
    hasMorePlaylistTracks.value = tracks.length >= 50
    queueCovers(tracks)
  } catch {
    playlistTracksError.value = '加载更多歌曲失败，请重试'
  } finally {
    playlistTracksLoading.value = false
  }
}

function submitPlaylistSearch() {
  void loadNeteasePlaylists(true)
}

function selectPlaylistCategory(category: string) {
  if (playlistCategory.value === category && !playlistSearchKeyword.value.trim()) return
  playlistCategory.value = category
  playlistSearchKeyword.value = ''
  void loadNeteasePlaylists(true)
}

</script>

<template>
  <section class="lt-page">
    <header class="lt-header">
      <div class="lt-title">
        <Music2 :size="20" />
        <h3>一起听</h3>
      </div>
      <div class="lt-status">
        <span class="lt-badge" :class="{ on: partnerListening, warning: syncStatus === 'reconnecting', offline: syncStatus === 'offline' }">
          <Wifi v-if="syncStatus === 'connected'" :size="12" />
          <WifiOff v-else-if="syncStatus === 'offline'" :size="12" />
          <LoaderCircle v-else class="spin" :size="12" />
          {{ partnerListening ? 'TA 也在听' : syncStatus === 'offline' ? '已离线' : syncStatus === 'reconnecting' ? '正在重连' : syncStatus === 'connecting' ? '连接中' : (synced ? '已连接，等待 TA' : '等待 TA 加入') }}
        </span>
        <button v-if="syncStatus === 'offline' || syncStatus === 'reconnecting'" type="button" class="lt-retry-sync" title="重新连接" @click="retrySync"><RefreshCw :size="14" /></button>
        <button v-if="currentTrack" type="button" class="lt-stop" title="结束一起听" @click="stopSession"><Square :size="12" /></button>
      </div>
    </header>

    <!-- 对方在听：展示歌曲与进度，一键加入 -->
    <div v-if="!currentTrack && partnerState" class="lt-join-banner">
      <img v-if="coverMap[trackKey(partnerState.track)]" :src="coverMap[trackKey(partnerState.track)]" class="lt-join-cover" alt="" @error="handleTrackCoverError(trackKey(partnerState.track))" />
      <div v-else class="lt-join-cover lt-cover-placeholder"><Music2 :size="16" /></div>
      <div class="lt-join-copy">
        <strong>TA 正在听《{{ partnerState.track.name }}》</strong>
        <small>{{ partnerState.playing ? '▶ 播放中' : '⏸ 已暂停' }} · 播放到 {{ formatTime(partnerProgress) }}</small>
      </div>
      <button type="button" class="lt-join-btn" @click="requestPartnerState">一键加入</button>
    </div>
    <div v-else-if="!currentTrack && partnerListening" class="lt-join-banner">
      <div class="lt-join-copy">
        <strong>TA 已进入听歌房 ♪</strong>
        <small>搜索一首歌点播，TA 会和你同步收听</small>
      </div>
    </div>

    <!-- 搜索区 -->
    <div class="lt-search">
      <div class="lt-library-tabs" role="tablist" aria-label="音乐库">
        <button type="button" class="lt-library-tab" :class="{ active: libraryTab === 'search' }" :aria-selected="libraryTab === 'search'" role="tab" @click="libraryTab = 'search'">
          <Search :size="14" /> 搜索音乐
        </button>
        <button type="button" class="lt-library-tab" :class="{ active: playlistPageOpen }" :aria-selected="playlistPageOpen" role="tab" @click="openPlaylistPage">
          <Bookmark :size="14" /> 我的歌单 <span v-if="playlist.length">{{ playlist.length }}</span>
        </button>
      </div>
      <template v-if="libraryTab === 'search'">
        <div class="lt-sources">
          <button
            v-for="s in MUSIC_SOURCES"
            :key="s.value"
            type="button"
            class="lt-source"
            :class="{ active: source === s.value }"
            :aria-pressed="source === s.value"
            @click="changeSource(s.value)"
          >{{ s.label }}</button>
        </div>
        <form class="lt-search-row" @submit.prevent="handleSearch">
          <input v-model="keyword" class="lt-input" aria-label="搜索歌名或歌手" placeholder="搜索歌名、歌手…" maxlength="80" />
          <button type="submit" class="lt-search-btn" :disabled="searching || !keyword.trim()">
            <LoaderCircle v-if="searching" class="spin" :size="16" />
            <Search v-else :size="16" />
          </button>
        </form>
        <p v-if="searchError" class="lt-error">{{ searchError }}</p>
      </template>
    </div>

    <!-- 迷你播放器卡片（点击进入播放页） -->
    <div v-if="currentTrack" class="lt-mini-player">
      <img v-if="currentCover" :src="currentCover" class="lt-mini-cover" alt="封面" @error="handleCurrentCoverError" />
      <div v-else class="lt-mini-cover lt-cover-placeholder"><Music2 :size="20" /></div>
      <button type="button" class="lt-mini-open" :aria-label="`打开播放器：${currentTrack.name}`" @click="playerOpen = true">
        <p class="lt-mini-name">{{ currentTrack.name }}</p>
        <p class="lt-mini-artist">{{ currentTrack.artist.join(' / ') }}</p>
        <div class="lt-mini-progress"><i :style="{ width: duration ? `${Math.min(100, position / duration * 100)}%` : '0%' }" /></div>
      </button>
      <button type="button" class="lt-play-btn small" :aria-label="isPlaying ? '暂停' : '播放'" :disabled="resolving" @click="togglePlay">
        <LoaderCircle v-if="resolving" class="spin" :size="16" />
        <Pause v-else-if="isPlaying" :size="16" />
        <Play v-else :size="16" />
      </button>
    </div>
    <p v-else-if="playerError" class="lt-error">{{ playerError }}</p>

    <!-- 边听边聊 -->
    <details class="lt-chat lt-disclosure">
      <summary class="lt-disclosure-summary">
        <span class="lt-section-title">边听边聊</span>
        <span class="lt-disclosure-meta">{{ messages.length ? `${messages.length} 条消息` : '和 TA 说点什么' }}</span>
        <ChevronDown :size="17" />
      </summary>
      <div ref="chatListRef" class="lt-chat-list">
        <p v-if="!messages.length" class="lt-chat-empty">还没有消息，和 TA 说点什么吧 ♡</p>
        <div
          v-for="message in messages"
          :key="message.id"
          class="lt-chat-row"
          :class="{ mine: message.senderId === profile?.id }"
        >
          <div class="lt-chat-bubble" :class="{ mine: message.senderId === profile?.id }">
            <template v-if="message.kind === 'text'">{{ message.content }}</template>
            <button v-else type="button" class="lt-audio-msg" :disabled="audioLoading[message.id]" @click="audioErrors[message.id] ? retryMessageAudio(message) : toggleMessageAudio(message)">
              <LoaderCircle v-if="audioLoading[message.id]" class="spin" :size="13" />
              <RefreshCw v-else-if="audioErrors[message.id]" :size="13" />
              <Play v-else-if="playingAudioId !== message.id" :size="13" />
              <Pause v-else :size="13" />
              <span class="lt-audio-bars"><i /><i /><i /><i /></span>
              <span class="lt-audio-duration">{{ message.audioDuration }}″</span>
            </button>
          </div>
        </div>
      </div>
      <!-- 录音中 -->
      <div v-if="recording" class="lt-record-bar">
        <span class="lt-record-dot" />
        <span class="lt-record-time">录音中 {{ recordSeconds }}s / 60s</span>
        <button type="button" class="lt-record-cancel" @click="cancelRecording">取消</button>
        <button type="button" class="lt-record-send" @click="stopRecording">发送</button>
      </div>
      <form v-else class="lt-chat-input" @submit.prevent="submitChat">
        <input v-model="chatInput" class="lt-input" aria-label="发送聊天消息" placeholder="和 TA 说点什么…" maxlength="500" />
        <button type="button" class="lt-mic-btn" :class="{ busy: sending }" title="发送语音" :disabled="sending" @click="startRecording">
          <LoaderCircle v-if="sending" class="spin" :size="16" />
          <Mic v-else :size="16" />
        </button>
        <button type="submit" class="lt-send-btn" :disabled="sending || !chatInput.trim()">
          <Send :size="15" />
        </button>
      </form>
      <p v-if="chatError" class="lt-error">{{ chatError }}</p>
    </details>

    <!-- 搜索结果 -->
    <div v-if="libraryTab === 'search' && results.length" class="lt-results">
      <p class="lt-section-title">搜索结果 · {{ results.length }} 首</p>
      <div v-for="track in results" :key="trackKey(track)" class="lt-result-item">
        <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" class="lt-result-cover" alt="" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
        <div v-else class="lt-result-cover lt-cover-placeholder"><Music2 :size="15" /></div>
        <button type="button" class="lt-result-info lt-track-select" :aria-label="`播放 ${track.name}，${track.artist.join(' / ')}`" @click.stop="openTrack(track)">
          <p class="lt-result-name">{{ track.name }}</p>
          <p class="lt-result-artist">{{ track.artist.join(' / ') }}<span v-if="track.album"> · {{ track.album }}</span></p>
        </button>
        <button type="button" class="lt-icon-btn" title="加入队列" @click="enqueue(track)"><Plus :size="15" /></button>
        <button type="button" class="lt-icon-btn" :class="{ primary: isInPlaylist(track) }" :title="isInPlaylist(track) ? '移出歌单' : '收藏到歌单'" @click="togglePlaylist(track)">
          <Bookmark :size="15" :fill="isInPlaylist(track) ? 'currentColor' : 'none'" />
        </button>
        <button type="button" class="lt-icon-btn primary" title="立即播放" @click.stop="openTrack(track)">
          <LoaderCircle v-if="resolving && currentTrack?.id === track.id" class="spin" :size="15" />
          <Play v-else :size="15" />
        </button>
      </div>
      <button v-if="hasMore" type="button" class="lt-load-more" :disabled="loadingMore" @click="loadMore">
        <LoaderCircle v-if="loadingMore" class="spin" :size="14" />
        {{ loadingMore ? '加载中…' : '加载更多' }}
      </button>
      <p v-else class="lt-no-more">已经到底啦 ♡</p>
    </div>
    <p v-else-if="libraryTab === 'search' && searched && !searching" class="lt-empty">没有找到相关歌曲，换个关键词或音源试试</p>

    <!-- 播放队列 -->
    <details v-if="queue.length" class="lt-queue lt-disclosure">
      <summary class="lt-disclosure-summary">
        <span class="lt-section-title">待播队列</span>
        <span class="lt-disclosure-meta">{{ queue.length }} 首歌曲</span>
        <ChevronDown :size="17" />
      </summary>
      <div v-for="(track, index) in queue" :key="trackKey(track)" class="lt-queue-item">
        <span class="lt-queue-index">{{ index + 1 }}</span>
        <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" class="lt-queue-cover" alt="" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
        <button type="button" class="lt-result-info lt-track-select" :aria-label="`播放 ${track.name}，${track.artist.join(' / ')}`" @click.stop="openTrack(track)">
          <p class="lt-result-name">{{ track.name }}</p>
          <p class="lt-result-artist">{{ track.artist.join(' / ') }}</p>
        </button>
        <button type="button" class="lt-icon-btn danger" title="移除" @click="removeFromQueue(index)"><Trash2 :size="13" /></button>
      </div>
    </details>

    <!-- 播放器与音乐库传送到 body，避免被首页导航的 stacking context 覆盖 -->
    <Teleport to="body">
    <!-- 全屏播放页（仿 QQ 音乐 / otter） -->
    <Transition name="player-slide">
      <div v-if="playerOpen && currentTrack" class="lt-player-page" role="dialog" aria-modal="true" :aria-label="`一起听播放器：${currentTrack.name}`">
        <img v-if="currentCover" :src="currentCover" class="lt-player-bg" alt="" @error="handleCurrentCoverError" />
        <div class="lt-player-bg-mask" />
        <div class="lt-player-inner">
          <!-- 顶栏 -->
          <div class="lt-player-top">
            <button type="button" class="lt-player-close" title="收起" aria-label="收起播放器" @click="playerOpen = false"><ChevronDown :size="22" /></button>
            <div class="lt-player-couple">
              <span class="lt-player-avatar">
                <img v-if="selfMember?.avatarUrl" :src="selfMember.avatarUrl" :alt="selfMember?.displayName" />
                <template v-else>{{ selfMember?.displayName?.slice(0, 1) || '我' }}</template>
                <i class="lt-avatar-dot on" title="我在听" />
              </span>
              <span class="lt-player-link"><Heart :size="14" fill="currentColor" /></span>
              <span class="lt-player-avatar">
                <img v-if="partnerMember?.avatarUrl" :src="partnerMember.avatarUrl" :alt="partnerMember?.displayName" />
                <template v-else>{{ partnerMember?.displayName?.slice(0, 1) || 'TA' }}</template>
                <i class="lt-avatar-dot" :class="{ on: partnerListening }" :title="partnerListening ? 'TA 在听' : 'TA 未在线'" />
              </span>
            </div>
            <div class="lt-player-top-right">
              <span class="lt-player-status">{{ partnerListening ? '正在一起听' : '等 TA 加入' }}</span>
              <button type="button" class="lt-player-close" :title="queuePanelOpen ? '关闭播放队列' : '打开播放队列'" :aria-label="queuePanelOpen ? '关闭播放队列' : '打开播放队列'" :aria-expanded="queuePanelOpen" @click="openQueuePanel"><ListMusic :size="18" /></button>
              <button type="button" class="lt-player-close" :title="chatPanelOpen ? '关闭聊天' : '边听边聊'" :aria-label="chatPanelOpen ? '关闭聊天' : '边听边聊'" :aria-expanded="chatPanelOpen" @click="openChatPanel"><MessageCircle :size="18" /></button>
            </div>
          </div>

          <!-- 歌曲信息 -->
          <div class="lt-player-song">
            <h4>{{ currentTrack.name }}</h4>
            <p>{{ currentTrack.artist.join(' / ') }}<span v-if="currentTrack.album"> · {{ currentTrack.album }}</span></p>
          </div>
          <p v-if="playerError" class="lt-error lt-player-error">{{ playerError }}</p>

          <!-- 中部区域：点封面切换歌词，点歌词空白区返回封面（QQ 音乐式） -->
          <div class="lt-view-zone">
            <div
              class="lt-cover-pane"
              :class="{ active: !showLyrics }"
              role="button"
              tabindex="0"
              aria-label="查看歌词"
              @click="showLyrics = true"
              @keydown.enter.prevent="showLyrics = true"
              @keydown.space.prevent="showLyrics = true"
            >
              <div class="lt-cover-card" :class="{ playing: isPlaying, paused: !isPlaying }">
                <img v-if="currentCover" :src="currentCover" class="lt-cover-img" alt="封面" @error="handleCurrentCoverError" />
                <div v-else class="lt-cover-img lt-cover-ph"><Music2 :size="44" /></div>
              </div>
              <span class="lt-view-hint">点击封面查看歌词</span>
            </div>
            <div class="lt-lyrics-pane" :class="{ active: showLyrics }" @click="showLyrics = false">
              <div class="lt-lyric-view">
                <div class="lt-lyrics-header">
                  <span>歌词</span>
                  <span class="lt-lyrics-follow" :class="{ paused: userScrollingLyrics }">
                    {{ userScrollingLyrics ? '手动浏览' : '自动跟随' }}
                  </span>
                </div>
                <div ref="playerLyricBoxRef" class="lt-player-lyrics" @scroll="onLyricsScroll">
                  <div class="lt-lyrics-inner">
                    <template v-if="lyricLines.length">
                      <p
                        v-for="(line, i) in lyricLines"
                        :key="i"
                        class="lt-lyric-line"
                        :class="{ active: i === currentLyricIndex }"
                        :style="lyricLineStyle(i)"
                        role="button"
                        tabindex="0"
                        @click.stop="seekLyric(line)"
                        @keydown.enter.prevent.stop="seekLyric(line)"
                        @keydown.space.prevent.stop="seekLyric(line)"
                      >
                        <span>{{ line.text || '· · ·' }}</span>
                        <small v-if="line.translation">{{ line.translation }}</small>
                      </p>
                    </template>
                    <p v-else class="lt-player-lyric-empty">纯音乐，请欣赏 ♡</p>
                  </div>
                </div>
                <span class="lt-view-hint lt-view-hint--lyrics">点击歌词区域返回封面</span>
                <!-- 手动滚动时的基准线：时间 + 从此处播放 -->
                <div v-if="userScrollingLyrics && lyricCenterIndex >= 0 && lyricLines[lyricCenterIndex]" class="lt-lyric-baseline">
                  <span class="lt-baseline-time">{{ formatTime(lyricLines[lyricCenterIndex].time) }}</span>
                  <div class="lt-baseline-line" />
                  <button type="button" class="lt-baseline-play" title="从这里播放" @click.stop="seekLyric(lyricLines[lyricCenterIndex])"><Play :size="12" /></button>
                </div>
              </div>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="lt-player-progress">
            <span class="lt-time">{{ formatTime(position) }}</span>
            <div class="lt-progress" @click="onSeekClick">
              <div class="lt-progress-fill" :style="{ width: duration ? `${Math.min(100, position / duration * 100)}%` : '0%' }"><i class="lt-progress-thumb" /></div>
            </div>
            <span class="lt-time">{{ formatTime(duration) }}</span>
          </div>

          <!-- 控制按钮 -->
          <div class="lt-player-controls">
            <button type="button" class="lt-ctrl-btn" :class="{ active: isInPlaylist(currentTrack) }" :title="isInPlaylist(currentTrack) ? '移出收藏' : '收藏歌曲'" :aria-pressed="isInPlaylist(currentTrack)" @click="togglePlaylist(currentTrack)">
              <Heart :size="19" :fill="isInPlaylist(currentTrack) ? 'currentColor' : 'none'" />
            </button>
            <button type="button" class="lt-ctrl-btn" title="上一首" :disabled="!recentTracks.length" @click="playPrevious"><SkipBack :size="20" /></button>
            <button type="button" class="lt-ctrl-btn" :class="{ active: repeatOne }" title="单曲循环" :aria-pressed="repeatOne" @click="toggleRepeatOne"><Repeat1 :size="18" /></button>
            <button type="button" class="lt-play-btn big" :disabled="resolving" @click="togglePlay">
              <LoaderCircle v-if="resolving" class="spin" :size="26" />
              <Pause v-else-if="isPlaying" :size="26" />
              <Play v-else :size="26" />
            </button>
            <button type="button" class="lt-ctrl-btn" :class="{ dim: !queue.length }" title="下一首" @click="playNext"><SkipForward :size="19" /></button>
            <button type="button" class="lt-ctrl-btn" title="加入待播队列" @click="enqueue(currentTrack)"><Plus :size="19" /></button>
          </div>
          <div class="lt-player-volume">
            <button type="button" class="lt-volume-button" :title="muted ? '取消静音' : '静音'" :aria-label="muted ? '取消静音' : '静音'" :aria-pressed="muted" @click="toggleMute">
              <VolumeX v-if="muted || volume === 0" :size="17" />
              <Volume2 v-else :size="17" />
            </button>
            <input class="lt-volume-range" type="range" min="0" max="1" step="0.01" :value="muted ? 0 : volume" aria-label="音量" @input="onVolumeInput" />
            <span>{{ Math.round((muted ? 0 : volume) * 100) }}%</span>
          </div>
          <p v-if="nextTrack" class="lt-next-hint">接下来播放：{{ nextTrack.name }} · {{ nextTrack.artist.join(' / ') }}</p>

          <!-- 边听边聊抽屉 -->
          <Transition name="chat-slide">
            <div v-if="chatPanelOpen" class="lt-room-chat">
              <div class="lt-room-chat-head">
                <span>边听边聊</span>
                <button type="button" class="lt-room-chat-close" @click="chatPanelOpen = false"><X :size="14" /></button>
              </div>
              <div ref="playerChatListRef" class="lt-chat-list">
                <p v-if="!messages.length" class="lt-chat-empty">还没有消息，和 TA 说点什么吧 ♡</p>
                <div v-for="message in messages" :key="message.id" class="lt-chat-row" :class="{ mine: message.senderId === profile?.id }">
                  <div class="lt-chat-bubble" :class="{ mine: message.senderId === profile?.id }">
                    <template v-if="message.kind === 'text'">{{ message.content }}</template>
                    <button v-else type="button" class="lt-audio-msg" :disabled="audioLoading[message.id]" @click="audioErrors[message.id] ? retryMessageAudio(message) : toggleMessageAudio(message)">
                      <LoaderCircle v-if="audioLoading[message.id]" class="spin" :size="13" />
                      <RefreshCw v-else-if="audioErrors[message.id]" :size="13" />
                      <Play v-else-if="playingAudioId !== message.id" :size="13" />
                      <Pause v-else :size="13" />
                      <span class="lt-audio-bars"><i /><i /><i /><i /></span>
                      <span class="lt-audio-duration">{{ message.audioDuration }}″</span>
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="recording" class="lt-record-bar">
                <span class="lt-record-dot" />
                <span class="lt-record-time">录音中 {{ recordSeconds }}s / 60s</span>
                <button type="button" class="lt-record-cancel" @click="cancelRecording">取消</button>
                <button type="button" class="lt-record-send" @click="stopRecording">发送</button>
              </div>
              <form v-else class="lt-chat-input" @submit.prevent="submitChat">
                <input v-model="chatInput" class="lt-input" aria-label="发送聊天消息" placeholder="和 TA 说点什么…" maxlength="500" />
                <button type="button" class="lt-mic-btn" :disabled="sending" title="发送语音" @click="startRecording"><Mic :size="16" /></button>
                <button type="submit" class="lt-send-btn" :disabled="sending || !chatInput.trim()"><Send :size="15" /></button>
              </form>
              <p v-if="chatError" class="lt-error">{{ chatError }}</p>
            </div>
          </Transition>

          <!-- 播放队列抽屉 -->
          <Transition name="queue-slide">
            <div v-if="queuePanelOpen" class="lt-room-queue" role="dialog" aria-modal="true" aria-label="播放队列">
              <div class="lt-room-chat-head">
                <span>播放队列 · {{ queue.length }} 首</span>
                <button type="button" class="lt-room-chat-close" aria-label="关闭播放队列" @click="queuePanelOpen = false"><X :size="14" /></button>
              </div>
              <div class="lt-room-queue-current">
                <img v-if="currentCover" :src="currentCover" class="lt-queue-cover" alt="" @error="handleCurrentCoverError" />
                <div v-else class="lt-queue-cover lt-cover-placeholder"><Music2 :size="15" /></div>
                <div>
                  <small>正在播放</small>
                  <strong>{{ currentTrack.name }}</strong>
                  <span>{{ currentTrack.artist.join(' / ') }}</span>
                </div>
                <span class="lt-queue-playing"><i /><i /><i /></span>
              </div>
              <div v-if="!queue.length" class="lt-queue-empty">
                <ListMusic :size="24" />
                <span>队列还是空的</span>
                <small>在搜索结果里点 + 添加下一首</small>
              </div>
              <div v-else class="lt-room-queue-list">
                <div v-for="(track, index) in queue" :key="trackKey(track)" class="lt-room-queue-item">
                  <button type="button" class="lt-room-queue-main" :aria-label="`播放队列第 ${index + 1} 首：${track.name}`" @click.stop="playQueuedTrack(index)">
                    <span class="lt-queue-index">{{ index + 1 }}</span>
                    <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" class="lt-queue-cover" alt="" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
                    <span class="lt-room-queue-copy">
                      <strong>{{ track.name }}</strong>
                      <small>{{ track.artist.join(' / ') }}</small>
                    </span>
                  </button>
                  <div class="lt-room-queue-actions">
                    <button type="button" class="lt-queue-action" :disabled="index === 0" :aria-label="`将 ${track.name} 上移`" title="上移" @click="moveQueueItem(index, index - 1)"><ChevronUp :size="14" /></button>
                    <button type="button" class="lt-queue-action" :disabled="index === queue.length - 1" :aria-label="`将 ${track.name} 下移`" title="下移" @click="moveQueueItem(index, index + 1)"><ChevronDown :size="14" /></button>
                    <button type="button" class="lt-queue-action danger" :aria-label="`移除 ${track.name}`" title="移除" @click="removeFromQueue(index)"><Trash2 :size="13" /></button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
    <Transition name="library-slide">
      <div v-if="playlistPageOpen" class="lt-library-page" role="dialog" aria-modal="true" aria-label="音乐库">
        <div class="lt-library-shell">
          <header class="lt-library-head">
            <button type="button" class="lt-library-icon" :aria-label="playlistCollection === 'home' ? '关闭音乐库' : '返回音乐库'" @click="backPlaylistPage">
              <ArrowLeft :size="19" />
            </button>
            <div class="lt-library-head-copy">
              <span>一起听</span>
              <h2>{{ playlistCollection === 'home' ? '音乐库' : playlistDetailTitle }}</h2>
            </div>
            <button type="button" class="lt-library-icon" aria-label="关闭音乐库" @click="closePlaylistPage"><X :size="19" /></button>
          </header>

          <main class="lt-library-scroll">
            <template v-if="playlistCollection === 'home'">
              <section class="lt-library-hero">
                <div class="lt-library-hero-cover">
                  <template v-for="track in libraryHeroTracks" :key="`hero-${trackKey(track)}`">
                    <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" :alt="track.name" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
                    <div v-else class="lt-library-cover-fallback"><Music2 :size="24" /></div>
                  </template>
                  <div v-if="!libraryHeroTracks.length" class="lt-library-cover-fallback"><Bookmark :size="30" /></div>
                </div>
                <div class="lt-library-hero-copy">
                  <span class="lt-library-eyebrow">我的音乐</span>
                  <h1>把喜欢的歌放在一起</h1>
                  <p>{{ playlist.length ? `${playlist.length} 首收藏歌曲，随时和 TA 一起播放` : '收藏歌曲后，会在这里形成你们的专属歌单' }}</p>
                  <button v-if="playlist.length" type="button" class="lt-library-primary" @click="playCollection('favorites')"><Play :size="15" /> 播放我的收藏</button>
                  <button v-else type="button" class="lt-library-secondary" @click="closePlaylistPage(); libraryTab = 'search'"><Search :size="15" /> 去搜索音乐</button>
                </div>
              </section>

              <div class="lt-library-section-head">
                <div>
                  <span class="lt-library-eyebrow">歌单</span>
                  <h3>你的音乐空间</h3>
                </div>
                <span class="lt-library-section-count">网易云歌单</span>
              </div>

              <div class="lt-library-grid">
                <button type="button" class="lt-library-card" @click="openPlaylistCollection('favorites')">
                  <div class="lt-library-card-cover">
                    <template v-for="track in collectionTracks('favorites').slice(0, 4)" :key="`fav-${trackKey(track)}`">
                      <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" :alt="track.name" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
                      <div v-else class="lt-library-cover-fallback"><Music2 :size="17" /></div>
                    </template>
                    <div v-if="!collectionTracks('favorites').length" class="lt-library-cover-fallback"><Bookmark :size="23" /></div>
                  </div>
                  <strong>我的收藏</strong>
                  <small>{{ playlist.length }} 首歌曲</small>
                </button>

                <button type="button" class="lt-library-card" @click="openPlaylistCollection('recent')">
                  <div class="lt-library-card-cover">
                    <template v-for="track in collectionTracks('recent').slice(0, 4)" :key="`recent-${trackKey(track)}`">
                      <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" :alt="track.name" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
                      <div v-else class="lt-library-cover-fallback"><Music2 :size="17" /></div>
                    </template>
                    <div v-if="!collectionTracks('recent').length" class="lt-library-cover-fallback"><ListMusic :size="23" /></div>
                  </div>
                  <strong>最近播放</strong>
                  <small>{{ recentTracks.length }} 首歌曲</small>
                </button>
              </div>

              <form class="lt-net-ease-search" @submit.prevent="submitPlaylistSearch">
                <Search :size="16" />
                <input v-model="playlistSearchKeyword" aria-label="搜索网易云歌单" placeholder="搜索网易云歌单，例如：周杰伦、轻音乐…" maxlength="60" />
                <button type="submit" :disabled="playlistSearchLoading">
                  <LoaderCircle v-if="playlistSearchLoading" class="spin" :size="15" />
                  <Search v-else :size="15" />
                  <span>搜索歌单</span>
                </button>
              </form>
              <p v-if="playlistSearchError" class="lt-error">{{ playlistSearchError }}</p>

              <div class="lt-library-section-head lt-library-section-head--remote">
                <div>
                  <span class="lt-library-eyebrow">网易云音乐</span>
                  <h3>{{ playlistSearchKeyword.trim() ? `“${playlistSearchKeyword.trim()}”的歌单` : `${playlistCategory}歌单` }}</h3>
                </div>
                <span class="lt-library-section-count">{{ neteasePlaylists.length }} 个</span>
              </div>
              <div v-if="!playlistSearchKeyword.trim()" class="lt-playlist-categories" aria-label="歌单分类">
                <button
                  v-for="category in PLAYLIST_CATEGORIES"
                  :key="category"
                  type="button"
                  :class="{ active: playlistCategory === category }"
                  @click="selectPlaylistCategory(category)"
                >{{ category }}</button>
              </div>
              <div v-if="playlistSearchLoading && !neteasePlaylists.length" class="lt-library-state lt-library-state--inline">
                <LoaderCircle class="spin" :size="20" />
                <span>正在加载网易云歌单</span>
              </div>
              <div v-else-if="neteasePlaylists.length" class="lt-netease-grid">
                <button v-for="item in neteasePlaylists" :key="item.id" type="button" class="lt-netease-card" @click="openNeteasePlaylist(item)">
                  <div class="lt-netease-cover">
                    <img v-if="item.coverUrl && !failedPlaylistCovers[item.id]" :src="item.coverUrl" :alt="item.name" loading="lazy" @error="handlePlaylistCoverError(item.id)" />
                    <Music2 v-else :size="24" />
                  </div>
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.creatorName }} · {{ item.trackCount }} 首 · {{ formatPlayCount(item.playCount) }} 播放</small>
                </button>
              </div>
              <button v-if="hasMorePlaylists" type="button" class="lt-load-more" :disabled="playlistSearchLoading" @click="loadNeteasePlaylists(false)">
                <LoaderCircle v-if="playlistSearchLoading" class="spin" :size="14" />
                {{ playlistSearchLoading ? '加载中…' : '加载更多歌单' }}
              </button>
            </template>

            <template v-else>
              <section class="lt-library-detail-head">
                <div class="lt-library-detail-cover">
                  <img v-if="playlistCollection === 'netease' && selectedNeteasePlaylist?.coverUrl && !failedPlaylistCovers[selectedNeteasePlaylist.id]" :src="selectedNeteasePlaylist.coverUrl" :alt="selectedNeteasePlaylist.name" @error="handlePlaylistCoverError(selectedNeteasePlaylist.id)" />
                  <template v-else>
                    <template v-for="track in playlistDetailTracks.slice(0, 4)" :key="`detail-${trackKey(track)}`">
                      <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" :alt="track.name" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
                      <div v-else class="lt-library-cover-fallback"><Music2 :size="19" /></div>
                    </template>
                    <div v-if="!playlistDetailTracks.length" class="lt-library-cover-fallback"><Bookmark :size="25" /></div>
                  </template>
                </div>
                <div class="lt-library-detail-copy">
                  <span class="lt-library-eyebrow">{{ playlistCollection === 'netease' ? '网易云歌单' : '歌单' }}</span>
                  <h1>{{ playlistDetailTitle }}</h1>
                  <p>{{ playlistDetailSubtitle }} · {{ selectedNeteasePlaylist?.trackCount || playlistDetailTracks.length }} 首</p>
                  <p v-if="playlistCollection === 'netease' && selectedNeteasePlaylist?.description" class="lt-library-detail-description">{{ selectedNeteasePlaylist.description }}</p>
                  <div v-if="playlistDetailTracks.length" class="lt-library-actions">
                    <button type="button" class="lt-library-primary" @click="playCurrentCollection"><Play :size="15" /> 播放全部</button>
                    <button type="button" class="lt-library-secondary" @click="enqueueCollection(playlistCollection)"><Plus :size="15" /> 加入待播</button>
                  </div>
                </div>
              </section>

              <div v-if="playlistTracksLoading && !playlistDetailTracks.length" class="lt-library-state">
                <LoaderCircle class="spin" :size="22" />
                <span>正在加载歌单歌曲</span>
              </div>
              <div v-else-if="!playlistDetailTracks.length" class="lt-library-state">
                <Bookmark :size="25" />
                <strong>{{ playlistTracksError || '这个歌单还是空的' }}</strong>
                <span>{{ playlistCollection === 'netease' ? '网易云暂时没有返回歌曲，请稍后重试' : '去搜索并收藏歌曲，它们会出现在这里' }}</span>
                <button v-if="playlistCollection !== 'netease'" type="button" class="lt-library-secondary" @click="closePlaylistPage(); libraryTab = 'search'"><Search :size="14" /> 去搜索音乐</button>
              </div>
              <div v-else class="lt-library-track-list">
                <article v-for="(track, index) in playlistDetailTracks" :key="trackKey(track)" class="lt-library-track">
                  <span class="lt-library-track-index">{{ String(index + 1).padStart(2, '0') }}</span>
                  <img v-if="coverMap[trackKey(track)]" :src="coverMap[trackKey(track)]" :alt="track.name" loading="lazy" @error="handleTrackCoverError(trackKey(track))" />
                  <div v-else class="lt-library-track-cover"><Music2 :size="15" /></div>
                    <button type="button" class="lt-library-track-main" :aria-label="`播放 ${track.name}，${track.artist.join(' / ')}`" @click.stop="playAndCloseLibrary(track)">
                    <strong>{{ track.name }}</strong>
                    <small>{{ track.artist.join(' / ') }}<span v-if="track.album"> · {{ track.album }}</span></small>
                  </button>
                  <button type="button" class="lt-library-track-action" title="加入待播" aria-label="加入待播" @click.stop="enqueue(track)"><Plus :size="15" /></button>
                  <button v-if="playlistCollection === 'favorites'" type="button" class="lt-library-track-action danger" title="移出歌单" @click="togglePlaylist(track)"><Trash2 :size="15" /></button>
                  <button v-else type="button" class="lt-library-track-action" :class="{ active: isInPlaylist(track) }" :title="isInPlaylist(track) ? '移出歌单' : '收藏到歌单'" @click="togglePlaylist(track)">
                    <Bookmark :size="15" :fill="isInPlaylist(track) ? 'currentColor' : 'none'" />
                  </button>
                </article>
                <button v-if="playlistCollection === 'netease' && hasMorePlaylistTracks" type="button" class="lt-load-more" :disabled="playlistTracksLoading" @click="loadMorePlaylistTracks">
                  <LoaderCircle v-if="playlistTracksLoading" class="spin" :size="14" />
                  {{ playlistTracksLoading ? '加载中…' : '加载更多歌曲' }}
                </button>
              </div>
            </template>
          </main>
        </div>
      </div>
    </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.lt-page{padding:22px;background:linear-gradient(160deg,rgba(245,250,255,.98),rgba(248,242,255,.94) 55%,rgba(252,240,248,.92));min-height:100%;display:flex;flex-direction:column;gap:18px;max-width:660px;margin:14px auto;width:calc(100% - 28px);border-radius:36px;border:1px solid rgba(255,255,255,.75);box-shadow:0 18px 50px rgba(90,90,160,.08)}
.lt-join-banner{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:28px;background:linear-gradient(135deg,rgba(150,220,180,.24),rgba(120,190,240,.16));border:1px solid rgba(90,190,140,.28);box-shadow:0 8px 24px rgba(80,160,120,.08)}
.lt-join-cover{width:46px;height:46px;border-radius:15px;object-fit:cover;flex-shrink:0;box-shadow:0 4px 10px rgba(80,160,120,.18)}
.lt-join-cover.lt-cover-placeholder{border-radius:15px}
.lt-join-copy{flex:1;min-width:0}
.lt-join-copy strong{display:block;font-size:12px;color:#2f7a55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-join-copy small{font-size:10px;color:#5a8a72}
.lt-join-btn{padding:10px 20px;border:0;border-radius:999px;background:linear-gradient(135deg,#4aa878,#5aa0c0);color:#fff;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 6px 16px rgba(80,160,120,.32);flex-shrink:0}
.lt-join-btn:hover{filter:brightness(1.06)}
.lt-header{display:flex;align-items:center;justify-content:space-between}
.lt-title{display:flex;align-items:center;gap:8px;color:#7a68b0}
.lt-title h3{margin:0;font-size:18px;color:#3d4a6e}
.lt-status{display:flex;align-items:center;gap:8px}
.lt-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;background:rgba(200,205,225,.25);color:#8a90a8;font-size:11px;font-weight:600}
.lt-badge.on{background:rgba(150,220,180,.2);color:#3a9a68}
.lt-badge.warning{background:rgba(255,220,170,.28);color:#a57432}
.lt-badge.offline{background:rgba(210,215,230,.3);color:#8a90a8}
.lt-badge .dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.lt-retry-sync{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(160,150,220,.2);border-radius:50%;background:rgba(255,255,255,.72);color:#6a7da0;cursor:pointer}
.lt-retry-sync:hover{background:#fff;color:#6a60c0}
.lt-stop{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(200,110,130,.25);border-radius:999px;background:rgba(255,240,244,.6);color:#c06080;cursor:pointer}
.lt-stop:hover{background:rgba(255,225,235,.85)}
/* 搜索 */
.lt-search{display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:28px;background:rgba(255,255,255,.65);border:1px solid rgba(160,150,220,.12);box-shadow:0 8px 24px rgba(90,100,170,.06)}
.lt-library-tabs{display:flex;gap:6px;padding:4px;border-radius:18px;background:rgba(225,230,250,.42)}
.lt-library-tab{display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;flex:1;padding:7px 12px;border:0;border-radius:14px;background:transparent;color:#7a84a4;font-size:12px;font-weight:700;cursor:pointer}
.lt-library-tab span{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:rgba(120,110,190,.12);font-size:10px}
.lt-library-tab.active{background:rgba(255,255,255,.82);color:#5f63a6;box-shadow:0 4px 12px rgba(100,100,170,.1)}
.lt-sources{display:flex;gap:8px;flex-wrap:wrap}
.lt-source{padding:7px 16px;border:1px solid rgba(140,160,200,.2);border-radius:999px;background:rgba(255,255,255,.55);color:#6a7da0;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s}
.lt-source.active{background:linear-gradient(135deg,#5a80c0,#7a60c0);border-color:transparent;color:#fff;box-shadow:0 4px 12px rgba(100,100,190,.25)}
.lt-search-row{display:flex;gap:10px}
.lt-input{flex:1;min-height:44px;padding:10px 18px;border:1px solid rgba(140,160,200,.18);border-radius:18px;background:rgba(248,248,255,.9);color:#3d4a6e;font-size:13px;outline:none;font-family:inherit}
.lt-input:focus{border-color:rgba(120,100,200,.45);box-shadow:0 0 0 3px rgba(120,100,200,.08)}
.lt-search-btn{display:grid;place-items:center;width:46px;border:0;border-radius:18px;background:linear-gradient(135deg,#5a80c0,#7a60c0);color:#fff;cursor:pointer;box-shadow:0 5px 14px rgba(100,100,190,.25)}
.lt-search-btn:disabled{opacity:.5;cursor:default}
.lt-playlist-panel{min-height:120px}
.lt-playlist-list{display:flex;flex-direction:column;gap:4px}
.lt-playlist-item{display:flex;align-items:center;gap:10px;padding:7px 4px;border-radius:16px}
.lt-playlist-item:hover{background:rgba(228,236,255,.5)}
.lt-playlist-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:130px;color:#a0a8c0;text-align:center}
.lt-playlist-empty strong{font-size:12px;color:#70799c}
.lt-playlist-empty small{font-size:10px;color:#a0a8c0}
/* 迷你播放器 */
.lt-mini-player{display:flex;align-items:center;gap:14px;padding:14px;border-radius:28px;background:rgba(255,255,255,.75);border:1px solid rgba(160,150,220,.14);box-shadow:0 8px 24px rgba(90,100,170,.08);cursor:pointer;transition:transform .15s}
.lt-mini-player:hover{transform:translateY(-1px)}
.lt-mini-cover{width:56px;height:56px;border-radius:20px;object-fit:cover;box-shadow:0 5px 14px rgba(90,100,170,.18)}
.lt-cover-placeholder{display:grid;place-items:center;background:linear-gradient(135deg,#dce6ff,#e8dcff);color:#8a90c8}
.lt-mini-open{display:block;flex:1;min-width:0;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;font:inherit}
.lt-mini-name{margin:0;font-size:13px;font-weight:700;color:#3d4a6e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-mini-artist{margin:2px 0 6px;font-size:10px;color:#8a96b0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-mini-progress{height:4px;border-radius:999px;background:rgba(140,160,200,.18);overflow:hidden}
.lt-mini-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#5a80c0,#9a70d0)}
.lt-play-btn{display:grid;place-items:center;border:0;border-radius:50%;background:linear-gradient(135deg,#5a80c0,#7a60c0);color:#fff;cursor:pointer;box-shadow:0 5px 14px rgba(100,100,190,.3);flex-shrink:0}
.lt-play-btn.small{width:40px;height:40px}
.lt-play-btn.big{width:64px;height:64px}
.lt-play-btn:disabled{opacity:.6}
/* 结果与队列 */
.lt-section-title{margin:0 0 12px;font-size:11px;font-weight:700;color:#8a96b0;text-transform:uppercase;letter-spacing:.6px}
.lt-results,.lt-queue,.lt-chat{padding:18px;border-radius:28px;background:rgba(255,255,255,.6);border:1px solid rgba(160,150,220,.1);box-shadow:0 8px 24px rgba(90,100,170,.05)}
.lt-result-item,.lt-queue-item{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:20px;transition:background .15s}
.lt-result-item:hover,.lt-queue-item:hover{background:rgba(228,236,255,.5)}
.lt-result-cover{width:46px;height:46px;border-radius:15px;object-fit:cover;flex-shrink:0;box-shadow:0 3px 8px rgba(90,100,170,.12)}
.lt-result-cover.lt-cover-placeholder{border-radius:15px}
.lt-queue-cover{width:38px;height:38px;border-radius:13px;object-fit:cover;flex-shrink:0}
.lt-result-info{flex:1;min-width:0;cursor:pointer}
.lt-track-select{display:block;padding:0;border:0;background:transparent;text-align:left;font:inherit}
.lt-result-name{margin:0;font-size:12px;font-weight:600;color:#3d4a6e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-result-artist{margin:2px 0 0;font-size:10px;color:#8a96b0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-icon-btn{display:grid;place-items:center;width:40px;height:40px;border:1px solid rgba(140,160,200,.2);border-radius:14px;background:rgba(255,255,255,.7);color:#6a7da0;cursor:pointer;flex-shrink:0}
.lt-icon-btn:hover{background:rgba(230,240,255,.9)}
.lt-icon-btn.primary{border-color:rgba(110,100,200,.3);color:#6a60c0}
.lt-icon-btn.danger{border-color:transparent;background:transparent;color:#b0b8d0}
.lt-icon-btn.danger:hover{background:rgba(220,100,130,.12);color:#d06080}
.lt-queue-index{font-size:11px;color:#8a96b0;min-width:16px;text-align:center;font-variant-numeric:tabular-nums}
.lt-load-more{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:10px;padding:12px;border:1px solid rgba(140,160,200,.18);border-radius:18px;background:rgba(240,244,255,.6);color:#5a6a9a;font-size:12px;font-weight:700;cursor:pointer}
.lt-load-more:hover{background:rgba(225,232,255,.8)}
.lt-no-more{margin:10px 0 0;text-align:center;font-size:10px;color:#a0a8c0}
.lt-empty{margin:0;padding:28px;text-align:center;font-size:12px;color:#9aa0b8}
.lt-error{margin:0;padding:8px 12px;background:#ffe6ef;color:#b64f73;font-size:11px;border-radius:14px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* ============ 房内聊天 ============ */
.lt-chat-list{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 2px;margin-bottom:12px}
.lt-chat-empty{margin:auto;padding:16px;text-align:center;font-size:11px;color:#a0a8c0}
.lt-chat-row{display:flex}
.lt-chat-row.mine{justify-content:flex-end}
.lt-chat-bubble{max-width:75%;padding:9px 14px;border-radius:20px 20px 20px 6px;background:rgba(255,255,255,.85);border:1px solid rgba(160,150,220,.14);color:#3d4a6e;font-size:12px;line-height:1.6;word-break:break-word}
.lt-chat-bubble.mine{border-radius:20px 20px 6px 20px;background:linear-gradient(135deg,#6a80d0,#8a68c8);border-color:transparent;color:#fff}
.lt-audio-msg{display:flex;align-items:center;gap:8px;border:0;background:transparent;color:inherit;cursor:pointer;padding:0;font:inherit}
.lt-audio-bars{display:flex;align-items:flex-end;gap:2px;height:14px}
.lt-audio-bars i{width:3px;border-radius:2px;background:currentColor;opacity:.7}
.lt-audio-bars i:nth-child(1){height:6px}.lt-audio-bars i:nth-child(2){height:12px}.lt-audio-bars i:nth-child(3){height:9px}.lt-audio-bars i:nth-child(4){height:5px}
.lt-audio-duration{font-size:10px;opacity:.8;font-variant-numeric:tabular-nums}
.lt-chat-input{display:flex;gap:8px}
.lt-chat-input .lt-input{min-height:40px}
.lt-mic-btn,.lt-send-btn{display:grid;place-items:center;width:42px;border:0;border-radius:16px;cursor:pointer;flex-shrink:0}
.lt-mic-btn{background:rgba(255,255,255,.8);border:1px solid rgba(140,160,200,.2);color:#6a7da0}
.lt-mic-btn:hover{background:rgba(230,240,255,.9);color:#c06080}
.lt-send-btn{background:linear-gradient(135deg,#5a80c0,#7a60c0);color:#fff;box-shadow:0 4px 12px rgba(100,100,190,.25)}
.lt-send-btn:disabled{opacity:.5;cursor:default}
.lt-record-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:18px;background:rgba(255,240,244,.8);border:1px solid rgba(220,110,140,.25)}
.lt-record-dot{width:9px;height:9px;border-radius:50%;background:#e05070;animation:record-blink 1s ease-in-out infinite}
@keyframes record-blink{50%{opacity:.3}}
.lt-record-time{flex:1;font-size:12px;font-weight:700;color:#c05070;font-variant-numeric:tabular-nums}
.lt-record-cancel{padding:7px 14px;border:1px solid rgba(140,160,200,.25);border-radius:999px;background:transparent;color:#8a90a8;font-size:11px;cursor:pointer}
.lt-record-send{padding:7px 18px;border:0;border-radius:999px;background:linear-gradient(135deg,#e05070,#c060a0);color:#fff;font-size:11px;font-weight:700;cursor:pointer}
/* ============ 全屏播放页 ============ */
.lt-player-page{position:fixed;inset:0;z-index:400;overflow:hidden;background:linear-gradient(160deg,#f5faff,#f8f2ff 55%,#fcf0f8)}
.lt-player-bg{position:absolute;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);object-fit:cover;filter:blur(60px) saturate(1.25);opacity:.22}
.lt-player-bg-mask{position:absolute;inset:0;background:linear-gradient(180deg,rgba(245,250,255,.35),rgba(250,242,255,.55))}
.lt-player-inner{position:relative;z-index:1;height:100%;max-width:520px;margin:0 auto;display:flex;flex-direction:column;padding:max(16px,env(safe-area-inset-top)) 24px max(20px,env(safe-area-inset-bottom))}
.lt-player-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;flex-shrink:0}
.lt-player-close{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(160,150,220,.2);border-radius:999px;background:rgba(255,255,255,.75);color:#6a7da0;cursor:pointer;backdrop-filter:blur(8px)}
.lt-player-close:hover{background:rgba(255,255,255,.95)}
.lt-player-couple{display:flex;align-items:center;gap:8px;min-width:0;flex-shrink:1}
.lt-player-avatar{position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.9);color:#7a68b0;font-size:15px;font-weight:700;border:2px solid #fff;box-shadow:0 4px 12px rgba(90,90,160,.15)}
.lt-player-avatar{flex:0 0 auto}
.lt-player-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.lt-avatar-dot{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#8a8a9a;border:2px solid #fff}
.lt-avatar-dot.on{background:#4ade80}
.lt-player-link{color:#ff8fb4;display:grid;place-items:center}
.lt-player-status{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#7a68b0;font-weight:600;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.75);border:1px solid rgba(160,150,220,.18)}
.lt-player-top-right{display:flex;align-items:center;gap:8px;min-width:0;flex-shrink:0}
.lt-view-zone{flex:1;min-width:0;min-height:140px;max-height:430px;margin:auto 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;padding:6px 0}
.lt-cover-card{width:min(52vw,230px);aspect-ratio:1;border-radius:30px;overflow:hidden;box-shadow:0 24px 50px rgba(90,90,160,.28),0 0 0 1px rgba(255,255,255,.8);transition:transform .4s ease}
.lt-cover-card.playing{animation:lt-breathe 7s ease-in-out infinite}
.lt-cover-card.paused{transform:scale(.95)}
.lt-view-hint{margin:0;font-size:10px;color:#a0a8c0}
.lt-lyric-view{position:relative;width:100%;height:min(32vh,260px);min-width:0}
@keyframes lt-breathe{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.025) translateY(-5px)}}
.lt-cover-img{width:100%;height:100%;object-fit:cover;display:block}
.lt-cover-ph{display:grid;place-items:center;background:linear-gradient(135deg,#3a2c60,#5a3a70);color:rgba(255,255,255,.5)}
.lt-player-song{text-align:center;min-width:0;flex-shrink:0}
.lt-player-song h4{margin:0;font-size:17px;font-weight:800;color:#3d4a6e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-player-song p{margin:3px 0 0;font-size:11px;color:#8a96b0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-player-error{margin:8px auto 0;background:#ffe6ef;color:#b64f73;max-width:320px;text-align:center}
/* 歌词：中等高度滚动窗口，复刻 otter 交互 */
.lt-player-lyrics{position:relative;height:100%;overflow-y:auto;mask-image:linear-gradient(180deg,transparent,#000 14%,#000 86%,transparent)}
.lt-lyrics-header{position:absolute;top:0;left:6px;right:6px;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:3px 10px;color:#858cb0;font-size:10px;font-weight:700;pointer-events:none}
.lt-lyrics-follow{padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.4);font-weight:600}
.lt-lyrics-follow.paused{color:#aa7f9e;background:rgba(255,238,247,.6)}
.lt-lyrics-inner{display:flex;flex-direction:column;gap:14px;padding:24% 6px 28%}
.lt-lyric-line{margin:0;padding:4px 10px;font-size:14px;line-height:1.5;color:#a8aec8;text-align:center;border-radius:14px;transition:color .3s,transform .3s,font-size .3s;cursor:pointer;outline:none}
.lt-lyric-line:hover{color:#7a80a8}
.lt-lyric-line:focus-visible{box-shadow:0 0 0 3px rgba(110,100,200,.16)}
.lt-lyric-line.active{color:#5a68c0;font-weight:700;font-size:15px}
.lt-lyric-line small{display:block;margin-top:2px;color:#aeb3c9;font-size:11px;font-weight:500;line-height:1.45}
.lt-lyric-line.active small{color:#7f89ba}
.lt-player-lyric-empty{text-align:center;color:#a0a8c0;font-size:12px}
.lt-lyric-baseline{position:absolute;left:6px;right:6px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:10px;pointer-events:none}
.lt-baseline-time{font-size:11px;color:#8a90b8;font-variant-numeric:tabular-nums}
.lt-baseline-line{flex:1;height:1px;background:rgba(120,110,190,.25)}
.lt-baseline-play{pointer-events:auto;display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:50%;background:rgba(120,110,190,.14);color:#6a60c0;cursor:pointer}
.lt-baseline-play:hover{background:rgba(120,110,190,.24)}
/* 进度与控制 */
.lt-player-progress{display:flex;align-items:center;gap:10px;flex-shrink:0}
.lt-player-progress .lt-time{font-size:10px;color:#8a96b0;font-variant-numeric:tabular-nums;min-width:32px;text-align:center}
.lt-progress{flex:1;height:5px;border-radius:999px;background:rgba(140,150,200,.2);cursor:pointer}
.lt-player-page .lt-progress-fill{position:relative;height:100%;border-radius:999px;background:linear-gradient(90deg,#6a90e0,#b070d8)}
.lt-progress-thumb{position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:12px;height:12px;border-radius:50%;background:#fff;border:1px solid rgba(120,110,190,.3);box-shadow:0 2px 6px rgba(90,90,160,.35)}
.lt-player-controls{display:flex;align-items:center;justify-content:center;gap:clamp(18px,6vw,34px);padding-top:14px;flex-shrink:0}
.lt-ctrl-btn{display:grid;place-items:center;width:46px;height:46px;border:1px solid rgba(160,150,220,.25);border-radius:50%;background:rgba(255,255,255,.8);color:#6a7da0;cursor:pointer}
.lt-ctrl-btn:hover{background:#fff}
.lt-ctrl-btn.dim{opacity:.4}
.lt-next-hint{margin:8px 0 0;text-align:center;font-size:10px;color:#9aa0b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
/* 边听边聊抽屉（播放页内） */
.lt-room-chat{position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;flex-direction:column;gap:10px;padding:16px 18px max(18px,env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:rgba(255,255,255,.92);border:1px solid rgba(160,150,220,.2);border-bottom:0;backdrop-filter:blur(18px);box-shadow:0 -12px 40px rgba(90,90,160,.12);max-height:72%}
.lt-room-chat-head{display:flex;align-items:center;justify-content:space-between;color:#3d4a6e;font-size:12px;font-weight:700}
.lt-room-chat-close{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:999px;background:rgba(140,150,200,.12);color:#6a7da0;cursor:pointer}
.lt-room-chat .lt-chat-list{max-height:190px}
.lt-room-chat .lt-input{background:rgba(248,248,255,.9);border-color:rgba(140,160,200,.2);color:#3d4a6e}
.lt-room-chat .lt-input::placeholder{color:#9aa0b8}
.lt-room-chat .lt-mic-btn{background:rgba(255,255,255,.85);border-color:rgba(140,160,200,.2);color:#6a7da0}
.chat-slide-enter-active,.chat-slide-leave-active{transition:transform .28s cubic-bezier(.3,.8,.3,1),opacity .28s ease}
.chat-slide-enter-from,.chat-slide-leave-to{transform:translateY(100%);opacity:0}
/* 播放队列抽屉：沿用聊天面板的玻璃层，保持与当前会话同步 */
.lt-room-queue{position:absolute;left:0;right:0;bottom:0;z-index:7;display:flex;flex-direction:column;gap:12px;padding:16px 18px max(18px,env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:rgba(255,255,255,.88);border:1px solid rgba(160,150,220,.2);border-bottom:0;backdrop-filter:blur(18px);box-shadow:0 -12px 40px rgba(90,90,160,.12);max-height:72%}
.lt-room-queue-current{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:18px;background:rgba(235,238,255,.58);border:1px solid rgba(140,150,210,.14)}
.lt-room-queue-current>div{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.lt-room-queue-current small{font-size:9px;color:#8b91b0}
.lt-room-queue-current strong,.lt-room-queue-current span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-room-queue-current strong{font-size:12px;color:#3d4a6e}
.lt-room-queue-current span{font-size:10px;color:#8a96b0}
.lt-queue-playing{display:flex;align-items:flex-end;gap:2px;width:18px;height:16px;flex-shrink:0}
.lt-queue-playing i{width:3px;border-radius:2px;background:#7a68c0;animation:queue-wave .8s ease-in-out infinite alternate}
.lt-queue-playing i:nth-child(1){height:7px}.lt-queue-playing i:nth-child(2){height:14px;animation-delay:.2s}.lt-queue-playing i:nth-child(3){height:10px;animation-delay:.4s}
@keyframes queue-wave{to{transform:scaleY(.45);opacity:.45}}
.lt-room-queue-list{display:flex;flex-direction:column;gap:6px;overflow-y:auto;min-height:0}
.lt-room-queue-item{display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:16px;transition:background .15s}
.lt-room-queue-item:hover{background:rgba(230,235,255,.68)}
.lt-room-queue-main{display:flex;align-items:center;gap:9px;min-width:0;flex:1;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;font:inherit}
.lt-room-queue-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.lt-room-queue-copy strong,.lt-room-queue-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lt-room-queue-copy strong{font-size:12px;color:#3d4a6e}
.lt-room-queue-copy small{font-size:10px;color:#8a96b0}
.lt-room-queue-actions{display:flex;gap:3px;flex-shrink:0}
.lt-queue-action{display:grid;place-items:center;width:28px;height:28px;padding:0;border:1px solid rgba(140,150,200,.16);border-radius:9px;background:rgba(255,255,255,.62);color:#6a7da0;cursor:pointer}
.lt-queue-action:hover:not(:disabled){background:#fff;color:#6259ac}
.lt-queue-action:disabled{opacity:.3;cursor:default}
.lt-queue-action.danger:hover{color:#d06080;background:rgba(255,235,242,.8)}
.lt-queue-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px 12px;color:#9a9fba}
.lt-queue-empty span{font-size:12px;color:#6f7798}
.lt-queue-empty small{font-size:10px;color:#a0a8c0}
.queue-slide-enter-active,.queue-slide-leave-active{transition:transform .28s cubic-bezier(.3,.8,.3,1),opacity .28s ease}
.queue-slide-enter-from,.queue-slide-leave-to{transform:translateY(100%);opacity:0}
/* 播放页转场 */
.player-slide-enter-active,.player-slide-leave-active{transition:transform .32s cubic-bezier(.3,.8,.3,1),opacity .32s ease}
.player-slide-enter-from,.player-slide-leave-to{transform:translateY(100%);opacity:.6}
@media(min-width:900px){
  .lt-player-inner{max-width:640px;padding-inline:32px}
  .lt-cover-card{width:min(34vw,280px)}
  .lt-lyric-view{height:min(38vh,320px)}
}
@media(max-width:760px){
  .lt-page{padding:14px;margin:8px auto;width:calc(100% - 16px);border-radius:28px}
  .lt-search,.lt-results,.lt-queue,.lt-chat{padding:14px;border-radius:24px}
  .lt-mini-cover{width:50px;height:50px}
  .lt-cover-card{width:min(58vw,210px)}
  .lt-lyric-view{height:min(30vh,230px)}
}
@media(max-width:380px){
  .lt-player-inner{padding-inline:14px}
  .lt-player-top{gap:6px}
  .lt-player-close{width:34px;height:34px}
  .lt-player-couple{gap:4px}
  .lt-player-avatar{width:34px;height:34px;font-size:13px}
  .lt-player-link{font-size:12px}
  .lt-player-top-right{gap:4px}
  .lt-player-status{max-width:64px;padding:5px 7px;font-size:10px}
  .lt-player-controls{gap:14px}
  .lt-ctrl-btn{width:42px;height:42px}
  .lt-play-btn.big{width:58px;height:58px}
  .lt-library-tab{padding-inline:8px;font-size:11px}
  .lt-source{padding-inline:11px}
}

/* Aurora-inspired library shell: dense desktop workspace, one-column mobile
   flow. The existing sync/chat logic stays unchanged; only the visual
   hierarchy is rearranged here. */
@media(min-width:900px){
  .lt-page{
    display:grid;
    grid-template-columns:minmax(300px,.82fr) minmax(0,1.18fr);
    grid-template-areas:
      "header header"
      "join join"
      "search player"
      "search results"
      "chat queue";
    align-items:start;
    max-width:1180px;
    padding:28px;
    gap:18px;
  }
  .lt-header{grid-area:header}
  .lt-join-banner{grid-area:join}
  .lt-search{grid-area:search;position:sticky;top:18px}
  .lt-mini-player{grid-area:player;position:sticky;top:18px}
  .lt-results{grid-area:results}
  .lt-chat{grid-area:chat}
  .lt-queue{grid-area:queue}
  .lt-playlist-panel{min-height:300px}
}

.lt-page{
  position:relative;
  isolation:isolate;
  background:
    radial-gradient(80% 70% at 12% 0%,rgba(128,154,236,.16),transparent 66%),
    radial-gradient(75% 70% at 100% 100%,rgba(219,132,188,.14),transparent 66%),
    rgba(249,248,255,.74);
  backdrop-filter:blur(24px) saturate(125%);
  -webkit-backdrop-filter:blur(24px) saturate(125%);
}
.lt-page::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  pointer-events:none;
  border-radius:inherit;
  background:linear-gradient(145deg,rgba(255,255,255,.44),transparent 42%,rgba(255,255,255,.18));
}
.lt-search,.lt-results,.lt-queue,.lt-chat,.lt-mini-player{
  background:rgba(255,255,255,.48);
  border-color:rgba(255,255,255,.68);
  box-shadow:0 16px 34px rgba(57,61,118,.08),inset 0 1px 0 rgba(255,255,255,.82);
  backdrop-filter:blur(18px) saturate(125%);
  -webkit-backdrop-filter:blur(18px) saturate(125%);
}
.lt-library-tabs{
  background:rgba(54,58,100,.08);
  border:1px solid rgba(255,255,255,.5);
}
.lt-library-tab.active{
  background:rgba(255,255,255,.86);
  color:#4a4f91;
  box-shadow:0 5px 16px rgba(59,66,130,.12);
}
.lt-playlist-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 2px 12px}
.lt-playlist-heading .lt-section-title{margin:0 0 3px}
.lt-playlist-count{font-size:11px;color:#8c91ad}
.lt-text-action,.lt-empty-action{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  border:1px solid rgba(110,118,190,.2);border-radius:999px;
  background:rgba(255,255,255,.72);color:#5d63a0;font-size:11px;font-weight:700;
  cursor:pointer;transition:transform .16s ease,background .16s ease;
}
.lt-text-action{padding:8px 12px}
.lt-empty-action{padding:9px 14px;margin-top:8px}
.lt-text-action:hover,.lt-empty-action:hover{background:#fff;transform:translateY(-1px)}
.lt-playlist-empty--has-suggestions{align-items:stretch;text-align:left;justify-content:flex-start;padding:8px 0 0}
.lt-playlist-empty-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:rgba(110,123,205,.12);color:#6269a7}
.lt-playlist-empty--has-suggestions strong{margin-top:6px}
.lt-playlist-empty--has-suggestions small{margin-bottom:8px}
.lt-playlist-suggestions{display:flex;flex-direction:column;gap:4px;width:100%}
.lt-playlist-item{padding:8px 6px}
.lt-playlist-item:hover{background:rgba(226,232,255,.62)}
.lt-result-item,.lt-queue-item{padding:10px 8px}
.lt-result-name,.lt-room-queue-copy strong{font-size:13px}
.lt-result-artist,.lt-room-queue-copy small{font-size:11px}
.lt-icon-btn{background:rgba(255,255,255,.62)}
.lt-mini-player{border-radius:24px;padding:12px 14px}
.lt-mini-player:hover{transform:translateY(-2px);box-shadow:0 20px 40px rgba(57,61,118,.13)}
.lt-mini-cover{border-radius:16px}

/* Immersive player treatment based on Aurora's Halcyon player. */
.lt-player-page{
  background:#0f1017;
  color:rgba(255,255,255,.92);
}
.lt-player-bg{opacity:.46;filter:blur(78px) saturate(1.35) brightness(.56);transform:scale(1.12)}
.lt-player-bg-mask{
  background:
    radial-gradient(100% 72% at 50% -10%,rgba(255,255,255,.12),transparent 58%),
    linear-gradient(180deg,rgba(7,8,14,.24),rgba(9,10,17,.82));
}
.lt-player-inner{max-width:1180px;padding:20px 28px max(24px,env(safe-area-inset-bottom))}
.lt-player-close{background:rgba(18,20,31,.46);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.lt-player-close:hover{background:rgba(255,255,255,.16)}
.lt-player-status{background:rgba(18,20,31,.42);border-color:rgba(255,255,255,.16);color:rgba(255,255,255,.78)}
.lt-player-song h4{color:#fff;font-size:20px;text-shadow:0 2px 18px rgba(0,0,0,.28)}
.lt-player-song p,.lt-view-hint,.lt-next-hint{color:rgba(255,255,255,.62)}
.lt-cover-card{box-shadow:0 28px 60px rgba(0,0,0,.42),0 0 0 1px rgba(255,255,255,.2)}
.lt-player-lyrics{mask-image:linear-gradient(180deg,transparent,#000 16%,#000 84%,transparent);-webkit-mask-image:linear-gradient(180deg,transparent,#000 16%,#000 84%,transparent)}
.lt-lyric-line{color:rgba(255,255,255,.42);font-size:16px;line-height:1.55}
.lt-lyric-line:hover{color:rgba(255,255,255,.78)}
.lt-lyric-line.active{color:#fff;font-size:20px;text-shadow:0 2px 22px rgba(0,0,0,.4)}
.lt-lyric-line small{color:rgba(255,255,255,.45)}
.lt-lyric-line.active small{color:rgba(255,255,255,.72)}
.lt-player-progress .lt-time{color:rgba(255,255,255,.62)}
.lt-progress{background:rgba(255,255,255,.2)}
.lt-player-page .lt-progress-fill{background:linear-gradient(90deg,#fff,#b7c5ff)}
.lt-progress-thumb{border-color:rgba(255,255,255,.3);box-shadow:0 2px 9px rgba(0,0,0,.4)}
.lt-ctrl-btn{background:rgba(18,20,31,.48);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.88)}
.lt-ctrl-btn:hover{background:rgba(255,255,255,.14)}
.lt-play-btn{background:#fff;color:#171821;box-shadow:0 12px 32px rgba(0,0,0,.35)}
.lt-room-chat,.lt-room-queue{background:rgba(18,20,31,.78);border-color:rgba(255,255,255,.16);backdrop-filter:blur(24px) saturate(130%);-webkit-backdrop-filter:blur(24px) saturate(130%);box-shadow:0 -16px 50px rgba(0,0,0,.26)}
.lt-room-chat-head,.lt-room-queue-current strong,.lt-room-queue-copy strong{color:#fff}
.lt-room-queue-current{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.12)}
.lt-room-queue-current small,.lt-room-queue-current span,.lt-room-queue-copy small{color:rgba(255,255,255,.56)}
.lt-room-queue-item:hover{background:rgba(255,255,255,.1)}
.lt-queue-action{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:rgba(255,255,255,.78)}
.lt-queue-action:hover:not(:disabled){background:rgba(255,255,255,.16);color:#fff}
.lt-room-chat-close{background:rgba(255,255,255,.1);color:rgba(255,255,255,.8)}

@media(min-width:900px){
  .lt-player-inner{padding-inline:clamp(34px,6vw,96px)}
  .lt-view-zone{max-width:980px;align-self:center}
  .lt-cover-card{width:min(34vw,360px)}
  .lt-lyric-view{height:min(40vh,360px)}
}
@media(max-width:650px){
  .lt-page{backdrop-filter:blur(16px) saturate(120%);-webkit-backdrop-filter:blur(16px) saturate(120%)}
  .lt-player-inner{padding-inline:18px}
  .lt-player-song h4{font-size:18px}
  .lt-lyric-line.active{font-size:18px}
}

/* Aurora-style player geometry: the center is a real flexible pane instead
   of a short fixed-height lyric window surrounded by empty space. */
.lt-player-page,.lt-player-inner{box-sizing:border-box}
.lt-player-inner{min-height:100dvh}
.lt-view-zone{align-items:stretch;max-height:none;min-height:0}
.lt-cover-pane,.lt-lyrics-pane{display:none;min-width:0;min-height:0}
.lt-cover-pane.active,.lt-lyrics-pane.active{display:flex}
.lt-cover-pane{flex:1;flex-direction:column;align-items:center;justify-content:center;gap:12px}
.lt-lyrics-pane{flex:1;flex-direction:column;align-items:stretch;justify-content:center;gap:12px;width:100%}
.lt-lyrics-pane .lt-lyric-view{height:auto;min-height:0;max-height:none;flex:1}

@media(min-width:1024px){
  .lt-view-zone{flex-direction:row;align-items:stretch;gap:clamp(32px,5vw,76px);margin:12px 0}
  .lt-cover-pane,.lt-lyrics-pane{display:flex}
  .lt-cover-pane{flex:0 0 clamp(280px,28vw,400px)}
  .lt-lyrics-pane{flex:1;padding-right:6px}
  .lt-cover-card{width:min(100%,400px)}
  .lt-lyrics-pane .lt-view-hint{text-align:left}
  .lt-lyrics-pane .lt-lyric-line{text-align:left}
}

/* Final compact light player treatment: the viewport stays fixed while only
   the lyric list is allowed to scroll. */
:global(html.lt-player-lock),
:global(body.lt-player-lock){
  overflow:hidden !important;
  height:100%;
  overscroll-behavior:none;
}

.lt-player-page{
  position:fixed;
  inset:0;
  width:100%;
  height:100dvh;
  min-height:100dvh;
  overflow:hidden;
  overscroll-behavior:none;
  background:#f8f9fc;
  color:#26324a;
}

.lt-player-bg{
  opacity:.12;
  filter:blur(54px) saturate(1.05);
  transform:scale(1.08);
}

.lt-player-bg-mask{
  background:rgba(248,249,252,.78);
}

.lt-player-inner{
  width:100%;
  height:100dvh;
  max-height:100dvh;
  min-height:0;
  overflow:hidden;
  padding:max(10px,env(safe-area-inset-top))
    clamp(14px,4vw,36px)
    max(12px,env(safe-area-inset-bottom));
}

.lt-player-top{
  min-height:38px;
}

.lt-player-avatar{
  width:38px;
  height:38px;
}

.lt-player-close,
.lt-player-status,
.lt-ctrl-btn{
  background:rgba(255,255,255,.92);
  border-color:rgba(70,82,112,.12);
  color:#52617d;
  box-shadow:0 4px 14px rgba(70,82,112,.08);
}

.lt-player-close:hover,
.lt-ctrl-btn:hover{
  background:#fff;
}

.lt-player-song{
  margin-top:4px;
}

.lt-player-song h4{
  color:#26324a;
  text-shadow:none;
}

.lt-player-song p,
.lt-view-hint,
.lt-next-hint{
  color:#8490a8;
}

.lt-view-zone{
  margin:8px 0;
  min-height:0;
  max-height:none;
  overflow:hidden;
}

.lt-cover-card{
  box-shadow:0 18px 38px rgba(70,82,112,.16),0 0 0 1px rgba(255,255,255,.92);
}

.lt-lyrics-pane{
  min-height:0;
}

.lt-lyrics-pane .lt-lyric-view{
  min-height:0;
}

.lt-player-lyrics{
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-width:thin;
  scrollbar-color:rgba(99,121,173,.25) transparent;
}

.lt-lyric-line{
  color:#9aa4b8;
}

.lt-lyric-line:hover,
.lt-lyric-line.active{
  color:#42547b;
  text-shadow:none;
}

.lt-lyric-line.active{
  font-size:18px;
}

.lt-lyric-line small,
.lt-lyric-line.active small{
  color:#9aa4b8;
}

.lt-player-progress{
  flex-shrink:0;
}

.lt-progress{
  background:rgba(76,91,120,.14);
}

.lt-player-page .lt-progress-fill{
  background:#6379ad;
}

.lt-progress-thumb{
  border-color:rgba(99,121,173,.24);
  box-shadow:0 2px 8px rgba(70,82,112,.2);
}

.lt-player-controls{
  padding-top:8px;
}

.lt-play-btn{
  background:#6379ad;
  color:#fff;
  box-shadow:0 8px 20px rgba(99,121,173,.25);
}

.lt-next-hint{
  margin-top:4px;
}

.lt-room-chat,
.lt-room-queue{
  background:rgba(255,255,255,.96);
  border-color:rgba(70,82,112,.12);
  box-shadow:0 -16px 50px rgba(70,82,112,.12);
}

.lt-room-chat-head,
.lt-room-queue-current strong,
.lt-room-queue-copy strong{
  color:#26324a;
}

.lt-room-queue-current{
  background:#f1f4fa;
  border-color:rgba(70,82,112,.1);
}

.lt-room-queue-current small,
.lt-room-queue-current span,
.lt-room-queue-copy small{
  color:#8490a8;
}

.lt-room-queue-item:hover{
  background:#f2f5fa;
}

.lt-queue-action{
  background:#fff;
  border-color:rgba(70,82,112,.12);
  color:#52617d;
}

@media(min-width:1024px){
  .lt-view-zone{
    gap:clamp(20px,4vw,52px);
    margin:8px 0;
  }

  .lt-cover-pane{
    flex:0 0 clamp(220px,26vw,340px);
  }

  .lt-cover-card{
    width:min(100%,340px);
  }
}

@media(max-width:650px){
  .lt-player-inner{
    padding-inline:14px;
  }

  .lt-player-song h4{
    font-size:17px;
  }

  .lt-player-controls{
    gap:16px;
  }

  .lt-ctrl-btn{
    width:44px;
    height:44px;
  }
}

/* The player is a compact, single-viewport layout. Lyrics keep their own
   scroll container; the player shell and home navigation never compete. */
.lt-player-page{
  z-index:1000;
}

.lt-view-zone{
  display:flex;
  flex:1 1 auto;
  flex-direction:row;
  align-items:stretch;
  gap:clamp(18px,4vw,48px);
  overflow:hidden;
}

.lt-cover-pane,
.lt-lyrics-pane{
  display:none;
}

.lt-cover-pane.active,
.lt-lyrics-pane.active{
  display:flex;
}

.lt-cover-pane{
  flex:0 0 clamp(210px,26vw,340px);
  align-items:center;
  justify-content:center;
}

.lt-lyrics-pane{
  flex:1 1 auto;
  min-width:0;
  min-height:0;
  overflow:hidden;
}

.lt-lyric-view{
  display:flex;
  flex:1 1 auto;
  flex-direction:column;
  width:100%;
  height:auto;
  min-height:0;
}

.lt-player-lyrics{
  flex:1 1 auto;
  height:auto;
  min-height:0;
  mask-image:none;
  -webkit-mask-image:none;
}

.lt-lyrics-inner{
  gap:10px;
  padding:34px 8px 22px;
}

.lt-lyric-line{
  filter:none;
  transform-origin:center;
  font-size:17px;
  line-height:1.5;
}

.lt-lyric-line.active{
  font-size:22px;
}

.lt-view-hint{
  color:#9aa4b8;
  font-size:11px;
}

.lt-view-hint--lyrics{
  display:block;
  padding:4px 0 8px;
  text-align:center;
}

.lt-player-controls{
  position:relative;
  z-index:2;
  flex:0 0 auto;
}

@media(max-width:1023px){
  .lt-player-inner{
    padding-inline:14px;
  }

  .lt-player-song h4{
    font-size:16px;
  }

  .lt-view-zone{
    flex-direction:column;
    gap:8px;
    margin:7px 0;
  }

  .lt-cover-pane{
    flex:0 0 auto;
    min-height:0;
  }

  .lt-cover-card{
    width:min(42vw,168px);
    border-radius:20px;
  }

  .lt-lyrics-pane{
    flex:1 1 auto;
  }

  .lt-lyrics-inner{
    gap:7px;
    padding:25px 4px 16px;
  }

  .lt-lyric-line{
    padding:3px 8px;
    font-size:16px;
    line-height:1.45;
  }

  .lt-lyric-line.active{
    font-size:20px;
  }

  .lt-player-progress{
    gap:7px;
  }
}

@media(max-width:650px){
  .lt-player-top{
    min-height:34px;
  }

  .lt-player-avatar{
    width:34px;
    height:34px;
  }

  .lt-player-status{
    max-width:112px;
    padding:5px 9px;
    font-size:10px;
  }

  .lt-player-controls{
    gap:16px;
    padding-top:6px;
  }
}

@media(max-height:680px) and (max-width:1023px){
  .lt-player-inner{
    padding-top:max(7px,env(safe-area-inset-top));
    padding-bottom:max(8px,env(safe-area-inset-bottom));
  }

  .lt-cover-card{
    width:min(31vw,122px);
  }

  .lt-player-song{
    margin-top:2px;
  }

  .lt-lyrics-inner{
    padding-top:18px;
    padding-bottom:10px;
  }
}

/* Library-first room layout: search results remain the main content; chat and
   queue are available on demand instead of extending the page indefinitely. */
.lt-page{
  display:grid;
  grid-template-columns:minmax(0,1fr);
  grid-template-areas:
    "header"
    "join"
    "search"
    "results"
    "player"
    "chat"
    "queue";
  align-items:start;
  gap:12px;
  max-width:1180px;
  padding:22px;
  border-radius:20px;
  background:rgba(248,249,252,.82);
  border:1px solid rgba(70,82,112,.1);
  box-shadow:0 12px 32px rgba(44,49,66,.06);
}

.lt-header{grid-area:header;min-height:42px}
.lt-join-banner{grid-area:join}
.lt-search{grid-area:search}
.lt-results{grid-area:results}
.lt-mini-player{grid-area:player}
.lt-chat{grid-area:chat}
.lt-queue{grid-area:queue}

.lt-title{color:#52617d}
.lt-title h3{font-size:20px;color:#26324a}
.lt-badge{min-height:34px;border:1px solid rgba(70,82,112,.1);background:rgba(255,255,255,.72);color:#66738b}
.lt-search,.lt-results,.lt-queue,.lt-chat,.lt-mini-player{
  border-radius:14px;
  border-color:rgba(70,82,112,.1);
  background:rgba(255,255,255,.86);
  box-shadow:0 6px 18px rgba(44,49,66,.045);
}
.lt-search{gap:14px;padding:18px}
.lt-library-tabs{border-radius:10px;background:#f1f2f5}
.lt-library-tab{min-height:42px;border-radius:8px;color:#697387}
.lt-library-tab.active{background:#fff;color:#4e5c77;box-shadow:0 2px 8px rgba(44,49,66,.09)}
.lt-sources{gap:8px}
.lt-source{min-height:36px;border-radius:8px;background:#fff}
.lt-source.active{background:#53627e;box-shadow:none}
.lt-input{min-height:46px;border-radius:10px;background:#f7f8fa;color:#26324a;font-size:14px}
.lt-search-btn{width:46px;min-height:46px;border-radius:10px;background:#53627e;box-shadow:none}
.lt-mini-player{padding:12px;border-radius:14px}
.lt-mini-cover{width:52px;height:52px;border-radius:10px}
.lt-result-item,.lt-queue-item{min-height:64px;gap:10px;padding:8px}
.lt-result-cover{width:44px;height:44px;border-radius:8px}
.lt-result-name{font-size:14px;color:#26324a}
.lt-result-artist{font-size:12px;color:#697387}
.lt-icon-btn{width:42px;height:42px;border-radius:9px;background:#f6f7f9}
.lt-section-title{margin:0;color:#44516a;font-size:13px;letter-spacing:0;text-transform:none}
.lt-disclosure{padding:0;overflow:hidden}
.lt-disclosure-summary{
  display:flex;
  align-items:center;
  gap:10px;
  min-height:52px;
  padding:0 16px;
  list-style:none;
  cursor:pointer;
  color:#748096;
}
.lt-disclosure-summary::-webkit-details-marker{display:none}
.lt-disclosure-summary .lt-section-title{margin:0}
.lt-disclosure-summary svg{flex:0 0 auto;transition:transform .18s ease}
.lt-disclosure[open] .lt-disclosure-summary svg{transform:rotate(180deg)}
.lt-disclosure-meta{margin-inline-start:auto;font-size:12px;color:#8b95a8}
.lt-disclosure .lt-chat-list,
.lt-disclosure .lt-chat-input,
.lt-disclosure .lt-record-bar,
.lt-disclosure>.lt-error,
.lt-disclosure>.lt-queue-item{margin-inline:14px}
.lt-disclosure .lt-chat-list{margin-top:2px}
.lt-disclosure .lt-chat-input,
.lt-disclosure .lt-record-bar{margin-bottom:14px}
.lt-disclosure>.lt-error{display:block;margin-bottom:12px}
.lt-disclosure>.lt-queue-item:last-child{margin-bottom:10px}

@media(min-width:900px){
  .lt-page{
    grid-template-columns:minmax(300px,.84fr) minmax(0,1.16fr);
    grid-template-areas:
      "header header"
      "join join"
      "search player"
      "search results"
      "chat queue";
    gap:16px;
    padding:24px;
  }
  .lt-search{position:sticky;top:18px}
  .lt-mini-player{position:sticky;top:18px}
  .lt-chat,.lt-queue{align-self:start}
}

@media(max-width:650px){
  .lt-page{width:100%;margin:0;padding:14px;border-radius:14px;gap:10px}
  .lt-header{gap:8px}
  .lt-title h3{font-size:18px}
  .lt-badge{padding:5px 9px;font-size:10px}
  .lt-search{padding:13px;border-radius:12px}
  .lt-results{padding:12px;border-radius:12px}
  .lt-result-item,.lt-queue-item{gap:7px;padding:7px 3px}
  .lt-result-cover{width:40px;height:40px}
  .lt-icon-btn{width:38px;height:40px}
  .lt-mini-player{gap:10px}
  .lt-mini-name{font-size:14px}
  .lt-mini-artist{font-size:12px}
  .lt-disclosure-summary{min-height:48px;padding-inline:13px}
}

@media(prefers-reduced-motion:reduce){
  .lt-cover-card.playing{animation:none}
  .lt-disclosure-summary svg{transition:none}
}

/* Second-level music library: collections live here instead of stretching
   the together-list page. */
.lt-library-page{
  position:fixed;
  z-index:950;
  inset:0;
  overflow:hidden;
  background:#f8f9fc;
  color:#26324a;
}

.lt-library-shell{
  display:flex;
  flex-direction:column;
  width:min(100%,1180px);
  height:100dvh;
  margin:0 auto;
}

.lt-library-head{
  display:flex;
  flex:0 0 auto;
  align-items:center;
  gap:12px;
  padding:max(10px,env(safe-area-inset-top)) clamp(14px,4vw,36px) 10px;
  border-bottom:1px solid rgba(70,82,112,.09);
  background:rgba(255,255,255,.94);
}

.lt-library-icon{
  display:grid;
  flex:0 0 42px;
  place-items:center;
  width:42px;
  height:42px;
  border:1px solid rgba(70,82,112,.12);
  border-radius:13px;
  background:#fff;
  color:#52617d;
  cursor:pointer;
}

.lt-library-icon:hover{
  background:#f1f4fa;
}

.lt-library-head-copy{
  min-width:0;
  flex:1;
}

.lt-library-head-copy span,
.lt-library-eyebrow{
  display:block;
  color:#8b96ad;
  font-size:10px;
  font-weight:700;
  letter-spacing:.08em;
}

.lt-library-head-copy h2{
  margin:2px 0 0;
  overflow:hidden;
  color:#26324a;
  font-size:20px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.lt-library-scroll{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  padding:clamp(18px,4vw,36px) clamp(14px,4vw,36px) max(24px,env(safe-area-inset-bottom));
}

.lt-library-hero,
.lt-library-detail-head{
  display:grid;
  grid-template-columns:minmax(150px,260px) minmax(0,1fr);
  align-items:center;
  gap:clamp(18px,4vw,42px);
  padding:clamp(18px,4vw,34px);
  border:1px solid rgba(70,82,112,.1);
  border-radius:24px;
  background:#fff;
  box-shadow:0 12px 32px rgba(70,82,112,.07);
}

.lt-library-hero-cover,
.lt-library-detail-cover{
  display:grid;
  grid-template-columns:1fr 1fr;
  grid-auto-rows:1fr;
  aspect-ratio:1;
  overflow:hidden;
  border-radius:18px;
  background:#edf1f7;
}

.lt-library-hero-cover img,
.lt-library-detail-cover img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.lt-library-cover-fallback{
  display:grid;
  place-items:center;
  min-width:0;
  min-height:0;
  background:#edf1f7;
  color:#8a96ad;
}

.lt-library-hero-copy h1,
.lt-library-detail-copy h1{
  margin:6px 0 8px;
  color:#26324a;
  font-size:clamp(24px,4vw,38px);
  line-height:1.15;
}

.lt-library-hero-copy p,
.lt-library-detail-copy p{
  max-width:520px;
  margin:0;
  color:#8490a8;
  font-size:12px;
  line-height:1.65;
}

.lt-library-primary,
.lt-library-secondary{
  display:inline-flex;
  align-items:center;
  gap:7px;
  min-height:40px;
  margin-top:18px;
  padding:0 15px;
  border-radius:12px;
  font-size:11px;
  font-weight:750;
  cursor:pointer;
}

.lt-library-actions{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.lt-library-actions .lt-library-primary,
.lt-library-actions .lt-library-secondary{
  margin-top:18px;
}

.lt-library-primary{
  border:0;
  background:#6379ad;
  color:#fff;
  box-shadow:0 8px 18px rgba(99,121,173,.2);
}

.lt-library-secondary{
  border:1px solid rgba(70,82,112,.13);
  background:#fff;
  color:#52617d;
}

.lt-library-section-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
  margin:28px 2px 12px;
}

.lt-library-section-head h3{
  margin:4px 0 0;
  color:#26324a;
  font-size:18px;
}

.lt-library-section-count{
  color:#9aa4b8;
  font-size:11px;
}

.lt-library-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:14px;
}

.lt-net-ease-search{
  display:flex;
  align-items:center;
  gap:10px;
  margin-top:26px;
  padding:8px 10px 8px 14px;
  border:1px solid rgba(70,82,112,.12);
  border-radius:16px;
  background:#fff;
  color:#8792a8;
}

.lt-net-ease-search input{
  min-width:0;
  flex:1;
  border:0;
  outline:0;
  background:transparent;
  color:#26324a;
  font-size:13px;
}

.lt-net-ease-search button{
  display:inline-flex;
  align-items:center;
  gap:6px;
  min-height:34px;
  padding:0 12px;
  border:0;
  border-radius:10px;
  background:#6379ad;
  color:#fff;
  font-size:11px;
  font-weight:750;
  cursor:pointer;
}

.lt-net-ease-search button:disabled{
  opacity:.6;
  cursor:wait;
}

.lt-library-section-head--remote{
  margin-top:26px;
}

.lt-playlist-categories{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin:0 0 14px;
}

.lt-playlist-categories button{
  min-height:30px;
  padding:0 11px;
  border:1px solid rgba(70,82,112,.1);
  border-radius:999px;
  background:#fff;
  color:#7e8aa4;
  font-size:11px;
  cursor:pointer;
}

.lt-playlist-categories button:hover{
  border-color:rgba(99,121,173,.35);
  color:#6379ad;
}

.lt-playlist-categories button.active{
  border-color:#6379ad;
  background:#6379ad;
  color:#fff;
}

.lt-netease-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:14px;
}

.lt-netease-card{
  min-width:0;
  padding:0;
  border:1px solid rgba(70,82,112,.1);
  border-radius:16px;
  background:#fff;
  color:#26324a;
  text-align:left;
  box-shadow:0 8px 22px rgba(70,82,112,.05);
  cursor:pointer;
  overflow:hidden;
  transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;
}

.lt-netease-card:hover{
  border-color:rgba(99,121,173,.3);
  box-shadow:0 12px 26px rgba(70,82,112,.1);
  transform:translateY(-2px);
}

.lt-netease-cover{
  display:grid;
  place-items:center;
  aspect-ratio:1;
  overflow:hidden;
  background:#edf1f7;
  color:#8a96ad;
}

.lt-netease-cover img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.lt-netease-card strong,
.lt-netease-card small{
  display:block;
  overflow:hidden;
  padding-inline:11px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.lt-netease-card strong{
  margin-top:10px;
  font-size:12px;
}

.lt-netease-card small{
  margin:4px 0 12px;
  color:#8b96ad;
  font-size:10px;
}

.lt-library-state--inline{
  min-height:120px;
}

.lt-library-detail-description{
  display:-webkit-box;
  overflow:hidden;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:3;
}

.lt-library-card{
  min-width:0;
  padding:0;
  border:1px solid rgba(70,82,112,.1);
  border-radius:18px;
  background:#fff;
  color:#26324a;
  text-align:left;
  box-shadow:0 8px 22px rgba(70,82,112,.05);
  cursor:pointer;
  overflow:hidden;
}

.lt-library-card:hover{
  border-color:rgba(99,121,173,.3);
  transform:translateY(-2px);
}

.lt-library-card-cover{
  display:grid;
  grid-template-columns:1fr 1fr;
  grid-auto-rows:1fr;
  aspect-ratio:1.25;
  overflow:hidden;
  background:#edf1f7;
}

.lt-library-card-cover img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.lt-library-card strong,
.lt-library-card small{
  display:block;
  overflow:hidden;
  padding-inline:12px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.lt-library-card strong{
  margin-top:11px;
  font-size:13px;
}

.lt-library-card small{
  margin:4px 0 13px;
  color:#8b96ad;
  font-size:10px;
}

.lt-library-detail-head{
  grid-template-columns:150px minmax(0,1fr);
  padding:22px;
}

.lt-library-detail-copy h1{
  font-size:28px;
}

.lt-library-track-list{
  display:flex;
  flex-direction:column;
  gap:4px;
  margin-top:20px;
}

.lt-library-track{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
  padding:9px 8px;
  border-bottom:1px solid rgba(70,82,112,.08);
}

.lt-library-track-index{
  width:26px;
  color:#a2acbd;
  font-size:10px;
  font-variant-numeric:tabular-nums;
  text-align:center;
}

.lt-library-track>img,
.lt-library-track-cover{
  display:grid;
  flex:0 0 42px;
  place-items:center;
  width:42px;
  height:42px;
  border-radius:10px;
  object-fit:cover;
  background:#edf1f7;
  color:#8a96ad;
}

.lt-library-track-main{
  min-width:0;
  flex:1;
  padding:0;
  border:0;
  background:transparent;
  text-align:left;
  cursor:pointer;
}

.lt-library-track-main strong,
.lt-library-track-main small{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.lt-library-track-main strong{
  color:#26324a;
  font-size:12px;
}

.lt-library-track-main small{
  margin-top:4px;
  color:#8b96ad;
  font-size:10px;
}

.lt-library-track-action{
  display:grid;
  flex:0 0 36px;
  place-items:center;
  width:36px;
  height:36px;
  border:1px solid rgba(70,82,112,.1);
  border-radius:11px;
  background:#fff;
  color:#7e8aa4;
  cursor:pointer;
}

.lt-library-track-action.active{
  color:#6379ad;
}

.lt-library-track-action.danger:hover{
  color:#c2647d;
  background:#fff2f5;
}

.lt-library-state{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  min-height:260px;
  color:#8b96ad;
  text-align:center;
}

.lt-library-state strong{
  color:#52617d;
  font-size:14px;
}

.lt-library-state span{
  font-size:11px;
}

.library-slide-enter-active,
.library-slide-leave-active{
  transition:opacity .22s ease,transform .22s ease;
}

.library-slide-enter-from,
.library-slide-leave-to{
  opacity:0;
  transform:translateY(12px);
}

@media(max-width:650px){
  .lt-library-head{
    padding-inline:14px;
  }

  .lt-library-scroll{
    padding-inline:14px;
  }

  .lt-library-hero,
  .lt-library-detail-head{
    grid-template-columns:1fr;
    gap:16px;
    padding:16px;
  }

  .lt-library-hero-cover,
  .lt-library-detail-cover{
    width:min(58vw,210px);
    margin:0 auto;
  }

  .lt-library-hero-copy h1,
  .lt-library-detail-copy h1{
    font-size:25px;
  }

  .lt-library-grid{
    grid-template-columns:1fr 1fr;
    gap:10px;
  }

  .lt-netease-grid{
    grid-template-columns:1fr 1fr;
    gap:10px;
  }

  .lt-net-ease-search{
    flex-wrap:wrap;
  }

  .lt-net-ease-search input{
    min-width:calc(100% - 32px);
  }

  .lt-net-ease-search button{
    width:100%;
    justify-content:center;
  }

  .lt-library-detail-head{
    grid-template-columns:120px minmax(0,1fr);
    align-items:center;
  }

  .lt-library-detail-cover{
    width:120px;
  }
}

@media(max-width:420px){
  .lt-library-detail-head{
    grid-template-columns:1fr;
  }

  .lt-library-detail-cover{
    width:128px;
    margin:0;
  }
}

/* Keep the player interaction consistent at every viewport. The desktop
   layout must not reveal lyrics beside the cover before the user asks for it. */
.lt-cover-pane,
.lt-lyrics-pane{
  display:none !important;
}

.lt-cover-pane.active,
.lt-lyrics-pane.active{
  display:flex !important;
}

.lt-view-zone{
  flex-direction:column;
  align-items:stretch;
}

.lt-cover-pane{
  flex:1 1 auto;
  align-items:center;
  justify-content:center;
}

.lt-lyrics-pane{
  flex:1 1 auto;
  min-width:0;
  min-height:0;
  overflow:hidden;
}

@media(min-width:1024px){
  .lt-view-zone{
    flex-direction:column;
    align-items:center;
  }

  .lt-cover-pane,
  .lt-lyrics-pane{
    width:100%;
  }

  .lt-cover-pane{
    flex:1 1 auto;
  }

  .lt-cover-card{
    width:min(34vw,360px);
  }
}

/* Final full-screen player pass: album art is the primary object, controls
   stay in one viewport, and secondary actions remain discoverable. */
.lt-player-page{
  background:#edf1f6;
  color:#243149;
}

.lt-player-bg{
  opacity:.2;
  filter:blur(72px) saturate(1.15) brightness(1.04);
  transform:scale(1.12);
}

.lt-player-bg-mask{
  background:
    radial-gradient(70% 60% at 50% 10%,rgba(255,255,255,.8),transparent 70%),
    linear-gradient(180deg,rgba(239,243,248,.7),rgba(236,240,246,.96));
}

.lt-player-inner{
  width:min(100%,1280px);
  max-width:1280px;
  padding:max(18px,env(safe-area-inset-top)) clamp(18px,4vw,56px) max(18px,env(safe-area-inset-bottom));
}

.lt-player-top{
  min-height:48px;
}

.lt-player-close{
  width:44px;
  height:44px;
  border-radius:14px;
  background:rgba(255,255,255,.8);
  border-color:rgba(57,73,102,.12);
  color:#52617d;
  box-shadow:0 8px 22px rgba(58,71,96,.1);
}

.lt-player-close:hover{
  background:#fff;
  color:#26324a;
}

.lt-player-status{
  background:rgba(255,255,255,.76);
  border-color:rgba(57,73,102,.11);
  color:#64728c;
}

.lt-player-song{
  margin-top:16px;
}

.lt-player-song h4{
  font-size:clamp(20px,2.2vw,28px);
  color:#243149;
  letter-spacing:0;
}

.lt-player-song p{
  margin-top:6px;
  font-size:13px;
  color:#73819a;
}

.lt-player-error{
  margin-top:10px;
}

.lt-view-zone{
  width:100%;
  max-width:1100px;
  margin:12px auto 10px;
  flex:1 1 auto;
}

.lt-cover-pane{
  gap:16px;
}

.lt-cover-card{
  width:min(62vh,56vw,560px);
  border-radius:28px;
  box-shadow:0 34px 70px rgba(42,58,88,.22),0 0 0 1px rgba(255,255,255,.9);
}

.lt-cover-card.playing{
  animation:lt-breathe 8s ease-in-out infinite;
}

.lt-view-hint{
  color:#7c899f;
  font-size:12px;
}

.lt-lyrics-pane{
  width:min(100%,760px);
  margin:0 auto;
}

.lt-lyric-view{
  width:100%;
}

.lt-lyrics-header{
  padding-inline:14px;
  color:#60708a;
  font-size:12px;
}

.lt-lyrics-follow{
  background:rgba(255,255,255,.64);
}

.lt-player-lyrics{
  scrollbar-color:rgba(82,103,143,.32) transparent;
}

.lt-lyrics-inner{
  gap:16px;
  padding:34px 12px 28px;
}

.lt-lyric-line{
  padding:6px 14px;
  color:#8995a9;
  font-size:18px;
  line-height:1.55;
}

.lt-lyric-line.active{
  color:#34496f;
  font-size:24px;
  font-weight:800;
}

.lt-lyric-line small{
  font-size:12px;
  color:#9ba6b7;
}

.lt-lyric-line.active small{
  color:#667998;
}

.lt-player-progress{
  width:min(100%,900px);
  margin-inline:auto;
  gap:12px;
}

.lt-player-progress .lt-time{
  min-width:38px;
  font-size:11px;
  color:#718099;
}

.lt-progress{
  height:6px;
  background:rgba(71,89,122,.16);
}

.lt-player-page .lt-progress-fill{
  background:#5d719d;
}

.lt-player-controls{
  gap:clamp(8px,1.8vw,22px);
  padding-top:14px;
}

.lt-ctrl-btn{
  width:48px;
  height:48px;
  border-radius:15px;
  background:rgba(255,255,255,.78);
  border-color:rgba(57,73,102,.12);
  color:#5f6f8b;
  box-shadow:0 8px 20px rgba(58,71,96,.08);
}

.lt-ctrl-btn:hover,
.lt-ctrl-btn.active{
  background:#fff;
  color:#4f638f;
  border-color:rgba(79,99,143,.28);
}

.lt-ctrl-btn:disabled{
  opacity:.35;
  cursor:default;
}

.lt-play-btn.big{
  width:76px;
  height:76px;
  background:#526993;
  box-shadow:0 14px 28px rgba(70,91,139,.28);
}

.lt-player-volume{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  width:min(100%,320px);
  margin:12px auto 0;
  color:#73819a;
  font-size:11px;
  font-variant-numeric:tabular-nums;
}

.lt-volume-button{
  display:grid;
  place-items:center;
  width:36px;
  height:36px;
  padding:0;
  border:1px solid rgba(57,73,102,.12);
  border-radius:10px;
  background:rgba(255,255,255,.74);
  color:#5f6f8b;
  cursor:pointer;
}

.lt-volume-range{
  width:min(220px,65vw);
  accent-color:#5d719d;
  cursor:pointer;
}

.lt-next-hint{
  max-width:560px;
  margin:8px auto 0;
  color:#7d899e;
  font-size:11px;
}

@media(min-width:1024px){
  .lt-player-inner{
    padding-inline:clamp(40px,7vw,110px);
  }

  .lt-view-zone{
    margin-top:18px;
    margin-bottom:14px;
  }

  .lt-cover-card{
    width:min(62vh,52vw,560px);
  }
}

@media(max-width:650px){
  .lt-player-inner{
    padding-inline:14px;
  }

  .lt-player-song{
    margin-top:10px;
  }

  .lt-player-song h4{
    font-size:19px;
  }

  .lt-player-song p{
    font-size:12px;
  }

  .lt-view-zone{
    margin:8px 0;
  }

  .lt-cover-card{
    width:min(78vw,330px);
    border-radius:22px;
  }

  .lt-lyrics-inner{
    gap:10px;
    padding:26px 4px 20px;
  }

  .lt-lyric-line{
    font-size:16px;
  }

  .lt-lyric-line.active{
    font-size:20px;
  }

  .lt-player-controls{
    gap:7px;
    padding-top:8px;
  }

  .lt-ctrl-btn{
    width:42px;
    height:42px;
    border-radius:12px;
  }

  .lt-play-btn.big{
    width:64px;
    height:64px;
  }

  .lt-player-volume{
    margin-top:8px;
  }
}

@media(max-height:680px) and (max-width:650px){
  .lt-player-inner{
    padding-top:max(7px,env(safe-area-inset-top));
    padding-bottom:max(8px,env(safe-area-inset-bottom));
  }

  .lt-player-song{
    margin-top:4px;
  }

  .lt-cover-card{
    width:min(55vw,220px);
  }

  .lt-player-volume{
    margin-top:4px;
  }
}

@media(prefers-reduced-motion:reduce){
  .lt-cover-card.playing{
    animation:none;
  }
}
</style>
