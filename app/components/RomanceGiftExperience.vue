<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Copy, Heart, Image as ImageIcon, Mail, Music2, Pause, Play, Quote, Share2, SkipForward, Sparkles, Volume2, X } from '@lucide/vue'

type ExperienceMode = 'opening' | 'story'
type Props = { mode?: ExperienceMode }
type StoryLetter = { senderId: string; content: string; createdAt: string }
type StorySlide = { kind: 'photo' | 'whisper' | 'letter' | 'anniversary' | 'gallery' | 'voice' | 'ending'; title: string; body?: string; date?: string; image?: string; images?: string[]; audio?: string; meta?: string }
type StoryPhoto = { url: string; takenDate?: string; mediaType?: string; uploaderName?: string }

const props = withDefaults(defineProps<Props>(), { mode: 'opening' })
const emit = defineEmits<{ close: [] }>()
const { profile } = useCoupleAuth()
const { memories } = useMemories()
const { allPhotos } = useAlbums()
const { messages } = useMessages()
const { anniversaries, loveDays } = useAnniversaries()
const { members } = useAccountManagement()
const { capsules, load: loadVoiceCapsules } = useVoiceCapsules()
const { createLink, revoke: revokeStoryLink } = useStoryShare()
const { $supabase } = useNuxtApp()

const mode = ref<ExperienceMode>(props.mode)
const slideIndex = ref(0)
const storyPlaying = ref(true)
const openingDraft = ref('')
const editingOpening = ref(false)
const letters = ref<StoryLetter[]>([])
const loadingLetters = ref(false)
let storyTimer: ReturnType<typeof setInterval> | null = null

const selfName = computed(() => members.value.find(member => member.id === profile.value?.id)?.displayName || profile.value?.displayName || '我')
const partnerName = computed(() => members.value.find(member => member.id !== profile.value?.id)?.displayName || profile.value?.partnerName || 'TA')
const coupleId = computed(() => profile.value?.coupleId || 'demo')
const openingStorageKey = computed(() => `couple-space-opening-letter:${coupleId.value}`)
const seenStorageKey = computed(() => `couple-space-opening-letter-seen:${coupleId.value}`)
const firstPhoto = computed<StoryPhoto | undefined>(() => {
  const galleryPhoto = allPhotos.value.slice().sort((a, b) => a.takenDate.localeCompare(b.takenDate)).find(photo => photo.mediaType !== 'video' && photo.url)
  if (galleryPhoto) return { url: galleryPhoto.url, takenDate: galleryPhoto.takenDate, mediaType: galleryPhoto.mediaType, uploaderName: galleryPhoto.uploaderName }
  const memoryPhoto = memories.value.slice().sort((a, b) => a.memoryDate.localeCompare(b.memoryDate)).flatMap(memory => memory.photos).find(photo => photo.url)
  return memoryPhoto ? { url: memoryPhoto.url } : undefined
})
const firstMemory = computed(() => memories.value.slice().sort((a, b) => a.memoryDate.localeCompare(b.memoryDate))[0])
const firstWhisper = computed(() => messages.value.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find(message => message.content || message.mediaUrl))
const firstAudio = computed(() => messages.value.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find(message => message.mediaType === 'audio' && message.mediaUrl))
const firstLetter = computed(() => letters.value[0])
const firstAnniversary = computed(() => anniversaries.value.slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0])
const recentPhotos = computed(() => allPhotos.value.filter(photo => photo.url && photo.mediaType !== 'video').slice(0, 10).map(photo => photo.url))
const recentVideos = computed(() => allPhotos.value.filter(photo => photo.url && photo.mediaType === 'video').slice(0, 4).map(photo => photo.url))
const firstVoiceCapsule = computed(() => capsules.value.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find(item => item.audioUrl))
const storyShareMessage = ref('')
const storyShareToken = ref('')
const defaultOpening = computed(() => `谢谢你把平凡的日子变成了值得期待的日子。\n从遇见你开始，我想把每一个今天都过成我们的纪念日。`)
const openingMessage = computed(() => openingDraft.value || defaultOpening.value)

function formatDate(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value))
}

