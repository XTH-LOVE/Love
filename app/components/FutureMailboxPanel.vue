<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CalendarClock, Check, ChevronRight, Clock3, Heart, Inbox, LockKeyhole, Mail, Plus, Send, Sparkles, Trash2, X } from '@lucide/vue'
import { occurrence } from '~/composables/useAnniversaries'
import type { FutureLetter } from '~/composables/useFutureMailbox'

const emit = defineEmits<{ close: [] }>()
const { letters, loading, busy, error, load, create, markOpened, remove, refreshLocalUnlockState } = useFutureMailbox()
const { profile } = useCoupleAuth()
const { members } = useAccountManagement()
const { nextAnniversary } = useAnniversaries()
const showComposer = ref(false)
const tab = ref<'all' | 'locked' | 'unlocked'>('all')
const openedLetter = ref<FutureLetter | null>(null)
const title = ref('')
const content = ref('')
const unlockInput = ref('')
const presetError = ref('')
const nowTick = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

const partner = computed(() => members.value.find(member => member.id !== profile.value?.id))
const visibleLetters = computed(() => letters.value.filter(letter => tab.value === 'all' || (tab.value === 'locked' ? !letter.isUnlocked : letter.isUnlocked)))
const unreadCount = computed(() => letters.value.filter(letter => letter.isUnlocked && !letter.openedAt && letter.recipientId === profile.value?.id).length)

function nameFor(id: string) { return members.value.find(member => member.id === id)?.displayName || (id === profile.value?.id ? '我' : 'TA') }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function countdown(value: string) {
  const distance = Date.parse(value) - nowTick.value
  if (distance <= 0) return '现在可以打开'
  const days = Math.floor(distance / 86400000)
  const hours = Math.floor(distance % 86400000 / 3600000)
  const minutes = Math.floor(distance % 3600000 / 60000)
  return days ? `${days}天 ${hours}小时后` : `${hours}小时 ${minutes}分钟后`
}
function toInputDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function applyPreset(preset: 'birthday' | 'anniversary' | 'hundred' | 'year') {
  presetError.value = ''
  const date = new Date()
  if (preset === 'hundred') date.setDate(date.getDate() + 100)
  else if (preset === 'year') date.setFullYear(date.getFullYear() + 1)
  else if (nextAnniversary.value && (preset === 'anniversary' || preset === 'birthday')) {
    if (preset === 'birthday' && nextAnniversary.value.kind !== 'birthday') { presetError.value = '请先在纪念日里添加一个生日'; return }
    const next = occurrence(nextAnniversary.value)
    date.setFullYear(next.getFullYear(), next.getMonth(), next.getDate())
    date.setHours(9, 0, 0, 0)
  } else { presetError.value = '请先在纪念日里添加对应的日期'; return }
  unlockInput.value = toInputDate(date)
}
function resetComposer() { title.value = ''; content.value = ''; unlockInput.value = ''; presetError.value = '' }
async function submitLetter() {
  try {
    await create({ recipientId: partner.value?.id || '', title: title.value, content: content.value, unlockAt: unlockInput.value })
    resetComposer(); showComposer.value = false
  } catch { /* The composable exposes the message in the panel. */ }
}
async function openLetter(letter: FutureLetter) {
  if (!letter.isUnlocked) return
  openedLetter.value = letter
  try { await markOpened(letter) } catch { /* Keep the letter readable if the read receipt is temporarily offline. */ }
}
async function deleteLetter(letter: FutureLetter) {
  if (!window.confirm('删除这封未来信？删除后双方都无法恢复。')) return
  try {
    await remove(letter)
    if (openedLetter.value?.id === letter.id) openedLetter.value = null
  } catch { /* The composable exposes the message in the panel. */ }
}
onMounted(() => { void load(); ticker = setInterval(() => { nowTick.value = Date.now(); refreshLocalUnlockState() }, 30000) })
onBeforeUnmount(() => { if (ticker) clearInterval(ticker) })
</script>

