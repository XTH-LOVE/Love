<script setup lang="ts">
import { Bell, CalendarDays, CheckCheck, MessageCircleHeart, RefreshCw, Sparkles, Upload, X } from '@lucide/vue'
import type { AppNotification, NotificationTarget } from '~/composables/useNotificationCenter'
import { useGSAP } from '~/composables/useGSAP'
import { useMotionSettings } from '~/composables/useMotionSettings'

defineProps<{ notifications: AppNotification[]; unreadCount: number; loading?: boolean }>()
const emit = defineEmits<{ close: []; read: [id: string]; readAll: []; navigate: [target: NotificationTarget]; refresh: [] }>()
const notificationRoot = ref<HTMLElement | null>(null)
const { gsap } = useGSAP()
const { shouldAnimate } = useMotionSettings()
let notificationTimeline: ReturnType<typeof gsap.timeline> | undefined
const icons = { message: MessageCircleHeart, anniversary: CalendarDays, ai: Sparkles, upload: Upload }
const labels = { message: '悄悄话', anniversary: '纪念日', ai: '心动 AI', upload: '媒体' }
function formatTime(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) }
function open(item: AppNotification) { emit('read', item.id); emit('navigate', item.target) }
onMounted(async () => {
  await nextTick()
  if (!shouldAnimate.value || !notificationRoot.value) return
  notificationTimeline = gsap.timeline({ defaults: { ease: 'power2.out' } })
    .fromTo(notificationRoot.value.querySelector('.notification-panel'), { autoAlpha: 0, y: 18, scale: .98 }, { autoAlpha: 1, y: 0, scale: 1, duration: .3, clearProps: 'opacity,visibility,transform' })
    .fromTo(notificationRoot.value.querySelectorAll('.notification-item'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .22, stagger: .035, clearProps: 'opacity,visibility,transform' }, '-=.12')
})
onBeforeUnmount(() => notificationTimeline?.kill())
</script>

<template>
  <div ref="notificationRoot" class="notification-overlay" @click.self="emit('close')">
    <section class="notification-panel glass-panel" aria-label="通知中心">
      <header class="notification-header">
        <div><p class="eyebrow">SPACE UPDATES</p><h2><Bell :size="20" /> 通知中心 <span v-if="unreadCount">{{ unreadCount }}</span></h2></div>
        <div class="notification-actions"><button v-if="notifications.length" class="notification-read-all" type="button" @click="emit('readAll')"><CheckCheck :size="15" /> 全部已读</button><button class="icon-button" type="button" aria-label="刷新通知" title="刷新通知" @click="emit('refresh')"><RefreshCw :size="17" /></button><button class="icon-button" type="button" aria-label="关闭通知" title="关闭" @click="emit('close')"><X :size="18" /></button></div>
      </header>
      <div v-if="loading" class="notification-empty"><RefreshCw class="spin" :size="24" /><p>正在同步通知</p></div>
      <div v-else-if="!notifications.length" class="notification-empty"><Bell :size="30" /><strong>暂时没有新通知</strong><p>你们的每一个小进展，都会在这里留下痕迹。</p></div>
      <div v-else class="notification-list">
        <button v-for="item in notifications" :key="item.id" class="notification-item" :class="{ unread: !item.read }" type="button" @click="open(item)">
          <span class="notification-icon" :class="`notification-${item.type}`"><component :is="icons[item.type]" :size="18" /></span>
          <span class="notification-copy"><span class="notification-title"><strong>{{ item.title }}</strong><small>{{ labels[item.type] }} · {{ formatTime(item.createdAt) }}</small></span><span class="notification-body">{{ item.body }}</span></span>
          <i v-if="!item.read" class="notification-dot" aria-label="未读" />
        </button>
      </div>
    </section>
  </div>
</template>
