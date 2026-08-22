<script setup lang="ts">
import { LoaderCircle, Sparkles, Trash2 } from '@lucide/vue'
import { MOOD_OPTIONS, type MoodType } from '~/composables/useMoodCheckin'

const { profile } = useCoupleAuth()
const { members } = useAccountManagement()
const partnerProfile = computed(() => members.value.find(m => m.id !== profile.value?.id))
const { checkins, loading, busy, error, load, checkin, removeMood, getMyTodayMood, getPartnerTodayMood, getRecentMoods } = useMoodCheckin()

const showPicker = ref(false)
const selectedMood = ref<MoodType | null>(null)
const moodNote = ref('')

const myTodayMood = computed(() => getMyTodayMood())
const partnerTodayMood = computed(() => getPartnerTodayMood(partnerProfile.value?.id))
const recentMoods = computed(() => getRecentMoods(7))

function moodEmoji(mood: MoodType | string) {
  return MOOD_OPTIONS.find(o => o.value === mood)?.emoji || '😶'
}

function moodLabel(mood: MoodType | string) {
  return MOOD_OPTIONS.find(o => o.value === mood)?.label || '未知'
}

function moodColor(mood: MoodType | string) {
  const colors: Record<string, string> = {
    happy: '#f5c84c', love: '#f28bab', calm: '#8ec5b0', excited: '#f5a623',
    tired: '#b0a8c9', sad: '#7eb3d8', angry: '#e87474', anxious: '#c9a0dc',
  }
  return colors[mood] || '#ccc'
}

async function submitMood() {
  if (!selectedMood.value) return
  await checkin(selectedMood.value, moodNote.value.trim())
  showPicker.value = false
  selectedMood.value = null
  moodNote.value = ''
}

async function handleRemove(id: string) {
  await removeMood(id)
}

onMounted(() => { load() })
</script>

<template>
  <section class="mood-widget panel" aria-label="心情签到">
    <div class="mood-header">
      <div>
        <p class="eyebrow">HOW ARE YOU FEELING</p>
        <h3>今天的心情</h3>
      </div>
      <Sparkles :size="18" />
    </div>

    <div class="mood-today">
      <div class="mood-person" :class="{ empty: !myTodayMood }">
        <span class="mood-person-label">你</span>
        <div v-if="myTodayMood" class="mood-bubble" :style="{ background: moodColor(myTodayMood.mood) }">
          <span class="mood-emoji">{{ moodEmoji(myTodayMood.mood) }}</span>
          <span class="mood-label">{{ moodLabel(myTodayMood.mood) }}</span>
        </div>
        <button v-else class="mood-empty-btn" type="button" @click="showPicker = !showPicker">
          <span>?</span>
          <small>点击签到</small>
        </button>
      </div>

      <div class="mood-divider">
        <span class="mood-heart">💕</span>
      </div>

      <div class="mood-person" :class="{ empty: !partnerTodayMood }">
        <span class="mood-person-label">TA</span>
        <div v-if="partnerTodayMood" class="mood-bubble" :style="{ background: moodColor(partnerTodayMood.mood) }">
          <span class="mood-emoji">{{ moodEmoji(partnerTodayMood.mood) }}</span>
          <span class="mood-label">{{ moodLabel(partnerTodayMood.mood) }}</span>
        </div>
        <div v-else class="mood-empty-hint">
          <span>…</span>
          <small>还没签到</small>
        </div>
      </div>
    </div>

    <Transition name="mood-slide">
      <div v-if="showPicker" class="mood-picker">
        <p class="mood-picker-title">选择今天的心情</p>
        <div class="mood-grid">
          <button
            v-for="option in MOOD_OPTIONS"
            :key="option.value"
            type="button"
            class="mood-option"
            :class="{ active: selectedMood === option.value }"
            @click="selectedMood = option.value"
          >
            <span class="mood-option-emoji">{{ option.emoji }}</span>
            <span class="mood-option-label">{{ option.label }}</span>
          </button>
        </div>
        <input
          v-model="moodNote"
          maxlength="100"
          placeholder="想写点什么吗？（可选）"
          class="mood-note-input"
        />
        <div class="mood-picker-actions">
          <button type="button" class="mood-cancel" @click="showPicker = false">取消</button>
          <button type="button" class="mood-submit" :disabled="!selectedMood || busy" @click="submitMood">
            <LoaderCircle v-if="busy" class="spin" :size="14" />
            {{ busy ? '签到中...' : '签到' }}
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="recentMoods.length > 0" class="mood-history">
      <p class="mood-history-title">最近 7 天</p>
      <div class="mood-history-list">
        <div v-for="item in recentMoods.slice(0, 7)" :key="item.id" class="mood-history-item">
          <span class="mood-history-date">{{ item.moodDate.slice(5) }}</span>
          <span class="mood-history-emoji" :style="{ background: moodColor(item.mood) }">{{ moodEmoji(item.mood) }}</span>
          <span v-if="item.note" class="mood-history-note">{{ item.note }}</span>
          <span v-if="item.userId === profile?.id" class="mood-history-delete">
            <button type="button" title="删除" @click="handleRemove(item.id)"><Trash2 :size="11" /></button>
          </span>
        </div>
      </div>
    </div>

    <p v-if="error" class="widget-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.mood-widget{padding:20px 22px;background:linear-gradient(135deg,rgba(255,253,248,.95),rgba(255,245,250,.9));overflow:hidden}
