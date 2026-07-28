import { daysUntil, useAnniversaries } from './useAnniversaries'
import { useCouplePet } from './useCouplePet'
import { useHeartAi, type AiSavedWork } from './useHeartAi'
import { useMediaUploadQueue, type UploadJob } from './useMediaUploadQueue'
import { useMessages } from './useMessages'
import type { Component } from 'vue'

export type NotificationType = 'message' | 'anniversary' | 'streak' | 'pet' | 'ai' | 'upload'
export type NotificationTarget = '首页' | '悄悄话' | '纪念日' | '宠物小屋' | '心动AI' | '相册' | '时光'
export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  body: string
  createdAt: string
  target: NotificationTarget
  read: boolean
  icon?: Component
}

const readIds = ref<string[]>([])
const aiWorks = ref<AiSavedWork[]>([])
const aiLoading = ref(false)
const initialized = ref(false)
const readStorageKey = 'couple-space-notification-read-v1'

function loadReadIds() {
  if (!import.meta.client) return
  try {
    const raw = JSON.parse(localStorage.getItem(readStorageKey) || '[]')
    readIds.value = Array.isArray(raw) ? raw.map(String).slice(-500) : []
  } catch { readIds.value = [] }
}

function persistReadIds() {
  if (!import.meta.client) return
  localStorage.setItem(readStorageKey, JSON.stringify(readIds.value.slice(-500)))
}

function isRead(id: string) { return readIds.value.includes(id) }
function markIds(ids: string[]) {
  const next = new Set(readIds.value)
  ids.forEach(id => next.add(id))
  readIds.value = [...next].slice(-500)
  persistReadIds()
}

function shortText(value: string, fallback: string) {
  const text = String(value || '').trim()
  return text ? (text.length > 72 ? `${text.slice(0, 72)}…` : text) : fallback
}

function uploadBody(job: UploadJob) {
  if (job.status === 'failed') return `${job.name} 上传失败，点击进入相册重试。`
  if (job.status === 'completed') return `${job.name} 已完成上传。`
  return `${job.name} 正在上传，当前进度 ${job.progress}%。`
}

export function useNotificationCenter() {
  const { profile } = useCoupleAuth()
  const { messages } = useMessages()
  const { anniversaries } = useAnniversaries()
  const { pet, streak, todayActionCount } = useCouplePet()
  const { loadWorks } = useHeartAi()
  const { jobs } = useMediaUploadQueue()

  if (import.meta.client && !initialized.value) {
    initialized.value = true
    loadReadIds()
  }

  async function refreshAiWorks() {
    if (aiLoading.value) return
    aiLoading.value = true
    try { aiWorks.value = await loadWorks() } catch { /* AI is optional; other notifications remain available. */ }
    finally { aiLoading.value = false }
  }

  const notifications = computed<AppNotification[]>(() => {
    const result: AppNotification[] = []
    const ownId = profile.value?.id
    messages.value
      .filter(message => message.senderId !== ownId && !message.readAt)
      .slice(-8)
      .reverse()
      .forEach(message => result.push({
        id: `message:${message.id}`,
        type: 'message',
        title: '新的悄悄话',
        body: shortText(message.content, message.mediaType === 'image' ? 'TA 发来了一张照片' : message.mediaType === 'video' ? 'TA 发来了一段视频' : message.mediaType === 'audio' ? 'TA 发来了一条语音' : 'TA 发来了一条消息'),
        createdAt: message.createdAt,
        target: '悄悄话',
        read: isRead(`message:${message.id}`),
      }))

    anniversaries.value
      .filter(event => daysUntil(event) <= 30)
      .slice(0, 3)
      .forEach(event => {
        const id = `anniversary:${event.id}:${new Date().getFullYear()}`
        result.push({ id, type: 'anniversary', title: event.title, body: daysUntil(event) === 0 ? '就是今天，记得给 TA 一个拥抱。' : `还有 ${daysUntil(event)} 天，一起期待这个特别的日子。`, createdAt: new Date().toISOString(), target: '纪念日', read: isRead(id) })
      })

    if (streak.value && !todayActionCount.value) {
      const id = `streak:${new Date().toISOString().slice(0, 10)}`
      result.push({ id, type: 'streak', title: '今天别忘了续火花', body: `已经连续 ${streak.value.currentDays} 天，和 TA 完成一次互动就能延续。`, createdAt: new Date().toISOString(), target: '宠物小屋', read: isRead(id) })
    }
    if (pet.value && (pet.value.mood < 45 || pet.value.hunger < 35)) {
      const id = `pet:${new Date().toISOString().slice(0, 10)}`
      result.push({ id, type: 'pet', title: `${pet.value.name} 想你了`, body: pet.value.hunger < 35 ? '小屋里的宠物有点饿，去喂它一下吧。' : '宠物的心情有点低落，去陪它玩一会儿吧。', createdAt: pet.value.updatedAt, target: '宠物小屋', read: isRead(id) })
    }

    aiWorks.value.slice(0, 4).forEach(work => {
      const id = `ai:${work.id}`
      result.push({ id, type: 'ai', title: work.kind === 'love_letter' ? '情书已保存' : work.kind === 'diary' ? '今日日记已保存' : '约会方案已保存', body: shortText(work.title || work.content, '点击查看 AI 内容'), createdAt: work.createdAt, target: '心动AI', read: isRead(id) })
    })

    jobs.value.filter(job => job.status === 'failed' || job.status === 'uploading' || job.status === 'retrying' || job.status === 'paused').slice(-6).reverse().forEach(job => {
      const id = `upload:${job.id}`
      result.push({ id, type: 'upload', title: job.status === 'failed' ? '上传失败' : '上传进行中', body: uploadBody(job), createdAt: job.createdAt, target: job.operation?.kind === 'message' ? '悄悄话' : job.operation?.kind === 'memory' ? '时光' : '相册', read: isRead(id) })
    })

    return result.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  })
  const unreadCount = computed(() => notifications.value.filter(item => !item.read).length)
  function markRead(id: string) { markIds([id]) }
  function markAllRead() { markIds(notifications.value.map(item => item.id)) }
  function clearReadHistory() { readIds.value = []; persistReadIds() }

  return { notifications, unreadCount, aiLoading, refreshAiWorks, markRead, markAllRead, clearReadHistory }
}
