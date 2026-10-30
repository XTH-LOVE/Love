<script setup lang="ts">
import {
  Activity,
  Bell,
  CalendarDays,
  Heart,
  MapPin,
  Mail,
  Camera,
  X,
  Plus,
  Volume2,
  Check,
  ChevronRight,
  Film,
  Settings,
} from '@lucide/vue'
import { occurrence, daysUntil } from '../composables/useAnniversaries'
import { createMediaSignedUrl, refreshMediaElement, mediaBucketForPath } from '../composables/useMediaUrls'

const props = defineProps<{ navigate: (label: string) => void }>()

const emit = defineEmits<{ timeline: [] }>()

const { profile } = useCoupleAuth()
const { members } = useAccountManagement()
const { anniversaries, relationshipStart, nextAnniversary } = useAnniversaries()
const { memories } = useMemories()
const { allPhotos } = useAlbums()
const { items: togetherItems, toggleItem } = useTogetherList()
const { unreadCount } = useMessages()
const { unreadCount: notificationUnreadCount } = useNotificationCenter()
const { $supabase } = useNuxtApp()

const coverPickerVisible = ref(false)
const selectedCoverPath = ref('')
const selectedCoverUrl = ref('')
const displayedHeroPhoto = ref('')
const heroPhotoShape = ref<'wide' | 'square' | 'portrait'>('wide')

