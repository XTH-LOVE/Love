import { createMediaSignedUrl } from './useMediaUrls'

export type LoginDevice = { name: string; detail: string; current: boolean; lastSeen: string }

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function deviceName() {
  if (!import.meta.client) return '当前设备'
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'Android 手机'
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad'
  if (/Electron/i.test(ua)) return 'Windows 桌面端'
  return '浏览器设备'
}

export function useAccountSecurity() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode, signOut } = useCoupleAuth()
  const { members, unlinkCouple, loadMembers } = useAccountManagement()
  const working = ref(false)
  const error = ref('')
  const loginAnomaly = ref(false)

  async function exportData() {
    if (!$supabase || demoMode.value) {
      downloadJson(`love-home-export-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(), memories: JSON.parse(localStorage.getItem('couple-space-memories') || '[]'), messages: JSON.parse(localStorage.getItem('couple-space-messages') || '[]'), albums: JSON.parse(localStorage.getItem('couple-space-albums') || '[]'), photos: JSON.parse(localStorage.getItem('couple-space-album-photos') || '[]'),
      })
      return
    }
    working.value = true; error.value = ''
    try {
      const coupleId = profile.value?.coupleId
      if (!coupleId) throw new Error('请先进入情侣空间')
      const [memories, messages, albums, works, letters] = await Promise.all([
        $supabase.from('memories').select('*').eq('couple_id', coupleId).order('created_at'),
        $supabase.from('messages').select('id,sender_id,content,media_path,media_type,created_at,read_at').eq('couple_id', coupleId).order('created_at'),
        $supabase.from('albums').select('*').eq('couple_id', coupleId).order('created_at'),
        $supabase.from('ai_saved_works').select('*').eq('couple_id', coupleId).order('created_at'),
        $supabase.from('couple_letters').select('*').eq('couple_id', coupleId).order('created_at'),
      ])
      const albumIds = (albums.data || []).map((item: any) => item.id).filter(Boolean)
      const photos = albumIds.length
        ? await $supabase.from('album_photos').select('*').in('album_id', albumIds)
        : { data: [], error: null }
      if (memories.error) throw memories.error
      if (messages.error) throw messages.error
      if (albums.error) throw albums.error
      if (photos.error) throw photos.error
      if (works.error) throw works.error
      if (letters.error) throw letters.error
      const mediaPaths = [
        ...(memories.data || []).flatMap((item: any) => (Array.isArray(item.photos) ? item.photos : []).flatMap((photo: any) => [photo.path, photo.thumbPath, photo.mediumPath, photo.originalPath].filter(Boolean).map((path: string) => ({ bucket: 'memory-photos', path })))),
        ...(photos.data || []).flatMap((item: any) => [item.path, item.thumb_path, item.medium_path, item.original_path].filter(Boolean).map((path: string) => ({ bucket: 'album-media', path }))),
        ...(messages.data || []).filter((item: any) => item.media_path).map((item: any) => ({ bucket: 'message-media', path: item.media_path })),
      ].filter(item => item.path)
      const media = await Promise.all(mediaPaths.map(async item => ({ ...item, url: await createMediaSignedUrl($supabase, item.path, item.bucket) })))
      downloadJson(`love-home-export-${new Date().toISOString().slice(0, 10)}.json`, { exportedAt: new Date().toISOString(), profile: profile.value, memories: memories.data || [], messages: messages.data || [], albums: albums.data || [], albumPhotos: photos.data || [], aiWorks: works.data || [], letters: letters.data || [], media })
    } catch (e: any) { error.value = e.message || '导出失败' } finally { working.value = false }
  }

  async function deleteAccount() {
    if (!$supabase || demoMode.value) { localStorage.clear(); await signOut(); return }
    working.value = true; error.value = ''
    try {
      const { data, error: invokeError } = await $supabase.functions.invoke('account-security', { body: { action: 'delete-account', confirmation: '删除我的账户' } })
      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)
      await signOut()
    } catch (e: any) { error.value = e.message || '删除账户失败'; throw e } finally { working.value = false }
  }

  async function leaveCouple() {
    working.value = true; error.value = ''
    try { await unlinkCouple(); await loadMembers() } catch (e: any) { error.value = e.message || '注销情侣空间失败'; throw e } finally { working.value = false }
  }

  async function recordLoginDevice() {
    if (!$supabase || demoMode.value || !import.meta.client) return
    const key = `couple-space-login-device:${profile.value?.id || 'current'}`
    const current = `${navigator.platform}|${navigator.userAgent}`
    const previous = localStorage.getItem(key)
    loginAnomaly.value = Boolean(previous && previous !== current)
    localStorage.setItem(key, current)
    await $supabase.functions.invoke('account-security', { body: { action: 'login-anomaly', userAgent: navigator.userAgent } }).catch(() => undefined)
  }

  const devices = computed<LoginDevice[]>(() => [{ name: deviceName(), detail: import.meta.client ? navigator.platform : '当前会话', current: true, lastSeen: '刚刚活跃' }])
  return { working, error, loginAnomaly, devices, members, exportData, deleteAccount, leaveCouple, recordLoginDevice }
}