async function loadFirstLetter() {
  if (!$supabase || !profile.value?.coupleId) return
  loadingLetters.value = true
  try {
    const { data } = await $supabase.from('couple_letters').select('sender_id, content, created_at').eq('couple_id', profile.value.coupleId).order('created_at', { ascending: true }).limit(1)
    letters.value = (data || []).map((row: any) => ({ senderId: String(row.sender_id), content: String(row.content || ''), createdAt: String(row.created_at) }))
  } finally {
    loadingLetters.value = false
  }
}

const storySlides = computed<StorySlide[]>(() => {
  const slides: StorySlide[] = []
  if (firstPhoto.value?.url) slides.push({ kind: 'photo', title: '你们的第一张共同照片', body: firstMemory.value?.content || '那一天被好好保存了下来。', date: formatDate(firstMemory.value?.memoryDate || firstPhoto.value.takenDate), image: firstPhoto.value.url, meta: firstPhoto.value.uploaderName ? `${firstPhoto.value.uploaderName} 添加` : undefined })
  if (firstWhisper.value) slides.push({ kind: 'whisper', title: '第一条悄悄话', body: firstWhisper.value.content || (firstWhisper.value.mediaType === 'image' ? '发来了一张照片' : firstWhisper.value.mediaType === 'audio' ? '发来了一段语音' : '留下了一条消息'), date: formatDate(firstWhisper.value.createdAt), audio: firstWhisper.value.mediaType === 'audio' ? firstWhisper.value.mediaUrl : undefined })
  if (firstLetter.value) slides.push({ kind: 'letter', title: '第一封情书', body: firstLetter.value.content, date: formatDate(firstLetter.value.createdAt), meta: `${firstLetter.value.senderId === profile.value?.id ? selfName.value : partnerName.value} 写下` })
  if (firstAnniversary.value) slides.push({ kind: 'anniversary', title: firstAnniversary.value.title, body: firstAnniversary.value.note || '重要的日子，值得被记住。', date: formatDate(firstAnniversary.value.eventDate) })
  if (recentPhotos.value.length) slides.push({ kind: 'gallery', title: '最近的十个瞬间', body: '每一张照片，都是你们共同生活的证据。', images: recentPhotos.value })
  if (recentVideos.value.length) slides.push({ kind: 'gallery', title: '最近保存的共同视频', body: '会动的回忆，也被好好留在这里。', images: recentVideos.value, meta: `${recentVideos.value.length} 段视频封面` })
  if (firstVoiceCapsule.value) slides.push({ kind: 'voice', title: firstVoiceCapsule.value.title, body: '一枚声音胶囊，等你在想念的时候拆开。', audio: firstVoiceCapsule.value.audioUrl, date: formatDate(firstVoiceCapsule.value.createdAt), meta: '声音胶囊' })
  slides.push({ kind: 'ending', title: '故事还没有结束', body: '下一页，等我们一起写。' })
  return slides
})
const currentSlide = computed(() => storySlides.value[slideIndex.value] || storySlides.value[0])

function clearStoryTimer() { if (storyTimer) { clearInterval(storyTimer); storyTimer = null } }
function startStoryTimer() { clearStoryTimer(); if (!storyPlaying.value || mode.value !== 'story') return; storyTimer = setInterval(() => { if (slideIndex.value >= storySlides.value.length - 1) { storyPlaying.value = false; clearStoryTimer(); return } slideIndex.value += 1 }, 6500) }
function openStory() { if (mode.value === 'opening' && import.meta.client) localStorage.setItem(seenStorageKey.value, '1'); mode.value = 'story'; slideIndex.value = 0; storyPlaying.value = true; startStoryTimer() }
function nextSlide() { if (slideIndex.value < storySlides.value.length - 1) slideIndex.value += 1; else storyPlaying.value = false; startStoryTimer() }
function previousSlide() { slideIndex.value = Math.max(0, slideIndex.value - 1); startStoryTimer() }
function toggleStory() { storyPlaying.value = !storyPlaying.value; startStoryTimer() }
function closeExperience() { clearStoryTimer(); emit('close') }
function skipOpening() { if (import.meta.client) localStorage.setItem(seenStorageKey.value, '1'); openStory() }
function saveOpening() { if (import.meta.client) localStorage.setItem(openingStorageKey.value, openingDraft.value.trim()); editingOpening.value = false }
async function shareStory() {
  storyShareMessage.value = ''
  try {
    if (!import.meta.client) return
    const share = await createLink(72)
    storyShareToken.value = share.token
    const url = new URL(window.location.href)
    url.searchParams.set('story', share.token)
    const shareData = { title: `我和${partnerName.value}的故事 · Love 小家`, text: '这是我们一起写下的故事，欢迎回家看看。', url: url.toString() }
    if (navigator.share) await navigator.share(shareData)
    else if (navigator.clipboard) { await navigator.clipboard.writeText(url.toString()); storyShareMessage.value = '安全故事链接已复制，72 小时内有效' }
    else storyShareMessage.value = '请复制浏览器地址分享给 TA'
  } catch (cause: any) { if (cause?.name !== 'AbortError') storyShareMessage.value = cause?.message || '分享暂时不可用，请稍后重试' }
  if (storyShareMessage.value) window.setTimeout(() => { storyShareMessage.value = '' }, 2400)
}
async function revokeStoryShare() {
  if (!storyShareToken.value) return
  storyShareMessage.value = ''
  try {
    await revokeStoryLink(storyShareToken.value)
    storyShareToken.value = ''
    storyShareMessage.value = '刚刚生成的分享链接已撤销'
  } catch (cause: any) {
    storyShareMessage.value = cause?.message || '撤销失败，请稍后重试'
  }
  window.setTimeout(() => { storyShareMessage.value = '' }, 2400)
}

