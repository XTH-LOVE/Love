<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, Check, Gift, Heart, LoaderCircle, Mic, Pause, Play, Trash2, Volume2, X } from '@lucide/vue'
import type { VoiceCapsule, VoiceCapsuleCategory } from '~/composables/useVoiceCapsules'

const emit = defineEmits<{ close: [] }>()
const { profile } = useCoupleAuth()
const { members } = useAccountManagement()
const { capsules, loading, busy, uploadProgress, error, load, create, remove, subscribe, disconnect } = useVoiceCapsules()

const categoryOptions: Array<{ id: VoiceCapsuleCategory; label: string; hint: string; color: string }> = [
  { id: 'today', label: '今天最想对你说', hint: '把今天的心意留给 TA', color: '#a965c4' },
  { id: 'sleep', label: '睡前语音', hint: '晚安之前，听见你的声音', color: '#7185ce' },
  { id: 'miss', label: '想念时的声音', hint: '想你的时候，打开它', color: '#d76f9d' },
  { id: 'blessing', label: '重要日子的祝福', hint: '给未来某个特别的今天', color: '#d08a51' },
]
const categoryMap = computed(() => new Map(categoryOptions.map(item => [item.id, item])))
const selectedCategory = ref<VoiceCapsuleCategory>('today')
const title = ref('')
const recording = ref(false)
const recordSeconds = ref(0)
const pendingFile = ref<File | null>(null)
const previewUrl = ref('')
const openedId = ref('')
const localError = ref('')
let recorder: MediaRecorder | null = null
let recordStream: MediaStream | null = null
let recordTimer: ReturnType<typeof setInterval> | undefined
let recordStartedAt = 0

const selfId = computed(() => profile.value?.id || 'demo-user')
const sortedCapsules = computed(() => capsules.value.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const openedCapsule = computed(() => sortedCapsules.value.find(item => item.id === openedId.value) || null)

function categoryOf(item: VoiceCapsule) { return categoryMap.value.get(item.category) || categoryOptions[0] }
function authorName(item: VoiceCapsule) {
  const member = members.value.find(value => value.id === item.authorId)
  return member?.displayName || (item.authorId === selfId.value ? '我' : 'TA')
}
function formatTime(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
function setError(value: unknown) { localError.value = String((value as any)?.message || value || '声音胶囊暂时无法使用') }
function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''; pendingFile.value = null; recordSeconds.value = 0
}
function stopTimer() { if (recordTimer) clearInterval(recordTimer); recordTimer = undefined }
function stopStream() { recordStream?.getTracks().forEach(track => track.stop()); recordStream = null }
async function startRecording() {
  if (recording.value || busy.value) return
  localError.value = ''
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { localError.value = '当前设备不支持录音'; return }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const chunks: Blob[] = []
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || ''
    recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => {
      stopStream()
      if (!chunks.length) return
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      pendingFile.value = new File([blob], `voice-capsule-${Date.now()}.webm`, { type: blob.type })
      previewUrl.value = URL.createObjectURL(blob)
      recordSeconds.value = Math.max(1, Math.round((Date.now() - recordStartedAt) / 1000))
    }
    recordStartedAt = Date.now(); recordSeconds.value = 0; recorder.start(250); recording.value = true
    recordTimer = setInterval(() => { recordSeconds.value = Math.floor((Date.now() - recordStartedAt) / 1000); if (recordSeconds.value >= 180) stopRecording() }, 250)
  } catch (cause: any) { stopStream(); setError(`无法使用麦克风：${cause?.name || cause?.message || '请允许录音权限'}`) }
}
function stopRecording() {
  stopTimer()
  if (recorder?.state === 'recording') recorder.stop()
  recorder = null; recording.value = false
}
function discardRecording() { stopRecording(); clearPreview(); localError.value = '' }
async function saveCapsule() {
  if (!pendingFile.value || busy.value) return
  localError.value = ''
  try {
    const item = await create({ file: pendingFile.value, category: selectedCategory.value, title: title.value || categoryMap.value.get(selectedCategory.value)!.label, durationSeconds: recordSeconds.value })
    title.value = ''
    clearPreview()
    if (item) openedId.value = item.id
  } catch (cause) { setError(cause) }
}
async function deleteCapsule(item: VoiceCapsule) {
  if (!confirm('确定删除这枚声音胶囊吗？')) return
  try { await remove(item); if (openedId.value === item.id) openedId.value = '' } catch (cause) { setError(cause) }
}
function close() { stopRecording(); clearPreview(); void disconnect(); emit('close') }

