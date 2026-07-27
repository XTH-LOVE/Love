export type StreakHistoryDay = { date: string; count: number; actorIds: string[]; sources: string[] }
export type StreakHistoryEvent = { date: string; actorId: string; activityType: string; mood: number | null; note: string; createdAt: string }

const days = ref<StreakHistoryDay[]>([])
const events = ref<StreakHistoryEvent[]>([])
const milestones = ref<{ days: number; rewardKey: string; achievedAt: string }[]>([])
const rewards = ref<{ rewardKey: string; rewardType: string; unlockedAt: string }[]>([])
const month = ref('')
const loading = ref(false)
const error = ref('')

function monthKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(date).slice(0, 7)
}
function mapHistory(data: any) {
  month.value = String(data?.month || `${monthKey()}-01`).slice(0, 7)
  days.value = (data?.days || []).map((row: any) => ({ date: String(row.date), count: Number(row.count || 0), actorIds: (row.actor_ids || []).map((id: any) => String(id)), sources: (row.sources || []).map((source: any) => String(source)) }))
  events.value = (data?.events || []).map((row: any) => ({ date: String(row.date), actorId: String(row.actor_id), activityType: String(row.activity_type || 'manual'), mood: row.mood == null ? null : Number(row.mood), note: row.note || '', createdAt: row.created_at || '' }))
  milestones.value = (data?.milestones || []).map((row: any) => ({ days: Number(row.days || 0), rewardKey: String(row.reward_key || ''), achievedAt: row.achieved_at || '' }))
  rewards.value = (data?.rewards || []).map((row: any) => ({ rewardKey: String(row.reward_key || ''), rewardType: String(row.reward_type || ''), unlockedAt: row.unlocked_at || '' }))
}

export function useStreakHistory() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  async function load(targetMonth = month.value || monthKey()) {
    if (!import.meta.client || loading.value) return
    loading.value = true; error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        mapHistory({ month: `${targetMonth}-01`, days: [], events: [], milestones: [{ days: 3, rewardKey: 'pet-accessory-flower', achievedAt: new Date().toISOString() }], rewards: [{ rewardKey: 'pet-accessory-flower', rewardType: 'accessory', unlockedAt: new Date().toISOString() }] })
        return
      }
      const { data, error: rpcError } = await $supabase.rpc('get_couple_streak_history', { p_month: `${targetMonth}-01` })
      if (rpcError) throw rpcError
      mapHistory(data)
    } catch (e: any) {
      error.value = e?.message || '火花历史加载失败'
      if ($supabase && profile.value?.coupleId) {
        const start = `${targetMonth}-01`
        const next = new Date(`${start}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1)
        const { data } = await $supabase.from('streak_day_actions').select('activity_date,user_id,activity_type').eq('couple_id', profile.value.coupleId).gte('activity_date', start).lt('activity_date', next.toISOString().slice(0, 10))
        const grouped = new Map<string, StreakHistoryDay>()
        for (const row of data || []) { const key = String(row.activity_date); const current = grouped.get(key) || { date: key, count: 0, actorIds: [], sources: [] }; current.count += 1; if (!current.actorIds.includes(String(row.user_id))) current.actorIds.push(String(row.user_id)); if (!current.sources.includes(String(row.activity_type || 'manual'))) current.sources.push(String(row.activity_type || 'manual')); grouped.set(key, current) }
        days.value = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date)); month.value = targetMonth
      }
    } finally { loading.value = false }
  }
  return { days, events, milestones, rewards, month, loading, error, load }
}
