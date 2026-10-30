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

function isMissingRelation(error: any) {
  return /schema cache|does not exist|relation .* does not exist/i.test(String(error?.message || error || ''))
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
      async function fetchPaged(table: string, select = '*', orderColumn = 'created_at') {
        const rows: any[] = []
        const pageSize = 500
        for (let offset = 0; ; offset += pageSize) {
          const result = await $supabase.from(table).select(select).eq('couple_id', coupleId).order(orderColumn, { ascending: true }).range(offset, offset + pageSize - 1)
          if (result.error) {
            if (isMissingRelation(result.error)) return []
            throw result.error
          }
          rows.push(...(result.data || []))
          if (!result.data || result.data.length < pageSize) return rows
        }
      }
      async function fetchOptionalPaged(table: string, select = '*', orderColumn = 'created_at') {
        try { return await fetchPaged(table, select, orderColumn) } catch (cause) {
          if (isMissingRelation(cause)) return []
          throw cause
        }
      }
      async function fetchPagedRpc(name: string) {
        const rows: any[] = []
        const pageSize = 500
        for (let offset = 0; ; offset += pageSize) {
          const result = await $supabase.rpc(name).range(offset, offset + pageSize - 1)
          if (result.error) {
            if (isMissingRelation(result.error)) return []
            throw result.error
          }
          rows.push(...(result.data || []))
          if (!result.data || result.data.length < pageSize) return rows
        }
      }
      const [memories, messages, albums, works, letters, moodCheckins, dailyQuestions, dailyAnswers, sharedEvents, musicRoomMessages, listeningSessions, voiceCapsules, callRecords, streakActions, storyLinks, futureLetters] = await Promise.all([
        fetchPaged('memories'),
        fetchPaged('messages', 'id,sender_id,content,media_path,media_type,media_poster_path,created_at,read_at'),
        fetchPaged('albums'),
        fetchPaged('ai_saved_works'),
        fetchPaged('couple_letters'),
        fetchOptionalPaged('mood_checkins', '*', 'mood_date'),
        fetchOptionalPaged('daily_questions', '*', 'question_date'),
        fetchOptionalPaged('daily_answers'),
        fetchOptionalPaged('shared_events', '*', 'event_date'),
        fetchOptionalPaged('music_room_messages'),
        fetchOptionalPaged('listening_sessions', '*', 'updated_at'),
        fetchOptionalPaged('voice_capsules'),
        fetchOptionalPaged('call_records', '*', 'started_at'),
        fetchOptionalPaged('streak_day_actions', '*', 'activity_date'),
        fetchOptionalPaged('story_share_links'),
        fetchPagedRpc('get_future_letters'),
      ])
      const albumIds = albums.map((item: any) => item.id).filter(Boolean)
      const photos: any[] = []
      for (let offset = 0; albumIds.length; offset += 500) {
        const result = await $supabase.from('album_photos').select('*').in('album_id', albumIds).order('taken_date', { ascending: true }).range(offset, offset + 499)
        if (result.error) throw result.error
        photos.push(...(result.data || []))
        if (!result.data || result.data.length < 500) break
      }
      const mediaPaths = [
        ...(memories || []).flatMap((item: any) => (Array.isArray(item.photos) ? item.photos : []).flatMap((photo: any) => [photo.path, photo.thumbPath, photo.mediumPath, photo.originalPath].filter(Boolean).map((path: string) => ({ bucket: 'memory-photos', path })))),
        ...photos.flatMap((item: any) => [item.path, item.thumb_path, item.medium_path, item.original_path, item.video_poster_path].filter(Boolean).map((path: string) => ({ bucket: 'album-media', path }))),
        ...(messages || []).flatMap((item: any) => [item.media_path, item.media_poster_path].filter(Boolean).map((path: string) => ({ bucket: 'message-media', path }))),
        ...(musicRoomMessages || []).filter((item: any) => item.audio_path).map((item: any) => ({ bucket: 'message-media', path: item.audio_path })),
        ...(voiceCapsules || []).filter((item: any) => item.audio_path).map((item: any) => ({ bucket: 'message-media', path: item.audio_path })),
      ].filter(item => item.path)
      const media = await Promise.all(mediaPaths.map(async item => ({ ...item, url: await createMediaSignedUrl($supabase, item.path, item.bucket) })))
      downloadJson(`love-home-export-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(),
        profile: profile.value,
        memories,
        messages,
        albums,
        albumPhotos: photos,
        aiWorks: works,
        letters,
        moodCheckins,
        dailyQuestions,
        dailyAnswers,
        sharedEvents,
        musicRoomMessages,
        listeningSessions,
        voiceCapsules,
        futureLetters,
        callRecords,
        streakActions,
        storyLinks,
        media,
      })
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