onMounted(() => {
  if (import.meta.client) openingDraft.value = localStorage.getItem(openingStorageKey.value) || ''
  void loadFirstLetter()
  void loadVoiceCapsules(true)
  if (mode.value === 'story') startStoryTimer()
})
watch(() => props.mode, value => { mode.value = value; if (value === 'story') openStory() })
watch(storySlides, () => { if (slideIndex.value >= storySlides.value.length) slideIndex.value = Math.max(0, storySlides.value.length - 1) })
onBeforeUnmount(clearStoryTimer)
</script>

<template>
  <Teleport to="body">
    <div class="romance-experience" role="dialog" aria-modal="true" aria-label="我们的故事">
      <div class="romance-glow romance-glow-one" /><div class="romance-glow romance-glow-two" />
      <div class="romance-hearts" aria-hidden="true"><Heart v-for="index in 18" :key="index" :style="{ '--i': index }" :size="index % 3 === 0 ? 16 : 11" fill="currentColor" /></div>
      <header class="romance-toolbar"><div class="romance-brand"><Heart :size="18" fill="currentColor" /><span>Love 小家</span></div><div class="romance-toolbar-actions"><button v-if="mode === 'opening'" type="button" class="toolbar-link" @click="openStory">我们的故事</button><button v-if="mode === 'story'" type="button" class="toolbar-link" @click="shareStory"><Share2 :size="15" /> 分享回放</button><button v-if="storyShareToken" type="button" class="toolbar-link revoke-share-link" @click="revokeStoryShare"><X :size="14" /> 撤销分享</button><button type="button" class="toolbar-close" aria-label="关闭" @click="closeExperience"><X :size="20" /></button></div></header>

      <section v-if="mode === 'opening'" class="opening-stage">
        <div class="opening-photo" :class="{ empty: !firstPhoto?.url }"><img v-if="firstPhoto?.url" :src="firstPhoto.url" alt="你们的第一张共同照片"><div v-else class="opening-photo-empty"><ImageIcon :size="32" /><span>等你们上传第一张照片</span></div><span class="photo-date">{{ formatDate(firstMemory?.memoryDate || firstPhoto?.takenDate) }}</span></div>
        <div class="opening-copy"><p class="romance-kicker"><Sparkles :size="14" /> 给 TA 的专属开屏信</p><h1>欢迎回家，<em>{{ partnerName }}</em></h1><p class="opening-days">这是我们一起走过的每一天，<strong>{{ loveDays }}</strong> 天。</p><div class="opening-message"><Quote :size="20" /><p v-if="!editingOpening">{{ openingMessage }}</p><textarea v-else v-model="openingDraft" maxlength="500" placeholder="写一段只给 TA 的话……" /><button v-if="!editingOpening" class="edit-opening" type="button" @click="editingOpening = true">写下你的话</button><div v-else class="opening-editor-actions"><button type="button" @click="editingOpening = false">取消</button><button type="button" class="save" @click="saveOpening"><Check :size="14" /> 保存</button></div></div><div v-if="firstAudio?.mediaUrl" class="opening-voice"><Volume2 :size="17" /><div><span>还有一段声音，想让 TA 亲自听见</span><audio :src="firstAudio.mediaUrl" controls preload="metadata" /></div></div><button class="opening-primary" type="button" @click="skipOpening">打开我们的故事 <ArrowRight :size="18" /></button><button class="opening-skip" type="button" @click="closeExperience">先进入小家</button></div>
      </section>

      <section v-else class="story-stage"><div class="story-progress"><span v-for="(_, index) in storySlides" :key="index" :class="{ active: index <= slideIndex }" /></div><article class="story-card" :class="`story-${currentSlide?.kind || 'ending'}`"><div v-if="currentSlide?.image" class="story-image"><img :src="currentSlide.image" alt="故事照片"><span v-if="currentSlide.date">{{ currentSlide.date }}</span></div><div v-else-if="currentSlide?.images?.length" class="story-gallery"><img v-for="(image, index) in currentSlide.images" :key="`${image}-${index}`" :src="image" alt="共同回忆照片" loading="lazy"></div><div v-else class="story-symbol"><Heart v-if="currentSlide?.kind === 'ending'" :size="52" fill="currentColor" /><Mail v-else-if="currentSlide?.kind === 'letter'" :size="48" /><Quote v-else-if="currentSlide?.kind === 'whisper'" :size="48" /><CalendarDays v-else-if="currentSlide?.kind === 'anniversary'" :size="48" /><Volume2 v-else-if="currentSlide?.kind === 'voice'" :size="48" /><Sparkles v-else :size="48" /></div><div class="story-copy"><p class="romance-kicker">{{ currentSlide?.kind === 'ending' ? 'TO BE CONTINUED' : 'OUR STORY' }}</p><h2>{{ currentSlide?.title }}</h2><p v-if="currentSlide?.body" class="story-body">{{ currentSlide.body }}</p><div v-if="currentSlide?.audio" class="story-audio"><Music2 :size="18" /><audio :src="currentSlide.audio" controls /></div><small v-if="currentSlide?.meta">{{ currentSlide.meta }}</small><small v-if="currentSlide?.date && !currentSlide.image">{{ currentSlide.date }}</small></div></article><div class="story-controls"><button type="button" aria-label="上一页" title="上一页" :disabled="slideIndex === 0" @click="previousSlide"><ArrowLeft :size="20" /></button><button type="button" class="story-play" :aria-label="storyPlaying ? '暂停播放' : '继续播放'" @click="toggleStory"><Pause v-if="storyPlaying" :size="18" /><Play v-else :size="18" /></button><button type="button" aria-label="下一页" title="下一页" @click="nextSlide"><ArrowRight :size="20" /></button></div><span v-if="storyShareMessage" class="story-share-toast"><Copy :size="13" /> {{ storyShareMessage }}</span><button class="story-skip" type="button" @click="closeExperience"><SkipForward :size="14" /> 跳过回放</button></section>
    </div>
  </Teleport>
