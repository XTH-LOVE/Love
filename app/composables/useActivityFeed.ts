export type ActivityKind =
  | 'message'
  | 'memory'
  | 'photo'
  | 'album'
  | 'calendar'
  | 'list'
  | 'anniversary'
  | 'letter'
  | 'ai'
  | 'mood'
  | 'question'
  | 'voice'
  | 'music'
  | 'system'

export type ActivityTarget = '首页' | '悄悄话' | '时光' | '相册' | '清单' | '纪念日' | '日历' | '心动AI' | '一起听'

export type ActivityEvent = {
  id: string
  coupleId: string
  actorId: string
  kind: ActivityKind
  target: ActivityTarget
  entityId: string
  title: string
  body: string
  createdAt: string
}

const events = ref<ActivityEvent[]>([])
const loading = ref(false)
let activeCoupleId = ''
let activityChannel: any = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let intentionallyStopped = false
let startingPromise: Promise<void> | null = null

function mapRow(row: any): ActivityEvent {
  return {
    id: String(row?.id || ''),
    coupleId: String(row?.couple_id || ''),
    actorId: String(row?.actor_id || ''),
    kind: (row?.kind || 'system') as ActivityKind,
    target: (row?.target || '首页') as ActivityTarget,
    entityId: String(row?.entity_id || ''),
    title: String(row?.title || '空间有新动态'),
    body: String(row?.body || ''),
    createdAt: String(row?.created_at || new Date().toISOString()),
  }
}

function append(event: ActivityEvent) {
  if (!event.id || events.value.some(item => item.id === event.id)) return
  events.value = [event, ...events.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 150)
  if (import.meta.client) window.dispatchEvent(new CustomEvent('couple-space:activity', { detail: event }))
}

function clearReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function queueReconnect(start: () => Promise<void>) {
  if (intentionallyStopped || !activeCoupleId) return
  clearReconnect()
  const delay = Math.min(15000, Math.max(800, 1000 * 2 ** reconnectAttempt))
  reconnectAttempt = Math.min(reconnectAttempt + 1, 5)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void start()
  }, delay)
}

export function useActivityFeed() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  async function load() {
    if (!import.meta.client || loading.value) return false
    const coupleId = profile.value?.coupleId || ''
    if (!coupleId) return false
    loading.value = true
    try {
      if (!$supabase || demoMode.value) {
        const raw = localStorage.getItem(`couple-space-activity:${coupleId}`)
        events.value = raw ? JSON.parse(raw).map(mapRow) : []
        return true
      }
      const { data, error } = await $supabase
        .from('activity_events')
        .select('id, couple_id, actor_id, kind, target, entity_id, title, body, created_at')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
        .limit(150)
      if (error) throw error
      events.value = (data || []).map(mapRow)
      return true
    } catch {
      // Activity history is additive. A missing migration must not block the app.
      if (!$supabase || demoMode.value) events.value = []
      return false
    } finally {
      loading.value = false
    }
  }

  async function start() {
    const coupleId = profile.value?.coupleId || ''
    if (!coupleId) return
    if (activeCoupleId === coupleId && (activityChannel || startingPromise)) return startingPromise || undefined
    if (activityChannel && $supabase) await $supabase.removeChannel(activityChannel).catch(() => undefined)
    clearReconnect()
    activeCoupleId = coupleId
    intentionallyStopped = false
    startingPromise = (async () => {
      const available = await load()
      if (!$supabase || demoMode.value || !available) return

      const connect = async () => {
        if (!activeCoupleId || activityChannel || intentionallyStopped) return
        const channel = $supabase.channel(`activity-events:${activeCoupleId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'activity_events',
            filter: `couple_id=eq.${activeCoupleId}`,
          }, (payload: any) => append(mapRow(payload.new)))
        activityChannel = channel
        channel.subscribe((status: string) => {
          if (activityChannel !== channel) return
          if (status === 'SUBSCRIBED') {
            reconnectAttempt = 0
            void load()
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
            activityChannel = null
            void $supabase.removeChannel(channel).catch(() => undefined)
            queueReconnect(connect)
          }
        })
      }
      await connect()
    })()
    try {
      await startingPromise
    } finally {
      startingPromise = null
    }
  }

  async function stop() {
    intentionallyStopped = true
    clearReconnect()
    if (activityChannel && $supabase) await $supabase.removeChannel(activityChannel).catch(() => undefined)
    activityChannel = null
    activeCoupleId = ''
  }

  return { events, loading, load, start, stop }
}
