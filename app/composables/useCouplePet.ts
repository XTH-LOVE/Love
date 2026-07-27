export type CouplePet = {
  id: string
  coupleId: string
  name: string
  species: 'bunny' | 'cat' | 'puppy' | 'bear' | 'fox' | 'panda' | 'penguin' | 'hamster'
  level: number
  experience: number
  mood: number
  hunger: number
  skin: string
  accessories: string[]
  updatedAt: string
}

export type CoupleStreak = {
  id: string
  coupleId: string
  currentDays: number
  longestDays: number
  lastCompletedDate: string
  protectionCount: number
  level: number
  updatedAt: string
}
export type StreakActivityType = 'manual' | 'message' | 'photo' | 'video' | 'memory' | 'checklist' | 'letter' | 'ai' | 'pet' | 'other'
export type StreakAction = { userId: string; activityType: StreakActivityType; mood: number | null; note: string; createdAt: string }
export type PetReward = { rewardKey: string; rewardType: 'accessory' | 'furniture'; unlockedAt: string }
export type StreakMilestone = { days: number; rewardKey: string; achievedAt: string }

const pet = ref<CouplePet | null>(null)
const streak = ref<CoupleStreak | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const todayCompleted = ref(false)
const todayActionCount = ref(0)
const todayKey = ref('')
const streakNotice = ref('')
const todayActorIds = ref<string[]>([])
const todayActions = ref<StreakAction[]>([])
const petRewards = ref<PetReward[]>([])
const milestones = ref<StreakMilestone[]>([])
let realtimeChannel: any = null

const demoPet: CouplePet = { id: 'demo-pet', coupleId: 'demo', name: '小爱', species: 'bunny', level: 3, experience: 118, mood: 88, hunger: 76, skin: 'lavender', accessories: [], updatedAt: new Date().toISOString() }
const demoStreak: CoupleStreak = { id: 'demo-streak', coupleId: 'demo', currentDays: 7, longestDays: 12, lastCompletedDate: new Date().toISOString().slice(0, 10), protectionCount: 1, level: 2, updatedAt: new Date().toISOString() }

function mapPet(row: any): CouplePet { return { id: String(row.id), coupleId: String(row.couple_id), name: row.name || '小爱', species: ['bunny', 'cat', 'puppy', 'bear', 'fox', 'panda', 'penguin', 'hamster'].includes(row.species) ? row.species : 'bunny', level: Number(row.level || 1), experience: Number(row.experience || 0), mood: Number(row.mood ?? 80), hunger: Number(row.hunger ?? 80), skin: row.skin || 'lavender', accessories: Array.isArray(row.accessories) ? row.accessories : [], updatedAt: row.updated_at || new Date().toISOString() } }
function dateDistance(from: string, to: string) { if (!from || !to) return Number.POSITIVE_INFINITY; return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) }
function effectiveCurrentDays(lastCompletedDate: string, currentDays: number) { return dateDistance(lastCompletedDate, todayKey.value) <= 1 ? currentDays : 0 }
function mapStreak(row: any): CoupleStreak { const currentDays = Number(row.current_days || 0); return { id: String(row.id), coupleId: String(row.couple_id), currentDays: effectiveCurrentDays(row.last_completed_date || '', currentDays), longestDays: Number(row.longest_days || 0), lastCompletedDate: row.last_completed_date || '', protectionCount: Number(row.protection_count || 0), level: Number(row.level || 1), updatedAt: row.updated_at || new Date().toISOString() } }
function mapActions(rows: any[]): StreakAction[] { return (rows || []).map(row => ({ userId: String(row.user_id), activityType: (row.activity_type || 'manual') as StreakActivityType, mood: row.mood == null ? null : Number(row.mood), note: row.note || '', createdAt: row.created_at || new Date().toISOString() })) }
function mapRewards(rows: any[]): PetReward[] { return (rows || []).map(row => ({ rewardKey: String(row.reward_key), rewardType: row.reward_type === 'furniture' ? 'furniture' : 'accessory', unlockedAt: row.unlocked_at || new Date().toISOString() })) }
function mapMilestones(rows: any[]): StreakMilestone[] { return (rows || []).map(row => ({ days: Number(row.days || row.milestone_days || 0), rewardKey: String(row.reward_key || ''), achievedAt: row.achieved_at || new Date().toISOString() })) }
function saveDemo() { localStorage.setItem('couple-space-pet', JSON.stringify(pet.value)); localStorage.setItem('couple-space-streak', JSON.stringify(streak.value)); localStorage.setItem('couple-space-streak-today', todayCompleted.value ? '1' : '0') }