const selfMember = computed(() => members.value.find(m => m.id === profile.value?.id) || members.value[0])
const partnerMember = computed(() => members.value.find(m => m.id !== profile.value?.id))
const coupleNames = computed(() =>
  partnerMember.value
    ? `${selfMember.value?.displayName || profile.value?.displayName} 与 ${partnerMember.value.displayName}`
    : selfMember.value?.displayName || profile.value?.displayName || '我们的空间',
)
const todayLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()),
)
const relationshipLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${relationshipStart.value}T12:00:00`)),
)
const nextOccurrence = computed(() => (nextAnniversary.value ? occurrence(nextAnniversary.value) : null))

const latestMemory = computed(() => memories.value[0] || null)
const homeHeroPhoto = computed(() => selectedCoverUrl.value || latestMemory.value?.photos[0]?.url || allPhotos.value[0]?.url || '')
const homeHeroPath = computed(() => selectedCoverPath.value || latestMemory.value?.photos[0]?.path || allPhotos.value[0]?.path || '')
const homeHeroLocation = computed(() =>
  latestMemory.value?.photos[0] ? latestMemory.value.location : allPhotos.value[0]?.albumName || '',
)
const homePlans = computed(() => togetherItems.value.slice(0, 3))
const completedPlanCount = computed(() => togetherItems.value.filter(i => i.completed).length)
const latestSharedMedia = computed(() => allPhotos.value.filter(p => p.url).slice(0, 10))

watch(homeHeroPhoto, value => {
  if (!import.meta.client || !value) return
  const img = new window.Image()
  img.onload = () => {
    const ratio = img.naturalWidth / img.naturalHeight
    heroPhotoShape.value = ratio >= 1.4 ? 'wide' : ratio <= 0.82 ? 'portrait' : 'square'
    displayedHeroPhoto.value = value
  }
  img.src = value
}, { immediate: true })

function openTimelineComposer() {
  emit('timeline')
}

async function chooseCover(photo: { path: string; url: string; source?: 'album' | 'memory'; mediaType?: 'image' | 'video'; videoPosterPath?: string }) {
  selectedCoverPath.value = photo.path
  const coverPath = photo.mediaType === 'video' ? (photo.videoPosterPath || photo.path) : photo.path
  const bucket = photo.source === 'memory' ? 'memory-photos' : mediaBucketForPath(coverPath)
  selectedCoverUrl.value = $supabase
    ? await createMediaSignedUrl($supabase, coverPath, bucket, { width: 1400, height: 900, resize: 'cover', quality: 84 })
    : photo.url
  if ($supabase && profile.value?.coupleId && photo.path) {
    const { error } = await $supabase.from('couples').update({ cover_path: photo.path }).eq('id', profile.value.coupleId)
    if (error) throw error
  } else {
    localStorage.setItem('couple-space-cover-url', photo.url)
  }
  coverPickerVisible.value = false
}

function revealHomeVideo(event: Event) {
  const video = event.currentTarget as HTMLVideoElement
  if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime === 0)
    video.currentTime = Math.min(0.15, video.duration / 2)
}

async function refreshHomeMedia(event: Event, path: string, source?: 'memory' | 'album', mediaType: 'image' | 'video' = 'image') {
  const bucket = source === 'memory' ? 'memory-photos' : mediaBucketForPath(path)
  const transform = mediaType === 'image' ? { width: 640, height: 640, resize: 'contain' as const, quality: 68 } : undefined
  await refreshMediaElement(event, $supabase, path, bucket, transform)
}

async function refreshHero(event: Event) {
  const bucket = mediaBucketForPath(homeHeroPath.value)
  await refreshMediaElement(event, $supabase, homeHeroPath.value, bucket, { width: 1400, height: 900, resize: 'cover', quality: 84 })
}
</script>

<template>
  <main class="main-content">
    <header class="topbar">
      <div>
        <p class="eyebrow">{{ todayLabel }}</p>
        <h1>晚上好，{{ coupleNames }}</h1>
      </div>
      <div class="topbar-actions">
        <button class="message-button glass-panel notification-trigger" type="button" aria-label="打开通知中心" title="通知中心" @click="navigate('通知中心')">
          <Bell :size="20" />
          <strong v-if="notificationUnreadCount" class="notification-badge">{{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}</strong>
        </button>
        <button class="message-button glass-panel easter-trigger" type="button" aria-label="打开秘密彩蛋" title="只属于你们的秘密" @click="navigate('彩蛋')">
          <Heart :size="19" fill="currentColor" />
        </button>
        <button class="message-button glass-panel" type="button" aria-label="查看空间状态" title="空间状态" @click="navigate('空间状态')">
          <Activity :size="20" />
        </button>
        <button class="message-button glass-panel" type="button" aria-label="打开设置" title="设置" @click="navigate('设置')">
          <Settings :size="21" />
        </button>
      </div>
    </header>

    <section
      class="hero-section"
      :class="[{ 'has-cover': displayedHeroPhoto }, `photo-${heroPhotoShape}`]"
      :style="displayedHeroPhoto ? { '--hero-image': `url('${displayedHeroPhoto}')` } : undefined"
      aria-labelledby="love-days-title"
    >
      <div class="hero-copy">
        <div class="soft-label">
          <Heart :size="14" fill="currentColor" /> 我们在一起
        </div>
        <LoveDuration id="love-days-title" :start="relationshipStart" />
        <p>从 {{ relationshipLabel }} 开始，每一天都有了共同的名字。</p>
        <button class="primary-button" type="button" @click="openTimelineComposer">
          <Plus :size="18" /> 记录此刻
        </button>
        <div class="story-entry-grid">
          <button class="story-entry-button" type="button" @click="navigate('故事')">
            <Heart :size="16" fill="currentColor" /> <span>打开我们的故事</span>
          </button>
          <button class="story-entry-button" type="button" @click="navigate('未来邮箱')">
            <Mail :size="16" /> <span>写给未来的信</span>
          </button>
          <button class="story-entry-button" type="button" @click="navigate('声音胶囊')">
            <Volume2 :size="16" /> <span>声音胶囊</span>
          </button>
        </div>
      </div>
      <div
        class="hero-photo"
        :class="{ empty: !displayedHeroPhoto }"
        :style="displayedHeroPhoto ? { '--photo-image': `url('${displayedHeroPhoto}')` } : undefined"
        role="img"
        :aria-label="displayedHeroPhoto ? '最新的共同照片' : '等待添加共同照片'"
      >
        <img v-if="displayedHeroPhoto" :src="displayedHeroPhoto" alt="情侣空间封面" @error="refreshHero">
        <button class="cover-button glass-panel" type="button" @click="coverPickerVisible = true">
          <Camera :size="15" /> 选择封面
        </button>
        <div class="photo-caption glass-panel">
          <MapPin v-if="homeHeroLocation" :size="15" /> {{ homeHeroLocation || '第一张共同照片，等你们来记录' }}
        </div>
      </div>
    </section>

    <LoveQuoteCarousel />
    <MoodCheckinWidget />
    <DailyQuestionCard />

    <section class="dashboard-grid">
      <LoveLetterCard />

      <article class="anniversary-panel panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">下一次见面的期待</p>
            <h3>下一个特别的日子</h3>
          </div>
          <button class="icon-button" type="button" aria-label="查看所有纪念日" title="查看全部" @click="props.navigate('纪念日')">
            <ChevronRight :size="20" />
          </button>
        </div>
        <div class="date-display">
          <div class="calendar-page">
            <span>{{ nextOccurrence ? String(nextOccurrence.getMonth() + 1).padStart(2, '0') + '月' : '--' }}</span>
            <strong>{{ nextOccurrence ? String(nextOccurrence.getDate()).padStart(2, '0') : '--' }}</strong>
          </div>
          <div>
            <h4>{{ nextAnniversary?.title || '添加第一个纪念日' }}</h4>
            <p>{{ nextAnniversary ? `还有 ${daysUntil(nextAnniversary)} 天` : '让重要日子不再错过' }}</p>
          </div>
        </div>
        <div class="progress-track"><span /></div>
      </article>

      <article class="plans-panel panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">一起完成的小事</p>
            <h3>今天一起完成</h3>
          </div>
          <span class="plan-count">{{ completedPlanCount }}/{{ togetherItems.length }}</span>
        </div>
        <div class="plan-list">
          <button
            v-for="plan in homePlans"
            :key="plan.id"
            class="plan-item"
            :class="{ done: plan.completed }"
            type="button"
            @click="toggleItem(plan)"
          >
            <span class="check-box"><Check v-if="plan.completed" :size="14" /></span>
            <span>
              <strong>{{ plan.title }}</strong>
              <small>{{ plan.plannedDate || (plan.note || '共同计划') }}</small>
            </span>
          </button>
          <button v-if="!homePlans.length" class="empty-plan" type="button" @click="props.navigate('清单')">
            <Plus :size="16" /> 添加第一项共同计划
          </button>
        </div>
      </article>

      <article class="memory-panel panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">刚刚留下的回忆</p>
            <h3>最近的共同回忆</h3>
          </div>
          <button class="text-button" type="button" @click="props.navigate('时光')">查看时光</button>
        </div>
        <div v-if="latestSharedMedia.length" class="recent-media-grid">
          <button
            v-for="(media, mediaIndex) in latestSharedMedia"
            :key="media.id"
            type="button"
            @click="props.navigate('相册')"
          >
            <img
              :src="media.url"
              :alt="media.mediaType === 'video' ? '最近共同视频封面' : '最近共同回忆'"
              :loading="mediaIndex < 4 ? 'eager' : 'lazy'"
              :fetchpriority="mediaIndex < 2 ? 'high' : 'low'"
              decoding="async"
              @error="refreshHomeMedia($event, media.path, media.source, media.mediaType)"
            >
            <Film v-if="media.mediaType === 'video'" class="recent-video-mark" :size="17" />
            <span>{{ media.takenDate }} · {{ media.uploaderName }}</span>
          </button>
        </div>
        <button v-else class="empty-memory" type="button" @click="props.navigate('相册')">
          <Plus :size="19" />
          <span>
            <strong>还没有共同照片</strong>
            <small>从相册或时光上传第一张照片</small>
          </span>
        </button>
      </article>
    </section>
  </main>

  <div v-if="coverPickerVisible" class="cover-picker-overlay" @click.self="coverPickerVisible = false">
    <section class="cover-picker">
      <header>
        <div>
          <p class="eyebrow">首页封面</p>
          <h2>选择首页封面</h2>
        </div>
        <button type="button" aria-label="关闭" @click="coverPickerVisible = false">
          <X :size="20" />
        </button>
      </header>
      <p>从你们已经上传的照片中选择一张，双方会看到相同封面。</p>
      <div v-if="allPhotos.length" class="cover-photo-grid">
        <button
          v-for="photo in allPhotos"
          :key="photo.id"
          type="button"
          :class="{ selected: photo.path === selectedCoverPath }"
          @click="chooseCover(photo)"
        >
          <img :src="photo.url" alt="可选封面">
          <span>{{ photo.albumName }}</span>
        </button>
      </div>
      <div v-else class="cover-empty">相册中还没有照片，请先上传一张。</div>
    </section>
  </div>
</template>

<style>
.story-entry-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px;width:100%}.story-entry-button{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:38px;padding:0 8px;border:1px solid rgba(255,255,255,.62);border-radius:13px;background:rgba(255,255,255,.32);color:#8d4b91;font-size:10px;font-weight:850;text-align:center;cursor:pointer;transition:transform .2s ease,color .2s ease,background .2s ease}.story-entry-button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.story-entry-button:hover{color:#713c86;background:rgba(255,255,255,.64);transform:translateY(-2px)}
@media(max-width:650px){.story-entry-grid{grid-template-columns:1fr;gap:7px;margin-top:10px}.story-entry-button{justify-content:flex-start;padding:0 12px;font-size:10px}}
</style>

<style>
/* Hero section overflow guard for portrait and panoramic uploads. */
.hero-section{height:clamp(420px,58vw,560px);min-height:0;overflow:hidden;contain:paint}
.hero-photo{position:relative;min-width:0;height:100%;min-height:0;overflow:hidden}
.hero-photo>img{max-width:100%;max-height:100%;object-fit:cover}
.hero-photo.empty::before{display:none}.hero-photo.empty::after{background:linear-gradient(135deg,rgba(245,228,252,.25),rgba(255,220,237,.2))}
@media(max-width:650px){.hero-section{height:auto;min-height:560px!important}.hero-copy{min-height:370px}.hero-photo{height:190px;min-height:190px!important}}
</style>
