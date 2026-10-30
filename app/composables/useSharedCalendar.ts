import { expandCalendarOccurrences } from '~/utils/calendarOccurrences'

export type EventType = 'date' | 'schedule' | 'class' | 'reminder' | 'birthday' | 'other'

export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays'
export type EventStatus = 'planned' | 'done' | 'cancelled'
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
  repeatRule: RepeatRule
  repeatUntil: string
  reminderMinutes: number[]
  status: EventStatus
  budget: number | null
  memoryId: string
}
export type SharedEventTask = { id: string; eventId: string; coupleId: string; createdBy: string; title: string; completed: boolean; completedBy: string; createdAt: string }

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
const tasks = ref<SharedEventTask[]>([])
let calendarChannel: any = null
let reloadQueued = false

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
    repeatRule: (row?.repeat_rule || 'none') as RepeatRule,
    repeatUntil: String(row?.repeat_until || ''),
    reminderMinutes: Array.isArray(row?.reminder_minutes) ? row.reminder_minutes.map(Number).filter(Number.isFinite) : [],
    status: (row?.status || 'planned') as EventStatus,
    budget: row?.budget == null ? null : Number(row.budget),
    memoryId: String(row?.memory_id || ''),
  }
}

function storageKey(coupleId: string) { return `couple-space-events:${coupleId}` }
function taskStorageKey(coupleId: string) { return `couple-space-event-tasks:${coupleId}` }
function mapTask(row: any): SharedEventTask {
  return { id: String(row.id), eventId: String(row.event_id), coupleId: String(row.couple_id || ''), createdBy: String(row.created_by || ''), title: String(row.title || ''), completed: Boolean(row.completed), completedBy: String(row.completed_by || ''), createdAt: String(row.created_at || '') }
}