.mood-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:16px}
.mood-header h3{margin:3px 0 0;color:#5a3d5e;font-size:17px}
.mood-header>svg{color:#d4a0c0}
.mood-today{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:16px}
.mood-person{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:80px}
.mood-person-label{font-size:10px;font-weight:700;color:#8a6d8e;text-transform:uppercase;letter-spacing:.5px}
.mood-bubble{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 16px;border-radius:20px;color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.08);transition:transform .2s ease}
.mood-bubble:hover{transform:scale(1.05)}
.mood-emoji{font-size:28px;line-height:1}
.mood-label{font-size:10px;font-weight:700;opacity:.9}
.mood-empty-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px 18px;border:2px dashed rgba(180,140,180,.3);border-radius:20px;background:rgba(255,255,255,.5);cursor:pointer;transition:all .2s ease}
.mood-empty-btn:hover{border-color:rgba(200,120,170,.5);background:rgba(255,240,250,.7)}
.mood-empty-btn span{font-size:24px;color:#c0a0b8}
.mood-empty-btn small{font-size:9px;color:#a088a0}
.mood-empty-hint{display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px 18px;border-radius:20px;background:rgba(240,230,240,.3)}
.mood-empty-hint span{font-size:24px;color:#c0b0c0}
.mood-empty-hint small{font-size:9px;color:#b0a0b0}
.mood-divider{display:flex;align-items:center;justify-content:center}
.mood-heart{font-size:18px;animation:mood-pulse 2s ease-in-out infinite}
@keyframes mood-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
.mood-picker{margin:12px 0;padding:16px;border-radius:16px;background:rgba(255,255,255,.7);border:1px solid rgba(200,160,200,.15)}
.mood-picker-title{margin:0 0 12px;font-size:12px;font-weight:700;color:#6a4d6e;text-align:center}
.mood-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.mood-option{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border:2px solid transparent;border-radius:14px;background:rgba(255,255,255,.6);cursor:pointer;transition:all .15s ease}
.mood-option:hover{background:rgba(255,240,250,.8);border-color:rgba(200,150,180,.2)}
.mood-option.active{border-color:#d48ab0;background:rgba(255,230,245,.9);box-shadow:0 2px 8px rgba(200,120,160,.15)}
.mood-option-emoji{font-size:22px}
.mood-option-label{font-size:9px;color:#7a5d7e;font-weight:600}
.mood-note-input{width:100%;min-height:32px;padding:8px 12px;border:1px solid rgba(180,140,180,.2);border-radius:10px;background:rgba(255,255,255,.8);color:#6a4d6e;font-size:11px;outline:none;margin-bottom:10px}
.mood-note-input::placeholder{color:#b8a0b8}
.mood-note-input:focus{border-color:rgba(200,120,170,.4)}
.mood-picker-actions{display:flex;gap:8px;justify-content:flex-end}
.mood-cancel{padding:6px 14px;border:1px solid rgba(180,140,180,.2);border-radius:10px;background:transparent;color:#8a6d8e;font-size:10px;cursor:pointer}
.mood-cancel:hover{background:rgba(240,230,240,.5)}
.mood-submit{display:flex;align-items:center;gap:5px;padding:6px 18px;border:0;border-radius:10px;background:linear-gradient(135deg,#c06a9e,#a855a0);color:#fff;font-size:10px;font-weight:700;cursor:pointer;box-shadow:0 4px 10px rgba(180,100,150,.2)}
.mood-submit:disabled{opacity:.5;cursor:default}
.mood-history{margin-top:14px;padding-top:12px;border-top:1px solid rgba(200,160,200,.12)}
.mood-history-title{margin:0 0 8px;font-size:10px;font-weight:700;color:#8a6d8e;text-transform:uppercase;letter-spacing:.5px}
.mood-history-list{display:flex;flex-direction:column;gap:5px}
.mood-history-item{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:10px;background:rgba(255,255,255,.4)}
.mood-history-date{font-size:10px;color:#9a809a;font-variant-numeric:tabular-nums;min-width:36px}
.mood-history-emoji{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;font-size:13px}
.mood-history-note{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#7a5d7e}
.mood-history-delete button{display:grid;place-items:center;width:20px;height:20px;border:0;border-radius:6px;background:transparent;color:#c0a0b8;cursor:pointer;opacity:0;transition:opacity .15s}
.mood-history-item:hover .mood-history-delete button{opacity:1}
.mood-history-delete button:hover{background:rgba(220,100,130,.1);color:#d06080}
.widget-error{margin:8px 0 0;padding:6px 10px;background:#ffe6ef;color:#b64f73;font-size:10px;border-radius:8px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.mood-slide-enter-active,.mood-slide-leave-active{transition:all .25s ease}
.mood-slide-enter-from,.mood-slide-leave-to{opacity:0;transform:translateY(-8px)}
@media(max-width:760px){.mood-grid{grid-template-columns:repeat(4,1fr);gap:6px}.mood-option{padding:8px 2px}.mood-option-emoji{font-size:18px}.mood-bubble{padding:10px 12px}.mood-emoji{font-size:22px}.mood-today{gap:8px}}
</style>
