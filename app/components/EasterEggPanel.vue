<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Check, Film, Gift, Heart, Image as ImageIcon, KeyRound, LoaderCircle, LockKeyhole, Music2, Sparkles, Volume2, X } from '@lucide/vue'
import { useEasterEgg } from '~/composables/useEasterEgg'
import type { VoiceCapsule } from '~/composables/useVoiceCapsules'

const emit = defineEmits<{ close: [] }>()
const { profile } = useCoupleAuth()
const { allPhotos, loadAlbums } = useAlbums()
const { capsules, load: loadCapsules } = useVoiceCapsules()
const { anniversaries, relationshipStart, loadAnniversaries } = useAnniversaries()
const { egg, loading, busy, error, load, save, verify } = useEasterEgg()

const stage = ref<'setup' | 'locked' | 'revealed'>('locked')
const secret = ref('')
const unlockError = ref('')
const setupSecret = ref('')
const setupTitle = ref('只属于我们的秘密')
const setupContent = ref('')
const selectedPhotoId = ref('')
const selectedAudioId = ref('')
const savingMessage = ref('')

const mediaChoices = computed(() => allPhotos.value.filter(photo => photo.url && (photo.mediaType === 'image' || photo.mediaType === 'video')).slice(0, 24))
const audioChoices = computed<VoiceCapsule[]>(() => capsules.value.filter(item => item.audioUrl).slice(0, 24))
const selectedPhoto = computed(() => mediaChoices.value.find(item => item.id === selectedPhotoId.value))
const selectedAudio = computed(() => audioChoices.value.find(item => item.id === selectedAudioId.value))
const currentMediaIsVideo = computed(() => egg.value?.mediaType === 'video')
const dateTokens = computed(() => {
  const values = [relationshipStart.value, ...anniversaries.value.map(item => item.eventDate)]
  return [...new Set(values.flatMap(value => { const compact = String(value || '').replace(/\D/g, ''); return [String(value || '').replace(/\D/g, ''), compact.slice(0, 8)] }).filter(Boolean))]
})

function syncStage() { stage.value = egg.value ? 'locked' : 'setup' }
function close() { emit('close') }
function normalized(value: string) { return value.trim().toLowerCase().replace(/\s+/g, '') }
async function unlock() {
  unlockError.value = ''
  const candidate = normalized(secret.value)
  if (!candidate) { unlockError.value = '请输入暗号或特殊日期'; return }
  const dateMatch = dateTokens.value.includes(candidate.replace(/\D/g, ''))
  if (dateMatch || await verify(candidate)) { stage.value = 'revealed'; secret.value = ''; return }
  unlockError.value = '暗号不对，再想想你们之间最特别的那一天。'
}
function choosePhoto(id: string) { selectedPhotoId.value = selectedPhotoId.value === id ? '' : id }
function chooseAudio(id: string) { selectedAudioId.value = selectedAudioId.value === id ? '' : id }
async function saveEgg() {
  savingMessage.value = ''; unlockError.value = ''
  try {
    if (normalized(setupSecret.value).length < 2) throw new Error('暗号至少需要 2 个字符')
    if (!setupContent.value.trim()) throw new Error('请写下彩蛋内容')
    const item = await save({ secret: setupSecret.value, title: setupTitle.value, content: setupContent.value, mediaPath: selectedPhoto.value?.originalPath || selectedPhoto.value?.path, mediaType: selectedPhoto.value?.mediaType, mediaUrl: selectedPhoto.value?.url, audioPath: selectedAudio.value?.audioPath, audioUrl: selectedAudio.value?.audioUrl })
    if (item) { setupSecret.value = ''; stage.value = 'revealed'; savingMessage.value = '秘密已经藏好，先替 TA 保守这个惊喜。' }
  } catch (cause: any) { unlockError.value = cause?.message || error.value || '彩蛋保存失败' }
}
function relock() { stage.value = 'locked'; savingMessage.value = '' }
function editEgg() {
  if (!egg.value) return
  setupSecret.value = ''
  setupTitle.value = egg.value.title
  setupContent.value = egg.value.content
  selectedPhotoId.value = mediaChoices.value.find(item => item.path === egg.value?.mediaPath || item.originalPath === egg.value?.mediaPath)?.id || ''
  selectedAudioId.value = audioChoices.value.find(item => item.audioPath === egg.value?.audioPath)?.id || ''
  stage.value = 'setup'
}
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value)) }
function authorHint() { return profile.value?.displayName || '你' }

