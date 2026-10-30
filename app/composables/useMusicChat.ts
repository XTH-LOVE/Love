import { clearCachedMedia, createMediaSignedUrl } from './useMediaUrls'

export type MusicChatMessage = {
  id: string
  senderId: string
  kind: 'text' | 'audio'
  content: string
  audioPath: string
  audioDuration: number
  audioUrl: string
  createdAt: string
}

const messages = ref<MusicChatMessage[]>([])
const sending = ref(false)
const chatError = ref('')
const audioLoading = ref<Record<string, boolean>>({})
const audioErrors = ref<Record<string, string>>({})
let realtimeChannel: any = null

type MessageRow = {
  id: string
  sender_id: string
  kind: 'text' | 'audio'
  content: string | null
  audio_path: string | null
  audio_duration: number | null
  created_at: string
}

function mapRow(row: MessageRow): MusicChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    kind: row.kind === 'audio' ? 'audio' : 'text',
    content: row.content || '',
    audioPath: row.audio_path || '',
    audioDuration: row.audio_duration || 0,
    audioUrl: '',
    createdAt: row.created_at,
  }
}

function localKey(coupleId: string) {
  return `music-room-chat:${coupleId}`
}

/** 表不存在等错误转成用户能看懂的提示 */
function friendlyError(cause: any, fallback: string) {
  const msg = String(cause?.message || fallback)
  if (/schema cache|does not exist/i.test(msg)) return '聊天功能尚未开启：请先在 Supabase 控制台执行数据库迁移 027'
  return msg
}