export function useCouplePet() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const moodLabel = computed(() => !pet.value ? '等待入住' : pet.value.mood >= 80 ? '开心发光' : pet.value.mood >= 55 ? '心情不错' : '想要抱抱')
  const hungerLabel = computed(() => !pet.value ? '准备中' : pet.value.hunger >= 70 ? '吃饱啦' : pet.value.hunger >= 40 ? '有点饿' : '肚子空空')
  const levelProgress = computed(() => pet.value ? Math.min(100, Math.round((pet.value.experience % 50) / 50 * 100)) : 0)

  async function subscribe() {
    if (!$supabase || demoMode.value || realtimeChannel || !profile.value?.coupleId) return
    realtimeChannel = $supabase.channel(`pet-streak:${profile.value.coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_pets', filter: `couple_id=eq.${profile.value.coupleId}` }, (payload: any) => { if (payload.new) pet.value = mapPet(payload.new) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_streaks', filter: `couple_id=eq.${profile.value.coupleId}` }, (payload: any) => {
        if (!payload.new) return
        streak.value = mapStreak(payload.new)
        if (todayKey.value && payload.new.last_completed_date === todayKey.value) {
          todayCompleted.value = true
          todayActionCount.value = Math.max(todayActionCount.value, 2)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'streak_day_actions', filter: `couple_id=eq.${profile.value.coupleId}` }, async (payload: any) => {
        if (!todayKey.value || payload.new?.activity_date !== todayKey.value) return
        const { data: rows, count } = await $supabase.from('streak_day_actions').select('user_id, activity_type, mood, note, created_at', { count: 'exact' }).eq('couple_id', profile.value.coupleId).eq('activity_date', todayKey.value)
        todayActionCount.value = Number(count || 0)
        todayActorIds.value = (rows || []).map((row: any) => String(row.user_id))
        todayActions.value = mapActions(rows || [])
        todayCompleted.value = todayActionCount.value >= 2
      })
      .subscribe()
  }

  async function load() {
    if (!import.meta.client || loading.value) return
    loading.value = true; error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        pet.value = JSON.parse(localStorage.getItem('couple-space-pet') || 'null') || demoPet
        streak.value = JSON.parse(localStorage.getItem('couple-space-streak') || 'null') || demoStreak
        todayKey.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
        todayCompleted.value = localStorage.getItem('couple-space-streak-today') === '1'
        todayActionCount.value = todayCompleted.value ? 2 : 0
        todayActorIds.value = todayCompleted.value ? [profile.value?.id || 'demo-user', 'demo-partner'] : []
        todayActions.value = todayCompleted.value ? [{ userId: profile.value?.id || 'demo-user', activityType: 'manual', mood: null, note: '', createdAt: new Date().toISOString() }] : []
        saveDemo(); return
      }
      const { data: status, error: statusError } = await $supabase.rpc('get_couple_streak_status')
      if (statusError) {
        // Keep older deployments usable until migration 016 is applied.
        const { data: petData, error: petError } = await $supabase.rpc('ensure_couple_pet')
        if (petError) throw petError
        pet.value = mapPet(Array.isArray(petData) ? petData[0] : petData)
        const { data: streakData, error: streakError } = await $supabase.from('couple_streaks').select('*').eq('couple_id', profile.value!.coupleId).maybeSingle()
        if (streakError) throw streakError
        todayKey.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
        streak.value = streakData ? mapStreak(streakData) : null
        const { count } = await $supabase.from('streak_day_actions').select('user_id', { count: 'exact', head: true }).eq('couple_id', profile.value!.coupleId).eq('activity_date', todayKey.value)
        todayActionCount.value = Number(count || 0)
        todayCompleted.value = todayActionCount.value >= 2
        todayActorIds.value = []
        todayActions.value = []
        await subscribe()
        return
      }
      todayKey.value = String(status?.today || '')
      todayActionCount.value = Number(status?.today_action_count || 0)
      todayActorIds.value = (status?.today_actor_ids || []).map((id: any) => String(id))
      todayActions.value = mapActions(status?.today_actions || [])
      petRewards.value = mapRewards(status?.rewards || [])
      milestones.value = mapMilestones(status?.milestones || [])
      if (!status?.today_actor_ids && profile.value?.coupleId && todayKey.value) {
        const { data: rows } = await $supabase.from('streak_day_actions').select('user_id, activity_type, mood, note, created_at').eq('couple_id', profile.value.coupleId).eq('activity_date', todayKey.value)
        todayActorIds.value = (rows || []).map((row: any) => String(row.user_id))
        todayActions.value = mapActions(rows || [])
      }
      todayCompleted.value = Boolean(status?.today_completed) || todayActionCount.value >= 2
      streak.value = status?.streak ? mapStreak(status.streak) : null
      pet.value = status?.pet ? mapPet(status.pet) : null
      await subscribe()
    } catch (e: any) { error.value = e?.message || '宠物和火花加载失败' } finally { loading.value = false }
  }

  async function recordActivity(activityType: StreakActivityType = 'manual', mood: number | null = null, note = '') {
    if (busy.value || todayCompleted.value) return
    busy.value = true; error.value = ''; streakNotice.value = ''
    try {
      if (!$supabase || demoMode.value) {
        if (!pet.value) pet.value = { ...demoPet }
        if (!streak.value) streak.value = { ...demoStreak }
        todayCompleted.value = true
        todayActionCount.value = 2
        todayKey.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
        todayActorIds.value = [profile.value?.id || 'demo-user', 'demo-partner']
        todayActions.value = [{ userId: profile.value?.id || 'demo-user', activityType, mood, note, createdAt: new Date().toISOString() }]
        if (streak.value) { streak.value.currentDays += 1; streak.value.longestDays = Math.max(streak.value.longestDays, streak.value.currentDays); streak.value.lastCompletedDate = todayKey.value }
        if (pet.value) { pet.value.experience += 5; pet.value.mood = Math.min(100, pet.value.mood + 8) }
        saveDemo(); return
      }
      let data: any
      const contextual = await $supabase.rpc('record_couple_activity_context', { p_activity_date: null, p_activity_type: activityType, p_mood: mood, p_note: note || null })
      if (contextual.error) {
        const legacy = await $supabase.rpc('record_couple_activity')
        if (legacy.error) throw legacy.error
        data = legacy.data
      } else data = contextual.data
      todayKey.value = String(data?.today || todayKey.value)
      todayActionCount.value = Number(data?.today_action_count || 0)
      todayActorIds.value = (data?.today_actor_ids || []).map((id: any) => String(id))
      todayActions.value = mapActions(data?.today_actions || [])
      if (data?.rewards) petRewards.value = mapRewards(data.rewards)
      if (data?.milestones) milestones.value = mapMilestones(data.milestones)
      if (data?.streak) streak.value = mapStreak(data.streak)
      if (data?.pet) pet.value = mapPet(data.pet)
      todayCompleted.value = Boolean(data?.today_completed) || todayActionCount.value >= 2
      if (data?.protection_used && data?.protection_earned) streakNotice.value = '本次使用了 1 次保护，也重新获得了 1 次保护'
      else if (data?.protection_used) streakNotice.value = '本次已使用 1 次火花保护'
      else if (data?.protection_earned) streakNotice.value = '连续 7 天达成，获得 1 次火花保护'
      if (data?.milestone_days) streakNotice.value = `连续 ${data.milestone_days} 天达成，宠物获得经验和新奖励`
    } catch (e: any) { error.value = e?.message || '续火花失败' } finally { busy.value = false }
  }

  async function updateStyle(nextSkin: string, nextAccessories: string[], nextSpecies = pet.value?.species || 'bunny') {
    if (busy.value) return
    busy.value = true; error.value = ''
    try {
      const skin = ['lavender', 'pink', 'mint', 'night'].includes(nextSkin) ? nextSkin : 'lavender'
      const accessories = nextAccessories.filter(item => ['crown', 'scarf', 'bow', 'flower'].includes(item)).slice(0, 3)
      const species = ['bunny', 'cat', 'puppy', 'bear', 'fox', 'panda', 'penguin', 'hamster'].includes(nextSpecies) ? nextSpecies : 'bunny'
      if (!$supabase || demoMode.value) { if (pet.value) { pet.value.skin = skin; pet.value.accessories = accessories; pet.value.species = species as CouplePet['species']; pet.value.updatedAt = new Date().toISOString(); saveDemo() }; return }
      const { data, error: rpcError } = await $supabase.rpc('update_couple_pet_style', { p_skin: skin, p_accessories: accessories, p_species: species })
      if (rpcError) throw rpcError
      if (data) pet.value = mapPet(data)
    } catch (e: any) { error.value = e?.message || '保存装扮失败' } finally { busy.value = false }
  }

  async function interact(action: 'feed' | 'play' | 'pet') {
    if (busy.value) return
    busy.value = true; error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        if (!pet.value) return
        pet.value.experience += action === 'play' ? 3 : 1
        if (action === 'feed') pet.value.hunger = Math.min(100, pet.value.hunger + 16)
        if (action === 'play') pet.value.mood = Math.min(100, pet.value.mood + 14)
        if (action === 'pet') pet.value.mood = Math.min(100, pet.value.mood + 7)
        pet.value.level = Math.min(100, Math.floor(pet.value.experience / 50) + 1); saveDemo(); return
      }
      const { data, error: rpcError } = await $supabase.rpc('interact_with_couple_pet', { p_action: action })
      if (rpcError) throw rpcError
      if (data) pet.value = mapPet(data)
    } catch (e: any) { error.value = e?.message || '宠物互动失败' } finally { busy.value = false }
  }

  async function disconnect() { if (realtimeChannel && $supabase) await $supabase.removeChannel(realtimeChannel); realtimeChannel = null }
  return { pet, streak, loading, busy, error, todayCompleted, todayActionCount, todayActorIds, todayActions, petRewards, milestones, streakNotice, moodLabel, hungerLabel, levelProgress, load, subscribe, recordActivity, interact, updateStyle, disconnect }
}