onMounted(async () => {
  await Promise.all([load(), loadAlbums(), loadCapsules(true), loadAnniversaries()])
  syncStage()
})
watch(egg, syncStage)
onBeforeUnmount(() => { /* media elements own their playback lifecycle */ })
</script>

<template>
  <Teleport to="body">
    <div class="easter-overlay" role="dialog" aria-modal="true" aria-label="秘密彩蛋">
      <section class="easter-panel">
        <header class="easter-header"><button class="easter-back" type="button" aria-label="返回首页" @click="close"><ArrowLeft :size="18" /><span>返回小家</span></button><div class="easter-brand"><Heart :size="17" fill="currentColor" /> 只属于你们的秘密</div><button class="easter-close" type="button" aria-label="关闭" @click="close"><X :size="19" /></button></header>
        <main class="easter-content">
          <div v-if="loading" class="easter-state"><LoaderCircle :size="24" class="spin" /><span>正在寻找秘密入口…</span></div>
          <template v-else-if="stage === 'setup'">
            <section class="setup-hero"><div class="secret-icon"><KeyRound :size="32" /></div><p class="easter-kicker">HIDDEN FOR TWO</p><h1>藏一份只有你们懂的惊喜</h1><p>设置暗号后，TA 需要输入暗号或你们的特殊日期，才能打开这份礼物。</p></section>
            <section class="setup-form"><label><span>秘密暗号</span><input v-model="setupSecret" type="text" maxlength="60" autocomplete="off" placeholder="例如：第一次见面的地方"></label><label><span>彩蛋标题</span><input v-model="setupTitle" type="text" maxlength="100" placeholder="只属于我们的秘密"></label><label><span>想让 TA 看见什么</span><textarea v-model="setupContent" maxlength="3000" rows="5" placeholder="写一段情话、一个约定，或者一句只有 TA 懂的话……" /></label><div class="attach-heading"><span>附上一份回忆（可选）</span><small>照片、视频封面或声音胶囊</small></div><div class="attach-strip" v-if="mediaChoices.length || audioChoices.length"><button v-for="photo in mediaChoices" :key="photo.id" type="button" class="attach-choice" :class="{ selected: selectedPhotoId === photo.id }" @click="choosePhoto(photo.id)"><img :src="photo.url" :alt="photo.mediaType === 'video' ? '视频封面' : '共同照片'"><i v-if="photo.mediaType === 'video'"><Film :size="12" /></i><Check v-if="selectedPhotoId === photo.id" class="attach-check" :size="14" /></button><button v-for="item in audioChoices" :key="item.id" type="button" class="attach-choice audio-choice" :class="{ selected: selectedAudioId === item.id }" @click="chooseAudio(item.id)"><Music2 :size="20" /><small>{{ item.title }}</small><Check v-if="selectedAudioId === item.id" class="attach-check" :size="14" /></button></div><div v-else class="attach-empty"><ImageIcon :size="17" />先上传一张共同照片或录一枚声音胶囊</div><p v-if="unlockError || error" class="easter-error">{{ unlockError || error }}</p><button class="easter-primary" type="button" :disabled="busy" @click="saveEgg"><Gift :size="17" /> {{ busy ? '正在藏好惊喜…' : '封存这份彩蛋' }}</button><p class="setup-note"><LockKeyhole :size="13" /> 暗号只用于本情侣空间解锁，不会显示在彩蛋内容里。</p></section>
          </template>
          <template v-else-if="stage === 'locked'">
            <section class="locked-stage"><div class="locked-orbit"><span v-for="index in 12" :key="index" :style="{ '--i': index }"><Heart :size="index % 3 === 0 ? 18 : 12" fill="currentColor" /></span><div class="lock-heart"><LockKeyhole :size="38" /></div></div><p class="easter-kicker">A SECRET BETWEEN US</p><h1>这里藏着一份给你的惊喜</h1><p>输入你们的暗号，或者试试你们的特殊日期。</p><form class="unlock-form" @submit.prevent="unlock"><div class="unlock-input"><KeyRound :size="17" /><input v-model="secret" type="text" autocomplete="off" placeholder="暗号 / YYYYMMDD"><button type="submit" aria-label="解锁" title="解锁"><ArrowLeft :size="17" /></button></div><p v-if="unlockError" class="easter-error">{{ unlockError }}</p></form><p class="date-hint">提示：在一起的日期或纪念日也可以成为钥匙。</p><button class="setup-link" type="button" @click="editEgg"><Sparkles :size="14" /> 修改这份秘密</button></section>
          </template>
          <template v-else>
            <section class="revealed-stage"><div class="reveal-sparkles" aria-hidden="true"><Sparkles v-for="index in 8" :key="index" :style="{ '--i': index }" :size="index % 2 ? 14 : 10" /></div><div class="revealed-label"><Gift :size="15" /> 你打开了秘密彩蛋</div><h1>{{ egg?.title }}</h1><p class="revealed-date">封存于 {{ egg ? formatDate(egg.createdAt) : '' }}</p><div class="revealed-content"><p>{{ egg?.content }}</p><div v-if="egg?.mediaUrl" class="revealed-media"><video v-if="currentMediaIsVideo" :src="egg.mediaUrl" controls playsinline preload="metadata" /><img v-else :src="egg.mediaUrl" alt="彩蛋里的共同回忆"></div><div v-if="egg?.audioUrl" class="revealed-audio"><Volume2 :size="18" /><div><span>还有一段声音，想让你亲自听见</span><audio :src="egg.audioUrl" controls preload="metadata" /></div></div></div><p class="revealed-signature">{{ authorHint() }} 想把这一刻，偷偷留给你。</p><div class="revealed-actions"><button class="easter-primary" type="button" @click="relock"><LockKeyhole :size="16" /> 重新锁上</button><button class="setup-link" type="button" @click="editEgg">编辑彩蛋</button></div><p v-if="savingMessage" class="saved-note"><Check :size="14" /> {{ savingMessage }}</p></section>
          </template>
        </main>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.easter-overlay{position:fixed;z-index:245;inset:0;display:grid;place-items:center;padding:clamp(10px,3vw,36px);background:rgba(35,20,44,.46);backdrop-filter:blur(19px);-webkit-backdrop-filter:blur(19px)}.easter-panel{display:flex;width:min(850px,100%);max-height:min(850px,calc(100dvh - 22px));flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.88);border-radius:34px;background:linear-gradient(145deg,rgba(255,252,255,.96),rgba(248,236,255,.92));box-shadow:0 35px 100px rgba(51,26,68,.3);color:#4c3658}.easter-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(154,97,183,.13);background:rgba(255,255,255,.56)}.easter-back,.easter-close{display:flex;align-items:center;gap:7px;min-height:36px;border:0;border-radius:12px;background:rgba(255,255,255,.68);color:#82628e;cursor:pointer}.easter-back{padding:0 10px;font:inherit;font-size:11px;font-weight:750}.easter-close{width:36px;justify-content:center}.easter-brand{display:flex;align-items:center;gap:7px;color:#954da7;font-size:13px;font-weight:900}.easter-content{overflow-y:auto;padding:32px clamp(18px,6vw,74px) 48px}.easter-kicker{margin:0;color:#a459ad;font-size:9px;font-weight:900;letter-spacing:.17em}.setup-hero{text-align:center}.secret-icon{display:grid;place-items:center;width:70px;height:70px;margin:0 auto 15px;border:1px solid rgba(255,255,255,.92);border-radius:24px;background:linear-gradient(145deg,#ead2f8,#ffdce9);color:#a053ab;box-shadow:0 15px 30px rgba(144,77,161,.16);transform:rotate(-5deg)}.setup-hero h1,.locked-stage h1,.revealed-stage h1{margin:8px 0 9px;color:#4a2f58;font-size:clamp(28px,5vw,44px);line-height:1.15}.setup-hero>p:not(.easter-kicker),.locked-stage>p:not(.easter-kicker){margin:0 auto;color:#927d99;font-size:12px;line-height:1.7}.setup-form{max-width:620px;margin:27px auto 0;padding:22px;border:1px solid rgba(255,255,255,.9);border-radius:23px;background:rgba(255,255,255,.64);box-shadow:0 16px 34px rgba(105,61,121,.08)}.setup-form label{display:block;margin-top:14px}.setup-form label:first-child{margin-top:0}.setup-form label>span,.attach-heading>span{display:block;margin-bottom:7px;color:#6f5579;font-size:11px;font-weight:800}.setup-form input,.setup-form textarea{box-sizing:border-box;width:100%;padding:12px 13px;border:1px solid #eaddec;border-radius:12px;outline:0;background:rgba(255,255,255,.76);color:#5d4268;font:inherit;font-size:11px}.setup-form textarea{resize:vertical;line-height:1.8}.setup-form input:focus,.setup-form textarea:focus{border-color:#bc82ca;box-shadow:0 0 0 3px rgba(188,130,202,.12)}.attach-heading{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:18px}.attach-heading small{color:#a38ca8;font-size:9px}.attach-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 0 5px}.attach-choice{position:relative;display:grid;place-items:center;width:64px;height:64px;flex:0 0 64px;overflow:hidden;border:2px solid transparent;border-radius:13px;background:#f2e8f5;color:#aa6bb5;cursor:pointer}.attach-choice img{width:100%;height:100%;object-fit:cover}.attach-choice.selected{border-color:#a756ac;box-shadow:0 0 0 3px rgba(167,86,172,.15)}.attach-choice i{position:absolute;right:4px;bottom:4px;display:grid;place-items:center;width:20px;height:20px;border-radius:7px;background:rgba(47,30,53,.66);color:#fff}.attach-choice .attach-check{position:absolute;top:4px;right:4px;color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))}.audio-choice{width:132px;grid-template-columns:auto 1fr;gap:5px;padding:8px;color:#9a5cab}.audio-choice small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}.attach-empty{display:flex;align-items:center;gap:6px;padding:15px 0;color:#a38ea7;font-size:10px}.easter-primary{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:43px;margin-top:16px;padding:0 16px;border:0;border-radius:14px;background:linear-gradient(135deg,#8c4fb5,#d35e9a);color:#fff;box-shadow:0 13px 27px rgba(145,72,160,.2);font:inherit;font-size:11px;font-weight:850;cursor:pointer}.easter-primary:disabled{opacity:.5;cursor:not-allowed}.setup-note{display:flex;align-items:center;justify-content:center;gap:5px;margin:12px 0 0;color:#a28da6;font-size:9px}.easter-error{margin:10px 0 0;color:#b64c73;font-size:10px}.locked-stage{display:flex;align-items:center;flex-direction:column;text-align:center}.locked-stage>p:not(.easter-kicker){max-width:360px}.locked-orbit{position:relative;width:210px;height:170px;margin:0 auto 4px;color:#c783bc}.locked-orbit>span{position:absolute;left:calc(50% + cos(var(--i) * 30deg) * 80px - 7px);top:calc(50% + sin(var(--i) * 30deg) * 62px - 7px);animation:orbit-heart calc(4s + var(--i) * .15s) ease-in-out infinite alternate}.locked-orbit>span:nth-child(2n){color:#e58cae}.lock-heart{position:absolute;inset:42px 66px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.85);border-radius:50%;background:linear-gradient(145deg,#e6c8f6,#ffd2e4);color:#a64f9f;box-shadow:0 18px 42px rgba(150,70,151,.2);animation:lock-breathe 2.6s ease-in-out infinite}@keyframes orbit-heart{from{transform:translateY(10px) rotate(-8deg);opacity:.35}to{transform:translateY(-9px) rotate(9deg);opacity:.85}}@keyframes lock-breathe{50%{transform:scale(1.06);box-shadow:0 23px 55px rgba(150,70,151,.32)}}.unlock-form{width:min(100%,390px);margin-top:24px}.unlock-input{display:flex;align-items:center;gap:8px;padding:6px 7px 6px 13px;border:1px solid #eadbed;border-radius:15px;background:rgba(255,255,255,.8);box-shadow:0 10px 23px rgba(101,55,114,.08)}.unlock-input>svg{color:#a262ac}.unlock-input input{min-width:0;flex:1;padding:9px 0;border:0;outline:0;background:transparent;color:#5e4168;font:inherit;font-size:12px}.unlock-input button{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:11px;background:#8d50b4;color:#fff;cursor:pointer;transform:rotate(180deg)}.date-hint{margin-top:14px!important;color:#a18aa5!important;font-size:9px!important}.setup-link{display:inline-flex;align-items:center;gap:5px;margin-top:17px;padding:0;border:0;background:transparent;color:#a267ad;font:inherit;font-size:10px;font-weight:750;cursor:pointer}.revealed-stage{position:relative;display:flex;align-items:center;flex-direction:column;text-align:center;animation:reveal-in .65s ease both}@keyframes reveal-in{from{opacity:0;transform:scale(.94) translateY(15px)}to{opacity:1;transform:none}}.revealed-label{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:99px;background:#f3e1f4;color:#9b51a6;font-size:10px;font-weight:850}.revealed-stage h1{max-width:650px;margin-top:18px}.revealed-date{margin:0;color:#a18ba5;font-size:10px}.revealed-content{width:min(100%,610px);margin-top:23px;padding:24px;border:1px solid rgba(255,255,255,.9);border-radius:23px;background:rgba(255,255,255,.66);box-shadow:0 17px 38px rgba(104,58,119,.09)}.revealed-content>p{margin:0;color:#5e4668;font-size:15px;line-height:1.95;white-space:pre-wrap}.revealed-media{overflow:hidden;margin-top:18px;border-radius:16px}.revealed-media img,.revealed-media video{display:block;width:100%;max-height:390px;object-fit:contain;background:#f1e7f4}.revealed-audio{display:flex;align-items:flex-start;gap:8px;margin-top:17px;padding:11px 12px;border-radius:13px;background:#f7edf7;color:#96579f;text-align:left}.revealed-audio>div{display:grid;gap:6px;min-width:0;flex:1}.revealed-audio span{font-size:10px;font-weight:750}.revealed-audio audio{width:100%;height:32px}.revealed-signature{margin:20px 0 0;color:#9d7fa4;font-size:11px}.revealed-actions{display:flex;align-items:center;gap:9px}.saved-note{display:flex;align-items:center;gap:5px;margin:10px 0 0;color:#5b9a71;font-size:10px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:650px){.easter-overlay{padding:0}.easter-panel{width:100%;height:100dvh;max-height:100dvh;border:0;border-radius:0}.easter-header{padding-top:max(14px,env(safe-area-inset-top));padding-right:max(16px,env(safe-area-inset-right));padding-left:max(16px,env(safe-area-inset-left))}.easter-back span{display:none}.easter-content{padding:25px 16px calc(30px + env(safe-area-inset-bottom))}.setup-hero h1,.locked-stage h1,.revealed-stage h1{font-size:29px}.setup-form{padding:17px}.locked-orbit{transform:scale(.9);margin-top:-10px}.revealed-content{padding:18px}.revealed-content>p{font-size:14px}.easter-primary{width:100%}.revealed-actions{width:100%;flex-direction:column;gap:0}.revealed-actions .setup-link{margin-top:13px}}
</style>
<style scoped>
.locked-orbit>span:nth-child(1){left:42px;top:20px}.locked-orbit>span:nth-child(2){left:86px;top:5px}.locked-orbit>span:nth-child(3){left:137px;top:17px}.locked-orbit>span:nth-child(4){left:177px;top:48px}.locked-orbit>span:nth-child(5){left:184px;top:94px}.locked-orbit>span:nth-child(6){left:151px;top:132px}.locked-orbit>span:nth-child(7){left:103px;top:145px}.locked-orbit>span:nth-child(8){left:54px;top:135px}.locked-orbit>span:nth-child(9){left:19px;top:99px}.locked-orbit>span:nth-child(10){left:12px;top:53px}.locked-orbit>span:nth-child(11){left:67px;top:52px}.locked-orbit>span:nth-child(12){left:144px;top:70px}
</style>