<template>
  <Teleport to="body">
    <div class="future-overlay" @click.self="emit('close')">
      <section class="future-panel" aria-labelledby="future-mailbox-title">
        <header class="future-header"><div><p class="eyebrow"><Sparkles :size="13" /> PRIVATE FUTURE MAILBOX</p><h2 id="future-mailbox-title">未来信箱</h2><span>把现在的心意，寄给未来的 TA。</span></div><button class="future-close" type="button" aria-label="关闭未来信箱" @click="emit('close')"><X :size="19" /></button></header>
        <section class="future-hero"><div class="future-hero-icon"><Mail :size="27" /></div><div><strong>{{ unreadCount ? `有 ${unreadCount} 封信等你打开` : '写一封只在未来打开的信' }}</strong><span>未到时间的正文会被锁住，只有解锁后才会显示。</span></div><button type="button" class="future-compose" @click="showComposer = true"><Plus :size="16" />写一封</button></section>
        <nav class="future-tabs"><button type="button" :class="{ active: tab === 'all' }" @click="tab = 'all'">全部 <span>{{ letters.length }}</span></button><button type="button" :class="{ active: tab === 'locked' }" @click="tab = 'locked'"><LockKeyhole :size="14" />待解锁 <span>{{ letters.filter(letter => !letter.isUnlocked).length }}</span></button><button type="button" :class="{ active: tab === 'unlocked' }" @click="tab = 'unlocked'"><Check :size="14" />已解锁 <span>{{ letters.filter(letter => letter.isUnlocked).length }}</span></button></nav>
        <div v-if="loading" class="future-state"><Mail :size="28" /><span>正在打开未来的信</span></div>
        <div v-else-if="visibleLetters.length" class="future-list"><article v-for="letter in visibleLetters" :key="letter.id" class="future-letter" :class="{ locked: !letter.isUnlocked, opened: letter.openedAt }"><div class="future-letter-icon"><LockKeyhole v-if="!letter.isUnlocked" :size="19" /><Mail v-else :size="19" /></div><button class="future-letter-main" type="button" :disabled="!letter.isUnlocked" @click="openLetter(letter)"><div><strong>{{ letter.title }}</strong><small>{{ nameFor(letter.senderId) }} 写给 {{ nameFor(letter.recipientId) }} · {{ formatDate(letter.createdAt) }}</small></div><span v-if="!letter.isUnlocked" class="unlock-time"><Clock3 :size="13" />{{ countdown(letter.unlockAt) }}<em>{{ formatDate(letter.unlockAt) }}</em></span><ChevronRight v-else :size="18" /></button><button v-if="letter.senderId === profile?.id" class="future-delete" type="button" aria-label="删除未来信" title="删除这封信" @click.stop="deleteLetter(letter)"><Trash2 :size="15" /></button></article></div>
        <div v-else class="future-state empty"><Heart :size="34" /><strong>还没有寄出的未来信</strong><span>把今天想说的话，留给未来某个重要的日子。</span><button type="button" @click="showComposer = true"><Plus :size="15" />写第一封信</button></div>
        <p v-if="error" class="future-error">{{ error }}</p>
      </section>
    </div>
    <div v-if="showComposer" class="future-compose-overlay" @click.self="showComposer = false"><section class="future-composer"><header><div><p class="eyebrow">WRITE TO THE FUTURE</p><h3>写给 {{ partner?.displayName || 'TA' }}</h3></div><button type="button" aria-label="关闭编辑器" @click="showComposer = false"><X :size="19" /></button></header><div class="recipient-chip"><span class="mini-avatar">{{ partner?.displayName?.slice(0, 1) || 'T' }}</span><span>收件人：{{ partner?.displayName || '等待另一半加入' }}</span></div><label>信件标题<input v-model="title" maxlength="120" placeholder="例如：一周年的时候再打开" /></label><div class="preset-row"><span>快速设置解锁时间</span><button type="button" @click="applyPreset('birthday')">生日</button><button type="button" @click="applyPreset('anniversary')">下个纪念日</button><button type="button" @click="applyPreset('hundred')">100 天后</button><button type="button" @click="applyPreset('year')">一年后</button></div><label>解锁时间<input v-model="unlockInput" type="datetime-local" /></label><p v-if="presetError" class="future-error">{{ presetError }}</p><label>写给未来的正文<textarea v-model="content" maxlength="10000" placeholder="亲爱的未来的我们……&#10;&#10;等 TA 打开这封信时，希望你们已经又一起走过了好多天。" /></label><footer><span>{{ content.length }} / 10000</span><button type="button" class="send-future" :disabled="busy || !partner" @click="submitLetter"><Send :size="16" />{{ busy ? '正在寄出…' : '封存并寄给 TA' }}</button></footer></section></div>
    <div v-if="openedLetter" class="opened-letter-overlay" @click.self="openedLetter = null"><article class="opened-letter"><button type="button" class="opened-close" aria-label="关闭信件" @click="openedLetter = null"><X :size="18" /></button><div class="opened-seal"><Heart :size="25" fill="currentColor" /></div><p class="eyebrow">OPENED ON {{ formatDate(openedLetter.unlockAt) }}</p><h3>{{ openedLetter.title }}</h3><small>{{ nameFor(openedLetter.senderId) }} · {{ formatDate(openedLetter.createdAt) }}</small><div class="opened-content">{{ openedLetter.content }}</div><footer>这封信在 {{ formatDate(openedLetter.unlockAt) }} 之后，终于抵达了 TA 的手里。</footer></article></div>
  </Teleport>
