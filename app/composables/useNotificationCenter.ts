import { daysUntil, useAnniversaries } from './useAnniversaries'
import { useHeartAi, type AiSavedWork } from './useHeartAi'
import { useMediaUploadQueue, type UploadJob } from './useMediaUploadQueue'
import { useMessages } from './useMessages'
import { useActivityFeed, type ActivityKind, type ActivityTarget } from './useActivityFeed'
import type { Component } from 'vue'

export type NotificationType = ActivityKind | 'upload'
export type NotificationTarget = ActivityTarget
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

function readStorageKey(coupleId?: string, userId?: string) {
  return `couple-space-notification-read-v1:${coupleId || userId || 'guest'}`
}

function loadReadIds(coupleId?: string, userId?: string) {
  if (!import.meta.client) return
  try {
    const raw = JSON.parse(localStorage.getItem(readStorageKey(coupleId, userId)) || '[]')
    readIds.value = Array.isArray(raw) ? raw.map(String).slice(-500) : []
  } catch { readIds.value = [] }
}

function persistReadIds(coupleId?: string, userId?: string) {
  if (!import.meta.client) return
  localStorage.setItem(readStorageKey(coupleId, userId), JSON.stringify(readIds.value.slice(-500)))
}

function isRead(id: string) { return readIds.value.includes(id) }
function markIds(ids: string[], coupleId?: string, userId?: string) {
  const next = new Set(readIds.value)
  ids.forEach(id => next.add(id))
  readIds.value = [...next].slice(-500)
  persistReadIds(coupleId, userId)
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
  const { loadWorks } = useHeartAi()
  const { jobs } = useMediaUploadQueue()
  const activity = useActivityFeed()
  let startedScope = ''

  if (import.meta.client && !initialized.value) {
    initialized.value = true
  }

  function currentScope() {
    return {
      coupleId: profile.value?.coupleId || '',
      userId: profile.value?.id || '',
    }
  }

  async function refreshAiWorks() {
    if (aiLoading.value) return
    aiLoading.value = true
    try { aiWorks.value = await loadWorks() } catch { /* AI is optional; other notifications remain available. */ }
    finally { aiLoading.value = false }
  }

  watch(() => `${profile.value?.coupleId || ''}:${profile.value?.id || ''}`, scopeKey => {
    const coupleId = profile.value?.coupleId || ''
    if (!coupleId) {
      startedScope = ''
      readIds.value = []
      void activity.stop()
      return
    }
    if (startedScope === scopeKey) return
    startedScope = scopeKey
    const scope = currentScope()
    loadReadIds(scope.coupleId, scope.userId)
    void activity.start()
    void refreshAiWorks()
  }, { immediate: true })

  const notifications = computed<AppNotification[]>(() => {
    const result: AppNotification[] = []
    const ownId = profile.value?.id
    const activityEntityIds = new Set<string>()

    activity.events.value
      .filter(event => event.actorId !== ownId)
      .forEach(event => {
        if (event.entityId) activityEntityIds.add(`${event.kind}:${event.entityId}`)
        result.push({
          id: `activity:${event.id}`,
          type: event.kind,
          title: event.title,
          body: shortText(event.body, '点击查看详情'),
          createdAt: event.createdAt,
          target: event.target,
          read: isRead(`activity:${event.id}`),
        })
      })

    messages.value
      .filter(message => message.senderId !== ownId && !message.readAt)
      .slice(-8)
      .reverse()
      .filter(message => !activityEntityIds.has(`message:${message.id}`))
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
      .filter(event => !activityEntityIds.has(`anniversary:${event.id}`))
      .forEach(event => {
        const id = `anniversary:${event.id}:${new Date().getFullYear()}`
        result.push({ id, type: 'anniversary', title: event.title, body: daysUntil(event) === 0 ? '就是今天，记得给 TA 一个拥抱。' : `还有 ${daysUntil(event)} 天，一起期待这个特别的日子。`, createdAt: new Date().toISOString(), target: '纪念日', read: isRead(id) })
      })

    aiWorks.value.slice(0, 8)
      .filter(work => !activityEntityIds.has(`ai:${work.id}`))
      .forEach(work => {
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
  function markRead(id: string) {
    const scope = currentScope()
    markIds([id], scope.coupleId, scope.userId)
  }
  function markAllRead() {
    const scope = currentScope()
    markIds(notifications.value.map(item => item.id), scope.coupleId, scope.userId)
  }
  function clearReadHistory() {
    const scope = currentScope()
    readIds.value = []
    persistReadIds(scope.coupleId, scope.userId)
  }

  return { notifications, unreadCount, aiLoading, activityEvents: activity.events, refreshAiWorks, markRead, markAllRead, clearReadHistory }
}