</template>

<style scoped>
.romance-experience{position:fixed;z-index:220;inset:0;display:flex;flex-direction:column;overflow:hidden;color:#4a315b;background:radial-gradient(circle at 12% 16%,rgba(255,255,255,.95),transparent 31%),linear-gradient(135deg,#f2e1ff 0%,#ffe6f0 52%,#f8eafa 100%);isolation:isolate}.romance-experience:before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(120deg,rgba(255,255,255,.25),transparent 35%,rgba(255,255,255,.24));backdrop-filter:blur(22px)}.romance-glow{position:absolute;border-radius:50%;filter:blur(4px);opacity:.7;z-index:-1}.romance-glow-one{width:44vw;height:44vw;right:-16vw;top:-15vw;background:rgba(203,151,244,.3)}.romance-glow-two{width:30vw;height:30vw;left:-12vw;bottom:-9vw;background:rgba(255,170,204,.28)}.romance-toolbar{display:flex;align-items:center;justify-content:space-between;padding:calc(20px + env(safe-area-inset-top)) clamp(18px,5vw,72px) 0}.romance-brand{display:flex;align-items:center;gap:8px;color:#8750a5;font-size:13px;font-weight:850;letter-spacing:.02em}.romance-toolbar-actions{display:flex;align-items:center;gap:10px}.toolbar-link,.toolbar-close{display:flex;align-items:center;gap:7px;border:0;color:#77498d;background:rgba(255,255,255,.58);border-radius:999px;min-height:38px;padding:0 13px;font:inherit;font-size:11px;font-weight:800;box-shadow:0 8px 24px rgba(127,74,146,.1)}.toolbar-close{width:38px;justify-content:center;padding:0}.romance-hearts{position:absolute;inset:0;z-index:-1;pointer-events:none;color:rgba(166,99,195,.35)}.romance-hearts svg{position:absolute;left:calc((var(--i) * 17% ) - 10%);top:calc((var(--i) * 23% ) - 18%);animation:float-heart calc(7s + var(--i) * .25s) ease-in-out infinite alternate;animation-delay:calc(var(--i) * -.5s)}@keyframes float-heart{from{transform:translate3d(0,12px,0) rotate(-10deg);opacity:.2}to{transform:translate3d(15px,-22px,0) rotate(14deg);opacity:.65}}.opening-stage{display:grid;grid-template-columns:minmax(260px,440px) minmax(320px,540px);gap:clamp(32px,7vw,110px);align-items:center;justify-content:center;width:min(1120px,calc(100% - 36px));margin:auto;padding:34px 0}.opening-photo{position:relative;aspect-ratio:4/5;overflow:hidden;border:1px solid rgba(255,255,255,.7);border-radius:32px;box-shadow:0 32px 80px rgba(111,63,136,.2);background:rgba(255,255,255,.55);transform:rotate(-2deg)}.opening-photo img{width:100%;height:100%;object-fit:cover;display:block}.opening-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(62,37,77,.3));pointer-events:none}.opening-photo-empty{height:100%;display:grid;place-items:center;align-content:center;gap:10px;color:#ad87bb;font-size:12px}.photo-date{position:absolute;z-index:1;left:20px;bottom:18px;color:#fff;font-size:11px;font-weight:750}.opening-copy{max-width:540px}.romance-kicker{display:flex;align-items:center;gap:7px;color:#a256aa;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.opening-copy h1{margin:13px 0 8px;font-size:clamp(35px,5vw,66px);line-height:1.08;letter-spacing:-.02em;color:#4d2f5f}.opening-copy h1 em{font-style:normal;color:#c04d8a}.opening-days{margin:0;color:#8b6f96;font-size:14px}.opening-days strong{margin:0 4px;color:#b14b8d;font-size:27px;font-variant-numeric:tabular-nums}.opening-message{position:relative;margin:28px 0 18px;padding:22px 22px 20px 45px;border:1px solid rgba(255,255,255,.72);border-radius:24px;background:rgba(255,255,255,.48);box-shadow:0 18px 44px rgba(111,63,136,.1);backdrop-filter:blur(18px)}.opening-message>svg{position:absolute;left:18px;top:19px;color:#bf83be}.opening-message p{margin:0;color:#60466b;font-size:16px;line-height:1.9;white-space:pre-wrap}.opening-message textarea{width:100%;min-height:130px;padding:0;border:0;outline:0;resize:vertical;background:transparent;color:#60466b;font:inherit;line-height:1.9}.edit-opening{margin-top:13px;border:0;background:transparent;color:#a256aa;font-size:11px;font-weight:800;cursor:pointer}.opening-editor-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.opening-editor-actions button{border:0;border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.65);color:#8c6994;font:inherit;font-size:11px}.opening-editor-actions .save{display:flex;align-items:center;gap:4px;background:#8b4db9;color:#fff}.opening-voice{display:flex;align-items:center;gap:12px;margin:12px 0 20px;color:#8f5e9c}.opening-voice>div{display:grid;gap:6px;min-width:0}.opening-voice span{font-size:11px;font-weight:750}.opening-voice audio{width:min(100%,300px);height:30px}.opening-primary{display:inline-flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:13px 19px;background:linear-gradient(135deg,#8850b9,#d35e99);color:#fff;box-shadow:0 14px 30px rgba(153,77,158,.24);font:inherit;font-size:12px;font-weight:850;cursor:pointer}.opening-skip{margin-left:12px;border:0;background:transparent;color:#967b9b;font:inherit;font-size:11px;cursor:pointer}.story-stage{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;width:min(920px,calc(100% - 36px));margin:auto;padding:26px 0 42px}.story-progress{display:flex;gap:6px;width:min(620px,100%);margin-bottom:24px}.story-progress span{height:3px;flex:1;border-radius:99px;background:rgba(126,80,148,.17);transition:background .35s}.story-progress span.active{background:linear-gradient(90deg,#a654b3,#d15f98)}.story-card{display:grid;grid-template-columns:minmax(250px,480px) minmax(250px,420px);width:min(900px,100%);min-height:430px;overflow:hidden;border:1px solid rgba(255,255,255,.75);border-radius:34px;background:rgba(255,255,255,.46);box-shadow:0 35px 90px rgba(111,63,136,.18);backdrop-filter:blur(22px);animation:story-in .55s ease both}@keyframes story-in{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}.story-image{position:relative;min-height:430px}.story-image img{width:100%;height:100%;object-fit:cover;display:block}.story-image span{position:absolute;left:20px;bottom:18px;color:#fff;font-size:11px;font-weight:800;text-shadow:0 2px 8px rgba(0,0,0,.25)}.story-gallery{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:4px;min-height:430px;background:rgba(255,255,255,.45)}.story-gallery img{width:100%;height:100%;min-height:0;object-fit:cover}.story-symbol{display:grid;place-items:center;min-height:430px;color:#bf6eb3;background:linear-gradient(145deg,rgba(222,192,247,.82),rgba(255,210,228,.65))}.story-symbol svg{filter:drop-shadow(0 12px 18px rgba(165,78,140,.18))}.story-ending .story-symbol{color:#c44c91}.story-copy{display:flex;flex-direction:column;justify-content:center;padding:42px}.story-copy h2{margin:7px 0 13px;color:#4c305a;font-size:clamp(26px,4vw,42px);line-height:1.18}.story-body{margin:0;color:#684d71;font-size:15px;line-height:1.9;white-space:pre-wrap}.story-copy small{margin-top:22px;color:#a079a3;font-size:11px;font-weight:750}.story-audio{display:flex;align-items:center;gap:8px;margin-top:20px;color:#a05ba2}.story-audio audio{width:100%;height:30px}.story-controls{display:flex;align-items:center;gap:10px;margin-top:24px}.story-controls button{display:grid;place-items:center;width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.58);color:#7c4d8e;box-shadow:0 10px 25px rgba(107,61,125,.12);cursor:pointer}.story-controls button:disabled{opacity:.35;cursor:not-allowed}.story-controls .story-play{width:52px;height:52px;background:linear-gradient(135deg,#8a50b8,#d05b97);color:#fff}.story-skip{display:flex;align-items:center;gap:5px;margin-top:15px;border:0;background:transparent;color:#9a7d9f;font:inherit;font-size:11px;cursor:pointer}@media(max-width:760px){.romance-toolbar{padding-top:calc(13px + env(safe-area-inset-top))}.opening-stage{grid-template-columns:1fr;gap:22px;padding:24px 0 38px}.opening-photo{width:min(74vw,310px);margin:0 auto;aspect-ratio:1/1.08}.opening-copy{text-align:center}.romance-kicker{justify-content:center}.opening-copy h1{font-size:38px}.opening-days{font-size:12px}.opening-message{text-align:left;margin-top:20px}.opening-primary{padding:12px 16px}.opening-voice{justify-content:center;text-align:left}.opening-skip{margin-left:7px}.story-stage{padding:18px 0 30px}.story-card{grid-template-columns:1fr;min-height:0;max-height:calc(100dvh - 180px);overflow:auto;border-radius:28px}.story-image,.story-gallery,.story-symbol{min-height:260px;max-height:39dvh}.story-copy{padding:24px 22px 26px}.story-copy h2{font-size:28px}.story-body{font-size:14px}.story-progress{margin-bottom:14px}.story-controls{margin-top:17px}}
</style>
<style scoped>
.story-share-toast{display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.7);color:#8c6096;font-size:10px;font-weight:750;animation:share-toast-in .25s ease both}@keyframes share-toast-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
</style>
