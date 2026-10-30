export type MoodType = 'happy' | 'love' | 'calm' | 'sad' | 'angry' | 'anxious' | 'excited' | 'tired'

export type MoodCheckin = {
  id: string
  userId: string
  mood: MoodType
  note: string
  moodDate: string
  createdAt: string
}

export const MOOD_OPTIONS: { value: MoodType; emoji: string; label: string }[] = [
  { value: 'happy', emoji: '😊', label: '开心' },
  { value: 'love', emoji: '🥰', label: '甜蜜' },
  { value: 'calm', emoji: '😌', label: '平静' },
  { value: 'excited', emoji: '🤩', label: '兴奋' },
  { value: 'tired', emoji: '😴', label: '疲惫' },
  { value: 'sad', emoji: '😢', label: '难过' },
  { value: 'angry', emoji: '😤', label: '生气' },
  { value: 'anxious', emoji: '😰', label: '焦虑' },
]

const checkins = ref<MoodCheckin[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')

function mapCheckin(row: any): MoodCheckin {
  return {
    id: String(row?.id || ''),
    userId: String(row?.user_id || ''),
    mood: (row?.mood || 'calm') as MoodType,
    note: String(row?.note || ''),
    moodDate: String(row?.mood_date || new Date().toISOString().slice(0, 10)),
    createdAt: String(row?.created_at || new Date().toISOString()),
  }
}

function storageKey(coupleId: string) { return `couple-space-mood:${coupleId}` }

export function useMoodCheckin() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  function todayStr() { return new Date().toISOString().slice(0, 10) }

  function getMyTodayMood(): MoodCheckin | undefined {
    return checkins.value.find(c => c.userId === profile.value?.id && c.moodDate === todayStr())
  }

  function getPartnerTodayMood(partnerId?: string): MoodCheckin | undefined {
    if (!partnerId) return undefined
    return checkins.value.find(c => c.userId === partnerId && c.moodDate === todayStr())
  }

  function getRecentMoods(days = 7): MoodCheckin[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return checkins.value.filter(c => c.moodDate >= cutoffStr).sort((a, b) => b.moodDate.localeCompare(a.moodDate))
  }

  async function load() {
    if (!import.meta.client || loading.value) return
    loading.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        const raw = localStorage.getItem(storageKey(profile.value?.coupleId || 'demo'))
        checkins.value = raw ? (JSON.parse(raw) as any[]).map(mapCheckin) : []
        return
      }
      const { data, error: fetchError } = await $supabase
        .from('mood_checkins')
        .select('*')
        .order('mood_date', { ascending: false })
        .limit(60)
      if (fetchError) throw fetchError
      checkins.value = (data || []).map(mapCheckin)
    } catch (cause: any) {
      error.value = cause?.message || '加载心情签到失败'
    } finally {
      loading.value = false
    }
  }

  async function checkin(mood: MoodType, note = '') {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      const userId = profile.value?.id || 'demo-user'
      const coupleId = profile.value?.coupleId || 'demo'
      const moodDate = todayStr()

      if (!$supabase || demoMode.value) {
        const existing = checkins.value.findIndex(c => c.userId === userId && c.moodDate === moodDate)
        const item: MoodCheckin = { id: crypto.randomUUID(), userId, mood, note, moodDate, createdAt: new Date().toISOString() }
        if (existing >= 0) checkins.value[existing] = item
        else checkins.value.unshift(item)
        localStorage.setItem(storageKey(coupleId), JSON.stringify(checkins.value))
        return item
      }

      const { data, error: upsertError } = await $supabase
        .from('mood_checkins')
        .upsert({ couple_id: coupleId, user_id: userId, mood, note: note || null, mood_date: moodDate }, { onConflict: 'couple_id,user_id,mood_date' })
        .select()
        .single()
      if (upsertError) throw upsertError
      const mapped = mapCheckin(data)
      const existing = checkins.value.findIndex(c => c.id === mapped.id)
      if (existing >= 0) checkins.value[existing] = mapped
      else checkins.value.unshift(mapped)
      return mapped
    } catch (cause: any) {
      error.value = cause?.message || '签到失败'
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function removeMood(id: string) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        checkins.value = checkins.value.filter(c => c.id !== id)
        localStorage.setItem(storageKey(profile.value?.coupleId || 'demo'), JSON.stringify(checkins.value))
        return
      }
      const { error: delError } = await $supabase.from('mood_checkins').delete().eq('id', id)
      if (delError) throw delError
      checkins.value = checkins.value.filter(c => c.id !== id)
    } catch (cause: any) {
      error.value = cause?.message || '删除失败'
      throw cause
    } finally {
      busy.value = false
    }
  }

  return { checkins, loading, busy, error, load, checkin, removeMood, getMyTodayMood, getPartnerTodayMood, getRecentMoods }
}
