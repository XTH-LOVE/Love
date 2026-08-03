export type Album = { id: string; name: string; description: string; coverUrl: string; createdAt: string; photoCount: number }
export type GalleryPhoto = { id: string; path: string; thumbPath?: string; mediumPath?: string; originalPath?: string; videoPosterPath?: string; videoPosterUrl?: string; url: string; originalUrl?: string; loadState?: 'pending'|'ready'|'error'; takenDate: string; albumId: string; albumName: string; source: 'album' | 'memory'; caption: string; mediaType:'image'|'video'; uploadedBy:string; uploaderName:string; legacy:boolean }
import { createMediaSignedUrl, createMediaSignedUrls, createVideoPoster, prepareImageVariants, prepareVideoForUpload, uploadMediaResumable } from './useMediaUrls'
import { runQueuedUpload } from './useMediaUploadQueue'

const albums = ref<Album[]>([])
const albumPhotos = ref<GalleryPhoto[]>([])
const albumsLoading = ref(false);const albumPhotosLoadingMore = ref(false);const albumPhotosHasMore = ref(true);let oldestAlbumPhotoDate=''
const albumsLoaded = ref(false)
const ALBUM_PAGE_SIZE = 20
let albumRealtimeChannel: any = null

export function useAlbums() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const { memories, loadMemories } = useMemories()
  const { recordActivity } = useCouplePet()

  function demoLoad() {
    albums.value = JSON.parse(localStorage.getItem('couple-space-albums') || '[]')
    albumPhotos.value = JSON.parse(localStorage.getItem('couple-space-album-photos') || '[]')
  }
  function demoSave() { localStorage.setItem('couple-space-albums', JSON.stringify(albums.value)); localStorage.setItem('couple-space-album-photos', JSON.stringify(albumPhotos.value)) }
  function isAlbumPath(path: string) { return path.includes('/album-media/') || path.startsWith('album-media/') }
  const galleryImageTransform = { width: 640, height: 640, resize: 'contain' as const, quality: 68 }
  async function signedUrl(path: string, legacy = false, mediaType: 'image' | 'video' = 'image') { return createMediaSignedUrl($supabase, path, legacy && !isAlbumPath(path) ? 'memory-photos' : 'album-media', mediaType === 'image' ? galleryImageTransform : undefined) }


  function mapAlbumPhotoRows(rows: any[]) {
    return rows.map((row: any) => { const path = row.path || row.original_path || ''; const legacy=!path.includes('/album-media/'); const mediaType=row.media_type||'image'; return { id: row.id, path, thumbPath: row.thumb_path || '', mediumPath: row.medium_path || '', originalPath: row.original_path || path, videoPosterPath: row.video_poster_path || '', videoPosterUrl: '', url: '', loadState: 'pending' as const, takenDate: row.taken_date, albumId: row.album_id, albumName: row.albums?.name || '', source: 'album' as const, caption: row.caption || '', mediaType, uploadedBy: row.uploaded_by, uploaderName: row.profiles?.display_name||'情侣成员', legacy } })
  }
  // Video tiles should request the lightweight poster, never the original movie.
  // The original path is loaded only when the lightbox is opened.
  function displayPath(photo: GalleryPhoto) { return photo.mediaType === 'image' ? (photo.thumbPath || photo.path) : (photo.videoPosterPath || '') }
  function originalPath(photo: GalleryPhoto) { return photo.originalPath || photo.path }
  function photoNeedsTransform(photo: GalleryPhoto) { return photo.mediaType === 'image' && !photo.thumbPath }
  const albumPhotoSelect = 'id, path, thumb_path, medium_path, original_path, video_poster_path, taken_date, album_id, caption, media_type, uploaded_by, albums(name), profiles!album_photos_uploaded_by_fkey(display_name)'
  const legacyOptimizationAttempted = new Set<string>()
  async function fetchAlbumPhotoPage(build: (select: string) => any) {
    const first = await build(albumPhotoSelect)
    if (!first.error) return first
    // The app remains usable while a deployed project is waiting for 014_media_variants.sql.
    const status = Number(first.error?.status || first.error?.statusCode || 0)
    const code = String(first.error?.code || '')
    const message = String(first.error?.message || '').toLowerCase()
    const missingColumn = code === '42703' || code === 'PGRST204' || status === 400 || message.includes('column') || message.includes('video_poster_path')
    if (!missingColumn) return first
    return build('id, path, taken_date, album_id, caption, media_type, uploaded_by, albums(name), profiles!album_photos_uploaded_by_fkey(display_name)')
  }
  async function hydrateAlbumPhotoUrls(items: GalleryPhoto[]) {
    const imageTransform = galleryImageTransform
    // Resolve the first viewport independently so a slow item later in the
    // page cannot hold every gallery tile in a loading state.
    const chunks: GalleryPhoto[][] = []
    for (let start = 0; start < items.length; start += 12) chunks.push(items.slice(start, start + 12))
    let nextChunk = 0
    const hydrateWorker = async () => {
      while (nextChunk < chunks.length) {
        const chunk = chunks[nextChunk++]!
        try {
          const requests = chunk.map(photo => ({ photo, path: displayPath(photo), bucket: photo.legacy ? 'memory-photos' : 'album-media' }))
          const urls = await createMediaSignedUrls($supabase, requests.map(item => ({ path: item.path, bucket: item.bucket, transform: photoNeedsTransform(item.photo) ? imageTransform : undefined })))
          chunk.forEach(photo => { const path = displayPath(photo); photo.url = path ? (urls.get(`${photo.legacy ? 'memory-photos' : 'album-media'}:${path}`) || '') : ''; photo.videoPosterUrl = photo.mediaType === 'video' && photo.videoPosterPath ? photo.url : ''; photo.loadState = photo.url || (photo.mediaType === 'video' && !photo.videoPosterPath) ? 'ready' : 'error' })
        } catch {
          // Never leave a tile in the infinite pending state when a batch
          // request fails unexpectedly. The tile can be retried individually.
          chunk.forEach(photo => { photo.url = ''; photo.loadState = 'error' })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, () => hydrateWorker()))
    // Upgrade old rows after their existing image has rendered. This is
    // deliberately detached from the first paint and is safe to retry later.
    for (const photo of items) if (photo.url && photo.mediaType === 'image' && !photo.thumbPath && !legacyOptimizationAttempted.has(photo.path)) {
      legacyOptimizationAttempted.add(photo.path)
      void optimizeLegacyPhoto(photo)
    }
  }
  async function optimizeLegacyPhoto(photo: GalleryPhoto) {
    if (!$supabase || demoMode.value || !photo.url || photo.thumbPath || photo.mediaType !== 'image') return
    const bucket = photo.legacy ? 'memory-photos' : 'album-media'
    const base = photo.path.replace(/\.[^.]+$/, '')
    const paths = { thumb: `${base}/thumb.jpg`, medium: `${base}/medium.jpg` }
    try {
      const response = await fetch(photo.url)
      if (!response.ok) return
      const file = new File([await response.blob()], 'legacy-photo.jpg', { type: 'image/jpeg' })
      const variants = await prepareImageVariants(file)
      const results = await Promise.all([
        uploadMediaResumable($supabase, bucket, paths.thumb, variants.thumb, undefined, true),
        uploadMediaResumable($supabase, bucket, paths.medium, variants.medium, undefined, true),
      ])
      const failed = results.find(item => item.error)
      if (failed?.error) throw failed.error
      const { error } = await $supabase.from('album_photos').update({ thumb_path: paths.thumb, medium_path: paths.medium, original_path: photo.path }).eq('id', photo.id)
      if (error) throw error
      photo.thumbPath = paths.thumb; photo.mediumPath = paths.medium; photo.originalPath = photo.path
      photo.url = await createMediaSignedUrl($supabase, paths.thumb, bucket)
    } catch {
      await $supabase.storage.from(bucket).remove([paths.thumb, paths.medium]).catch(() => undefined)
    }
  }
  async function retryPhoto(photo: GalleryPhoto) {
    if (!photo.path) return
    photo.loadState = 'pending'
    const path = displayPath(photo)
    if (!path && photo.mediaType === 'video') { photo.loadState = 'ready'; return }
    const transform = photoNeedsTransform(photo) ? galleryImageTransform : undefined
    photo.url = await createMediaSignedUrl($supabase, path, photo.legacy ? 'memory-photos' : 'album-media', transform)
    photo.loadState = photo.url ? 'ready' : 'error'
  }
  async function loadAlbums(force = false) {
    if (!import.meta.client || albumsLoading.value || (albumsLoaded.value && !force)) return
    albumsLoading.value = true
    try {
      // The timeline and album query are independent; do not make the gallery wait for both.
      void loadMemories().catch(() => undefined)
      if (!$supabase || demoMode.value) { demoLoad(); albumsLoaded.value = true; return }
      const [{ data: albumRows, error: albumError }, { data: photoRows, error: photoError }] = await Promise.all([
        $supabase.from('albums').select('id, name, description, cover_path, created_at').order('created_at', { ascending: false }),
        fetchAlbumPhotoPage(select => $supabase.from('album_photos').select(select).order('taken_date', { ascending: false }).limit(ALBUM_PAGE_SIZE)),
      ])
      if (albumError) throw albumError; if (photoError) throw photoError
      albumPhotos.value = mapAlbumPhotoRows(photoRows || [])
      void hydrateAlbumPhotoUrls(albumPhotos.value).catch(() => undefined)
      oldestAlbumPhotoDate = albumPhotos.value[albumPhotos.value.length - 1]?.takenDate || ''
      albumPhotosHasMore.value = (photoRows || []).length === ALBUM_PAGE_SIZE
      const imageTransform = galleryImageTransform
      albums.value = (albumRows || []).map((row: any) => ({ id: row.id, name: row.name, description: row.description || '', coverUrl: '', createdAt: row.created_at, photoCount: albumPhotos.value.filter(photo => photo.albumId === row.id).length }))
      void (async () => {
        const imageTransform = galleryImageTransform
        const coverItems = (albumRows || []).filter((row: any) => row.cover_path).map((row: any) => ({ path: row.cover_path, bucket: 'album-media', transform: imageTransform }))
        const coverUrls = await createMediaSignedUrls($supabase, coverItems)
        const countEntries = await Promise.all((albumRows || []).map(async (row: any) => { const { count } = await $supabase.from('album_photos').select('id', { count: 'exact', head: true }).eq('album_id', row.id); return [row.id, count || 0] as const }))
        const photoCounts = new Map(countEntries)
        albums.value = albums.value.map(album => { const row = (albumRows || []).find((item: any) => item.id === album.id); return { ...album, coverUrl: row?.cover_path ? coverUrls.get(`album-media:${row.cover_path}`) || '' : '', photoCount: photoCounts.get(album.id) || 0 } })
      })().catch(() => undefined)
      albumsLoaded.value = true
    } finally { albumsLoading.value = false }
  }

  async function loadMorePhotos() {
    if (!$supabase || demoMode.value || albumPhotosLoadingMore.value || !albumPhotosHasMore.value || !oldestAlbumPhotoDate) return
    albumPhotosLoadingMore.value = true
    try {
      const { data, error } = await fetchAlbumPhotoPage(select => $supabase.from('album_photos').select(select).lt('taken_date', oldestAlbumPhotoDate).order('taken_date', { ascending: false }).limit(ALBUM_PAGE_SIZE))
      if (error) throw error
      const page = mapAlbumPhotoRows(data || [])
      albumPhotos.value = [...albumPhotos.value, ...page]
      void hydrateAlbumPhotoUrls(page).catch(() => undefined)
      oldestAlbumPhotoDate = page[page.length - 1]?.takenDate || oldestAlbumPhotoDate
      albumPhotosHasMore.value = page.length === ALBUM_PAGE_SIZE
    } finally { albumPhotosLoadingMore.value = false }
  }

  function adjustAlbumPhotoCount(albumId: string, delta: number) {
    albums.value = albums.value.map(album => album.id === albumId
      ? { ...album, photoCount: Math.max(0, album.photoCount + delta) }
      : album)
  }

  async function subscribeAlbumPhotos() {
    if (!$supabase || demoMode.value || albumRealtimeChannel || !profile.value?.coupleId) return
    const coupleId = profile.value.coupleId
    albumRealtimeChannel = $supabase.channel(`album-photos:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'album_photos' }, (payload: any) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new
        const id = String(row?.id || '')
        if (!id) return
        if (payload.eventType === 'DELETE') {
          const existing = albumPhotos.value.find(photo => photo.id === id)
          albumPhotos.value = albumPhotos.value.filter(photo => photo.id !== id)
          if (existing) adjustAlbumPhotoCount(existing.albumId, -1)
          return
        }
        // Re-query joined album/profile fields so both clients receive the same card metadata.
        void loadAlbums(true).catch(() => undefined)
      })
      .subscribe()
  }

  async function disconnectAlbumPhotos() {
    if (albumRealtimeChannel && $supabase) await $supabase.removeChannel(albumRealtimeChannel)
    albumRealtimeChannel = null
  }

  const memoryPhotos = computed<GalleryPhoto[]>(() => memories.value.flatMap(memory => memory.photos.map((photo, index) => ({ id: `${memory.id}-${index}`, path: photo.path, thumbPath: photo.thumbPath, mediumPath: photo.mediumPath, originalPath: photo.originalPath, url: photo.url, originalUrl: photo.originalUrl, loadState: photo.loadState, takenDate: memory.memoryDate, albumId: 'memories', albumName: '时光轴', source: 'memory' as const, caption: memory.content,mediaType:'image',uploadedBy:memory.authorId,uploaderName:memory.authorName||'情侣成员',legacy:!isAlbumPath(photo.path) }))))
  const allPhotos = computed(() => [...albumPhotos.value, ...memoryPhotos.value].sort((a, b) => b.takenDate.localeCompare(a.takenDate)))

  async function createAlbum(name: string, description: string) {
    if (!$supabase || demoMode.value) { albums.value.unshift({ id: crypto.randomUUID(), name, description, coverUrl: '', createdAt: new Date().toISOString(), photoCount: 0 }); demoSave(); return }
    const { error } = await $supabase.from('albums').insert({ couple_id: profile.value!.coupleId, created_by: profile.value!.id, name, description: description || null })
    if (error) throw error; await loadAlbums(true)
  }

  async function uploadToAlbum(albumId: string, files: File[], takenDate: string) {
    const album = albums.value.find(item => item.id === albumId)!
    const uploadedPaths: string[] = []
    try {
      for (const sourceFile of files) {
      if (!$supabase || demoMode.value) {
        const file = sourceFile
        const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(file) })
        albumPhotos.value.unshift({ id: crypto.randomUUID(), path: '', url, takenDate, albumId, albumName: album.name, source: 'album', caption: '',mediaType:file.type.startsWith('video/')?'video':'image',uploadedBy:profile.value?.id||'demo-user',uploaderName:profile.value?.displayName||'我',legacy:false }); continue
      }
      const result = await runQueuedUpload(sourceFile, `相册 · ${sourceFile.name}`, async setProgress => {
        if (sourceFile.type.startsWith('video/')) {
          const file = await prepareVideoForUpload(sourceFile); const poster = await createVideoPoster(file); setProgress(35)
          const mediaId = crypto.randomUUID(); const ext = file.name.split('.').pop()?.toLowerCase() || 'webm'; const path = `${profile.value!.coupleId}/album-media/${albumId}/${mediaId}.${ext}`; const posterPath = poster ? `${profile.value!.coupleId}/album-media/${albumId}/${mediaId}/poster.jpg` : ''
          const { error: uploadError } = await uploadMediaResumable($supabase, 'album-media', path, file, value => setProgress(35 + Math.round(value * .3))); uploadedPaths.push(path); if (uploadError) throw uploadError
          if (poster && posterPath) { const { error: posterError } = await uploadMediaResumable($supabase, 'album-media', posterPath, poster, value => setProgress(65 + Math.round(value * .08))); uploadedPaths.push(posterPath); if (posterError) throw posterError }
          setProgress(78)
          const { error } = await $supabase.from('album_photos').insert({ album_id: albumId, uploaded_by: profile.value!.id, path, original_path: path, video_poster_path: posterPath || null, taken_date: takenDate,media_type:'video' }); if (error) throw error
          if (!album.coverUrl) await $supabase.from('albums').update({ cover_path: posterPath || path }).eq('id', albumId)
          return path
        }
        const variants = await prepareImageVariants(sourceFile); setProgress(25)
        const base = `${profile.value!.coupleId}/album-media/${albumId}/${crypto.randomUUID()}`
        const paths = { thumb: `${base}/thumb.jpg`, medium: `${base}/medium.jpg`, original: `${base}/original.jpg` }
        uploadedPaths.push(...Object.values(paths))
        const uploadResults = await Promise.all([
          uploadMediaResumable($supabase, 'album-media', paths.thumb, variants.thumb, value => setProgress(25 + Math.round(value * .16))),
          uploadMediaResumable($supabase, 'album-media', paths.medium, variants.medium, value => setProgress(41 + Math.round(value * .16))),
          uploadMediaResumable($supabase, 'album-media', paths.original, variants.original, value => setProgress(57 + Math.round(value * .2))),
        ])
        const failed = uploadResults.find(item => item.error); if (failed?.error) throw failed.error
        setProgress(78)
        const { error } = await $supabase.from('album_photos').insert({ album_id: albumId, uploaded_by: profile.value!.id, path: paths.original, thumb_path: paths.thumb, medium_path: paths.medium, original_path: paths.original, taken_date: takenDate, media_type:'image' }); if (error) throw error
        if (!album.coverUrl) await $supabase.from('albums').update({ cover_path: paths.thumb }).eq('id', albumId)
        return paths.original
      }, { kind: 'album', coupleId: profile.value!.coupleId, albumId, takenDate, mediaType: sourceFile.type })
      uploadedPaths.push(result)
      }
    } catch (error) {
      if ($supabase && uploadedPaths.length) await $supabase.storage.from('album-media').remove([...new Set(uploadedPaths)]).catch(() => undefined)
      throw error
    }
    if (!$supabase || demoMode.value) { album.photoCount = albumPhotos.value.filter(photo => photo.albumId === albumId).length; album.coverUrl ||= albumPhotos.value.find(photo => photo.albumId === albumId)?.url || ''; demoSave() } else await loadAlbums(true); void recordActivity('photo')
  }

  async function deletePhoto(photo: GalleryPhoto) {
    if (photo.source === 'memory') throw new Error('时光轴照片请在对应回忆中编辑')
    if (!$supabase || demoMode.value) { albumPhotos.value = albumPhotos.value.filter(item => item.id !== photo.id); demoSave(); return }
    const paths = [...new Set([photo.path, photo.thumbPath, photo.mediumPath, photo.originalPath, photo.videoPosterPath].filter(Boolean))]
    if (paths.length) {
      const { error: storageError } = await $supabase.storage.from(photo.legacy ? 'memory-photos' : 'album-media').remove(paths)
      if (storageError) throw storageError
    }
    const { error } = await $supabase.from('album_photos').delete().eq('id', photo.id); if (error) throw error
    albumPhotos.value = albumPhotos.value.filter(item => item.id !== photo.id)
    adjustAlbumPhotoCount(photo.albumId, -1)
    await loadAlbums(true)
  }

  return { albums, allPhotos, albumsLoading, albumPhotosLoadingMore, albumPhotosHasMore, loadAlbums, loadMorePhotos, subscribeAlbumPhotos, disconnectAlbumPhotos, retryPhoto, createAlbum, uploadToAlbum, deletePhoto }
}
