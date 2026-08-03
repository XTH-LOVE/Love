import { createMediaSignedUrl, mediaBucketForPath } from './useMediaUrls'

export type EasterEgg = {
  id: string
  createdBy: string
  secretHash: string
  title: string
  content: string
  mediaPath: string
  mediaType: 'image' | 'video' | ''
  mediaUrl: string
  audioPath: string
  audioUrl: string
  createdAt: string
}

const egg = ref<EasterEgg | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')

function localKey(coupleId: string) { return `couple-space-easter-egg:${coupleId}` }
function normalizeSecret(value: string) { return value.trim().toLocaleLowerCase().replace(/\s+/g, '') }

async function hashSecret(value: string) {
  const normalized = normalizeSecret(value)
  if (!normalized) return ''
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(normalized)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  }
  // Local demo fallback only; hosted browsers support SubtleCrypto.
  let hash = 2166136261
  for (const char of normalized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `demo-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function mapEgg(row: any): EasterEgg {
  const mediaType = String(row?.media_type || row?.mediaType || '')
  return {
    id: String(row?.id || crypto.randomUUID()),
    createdBy: String(row?.created_by || row?.createdBy || ''),
    secretHash: String(row?.secret_hash || row?.secretHash || ''),
    title: String(row?.title || '只属于我们的秘密'),
    content: String(row?.content || ''),
    mediaPath: String(row?.media_path || row?.mediaPath || ''),
    mediaType: mediaType === 'image' || mediaType === 'video' ? mediaType : '',
    mediaUrl: String(row?.media_url || row?.mediaUrl || ''),
    audioPath: String(row?.audio_path || row?.audioPath || ''),
    audioUrl: String(row?.audio_url || row?.audioUrl || ''),
    createdAt: String(row?.created_at || row?.createdAt || new Date().toISOString()),
  }
}

export function useEasterEgg() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  async function hydrateMedia(item: EasterEgg) {
    if (!$supabase) return item
    if (item.mediaPath) item.mediaUrl = await createMediaSignedUrl($supabase, item.mediaPath, mediaBucketForPath(item.mediaPath), item.mediaType === 'image' ? { width: 1600, height: 1200, resize: 'contain', quality: 86 } : undefined)
    if (item.audioPath) item.audioUrl = await createMediaSignedUrl($supabase, item.audioPath, 'message-media')
    return item
  }

  async function load() {
    if (!import.meta.client || loading.value) return
    loading.value = true; error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        const raw = localStorage.getItem(localKey(profile.value?.coupleId || 'demo'))
        egg.value = raw ? mapEgg(JSON.parse(raw)) : null
        return
      }
      if (!profile.value?.coupleId) { egg.value = null; return }
      const { data, error: queryError } = await $supabase.from('couple_easter_eggs').select('id, created_by, secret_hash, title, content, media_path, media_type, audio_path, created_at').eq('couple_id', profile.value.coupleId).maybeSingle()
      if (queryError) throw queryError
      egg.value = data ? await hydrateMedia(mapEgg(data)) : null
    } catch (cause: any) { error.value = cause?.message || '秘密彩蛋暂时无法打开' }
    finally { loading.value = false }
  }

  async function save(input: { secret: string; title: string; content: string; mediaPath?: string; mediaType?: 'image' | 'video' | ''; mediaUrl?: string; audioPath?: string; audioUrl?: string }) {
    if (busy.value) return null
    const secretHash = await hashSecret(input.secret)
    if (secretHash.length < 8) throw new Error('暗号至少需要 2 个字符')
    if (!input.content.trim()) throw new Error('请写下彩蛋内容')
    busy.value = true; error.value = ''
    try {
      const payload = { title: input.title.trim() || '只属于我们的秘密', content: input.content.trim(), mediaPath: input.mediaPath || '', mediaType: input.mediaType || '', mediaUrl: input.mediaUrl || '', audioPath: input.audioPath || '', audioUrl: input.audioUrl || '' }
      if (!$supabase || demoMode.value) {
        const item: EasterEgg = { id: crypto.randomUUID(), createdBy: profile.value?.id || 'demo-user', secretHash, ...payload, mediaUrl: '', audioUrl: '', createdAt: new Date().toISOString() }
        egg.value = item
        localStorage.setItem(localKey(profile.value?.coupleId || 'demo'), JSON.stringify(item))
        return item
      }
      if (!profile.value?.coupleId || !profile.value.id) throw new Error('请先进入情侣空间')
      const { data, error: saveError } = await $supabase.from('couple_easter_eggs').upsert({ couple_id: profile.value.coupleId, created_by: profile.value.id, secret_hash: secretHash, title: payload.title, content: payload.content, media_path: payload.mediaPath || null, media_type: payload.mediaType || null, audio_path: payload.audioPath || null }, { onConflict: 'couple_id' }).select('id, created_by, secret_hash, title, content, media_path, media_type, audio_path, created_at').single()
      if (saveError) throw saveError
      egg.value = await hydrateMedia(mapEgg(data))
      return egg.value
    } catch (cause: any) { error.value = cause?.message || '彩蛋保存失败'; throw cause }
    finally { busy.value = false }
  }

  async function verify(secret: string) { return Boolean(egg.value?.secretHash && (await hashSecret(secret)) === egg.value.secretHash) }
  function clear() { egg.value = null; error.value = '' }
  return { egg, loading, busy, error, load, save, verify, clear, hashSecret }
}
