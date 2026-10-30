export type FutureLetter = {
  id: string
  senderId: string
  recipientId: string
  title: string
  content: string
  unlockAt: string
  createdAt: string
  openedAt: string
  isUnlocked: boolean
}

const letters = ref<FutureLetter[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')

function mapLetter(row: any): FutureLetter {
  const unlockAt = String(row?.unlock_at || '')
  return {
    id: String(row?.id || crypto.randomUUID()),
    senderId: String(row?.sender_id || ''),
    recipientId: String(row?.recipient_id || ''),
    title: String(row?.title || '写给未来的信'),
    content: String(row?.content || ''),
    unlockAt,
    createdAt: String(row?.created_at || new Date().toISOString()),
    openedAt: String(row?.opened_at || ''),
    isUnlocked: Boolean(row?.is_unlocked) || Date.parse(unlockAt) <= Date.now(),
  }
}

function demoKey(coupleId: string) { return `couple-space-future-letters:${coupleId}` }

export function useFutureMailbox() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  function refreshLocalUnlockState() {
    letters.value = letters.value.map(letter => ({ ...letter, isUnlocked: letter.isUnlocked || Date.parse(letter.unlockAt) <= Date.now() }))
  }

  async function load() {
    if (!import.meta.client || loading.value) return
    loading.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        const raw = localStorage.getItem(demoKey(profile.value?.coupleId || 'demo'))
        letters.value = raw ? (JSON.parse(raw) as any[]).map(mapLetter) : []
        refreshLocalUnlockState()
        return
      }
      const { data, error: rpcError } = await $supabase.rpc('get_future_letters')
      if (rpcError) throw rpcError
      letters.value = (data || []).map(mapLetter)
    } catch (cause: any) {
      error.value = cause?.message || '未来信箱暂时无法打开'
    } finally {
      loading.value = false
    }
  }

  async function create(input: { recipientId: string; title: string; content: string; unlockAt: string }) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      if (!input.recipientId) throw new Error('请先等待另一半加入情侣空间')
      if (!input.title.trim()) throw new Error('请写一个信件标题')
      if (!input.content.trim()) throw new Error('请写下信件内容')
      const unlockAt = new Date(input.unlockAt).toISOString()
      if (Date.parse(unlockAt) <= Date.now()) throw new Error('解锁时间必须晚于现在')
      if (!$supabase || demoMode.value) {
        const item: FutureLetter = { id: crypto.randomUUID(), senderId: profile.value?.id || 'demo-user', recipientId: input.recipientId, title: input.title.trim(), content: input.content.trim(), unlockAt, createdAt: new Date().toISOString(), openedAt: '', isUnlocked: false }
        letters.value = [item, ...letters.value]
        localStorage.setItem(demoKey(profile.value?.coupleId || 'demo'), JSON.stringify(letters.value))
        return item
      }
      const { data, error: rpcError } = await $supabase.rpc('create_future_letter', { p_recipient_id: input.recipientId, p_title: input.title, p_content: input.content, p_unlock_at: unlockAt })
      if (rpcError) throw rpcError
      await load()
      return letters.value.find(letter => letter.id === data) || null
    } catch (cause: any) {
      error.value = cause?.message || '保存未来信失败'
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function markOpened(letter: FutureLetter) {
    if (!letter.isUnlocked || letter.openedAt) return
    letter.openedAt = new Date().toISOString()
    if (!$supabase || demoMode.value) {
      localStorage.setItem(demoKey(profile.value?.coupleId || 'demo'), JSON.stringify(letters.value))
      return
    }
    const { error: rpcError } = await $supabase.rpc('mark_future_letter_opened', { p_letter_id: letter.id })
    if (rpcError) { letter.openedAt = ''; throw rpcError }
  }

  async function remove(letter: FutureLetter) {
    if (letter.senderId !== profile.value?.id) throw new Error('只能删除自己写的信')
    if (!$supabase || demoMode.value) {
      letters.value = letters.value.filter(item => item.id !== letter.id)
      localStorage.setItem(demoKey(profile.value?.coupleId || 'demo'), JSON.stringify(letters.value))
      return
    }
    const { error: rpcError } = await $supabase.rpc('delete_future_letter', { p_letter_id: letter.id })
    if (rpcError) throw rpcError
    letters.value = letters.value.filter(item => item.id !== letter.id)
  }

  return { letters, loading, busy, error, load, create, markOpened, remove, refreshLocalUnlockState }
}
