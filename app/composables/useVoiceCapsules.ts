import { createMediaSignedUrls, createMediaSignedUrl, uploadMediaResumable } from './useMediaUrls'
import { runQueuedUpload } from './useMediaUploadQueue'

export type VoiceCapsuleCategory = 'today' | 'sleep' | 'miss' | 'blessing'
export type VoiceCapsule = {
  id: string
  authorId: string
  category: VoiceCapsuleCategory
  title: string
  audioPath: string
  audioUrl: string
  durationSeconds: number
  createdAt: string
}

const capsules = ref<VoiceCapsule[]>([])
const loading = ref(false)
const busy = ref(false)
const uploadProgress = ref(0)
const error = ref('')
let realtimeChannel: any = null

const categoryValues = new Set<VoiceCapsuleCategory>(['today', 'sleep', 'miss', 'blessing'])

function mapCapsule(row: any): VoiceCapsule {
  const category = String(row?.category || 'today') as VoiceCapsuleCategory
  return {
    id: String(row?.id || crypto.randomUUID()),
    authorId: String(row?.author_id || row?.authorId || ''),
    category: categoryValues.has(category) ? category : 'today',
    title: String(row?.title || '给你的声音'),
    audioPath: String(row?.audio_path || row?.audioPath || ''),
    audioUrl: String(row?.audio_url || row?.audioUrl || ''),
    durationSeconds: Math.max(1, Number(row?.duration_seconds || row?.durationSeconds || 1)),
    createdAt: String(row?.created_at || row?.createdAt || new Date().toISOString()),
  }
}

function localKey(coupleId: string) { return `couple-space-voice-capsules:${coupleId}` }

export function useVoiceCapsules() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  async function hydrateUrls(items: VoiceCapsule[]) {
    if (!$supabase || !items.length) return
    const urls = await createMediaSignedUrls($supabase, items.map(item => ({ path: item.audioPath, bucket: 'message-media' })), 86400)
    items.forEach(item => { item.audioUrl = urls.get(`message-media:${item.audioPath}`) || '' })
  }

  function loadDemo() {
    const raw = localStorage.getItem(localKey(profile.value?.coupleId || 'demo'))
    capsules.value = raw ? (JSON.parse(raw) as any[]).map(mapCapsule) : []
  }

  async function load(force = false) {
    if (!import.meta.client || loading.value || (!force && capsules.value.length)) return
    loading.value = true
    error.value = ''
    try {
      if (!$supabase || demoMode.value) { loadDemo(); return }
      if (!profile.value?.coupleId) { capsules.value = []; return }
      const { data, error: queryError } = await $supabase
        .from('voice_capsules')
        .select('id, author_id, category, title, audio_path, duration_seconds, created_at')
        .eq('couple_id', profile.value.coupleId)
        .order('created_at', { ascending: false })
        .limit(60)
      if (queryError) throw queryError
      capsules.value = (data || []).map(mapCapsule)
      await hydrateUrls(capsules.value)
    } catch (cause: any) {
      error.value = cause?.message || '声音胶囊暂时无法打开'
    } finally { loading.value = false }
  }

  async function create(input: { file: File; category: VoiceCapsuleCategory; title: string; durationSeconds: number }) {
    if (busy.value) return null
    busy.value = true
    uploadProgress.value = 0
    error.value = ''
    let path = ''
    try {
      const title = input.title.trim() || '给你的声音'
      const durationSeconds = Math.min(180, Math.max(1, Math.round(input.durationSeconds)))
      if (!$supabase || demoMode.value) {
        const audioUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(reader.error || new Error('声音读取失败'))
          reader.readAsDataURL(input.file)
        })
        const item: VoiceCapsule = { id: crypto.randomUUID(), authorId: profile.value?.id || 'demo-user', category: input.category, title, audioPath: '', audioUrl, durationSeconds, createdAt: new Date().toISOString() }
        capsules.value = [item, ...capsules.value]
        localStorage.setItem(localKey(profile.value?.coupleId || 'demo'), JSON.stringify(capsules.value))
        return item
      }
      if (!profile.value?.coupleId || !profile.value.id) throw new Error('请先进入情侣空间')
      const capsuleId = crypto.randomUUID()
      const extension = input.file.type.includes('mp4') ? 'm4a' : 'webm'
      path = `${profile.value.coupleId}/messages/voice-capsules/${capsuleId}.${extension}`
      await runQueuedUpload(input.file, `声音胶囊 · ${title}`, async setProgress => {
        const result = await uploadMediaResumable($supabase, 'message-media', path, input.file, value => { uploadProgress.value = value; setProgress(value) })
        if (result.error) throw result.error
        return path
      }, { kind: 'message', coupleId: profile.value.coupleId, mediaType: 'audio' })
      const { data, error: insertError } = await $supabase.from('voice_capsules').insert({
        couple_id: profile.value.coupleId,
        author_id: profile.value.id,
        category: input.category,
        title,
        audio_path: path,
        duration_seconds: durationSeconds,
      }).select('id, author_id, category, title, audio_path, duration_seconds, created_at').single()
      if (insertError) throw insertError
      const item = mapCapsule(data)
      item.audioUrl = await createMediaSignedUrl($supabase, path, 'message-media')
      capsules.value = [item, ...capsules.value]
      return item
    } catch (cause: any) {
      if (path && $supabase) await $supabase.storage.from('message-media').remove([path]).catch(() => undefined)
      error.value = cause?.message || '声音胶囊保存失败'
      throw cause
    } finally { busy.value = false; uploadProgress.value = 0 }
  }

  async function remove(item: VoiceCapsule) {
    if (item.authorId !== profile.value?.id && profile.value?.id !== 'demo-user') throw new Error('只能删除自己录下的声音')
    if (!$supabase || demoMode.value) {
      capsules.value = capsules.value.filter(value => value.id !== item.id)
      localStorage.setItem(localKey(profile.value?.coupleId || 'demo'), JSON.stringify(capsules.value))
      return
    }
    const { error: deleteError } = await $supabase.from('voice_capsules').delete().eq('id', item.id).eq('author_id', profile.value!.id)
    if (deleteError) throw deleteError
    if (item.audioPath) await $supabase.storage.from('message-media').remove([item.audioPath]).catch(() => undefined)
    capsules.value = capsules.value.filter(value => value.id !== item.id)
  }

  async function subscribe() {
    if (!$supabase || demoMode.value || realtimeChannel || !profile.value?.coupleId) return
    realtimeChannel = $supabase.channel(`voice-capsules:${profile.value.coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_capsules', filter: `couple_id=eq.${profile.value.coupleId}` }, () => { capsules.value = []; void load(true) })
      .subscribe()
  }

  async function disconnect() {
    if (realtimeChannel && $supabase) await $supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  return { capsules, loading, busy, uploadProgress, error, load, create, remove, subscribe, disconnect }
}
