<script setup lang="ts">
import { Bell, CalendarDays, CalendarClock, Camera, CheckCheck, FileHeart, HeartHandshake, ListTodo, Mail, MessageCircleHeart, Mic, Music2, PenLine, RefreshCw, Sparkles, Upload, X } from '@lucide/vue'
import type { AppNotification, NotificationTarget } from '~/composables/useNotificationCenter'
import { useGSAP } from '~/composables/useGSAP'
import { useMotionSettings } from '~/composables/useMotionSettings'

defineProps<{ notifications: AppNotification[]; unreadCount: number; loading?: boolean }>()
const emit = defineEmits<{ close: []; read: [id: string]; readAll: []; navigate: [target: NotificationTarget]; refresh: [] }>()
const notificationRoot = ref<HTMLElement | null>(null)
const { gsap } = useGSAP()
const { shouldAnimate } = useMotionSettings()
let notificationTimeline: ReturnType<typeof gsap.timeline> | undefined
const icons = {
  message: MessageCircleHeart,
  memory: PenLine,
  photo: Camera,
  album: Camera,
  calendar: CalendarClock,
  list: ListTodo,
  anniversary: CalendarDays,
  letter: Mail,
  ai: Sparkles,
  mood: HeartHandshake,
  question: FileHeart,
  voice: Mic,
  music: Music2,
  system: Bell,
  upload: Upload,
}
const labels = {
  message: '悄悄话',
  memory: '时光',
  photo: '相册',
  album: '相册',
  calendar: '日历',
  list: '共同清单',
  anniversary: '纪念日',
  letter: '情书',
  ai: '心动 AI',
  mood: '今日心情',
  question: '每日问答',
  voice: '声音胶囊',
  music: '一起听',
  system: '空间',
  upload: '媒体',
}
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

<style scoped>
.notification-overlay {
  padding: 22px !important;
  background: rgba(53, 29, 64, .18) !important;
  backdrop-filter: blur(10px) saturate(120%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(120%) !important;
}

.notification-panel {
  width: min(470px, calc(100vw - 44px)) !important;
  height: min(760px, calc(100dvh - 44px)) !important;
  border: 1px solid rgba(255, 255, 255, .9) !important;
  border-radius: 28px !important;
  background:
    radial-gradient(circle at 100% 0, rgba(255, 208, 231, .55), transparent 34%),
    linear-gradient(145deg, rgba(255, 252, 255, .94), rgba(245, 232, 250, .88)) !important;
  box-shadow: 0 30px 90px rgba(61, 29, 77, .28), inset 0 1px rgba(255,255,255,.95) !important;
}

.notification-header {
  padding: 22px 22px 16px !important;
  border-bottom: 1px solid rgba(119, 73, 132, .1) !important;
}

.notification-header h2 {
  font-size: 21px !important;
  font-weight: 820 !important;
}

.notification-header h2 span {
  min-width: 22px !important;
  height: 22px !important;
  background: linear-gradient(135deg, #d45d9a, #8f5ac6) !important;
  color: #fff !important;
  box-shadow: 0 5px 12px rgba(144, 74, 143, .2);
}

.notification-actions {
  gap: 8px !important;
}

.notification-read-all,
.notification-header .icon-button {
  min-height: 38px !important;
  border: 1px solid rgba(255,255,255,.8) !important;
  border-radius: 12px !important;
  background: rgba(255,255,255,.62) !important;
  box-shadow: 0 7px 18px rgba(105, 55, 117, .08) !important;
}

.notification-list {
  padding: 14px 14px 22px !important;
}

.notification-item {
  gap: 12px !important;
  min-height: 68px !important;
  padding: 12px !important;
  border: 1px solid transparent !important;
  border-radius: 18px !important;
}

.notification-item.unread {
  border-color: rgba(214, 111, 170, .18) !important;
  background: linear-gradient(135deg, rgba(255,255,255,.8), rgba(255,234,247,.64)) !important;
  box-shadow: 0 8px 22px rgba(128, 65, 127, .08) !important;
}

.notification-item:hover {
  transform: translateY(-1px);
  background: rgba(255,255,255,.76) !important;
}

.notification-icon {
  width: 42px !important;
  height: 42px !important;
  flex-basis: 42px !important;
  border-radius: 14px !important;
  box-shadow: inset 0 1px rgba(255,255,255,.8);
}

.notification-title {
  gap: 8px !important;
}

.notification-title strong {
  font-size: 13px !important;
  font-weight: 780 !important;
}

.notification-title small {
  font-size: 9px !important;
}

.notification-body {
  margin-top: 6px !important;
  color: #756477 !important;
  font-size: 11px !important;
  line-height: 1.65 !important;
  white-space: normal !important;
  display: -webkit-box !important;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 650px) {
  .notification-overlay {
    align-items: flex-end !important;
    padding: 0 10px calc(76px + env(safe-area-inset-bottom)) !important;
  }

  .notification-panel {
    width: 100% !important;
    height: min(76dvh, 650px) !important;
    border-radius: 25px 25px 18px 18px !important;
  }
}
</style>
