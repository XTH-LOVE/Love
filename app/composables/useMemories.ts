export type MemoryPhoto = { path: string; thumbPath?: string; mediumPath?: string; originalPath?: string; url: string; originalUrl?: string; loadState?: 'pending'|'ready'|'error' }
export type MemoryComment = { id: string; userId: string; authorName: string; content: string; createdAt: string }
export type MemoryReaction = { count: number; reacted: boolean }
export type Memory = {
  id: string
  content: string
  memoryDate: string
  location: string
  photos: MemoryPhoto[]
  authorId: string
  authorName: string
  createdAt: string
  favoriteCount: number
  isFavorite: boolean
  reactions: Record<string, MemoryReaction>
  comments: MemoryComment[]
}
import { createMediaSignedUrl, createMediaSignedUrls, prepareImageVariants, uploadMediaResumable } from './useMediaUrls'
import { runQueuedUpload } from './useMediaUploadQueue'

const demoSeed: Memory[] = [
  {
    id: 'demo-1', content: '没有特别安排的一天，却成为了这个夏天最喜欢的傍晚。海风很轻，我们沿着海边走了很久。',
    memoryDate: '2026-07-06', location: '青岛 · 燕儿岛', authorId: 'demo-user', authorName:'我', createdAt: '2026-07-06T19:20:00Z',
    photos: [{ path: '', url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1000&q=84' }], favoriteCount: 0, isFavorite: false, reactions: {}, comments: [],
  },
  {
    id: 'demo-2', content: '周末临时决定去喝咖啡。交换了最近在听的歌，也写下了下一次旅行想去的地方。',
    memoryDate: '2026-06-28', location: '老城区 · 梧桐咖啡', authorId: 'demo-user', authorName:'我', createdAt: '2026-06-28T15:30:00Z',
    photos: [
      { path: '', url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=82' },
      { path: '', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82' },
    ], favoriteCount: 0, isFavorite: false, reactions: {}, comments: [],
  },
]

const memories = ref<Memory[]>([])
const memoriesLoaded = ref(false)
const memoriesLoading = ref(false)
const memoriesLoadingMore = ref(false)
const memoriesHasMore = ref(true)
let oldestMemoryCreatedAt = ''

const memorySelect = 'id, content, memory_date, location, photos, author_id, created_at, profiles!memories_author_id_fkey(display_name)'
const legacyOptimizationAttempted = new Set<string>()

export function useMemories() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const { recordActivity } = useCouplePet()

  function loadDemo() {
    const saved = localStorage.getItem('couple-space-memories')
    const rows = saved ? JSON.parse(saved) : demoSeed
    memories.value = (Array.isArray(rows) ? rows : []).map((memory: Memory) => ({ favoriteCount: 0, isFavorite: false, reactions: {}, comments: [], ...memory }))
    memoriesLoaded.value = true
  }

  function saveDemo() {
    localStorage.setItem('couple-space-memories', JSON.stringify(memories.value))
  }

  function bucketForPath(path: string) {
    return path.includes('/album-media/') || path.startsWith('album-media/') ? 'album-media' : 'memory-photos'
  }

  function mapMemoryRows(rows: any[]) {
    return rows.map((row: any) => ({
      id: row.id, content: row.content, memoryDate: row.memory_date, location: row.location || '',
      photos: (Array.isArray(row.photos) ? row.photos : []).map((photo: any) => {
        const path = photo?.path || ''
        return { path, thumbPath: photo?.thumbPath || '', mediumPath: photo?.mediumPath || '', originalPath: photo?.originalPath || path, url: photo?.url || '', originalUrl: photo?.originalUrl || '', loadState: photo?.url ? 'ready' as const : 'pending' as const }
      }),
      authorId: row.author_id, authorName: row.profiles?.display_name || '情侣成员', createdAt: row.created_at,
      favoriteCount: 0, isFavorite: false, reactions: {}, comments: [],
    })) as Memory[]
  }
  async function hydrateMemoryPhotoUrls(items: Memory[]) {
    const transform = { width: 640, height: 640, resize: 'contain' as const, quality: 68 }
    const entries = items.flatMap(memory => memory.photos.filter(photo => photo.path).map(photo => ({ memory, photo })))
    if (!$supabase || !entries.length) return
    const chunks: Array<Array<{ memory: Memory; photo: MemoryPhoto }>> = []
    for (let start = 0; start < entries.length; start += 12) chunks.push(entries.slice(start, start + 12))
    let nextChunk = 0
    const hydrateWorker = async () => {
      while (nextChunk < chunks.length) {
        const chunk = chunks[nextChunk++]!
        try {
          const requests = chunk.map(({ photo }) => ({ photo, path: photo.thumbPath || photo.path, bucket: bucketForPath(photo.thumbPath || photo.path) }))
          const urls = await createMediaSignedUrls($supabase, requests.map(item => ({ path: item.path, bucket: item.bucket, transform: item.photo.thumbPath ? undefined : transform })))
          chunk.forEach(({ photo }) => { const path = photo.thumbPath || photo.path; photo.url = urls.get(`${bucketForPath(path)}:${path}`) || ''; photo.loadState = photo.url ? 'ready' : 'error' })
        } catch {
          chunk.forEach(({ photo }) => { photo.url = ''; photo.loadState = 'error' })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, () => hydrateWorker()))
    for (const memory of items) for (const photo of memory.photos) if (photo.url && photo.path && !photo.thumbPath && !legacyOptimizationAttempted.has(photo.path)) {
      legacyOptimizationAttempted.add(photo.path)
      void optimizeLegacyPhoto(memory, photo)
    }
  }

  async function loadInteractions(items: Memory[]) {
    if (!$supabase || demoMode.value || !items.length || !profile.value?.coupleId) return
    const ids = items.map(item => item.id)
    try {
      const [favorites, reactions, comments] = await Promise.all([
        $supabase.from('memory_favorites').select('memory_id, user_id').in('memory_id', ids),
        $supabase.from('memory_reactions').select('memory_id, user_id, emoji').in('memory_id', ids),
        $supabase.from('memory_comments').select('id, memory_id, user_id, content, created_at').in('memory_id', ids).order('created_at', { ascending: false }),
      ])
      const favoriteRows = favorites.data || []
      const reactionRows = reactions.data || []
      const commentRows = comments.data || []
      items.forEach(memory => {
        const memoryFavorites = favoriteRows.filter((row: any) => row.memory_id === memory.id)
        memory.favoriteCount = memoryFavorites.length
        memory.isFavorite = memoryFavorites.some((row: any) => row.user_id === profile.value?.id)
        const map: Record<string, MemoryReaction> = {}
        reactionRows.filter((row: any) => row.memory_id === memory.id).forEach((row: any) => { const current = map[row.emoji] || { count: 0, reacted: false }; current.count += 1; current.reacted ||= row.user_id === profile.value?.id; map[row.emoji] = current })
        memory.reactions = map
        memory.comments = commentRows.filter((row: any) => row.memory_id === memory.id).slice(0, 6).map((row: any) => ({ id: row.id, userId: row.user_id, authorName: row.user_id === profile.value?.id ? '我' : 'TA', content: row.content, createdAt: row.created_at }))
      })
    } catch { /* The migration may not be deployed yet; media remains usable. */ }
  }
  async function optimizeLegacyPhoto(memory: Memory, photo: MemoryPhoto) {
    if (!$supabase || demoMode.value || !photo.url || photo.thumbPath) return
    const bucket = bucketForPath(photo.path)
    const base = photo.path.replace(/\.[^.]+$/, '')
    const paths = { thumb: `${base}/thumb.jpg`, medium: `${base}/medium.jpg` }
    try {
      const response = await fetch(photo.url)
      if (!response.ok) return
      const file = new File([await response.blob()], 'legacy-memory.jpg', { type: 'image/jpeg' })
      const variants = await prepareImageVariants(file)
      const results = await Promise.all([
        uploadMediaResumable($supabase, bucket, paths.thumb, variants.thumb, undefined, true),
        uploadMediaResumable($supabase, bucket, paths.medium, variants.medium, undefined, true),
      ])
      const failed = results.find(item => item.error)
      if (failed?.error) throw failed.error
      const photos = memory.photos.map(item => item === photo ? { ...item, thumbPath: paths.thumb, mediumPath: paths.medium, originalPath: item.path } : { path: item.path, thumbPath: item.thumbPath, mediumPath: item.mediumPath, originalPath: item.originalPath })
      const { error } = await $supabase.from('memories').update({ photos, updated_at: new Date().toISOString() }).eq('id', memory.id)
      if (error) throw error
      photo.thumbPath = paths.thumb; photo.mediumPath = paths.medium; photo.originalPath = photo.path
      photo.url = await createMediaSignedUrl($supabase, paths.thumb, bucket)
    } catch {
      await $supabase.storage.from(bucket).remove([paths.thumb, paths.medium]).catch(() => undefined)
    }
  }

  async function signedPhotos(items: { path: string }[] = []) {
    if (!$supabase || !items.length) return []
    const transform = { width: 640, height: 640, resize: 'contain' as const, quality: 68 }
    const urls = await createMediaSignedUrls($supabase, items.map(item => ({ path: item.path, bucket: bucketForPath(item.path), transform })))
    return items.map(item => ({ path: item.path, url: item.path ? urls.get(`${bucketForPath(item.path)}:${item.path}`) || '' : '' }))
  }

  async function loadMemories() {
    if (!import.meta.client || memoriesLoading.value) return
    memoriesLoading.value = true
    try {
      if (!$supabase || demoMode.value) { loadDemo(); return }
      const { data, error } = await $supabase.from('memories').select(memorySelect).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      memories.value = mapMemoryRows(data || [])
      void loadInteractions(memories.value)
      void hydrateMemoryPhotoUrls(memories.value).catch(() => undefined)
      memories.value.sort((a, b) => b.memoryDate.localeCompare(a.memoryDate) || b.createdAt.localeCompare(a.createdAt))
      oldestMemoryCreatedAt = data?.[data.length - 1]?.created_at || ''
      memoriesHasMore.value = (data || []).length === 20
      memoriesLoaded.value = true
    } finally { memoriesLoading.value = false }
  }

  async function loadMoreMemories() {
    if (!$supabase || demoMode.value || memoriesLoadingMore.value || !memoriesHasMore.value || !oldestMemoryCreatedAt) return
    memoriesLoadingMore.value = true
    try {
      const { data, error } = await $supabase.from('memories').select(memorySelect).lt('created_at', oldestMemoryCreatedAt).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      const page = mapMemoryRows(data || [])
      void loadInteractions(page)
      void hydrateMemoryPhotoUrls(page).catch(() => undefined)
      memories.value = [...memories.value, ...page].sort((a, b) => b.memoryDate.localeCompare(a.memoryDate) || b.createdAt.localeCompare(a.createdAt))
      oldestMemoryCreatedAt = data?.[data.length - 1]?.created_at || oldestMemoryCreatedAt
      memoriesHasMore.value = page.length === 20
    } finally { memoriesLoadingMore.value = false }
  }

  async function uploadPhotos(files: File[]) {
    if (!$supabase || demoMode.value) return Promise.all(files.map(file => new Promise<MemoryPhoto>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve({ path: '', url: reader.result as string }); reader.onerror = reject; reader.readAsDataURL(file)
    })))
    const results: MemoryPhoto[] = []
    const uploadedPaths: string[] = []
    try {
      for (const sourceFile of files) {
        const result = await runQueuedUpload(sourceFile, `时光 · ${sourceFile.name}`, async setProgress => {
          const variants = await prepareImageVariants(sourceFile); setProgress(25)
          const base = `${profile.value!.coupleId}/${crypto.randomUUID()}`
          const paths = { thumb: `${base}/thumb.jpg`, medium: `${base}/medium.jpg`, original: `${base}/original.jpg` }
          uploadedPaths.push(...Object.values(paths))
          const uploadResults = await Promise.all([
            uploadMediaResumable($supabase, 'memory-photos', paths.thumb, variants.thumb, value => setProgress(25 + Math.round(value * .16))),
            uploadMediaResumable($supabase, 'memory-photos', paths.medium, variants.medium, value => setProgress(41 + Math.round(value * .16))),
            uploadMediaResumable($supabase, 'memory-photos', paths.original, variants.original, value => setProgress(57 + Math.round(value * .2)), false),
          ])
          const failed = uploadResults.find(item => item.error); if (failed?.error) throw failed.error
          setProgress(82)
          return { path: paths.original, thumbPath: paths.thumb, mediumPath: paths.medium, originalPath: paths.original, url: await createMediaSignedUrl($supabase, paths.thumb, 'memory-photos') }
        }, { kind: 'memory', coupleId: profile.value!.coupleId, mediaType: sourceFile.type })
        results.push(result)
      }
    } catch (error) {
      if (uploadedPaths.length) await $supabase.storage.from('memory-photos').remove([...new Set(uploadedPaths)]).catch(() => undefined)
      throw error
    }
    return results
  }

  async function createMemory(input: Omit<Memory, 'id' | 'authorId' | 'authorName' | 'createdAt'>, files: File[]) {
    const uploadedPhotos = await uploadPhotos(files)
    const photos = [...input.photos, ...uploadedPhotos]
    if (!$supabase || demoMode.value) {
      memories.value.unshift({ ...input, photos, id: crypto.randomUUID(), authorId: profile.value?.id || 'demo-user',authorName:profile.value?.displayName||'我', createdAt: new Date().toISOString() })
      memories.value.sort((a, b) => b.memoryDate.localeCompare(a.memoryDate)); saveDemo(); void recordActivity('memory'); return
    }
    const { error } = await $supabase.from('memories').insert({ couple_id: profile.value!.coupleId, author_id: profile.value!.id, content: input.content, memory_date: input.memoryDate, location: input.location || null, photos: photos.map(({ path, thumbPath, mediumPath, originalPath }) => ({ path, thumbPath, mediumPath, originalPath })) })
    if (error) {
      const paths = [...new Set(uploadedPhotos.flatMap(photo => [photo.path, photo.thumbPath, photo.mediumPath, photo.originalPath]).filter(Boolean))]
      if (paths.length) await $supabase.storage.from('memory-photos').remove(paths).catch(() => undefined)
      throw error
    }
    await loadMemories(); void recordActivity('memory')
  }

  async function updateMemory(id: string, input: Omit<Memory, 'id' | 'authorId' | 'authorName' | 'createdAt'>, files: File[]) {
    const uploadedPhotos = await uploadPhotos(files)
    const photos = [...input.photos, ...uploadedPhotos]
    if (!$supabase || demoMode.value) {
      const index = memories.value.findIndex(item => item.id === id)
      if (index >= 0) memories.value[index] = { ...memories.value[index]!, ...input, photos }
      memories.value.sort((a, b) => b.memoryDate.localeCompare(a.memoryDate)); saveDemo(); void recordActivity('memory'); return
    }
    const { error } = await $supabase.from('memories').update({ content: input.content, memory_date: input.memoryDate, location: input.location || null, photos: photos.map(({ path, thumbPath, mediumPath, originalPath }) => ({ path, thumbPath, mediumPath, originalPath })), updated_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      const paths = [...new Set(uploadedPhotos.flatMap(photo => [photo.path, photo.thumbPath, photo.mediumPath, photo.originalPath]).filter(Boolean))]
      if (paths.length) await $supabase.storage.from('memory-photos').remove(paths).catch(() => undefined)
      throw error
    }
    await loadMemories(); void recordActivity('memory')
  }

  async function deleteMemory(memory: Memory) {
    if (!$supabase || demoMode.value) { memories.value = memories.value.filter(item => item.id !== memory.id); saveDemo(); return }
    const paths = [...new Set(memory.photos.flatMap(photo => [photo.path, photo.thumbPath, photo.mediumPath, photo.originalPath]).filter(Boolean))]
    if (paths.length) await $supabase.storage.from('memory-photos').remove(paths)
    const { error } = await $supabase.from('memories').delete().eq('id', memory.id)
    if (error) throw error
    memories.value = memories.value.filter(item => item.id !== memory.id)
  }

  function ensureInteractionState(memory: Memory) { memory.reactions ||= {}; memory.comments ||= []; memory.favoriteCount ||= 0 }
  async function toggleFavorite(memory: Memory) {
    ensureInteractionState(memory)
    const next = !memory.isFavorite; memory.isFavorite = next; memory.favoriteCount = Math.max(0, memory.favoriteCount + (next ? 1 : -1))
    if (!$supabase || demoMode.value || !profile.value?.coupleId) { saveDemo(); return }
    const query = $supabase.from('memory_favorites')
    const result = next ? await query.insert({ memory_id: memory.id, couple_id: profile.value.coupleId, user_id: profile.value.id }) : await query.delete().eq('memory_id', memory.id).eq('user_id', profile.value.id)
    if (result.error) { memory.isFavorite = !next; memory.favoriteCount = Math.max(0, memory.favoriteCount + (next ? -1 : 1)); throw result.error }
  }
  async function toggleReaction(memory: Memory, emoji: string) {
    ensureInteractionState(memory); const current = memory.reactions[emoji] || { count: 0, reacted: false }; const next = !current.reacted
    memory.reactions[emoji] = { count: Math.max(0, current.count + (next ? 1 : -1)), reacted: next }
    if (!$supabase || demoMode.value || !profile.value?.coupleId) { saveDemo(); return }
    const query = $supabase.from('memory_reactions')
    const result = next ? await query.insert({ memory_id: memory.id, couple_id: profile.value.coupleId, user_id: profile.value.id, emoji }) : await query.delete().eq('memory_id', memory.id).eq('user_id', profile.value.id).eq('emoji', emoji)
    if (result.error) { memory.reactions[emoji] = current; throw result.error }
  }
  async function addComment(memory: Memory, content: string) {
    const text = content.trim(); if (!text) return
    ensureInteractionState(memory)
    if (!$supabase || demoMode.value || !profile.value?.coupleId) { memory.comments.unshift({ id: crypto.randomUUID(), userId: profile.value?.id || 'demo-user', authorName: '我', content: text, createdAt: new Date().toISOString() }); memory.comments = memory.comments.slice(0, 6); saveDemo(); return }
    const { data, error } = await $supabase.from('memory_comments').insert({ memory_id: memory.id, couple_id: profile.value.coupleId, user_id: profile.value.id, content: text }).select('id, memory_id, user_id, content, created_at').single()
    if (error) throw error
    memory.comments.unshift({ id: data.id, userId: data.user_id, authorName: '我', content: data.content, createdAt: data.created_at }); memory.comments = memory.comments.slice(0, 6)
  }

  return { memories, memoriesLoaded, memoriesLoading, memoriesLoadingMore, memoriesHasMore, loadMemories, loadMoreMemories, createMemory, updateMemory, deleteMemory, toggleFavorite, toggleReaction, addComment }
}