export function useMusicChat() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  async function loadAudio(message: MusicChatMessage, force = false) {
    if (message.kind !== 'audio' || !message.audioPath || (!force && message.audioUrl) || !$supabase || demoMode.value) return Boolean(message.audioUrl)
    if (audioLoading.value[message.id]) return false
    audioLoading.value = { ...audioLoading.value, [message.id]: true }
    audioErrors.value = { ...audioErrors.value, [message.id]: '' }
    try {
      if (force) { message.audioUrl = ''; await clearCachedMedia(message.audioPath) }
      const url = await createMediaSignedUrl($supabase, message.audioPath, 'message-media')
      if (!url) throw new Error('语音地址获取失败')
      message.audioUrl = url
      return true
    } catch (cause: any) {
      audioErrors.value = { ...audioErrors.value, [message.id]: String(cause?.message || '语音加载失败，请重试') }
      return false
    } finally {
      const next = { ...audioLoading.value }
      delete next[message.id]
      audioLoading.value = next
    }
  }

  async function load() {
    try {
      chatError.value = ''
      if (!$supabase || demoMode.value) {
        const stored = localStorage.getItem(localKey(profile.value?.coupleId || 'demo'))
        messages.value = stored ? JSON.parse(stored) as MusicChatMessage[] : []
        return
      }
      if (!profile.value?.coupleId) { messages.value = []; return }
      const { data, error } = await $supabase
        .from('music_room_messages')
        .select('id, sender_id, kind, content, audio_path, audio_duration, created_at')
        .eq('couple_id', profile.value.coupleId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      messages.value = (data || []).map((row: MessageRow) => mapRow(row)).reverse()
    } catch (cause: any) {
      chatError.value = friendlyError(cause, '聊天暂时无法打开')
    }
  }

  function persistDemo() {
    localStorage.setItem(localKey(profile.value?.coupleId || 'demo'), JSON.stringify(messages.value.slice(-100)))
  }

  async function sendText(content: string) {
    const text = content.trim()
    if (!text || sending.value) return
    sending.value = true
    chatError.value = ''
    let tempId = ''
    try {
      if (!$supabase || demoMode.value) {
        messages.value = [...messages.value, {
          id: crypto.randomUUID(),
          senderId: profile.value?.id || 'demo-user',
          kind: 'text',
          content: text,
          audioPath: '',
          audioDuration: 0,
          audioUrl: '',
          createdAt: new Date().toISOString(),
        }]
        persistDemo()
        return
      }
      if (!profile.value?.coupleId || !profile.value.id) throw new Error('请先进入情侣空间')
      // 乐观回显：先本地显示，发送失败再撤回并提示
      tempId = `temp-${crypto.randomUUID()}`
      messages.value = [...messages.value, {
        id: tempId,
        senderId: profile.value.id,
        kind: 'text',
        content: text.slice(0, 500),
        audioPath: '',
        audioDuration: 0,
        audioUrl: '',
        createdAt: new Date().toISOString(),
      }]
      const { data, error } = await $supabase.from('music_room_messages').insert({
        couple_id: profile.value.coupleId,
        sender_id: profile.value.id,
        kind: 'text',
        content: text.slice(0, 500),
      }).select('id, sender_id, kind, content, audio_path, audio_duration, created_at').single()
      if (error) throw error
      if (data) messages.value = messages.value.map(item => item.id === tempId ? mapRow(data as MessageRow) : item)
    } catch (cause: any) {
      messages.value = messages.value.filter(m => m.id !== tempId)
      chatError.value = friendlyError(cause, '发送失败，请重试')
    } finally {
      sending.value = false
    }
  }

  async function sendVoice(file: Blob, durationSeconds: number) {
    if (sending.value) return
    sending.value = true
    chatError.value = ''
    let uploadedPath = ''
    try {
      const seconds = Math.min(60, Math.max(1, Math.round(durationSeconds)))
      if (!$supabase || demoMode.value) {
        const audioUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(reader.error || new Error('语音读取失败'))
          reader.readAsDataURL(file)
        })
        messages.value = [...messages.value, {
          id: crypto.randomUUID(),
          senderId: profile.value?.id || 'demo-user',
          kind: 'audio',
          content: '',
          audioPath: '',
          audioDuration: seconds,
          audioUrl,
          createdAt: new Date().toISOString(),
        }]
        persistDemo()
        return
      }
      if (!profile.value?.coupleId || !profile.value.id) throw new Error('请先进入情侣空间')
      const messageId = crypto.randomUUID()
      const extension = file.type.includes('mp4') ? 'm4a' : 'webm'
      const path = `${profile.value.coupleId}/messages/music-room/${messageId}.${extension}`
      const { error: uploadError } = await $supabase.storage.from('message-media')
        .upload(path, file, { contentType: file.type || 'audio/webm', upsert: false })
      if (uploadError) throw uploadError
      uploadedPath = path
      const { data, error: insertError } = await $supabase.from('music_room_messages').insert({
        couple_id: profile.value.coupleId,
        sender_id: profile.value.id,
        kind: 'audio',
        audio_path: path,
        audio_duration: seconds,
      }).select('id, sender_id, kind, content, audio_path, audio_duration, created_at').single()
      if (insertError) throw insertError
      if (data) messages.value = [...messages.value, mapRow(data as MessageRow)]
    } catch (cause: any) {
      if (uploadedPath && $supabase) await $supabase.storage.from('message-media').remove([uploadedPath]).catch(() => undefined)
      chatError.value = friendlyError(cause, '语音发送失败，请重试')
    } finally {
      sending.value = false
    }
  }

  async function subscribe() {
    if (!$supabase || demoMode.value || realtimeChannel || !profile.value?.coupleId) return
    realtimeChannel = $supabase.channel(`music-room-chat:${profile.value.coupleId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'music_room_messages', filter: `couple_id=eq.${profile.value.coupleId}` }, (payload: { new: MessageRow }) => {
        const item = mapRow(payload.new)
        if (!messages.value.some(existing => existing.id === item.id)) messages.value = [...messages.value, item].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'music_room_messages', filter: `couple_id=eq.${profile.value.coupleId}` }, (payload: { new: MessageRow }) => {
        const item = mapRow(payload.new)
        messages.value = messages.value.map(existing => existing.id === item.id ? { ...item, audioUrl: existing.audioUrl } : existing)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'music_room_messages', filter: `couple_id=eq.${profile.value.coupleId}` }, (payload: { old: MessageRow }) => {
        messages.value = messages.value.filter(existing => existing.id !== payload.old.id)
      })
      .subscribe()
  }

  async function disconnect() {
    if (realtimeChannel && $supabase) await $supabase.removeChannel(realtimeChannel).catch(() => undefined)
    realtimeChannel = null
  }

  return { messages, sending, chatError, audioLoading, audioErrors, load, loadAudio, subscribe, disconnect, sendText, sendVoice }
}
