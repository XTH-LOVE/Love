export type EventType = 'date' | 'schedule' | 'class' | 'reminder' | 'birthday' | 'other'

export type SharedEvent = {
  id: string
  createdBy: string
  title: string
  description: string
  eventDate: string
  eventTime: string | null
  eventType: EventType
  location: string
  createdAt: string
}

export const EVENT_TYPES: { value: EventType; emoji: string; label: string }[] = [
  { value: 'date', emoji: '💕', label: '约会' },
  { value: 'schedule', emoji: '📅', label: '日程' },
  { value: 'class', emoji: '📚', label: '课程' },
  { value: 'reminder', emoji: '🔔', label: '提醒' },
  { value: 'birthday', emoji: '🎂', label: '生日' },
  { value: 'other', emoji: '📌', label: '其他' },
]

const events = ref<SharedEvent[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')

function mapEvent(row: any): SharedEvent {
  return {
    id: String(row?.id || ''),
    createdBy: String(row?.created_by || ''),
    title: String(row?.title || ''),
    description: String(row?.description || ''),
    eventDate: String(row?.event_date || ''),
    eventTime: row?.event_time ? String(row.event_time).slice(0, 5) : null,
    eventType: (row?.event_type || 'other') as EventType,
    location: String(row?.location || ''),
    createdAt: String(row?.created_at || new Date().toISOString()),
  }
}

function storageKey(coupleId: string) { return `couple-space-events:${coupleId}` }

export function useSharedCalendar() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  function getEventsForMonth(year: number, month: number): SharedEvent[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return events.value.filter(e => e.eventDate.startsWith(prefix)).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  }

  function getEventsForDate(dateStr: string): SharedEvent[] {
    return events.value.filter(e => e.eventDate === dateStr).sort((a, b) => (a.eventTime || '').localeCompare(b.eventTime || ''))
  }

  function getUpcomingEvents(limit = 5): SharedEvent[] {
    const today = new Date().toISOString().slice(0, 10)
    return events.value
      .filter(e => e.eventDate >= today)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTime || '').localeCompare(b.eventTime || ''))
      .slice(0, limit)
  }

  async function load() {
    if (!import.meta.client || loading.value) return
    loading.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        const raw = localStorage.getItem(storageKey(profile.value?.coupleId || 'demo'))
        events.value = raw ? (JSON.parse(raw) as any[]).map(mapEvent) : []
        return
      }
      const { data, error: fetchError } = await $supabase
        .from('shared_events')
        .select('*')
        .order('event_date', { ascending: true })
        .limit(200)
      if (fetchError) throw fetchError
      events.value = (data || []).map(mapEvent)
    } catch (cause: any) {
      error.value = cause?.message || '加载日历失败'
    } finally {
      loading.value = false
    }
  }

  async function createEvent(input: { title: string; description?: string; eventDate: string; eventTime?: string; eventType?: EventType; location?: string }) {
    if (busy.value) return
    if (!input.title.trim()) throw new Error('请输入标题')
    if (!input.eventDate) throw new Error('请选择日期')
    busy.value = true
    error.value = ''
    try {
      const userId = profile.value?.id || 'demo-user'
      const coupleId = profile.value?.coupleId || 'demo'

      if (!$supabase || demoMode.value) {
        const item: SharedEvent = {
          id: crypto.randomUUID(),
          createdBy: userId,
          title: input.title.trim(),
          description: (input.description || '').trim(),
          eventDate: input.eventDate,
          eventTime: input.eventTime || null,
          eventType: input.eventType || 'other',
          location: (input.location || '').trim(),
          createdAt: new Date().toISOString(),
        }
        events.value.push(item)
        events.value.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        localStorage.setItem(storageKey(coupleId), JSON.stringify(events.value))
        return item
      }

      const { data, error: insertError } = await $supabase
        .from('shared_events')
        .insert({
          couple_id: coupleId,
          created_by: userId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          event_date: input.eventDate,
          event_time: input.eventTime || null,
          event_type: input.eventType || 'other',
          location: input.location?.trim() || null,
        })
        .select()
        .single()
      if (insertError) throw insertError
      const mapped = mapEvent(data)
      events.value.push(mapped)
      events.value.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      return mapped
    } catch (cause: any) {
      error.value = cause?.message || '创建事件失败'
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function updateEvent(id: string, updates: Partial<Pick<SharedEvent, 'title' | 'description' | 'eventDate' | 'eventTime' | 'eventType' | 'location'>>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        const idx = events.value.findIndex(e => e.id === id)
        if (idx < 0) throw new Error('事件不存在')
        Object.assign(events.value[idx], updates)
        localStorage.setItem(storageKey(profile.value?.coupleId || 'demo'), JSON.stringify(events.value))
        return
      }
      const dbUpdates: any = {}
      if (updates.title !== undefined) dbUpdates.title = updates.title.trim()
      if (updates.description !== undefined) dbUpdates.description = updates.description.trim() || null
      if (updates.eventDate !== undefined) dbUpdates.event_date = updates.eventDate
      if (updates.eventTime !== undefined) dbUpdates.event_time = updates.eventTime || null
      if (updates.eventType !== undefined) dbUpdates.event_type = updates.eventType
      if (updates.location !== undefined) dbUpdates.location = updates.location.trim() || null

      const { error: updateError } = await $supabase.from('shared_events').update(dbUpdates).eq('id', id)
      if (updateError) throw updateError
      const idx = events.value.findIndex(e => e.id === id)
      if (idx >= 0) Object.assign(events.value[idx], updates)
    } catch (cause: any) {
      error.value = cause?.message || '更新失败'
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function deleteEvent(id: string) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        events.value = events.value.filter(e => e.id !== id)
        localStorage.setItem(storageKey(profile.value?.coupleId || 'demo'), JSON.stringify(events.value))
        return
      }
      const { error: delError } = await $supabase.from('shared_events').delete().eq('id', id)
      if (delError) throw delError
      events.value = events.value.filter(e => e.id !== id)
    } catch (cause: any) {
      error.value = cause?.message || '删除失败'
      throw cause
    } finally {
      busy.value = false
    }
  }

  return { events, loading, busy, error, load, createEvent, updateEvent, deleteEvent, getEventsForMonth, getEventsForDate, getUpcomingEvents }
}