</template>

<style scoped>
.future-overlay,.future-compose-overlay,.opened-letter-overlay{position:fixed;z-index:195;inset:0;display:grid;place-items:center;padding:20px;background:rgba(48,31,58,.3);backdrop-filter:blur(13px)}.future-panel{width:min(100%,720px);max-height:min(860px,calc(100dvh - 40px));overflow:auto;padding:29px;border:1px solid rgba(255,255,255,.88);border-radius:31px;background:linear-gradient(145deg,#fffaff,#fff0f8);box-shadow:0 35px 100px rgba(58,31,70,.25)}.future-header{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.future-header h2{margin:3px 0 5px;color:#4d2c57;font-size:29px}.future-header>div>span{color:#9b849f;font-size:10px}.eyebrow{display:flex;align-items:center;gap:6px;margin:0;color:#a258a0;font-size:9px;font-weight:900;letter-spacing:.1em}.future-close,.future-composer header>button{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:13px;background:#f2e8f4;color:#795f82;cursor:pointer}.future-hero{display:flex;align-items:center;gap:12px;margin-top:22px;padding:15px;border:1px solid rgba(184,119,207,.17);border-radius:21px;background:linear-gradient(135deg,rgba(237,218,249,.78),rgba(255,223,237,.7))}.future-hero-icon{display:grid;place-items:center;width:43px;height:43px;flex:none;border-radius:15px;background:rgba(255,255,255,.75);color:#a55db0}.future-hero>div:nth-child(2){min-width:0;flex:1}.future-hero strong,.future-hero span{display:block}.future-hero strong{color:#67416f;font-size:12px}.future-hero span{margin-top:4px;color:#987b9c;font-size:9px}.future-compose{display:flex;align-items:center;gap:5px;flex:none;padding:10px 13px;border:0;border-radius:14px;background:linear-gradient(135deg,#8c4db8,#d95f9b);color:#fff;font-size:10px;font-weight:800;cursor:pointer}.future-tabs{display:flex;gap:6px;margin:18px 0 12px}.future-tabs button{display:flex;align-items:center;gap:5px;padding:9px 11px;border:0;border-radius:13px;background:transparent;color:#967d99;font-size:10px;font-weight:750;cursor:pointer}.future-tabs button.active{background:#f1e3f5;color:#78438e}.future-tabs span{display:grid;place-items:center;min-width:18px;height:18px;border-radius:9px;background:rgba(255,255,255,.7);font-size:8px}.future-list{display:grid;gap:9px}.future-letter{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid rgba(184,119,207,.14);border-radius:19px;background:rgba(255,255,255,.72);transition:transform .2s,box-shadow .2s}.future-letter:hover{transform:translateY(-1px);box-shadow:0 10px 25px rgba(117,61,133,.09)}.future-letter.locked{background:rgba(249,244,250,.78)}.future-letter.opened{opacity:.75}.future-letter-icon{display:grid;place-items:center;width:37px;height:37px;flex:none;border-radius:13px;background:#f0e2f6;color:#9a5eaa}.future-letter.locked .future-letter-icon{background:#eeeaf1;color:#988c9e}.future-letter-main{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;flex:1;padding:0;border:0;background:transparent;text-align:left;color:inherit;cursor:pointer}.future-letter-main:disabled{cursor:default}.future-letter-main>div{min-width:0}.future-letter-main strong,.future-letter-main small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.future-letter-main strong{color:#604168;font-size:12px}.future-letter-main small{margin-top:4px;color:#a08ca4;font-size:9px}.unlock-time{display:flex;align-items:center;gap:4px;flex:none;color:#a35d91;font-size:9px;font-weight:800}.unlock-time em{display:none;font-style:normal}.future-delete{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:10px;background:#fff0f4;color:#ba6680;cursor:pointer}.future-state{display:flex;min-height:240px;align-items:center;justify-content:center;flex-direction:column;gap:9px;color:#a08aa4;text-align:center}.future-state.empty strong{color:#624469;font-size:13px}.future-state.empty span{font-size:10px}.future-state.empty button{display:flex;align-items:center;gap:5px;margin-top:7px;padding:9px 12px;border:0;border-radius:13px;background:#f0e3f5;color:#7b498b;font-size:10px;font-weight:800;cursor:pointer}.future-error{margin:12px 0 0;color:#ba5574;font-size:10px}.future-compose-overlay{z-index:205}.future-composer{display:grid;grid-template-rows:auto auto auto auto 1fr auto;gap:12px;width:min(100%,640px);height:min(720px,calc(100dvh - 40px));overflow:auto;padding:28px;border:1px solid rgba(255,255,255,.9);border-radius:29px;background:#fffaff;box-shadow:0 30px 90px rgba(55,32,66,.25)}.future-composer header{display:flex;align-items:flex-start;justify-content:space-between}.future-composer h3{margin:3px 0 0;color:#4e3059;font-size:24px}.recipient-chip{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:13px;background:#f5eaf7;color:#76527d;font-size:10px}.mini-avatar{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:linear-gradient(135deg,#b47bdd,#ef83ad);color:#fff;font-size:10px;font-weight:850}.future-composer label{display:grid;gap:6px;color:#7d607f;font-size:10px;font-weight:800}.future-composer input,.future-composer textarea{width:100%;border:1px solid #e5d8e8;border-radius:13px;outline:0;background:#fff;color:#5e4265;font:inherit;font-size:12px}.future-composer input{min-height:42px;padding:0 12px}.future-composer textarea{min-height:190px;padding:13px;resize:vertical;line-height:1.8}.preset-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.preset-row>span{width:100%;color:#9a839d;font-size:9px}.preset-row button{padding:7px 9px;border:0;border-radius:10px;background:#f3e8f5;color:#80518d;font-size:9px;font-weight:750;cursor:pointer}.future-composer footer{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#a08ca3;font-size:9px}.send-future{display:flex;align-items:center;gap:6px;padding:11px 14px;border:0;border-radius:14px;background:linear-gradient(135deg,#8b4db9,#d85f99);color:#fff;font-size:10px;font-weight:850;cursor:pointer}.send-future:disabled{opacity:.5;cursor:not-allowed}.opened-letter-overlay{z-index:215}.opened-letter{position:relative;width:min(100%,580px);max-height:calc(100dvh - 40px);overflow:auto;padding:42px 38px 30px;border:1px solid rgba(255,255,255,.92);border-radius:29px;background:repeating-linear-gradient(#fffaff 0,#fffaff 32px,#f3e7f3 33px);box-shadow:0 35px 90px rgba(55,32,66,.26);text-align:center}.opened-close{position:absolute;top:13px;right:13px;display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:11px;background:#f2e8f4;color:#795f82;cursor:pointer}.opened-seal{display:grid;place-items:center;width:56px;height:56px;margin:0 auto 17px;border-radius:50%;background:#f6d8e7;color:#bd5d8c}.opened-letter h3{margin:6px 0 7px;color:#51325d;font-size:27px}.opened-letter>small{color:#a184a5;font-size:10px}.opened-content{margin:25px 0;color:#60466a;font-size:15px;line-height:2.1;text-align:left;white-space:pre-wrap}.opened-letter footer{color:#a783a6;font-size:9px}@media(max-width:650px){.future-overlay,.opened-letter-overlay{align-items:end;padding:0}.future-panel{max-height:calc(100dvh - env(safe-area-inset-top));padding:22px 16px calc(19px + env(safe-area-inset-bottom));border-radius:26px 26px 0 0}.future-header h2{font-size:24px}.future-hero{margin-top:17px}.future-hero span{line-height:1.5}.future-tabs{overflow:auto}.future-tabs button{white-space:nowrap}.future-compose-overlay{align-items:end;padding:0}.future-composer{width:100%;height:calc(100dvh - env(safe-area-inset-top));max-height:90dvh;padding:21px 16px calc(18px + env(safe-area-inset-bottom));border-radius:25px 25px 0 0}.future-composer h3{font-size:21px}.future-composer textarea{min-height:150px}.opened-letter{width:100%;max-height:88dvh;border-radius:25px 25px 0 0;padding:38px 22px 25px}.opened-letter h3{font-size:23px}.opened-content{font-size:14px}}
</style>