export function useSharedCalendar() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  function getEventsForMonth(year: number, month: number): SharedEvent[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    return expandEvents(start, end).filter(e => e.eventDate.startsWith(prefix)).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  }

  function getEventsForDate(dateStr: string): SharedEvent[] {
    const date = new Date(`${dateStr}T12:00:00`)
    return expandEvents(date, date).sort((a, b) => (a.eventTime || '').localeCompare(b.eventTime || ''))
  }

  function getUpcomingEvents(limit = 5): SharedEvent[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + 366)
    return expandEvents(today, horizon)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTime || '').localeCompare(b.eventTime || ''))
      .slice(0, limit)
  }

  function expandEvents(from: Date, to: Date) {
    return expandCalendarOccurrences(events.value, from, to) as SharedEvent[]
  }

  async function load() {
    if (!import.meta.client) return
    if (loading.value) { reloadQueued = true; return }
    loading.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        const raw = localStorage.getItem(storageKey(profile.value?.coupleId || 'demo'))
        events.value = raw ? (JSON.parse(raw) as any[]).map(mapEvent) : []
        const savedTasks = localStorage.getItem(taskStorageKey(profile.value?.coupleId || 'demo'))
        tasks.value = savedTasks ? JSON.parse(savedTasks).map(mapTask) : []
        return
      }
      const { data, error: fetchError } = await $supabase
        .from('shared_events')
        .select('*')
        .order('event_date', { ascending: true })
        .limit(200)
      if (fetchError) throw fetchError
      events.value = (data || []).map(mapEvent)
      const taskResult = await $supabase.from('shared_event_tasks').select('*').order('created_at')
      if (taskResult.error && !String(taskResult.error.message).includes('shared_event_tasks')) throw taskResult.error
      tasks.value = (taskResult.data || []).map(mapTask)
    } catch (cause: any) {
      error.value = cause?.message || '加载日历失败'
    } finally {
      loading.value = false
      if (reloadQueued) {
        reloadQueued = false
        void load()
      }
    }
  }

  async function createEvent(input: { title: string; description?: string; eventDate: string; eventTime?: string; eventType?: EventType; location?: string; repeatRule?: RepeatRule; repeatUntil?: string; reminderMinutes?: number[]; status?: EventStatus; budget?: number | null; memoryId?: string }) {
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
          createdAt: new Date().toISOString(), repeatRule: input.repeatRule || 'none', repeatUntil: input.repeatUntil || '', reminderMinutes: input.reminderMinutes || [], status: input.status || 'planned', budget: input.budget ?? null, memoryId: input.memoryId || '',
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
          repeat_rule: input.repeatRule || 'none',
          repeat_until: input.repeatUntil || null,
          reminder_minutes: input.reminderMinutes || [],
          status: input.status || 'planned',
          budget: input.budget ?? null,
          memory_id: input.memoryId || null,
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

  async function updateEvent(id: string, updates: Partial<Pick<SharedEvent, 'title' | 'description' | 'eventDate' | 'eventTime' | 'eventType' | 'location' | 'repeatRule' | 'repeatUntil' | 'reminderMinutes' | 'status' | 'budget' | 'memoryId'>>) {
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
      if (updates.repeatRule !== undefined) dbUpdates.repeat_rule = updates.repeatRule
      if (updates.repeatUntil !== undefined) dbUpdates.repeat_until = updates.repeatUntil || null
      if (updates.reminderMinutes !== undefined) dbUpdates.reminder_minutes = updates.reminderMinutes
      if (updates.status !== undefined) dbUpdates.status = updates.status
      if (updates.budget !== undefined) dbUpdates.budget = updates.budget
      if (updates.memoryId !== undefined) dbUpdates.memory_id = updates.memoryId || null

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

  async function addTask(eventId: string, title: string) {
    const text = title.trim()
    if (!text) throw new Error('请输入待办内容')
    const event = events.value.find(item => item.id === eventId)
    if (!event) throw new Error('日程不存在')
    const coupleId = profile.value?.coupleId || 'demo'
    if (!$supabase || demoMode.value) {
      tasks.value.push({ id: crypto.randomUUID(), eventId, coupleId, createdBy: profile.value?.id || 'demo-user', title: text, completed: false, completedBy: '', createdAt: new Date().toISOString() })
      localStorage.setItem(taskStorageKey(coupleId), JSON.stringify(tasks.value))
      return
    }
    const { data, error: insertError } = await $supabase.from('shared_event_tasks').insert({ event_id: eventId, couple_id: coupleId, created_by: profile.value!.id, title: text }).select().single()
    if (insertError) throw insertError
    tasks.value.push(mapTask(data))
  }

  async function toggleTask(task: SharedEventTask) {
    const next = !task.completed
    if (!$supabase || demoMode.value) {
      task.completed = next
      task.completedBy = next ? profile.value?.id || 'demo-user' : ''
      localStorage.setItem(taskStorageKey(profile.value?.coupleId || 'demo'), JSON.stringify(tasks.value))
      return
    }
    const { error: updateError } = await $supabase.from('shared_event_tasks').update({ completed: next, completed_by: next ? profile.value!.id : null, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (updateError) throw updateError
    task.completed = next
    task.completedBy = next ? profile.value!.id : ''
  }

  async function deleteTask(id: string) {
    if (!$supabase || demoMode.value) {
      tasks.value = tasks.value.filter(item => item.id !== id)
      localStorage.setItem(taskStorageKey(profile.value?.coupleId || 'demo'), JSON.stringify(tasks.value))
      return
    }
    const { error: deleteError } = await $supabase.from('shared_event_tasks').delete().eq('id', id)
    if (deleteError) throw deleteError
    tasks.value = tasks.value.filter(item => item.id !== id)
  }

  function startRealtime() {
    if (!$supabase || demoMode.value || !profile.value?.coupleId || calendarChannel) return
    const coupleId = profile.value.coupleId
    calendarChannel = $supabase.channel(`shared-calendar:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_events', filter: `couple_id=eq.${coupleId}` }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_event_tasks', filter: `couple_id=eq.${coupleId}` }, () => { void load() })
      .subscribe()
  }

  function stopRealtime() {
    if (calendarChannel && $supabase) void $supabase.removeChannel(calendarChannel)
    calendarChannel = null
  }

  return { events, tasks, loading, busy, error, load, createEvent, updateEvent, deleteEvent, addTask, toggleTask, deleteTask, startRealtime, stopRealtime, getEventsForMonth, getEventsForDate, getUpcomingEvents }
}