onMounted(async () => { await load(true); await subscribe() })
onBeforeUnmount(() => { stopRecording(); stopStream(); clearPreview(); void disconnect() })
</script>

<template>
  <Teleport to="body">
    <div class="voice-capsule-overlay" role="dialog" aria-modal="true" aria-label="声音胶囊">
      <section class="voice-capsule-panel">
        <header class="voice-capsule-header"><button type="button" class="capsule-back" aria-label="关闭声音胶囊" @click="close"><ArrowLeft :size="18" /><span>返回小家</span></button><div class="capsule-title"><Heart :size="18" fill="currentColor" /><span>声音胶囊</span></div><button type="button" class="capsule-close" aria-label="关闭" @click="close"><X :size="19" /></button></header>
        <div class="capsule-scroll">
          <section class="capsule-intro"><div class="intro-gift"><Gift :size="35" /></div><div><p class="capsule-kicker">FOR THE TWO OF US</p><h1>把想说的话，留成一份声音礼物</h1><p>录下此刻的你，TA 可以在想你的时候拆开听见。</p></div></section>
          <div v-if="error || localError" class="capsule-error" role="alert">{{ localError || error }}</div>
          <section class="record-card"><div class="record-card-heading"><div><p class="capsule-kicker">CREATE A CAPSULE</p><h2>录一段只属于你们的声音</h2></div><span class="record-limit">最长 3 分钟</span></div><div class="category-grid"><button v-for="option in categoryOptions" :key="option.id" type="button" :class="['category-choice', { selected: selectedCategory === option.id }]" :style="{ '--category-color': option.color }" @click="selectedCategory = option.id"><span class="category-dot" /><strong>{{ option.label }}</strong><small>{{ option.hint }}</small><Check v-if="selectedCategory === option.id" :size="15" /></button></div><input v-model="title" class="capsule-name" maxlength="80" placeholder="给这段声音起个名字（可选）"><div class="record-controls"><button v-if="!recording" class="record-main" type="button" :disabled="busy" @click="startRecording"><Mic :size="21" /><span>{{ pendingFile ? '重新录一段' : '按住心意，开始录音' }}</span></button><button v-else class="record-main recording" type="button" @click="stopRecording"><span class="record-pulse" /><span>正在录音 {{ formatTime(recordSeconds) }}</span><Pause :size="18" /></button><span v-if="pendingFile && !recording" class="record-ready"><Check :size="15" /> 已录好 {{ formatTime(recordSeconds) }}</span></div><div v-if="previewUrl && !recording" class="record-preview"><Volume2 :size="17" /><audio :src="previewUrl" controls preload="metadata" /><button type="button" aria-label="删除录音" title="重新录音" @click="discardRecording"><Trash2 :size="16" /></button></div><div v-if="busy" class="capsule-upload-progress"><span><LoaderCircle :size="15" class="spin" /> 正在保存声音礼物 {{ uploadProgress }}%</span><i><b :style="{ width: `${uploadProgress}%` }" /></i></div><button class="save-capsule" type="button" :disabled="!pendingFile || busy || recording" @click="saveCapsule"><Gift :size="17" /> 封存这份声音</button></section>
          <section class="capsule-list-section"><div class="list-heading"><div><p class="capsule-kicker">YOUR SOUND GIFTS</p><h2>已经封存的心意</h2></div><span>{{ sortedCapsules.length }} 份</span></div><div v-if="loading" class="capsule-empty"><LoaderCircle :size="21" class="spin" /> 正在寻找你们的声音</div><div v-else-if="!sortedCapsules.length" class="capsule-empty empty"><Gift :size="28" /><strong>这里还没有声音胶囊</strong><span>从第一句“想你了”开始吧。</span></div><div v-else class="capsule-grid"><article v-for="item in sortedCapsules" :key="item.id" class="capsule-card" :class="{ opened: openedId === item.id }" :style="{ '--category-color': categoryOf(item).color }"><button type="button" class="capsule-card-main" @click="openedId = openedId === item.id ? '' : item.id"><span class="capsule-seal"><Gift :size="22" /></span><span class="capsule-card-copy"><strong>{{ item.title }}</strong><small>{{ categoryOf(item).label }} · {{ authorName(item) }}</small><time>{{ formatDate(item.createdAt) }}</time></span><span class="capsule-card-action"><Pause v-if="openedId === item.id" :size="17" /><Play v-else :size="17" /></span></button><div v-if="openedId === item.id" class="capsule-opened"><div class="opened-ribbon"><Heart :size="13" fill="currentColor" /> 胶囊已拆开</div><p>这是 {{ authorName(item) }} 留给你的一段声音。</p><audio :src="item.audioUrl" controls preload="metadata" /><button v-if="item.authorId === selfId" type="button" class="delete-capsule" @click.stop="deleteCapsule(item)"><Trash2 :size="14" /> 删除这枚胶囊</button></div></article></div></section>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.voice-capsule-overlay{position:fixed;z-index:240;inset:0;display:grid;place-items:center;padding:clamp(10px,3vw,36px);background:rgba(42,24,51,.42);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.voice-capsule-panel{display:flex;width:min(920px,100%);max-height:min(920px,calc(100dvh - 22px));flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.86);border-radius:32px;background:linear-gradient(145deg,rgba(255,252,255,.94),rgba(250,239,255,.9));box-shadow:0 35px 100px rgba(59,28,75,.28);color:#4b3556}.voice-capsule-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(161,103,186,.12);background:rgba(255,255,255,.5)}.capsule-back,.capsule-close{display:flex;align-items:center;gap:7px;min-height:36px;border:0;border-radius:12px;background:rgba(255,255,255,.66);color:#82608e;cursor:pointer}.capsule-back{padding:0 10px;font:inherit;font-size:11px;font-weight:750}.capsule-close{width:36px;justify-content:center}.capsule-title{display:flex;align-items:center;gap:8px;color:#8e4da4;font-size:14px;font-weight:900}.capsule-scroll{overflow-y:auto;padding:28px clamp(18px,4vw,52px) 42px}.capsule-intro{display:flex;align-items:center;gap:18px;margin:3px 0 25px}.intro-gift{display:grid;place-items:center;width:74px;height:74px;flex:0 0 74px;border:1px solid rgba(255,255,255,.9);border-radius:24px;background:linear-gradient(145deg,#e9d2f8,#ffd9e8);color:#a052aa;box-shadow:0 13px 28px rgba(145,75,163,.17);transform:rotate(-4deg)}.capsule-kicker{margin:0;color:#a05aab;font-size:9px;font-weight:900;letter-spacing:.16em}.capsule-intro h1{margin:6px 0 7px;color:#4b2e5a;font-size:clamp(25px,4vw,39px);line-height:1.16}.capsule-intro p:not(.capsule-kicker){margin:0;color:#8c7594;font-size:12px}.record-card{padding:21px;border:1px solid rgba(255,255,255,.9);border-radius:24px;background:rgba(255,255,255,.62);box-shadow:0 15px 34px rgba(110,61,128,.08)}.record-card-heading,.list-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.record-card h2,.list-heading h2{margin:5px 0 0;color:#51365d;font-size:19px}.record-limit,.list-heading>span{padding:6px 9px;border-radius:10px;background:#f2e8f7;color:#9c7aaa;font-size:10px;font-weight:750;white-space:nowrap}.category-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0 12px}.category-choice{position:relative;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:5px;padding:12px 10px;border:1px solid rgba(174,123,190,.14);border-radius:15px;background:rgba(255,255,255,.7);color:#755a7d;text-align:left;cursor:pointer}.category-choice strong{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.category-choice small{grid-column:2;color:#a08ca6;font-size:9px;line-height:1.35}.category-choice svg{position:absolute;right:8px;top:8px;color:var(--category-color)}.category-choice.selected{border-color:color-mix(in srgb,var(--category-color) 55%,white);background:color-mix(in srgb,var(--category-color) 10%,white);box-shadow:0 8px 18px color-mix(in srgb,var(--category-color) 18%,transparent)}.category-dot{width:9px;height:9px;border-radius:50%;background:var(--category-color);box-shadow:0 0 0 4px color-mix(in srgb,var(--category-color) 12%,transparent)}.capsule-name{width:100%;margin:0 0 12px;padding:12px 13px;border:1px solid #eadfed;border-radius:12px;outline:0;background:rgba(255,255,255,.7);color:#5d4267;font:inherit;font-size:11px}.capsule-name:focus{border-color:#bf8cca;box-shadow:0 0 0 3px rgba(190,127,208,.12)}.record-controls{display:flex;align-items:center;gap:12px}.record-main{display:flex;align-items:center;justify-content:center;gap:9px;min-height:45px;padding:0 15px;border:0;border-radius:14px;background:linear-gradient(135deg,#9250b6,#d25e9b);color:#fff;box-shadow:0 11px 22px rgba(152,76,159,.2);font:inherit;font-size:11px;font-weight:850;cursor:pointer}.record-main:disabled,.save-capsule:disabled{opacity:.5;cursor:not-allowed}.record-main.recording{background:linear-gradient(135deg,#c75278,#a94791)}.record-pulse{width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 0 6px rgba(255,255,255,.18);animation:record-pulse 1.15s ease-in-out infinite}@keyframes record-pulse{50%{transform:scale(.65);opacity:.6}}.record-ready{display:flex;align-items:center;gap:5px;color:#5b9b72;font-size:10px;font-weight:750}.record-preview{display:flex;align-items:center;gap:8px;margin-top:12px;padding:8px 11px;border:1px solid #eedff2;border-radius:13px;background:rgba(255,255,255,.7);color:#9854a3}.record-preview audio{width:100%;height:34px}.record-preview button{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:9px;background:#f3e8f5;color:#9c6ca5;cursor:pointer}.capsule-upload-progress{display:grid;gap:6px;margin-top:12px;color:#8b7193;font-size:10px}.capsule-upload-progress span{display:flex;align-items:center;gap:6px}.capsule-upload-progress i{display:block;height:5px;overflow:hidden;border-radius:99px;background:#eadff0}.capsule-upload-progress b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#a55dc1,#dd6c9c);transition:width .25s}.save-capsule{display:inline-flex;align-items:center;gap:7px;min-height:42px;margin-top:14px;padding:0 15px;border:0;border-radius:12px;background:#493554;color:#fff;font:inherit;font-size:11px;font-weight:850;cursor:pointer}.capsule-error{margin-bottom:13px;padding:10px 12px;border-radius:12px;background:#fff0f4;color:#b34e74;font-size:11px}.capsule-list-section{margin-top:30px}.list-heading{align-items:center;margin-bottom:13px}.capsule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.capsule-card{overflow:hidden;border:1px solid color-mix(in srgb,var(--category-color) 18%,white);border-radius:18px;background:rgba(255,255,255,.64);box-shadow:0 10px 24px rgba(98,58,109,.06);transition:box-shadow .2s,transform .2s}.capsule-card.opened{box-shadow:0 15px 34px color-mix(in srgb,var(--category-color) 18%,transparent);transform:translateY(-2px)}.capsule-card-main{display:flex;align-items:center;gap:10px;width:100%;padding:13px;border:0;background:transparent;color:#5f4669;text-align:left;cursor:pointer}.capsule-seal{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:14px;background:color-mix(in srgb,var(--category-color) 13%,white);color:var(--category-color)}.capsule-card-copy{display:grid;min-width:0;flex:1;gap:3px}.capsule-card-copy strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.capsule-card-copy small,.capsule-card-copy time{overflow:hidden;color:#9b88a0;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.capsule-card-action{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:color-mix(in srgb,var(--category-color) 14%,white);color:var(--category-color)}.capsule-opened{padding:0 14px 14px}.opened-ribbon{display:flex;align-items:center;gap:5px;color:var(--category-color);font-size:10px;font-weight:800}.capsule-opened p{margin:7px 0 9px;color:#846f8c;font-size:10px}.capsule-opened audio{width:100%;height:34px}.delete-capsule{display:flex;align-items:center;gap:5px;margin-top:8px;padding:0;border:0;background:transparent;color:#b9829b;font:inherit;font-size:9px;cursor:pointer}.capsule-empty{display:flex;min-height:130px;align-items:center;justify-content:center;gap:8px;color:#9c8aa2;font-size:11px}.capsule-empty.empty{flex-direction:column;gap:5px;color:#a98aaf}.capsule-empty strong{color:#6c5175;font-size:13px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:700px){.voice-capsule-overlay{padding:0}.voice-capsule-panel{width:100%;max-height:100dvh;height:100dvh;border:0;border-radius:0}.voice-capsule-header{padding-top:max(14px,env(safe-area-inset-top));padding-right:max(16px,env(safe-area-inset-right));padding-left:max(16px,env(safe-area-inset-left))}.capsule-back span{display:none}.capsule-scroll{padding:22px 16px calc(30px + env(safe-area-inset-bottom))}.capsule-intro{align-items:flex-start}.intro-gift{width:56px;height:56px;flex-basis:56px;border-radius:18px}.intro-gift svg{width:26px}.capsule-intro h1{font-size:25px}.category-grid{grid-template-columns:repeat(2,1fr)}.category-choice{min-height:70px}.record-controls{flex-wrap:wrap}.record-main{width:100%}.capsule-grid{grid-template-columns:1fr}.save-capsule{width:100%;justify-content:center}}
</style>
