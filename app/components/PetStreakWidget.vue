<script setup lang="ts">
import { BellRing, Flame, Gamepad2, Hand, Heart, LoaderCircle, Sparkles, Utensils } from '@lucide/vue'

const { pet, streak, loading, busy, error, todayCompleted, todayActionCount, todayActorIds, petRewards, streakNotice, moodLabel, hungerLabel, levelProgress, load, recordActivity, interact, disconnect } = useCouplePet()
const { profile } = useCoupleAuth()
const { members, loadMembers } = useAccountManagement()
const { enabled: reminderEnabled, busy: reminderBusy, enable: enableReminder, disable: disableReminder } = useStreakReminders()
const mood = ref(5)
const note = ref('')
const petArt = computed(() => ({ bunny: '🐰', cat: '🐱', puppy: '🐶', bear: '🐻', fox: '🦊', panda: '🐼', penguin: '🐧', hamster: '🐹' }[pet.value?.species || 'bunny']))
const currentUserId = computed(() => profile.value?.id || 'demo-user')
const memberLabel = (member: { id: string; displayName: string }) => member.id === currentUserId.value ? '你' : 'TA'
const memberDone = (id: string) => todayActorIds.value.includes(id)
async function commitStreak() { await recordActivity('manual', mood.value, note.value); if (todayCompleted.value) note.value = '' }
async function toggleReminder() { if (reminderEnabled.value) await disableReminder(); else await enableReminder() }
onMounted(async () => { await Promise.all([load(), loadMembers()]) })
onBeforeUnmount(disconnect)
const streakCopy = computed(() => todayCompleted.value ? '今天的火花已经接上啦' : '今天也来见面一次吧')
</script>

<template>
  <section class="pet-streak-widget panel" aria-label="共同宠物和续火花">
    <div class="streak-column">
      <div class="widget-heading"><div><p class="eyebrow">TOGETHER, EVERY DAY</p><h3>续一朵火花</h3></div><Sparkles :size="19" /></div>
      <div class="streak-number"><Flame :size="28" fill="currentColor"/><strong>{{ streak?.currentDays || 0 }}</strong><span>天连续互动</span></div>
      <p class="streak-copy">{{ streakCopy }} · 最长连续 {{ streak?.longestDays || 0 }} 天</p>
      <p class="streak-progress" aria-live="polite">{{ todayActionCount >= 2 ? '双方都已完成' : `今日已完成 ${todayActionCount}/2` }}</p>
      <p class="streak-protection">火花保护 {{ streak?.protectionCount || 0 }} 次 · 连续 7 天奖励 1 次</p>
      <p v-if="streakNotice" class="streak-notice" aria-live="polite">{{ streakNotice }}</p>
      <div class="partner-status" aria-label="双方今日火花状态"><div v-for="member in members" :key="member.id" class="partner-status-item" :class="{done: memberDone(member.id)}"><span class="partner-avatar"><img v-if="member.avatarUrl" :src="member.avatarUrl" alt=""/><span v-else>{{ member.displayName.slice(0, 1) }}</span></span><span><b>{{ memberLabel(member) }}</b><small>{{ memberDone(member.id) ? '已完成' : '待续' }}</small></span></div></div>
      <div class="checkin-fields"><select v-model="mood" aria-label="今日心情"><option :value="5">今天很开心</option><option :value="4">今天不错</option><option :value="3">今天平静</option><option :value="2">今天有点累</option><option :value="1">今天想被抱抱</option></select><input v-model="note" maxlength="240" placeholder="留一句今天的话" aria-label="今日签到"/></div>
      <button class="reminder-button" type="button" :disabled="reminderBusy" @click="toggleReminder"><BellRing :size="13"/> {{ reminderEnabled ? '已开启每日 20:30 提醒' : '开启每日 20:30 温柔提醒' }}</button>
      <button class="streak-button" type="button" :disabled="busy || todayCompleted" @click="commitStreak"><LoaderCircle v-if="busy" class="spin" :size="16"/><Heart v-else :size="16" fill="currentColor"/> {{ todayCompleted ? '今日已续上' : '续上今天的火花' }}</button>
    </div>
    <div class="pet-column">
      <div class="widget-heading"><div><p class="eyebrow">OUR LITTLE FRIEND</p><h3>{{ pet?.name || '小爱' }} 的小屋</h3></div><span class="pet-level">Lv.{{ pet?.level || 1 }}</span></div>
      <div class="pet-main"><div class="pet-avatar" :class="`skin-${pet?.skin || 'lavender'}`">{{ petArt }}</div><div class="pet-copy"><strong>{{ moodLabel }}</strong><span>{{ hungerLabel }} · 经验 {{ pet?.experience || 0 }}</span><div class="pet-progress"><i :style="{ width: `${levelProgress}%` }" /></div></div></div>
      <p class="reward-strip">已解锁 {{ petRewards.length }} 个共同奖励 · 火花会让小屋继续长大</p>
      <div class="pet-actions"><button type="button" title="喂食" :disabled="busy || loading" @click="interact('feed')"><Utensils :size="15"/><span>喂食</span></button><button type="button" title="陪玩" :disabled="busy || loading" @click="interact('play')"><Gamepad2 :size="15"/><span>陪玩</span></button><button type="button" title="摸摸" :disabled="busy || loading" @click="interact('pet')"><Hand :size="15"/><span>摸摸</span></button></div>
    </div>
    <p v-if="error" class="widget-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.pet-streak-widget{display:grid;grid-template-columns:1fr 1.2fr;gap:0;overflow:hidden;padding:0;background:linear-gradient(135deg,rgba(255,251,255,.94),rgba(249,239,252,.88))}.streak-column,.pet-column{min-width:0;padding:24px}.streak-column{background:linear-gradient(145deg,rgba(239,220,252,.66),rgba(255,226,239,.46));border-right:1px solid rgba(157,100,176,.12)}.widget-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.widget-heading h3{margin:3px 0 0;color:#52355b;font-size:18px}.widget-heading>svg{color:#c165a6}.streak-number{display:flex;align-items:baseline;gap:7px;margin-top:24px;color:#b24f91}.streak-number strong{font-size:54px;line-height:1;font-weight:780;letter-spacing:0}.streak-number span{color:#8f718f;font-size:11px}.streak-copy{margin:8px 0 4px;color:#927d98;font-size:10px}.streak-progress{margin:0 0 4px;color:#a24e87;font-size:10px;font-weight:800}.streak-protection{margin:0 0 5px;color:#94728f;font-size:9px}.streak-notice{margin:0 0 15px;color:#9c4f86;font-size:9px;font-weight:800}.streak-button{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:42px;border:0;border-radius:15px;background:linear-gradient(135deg,#8d55b5,#dd709f);color:#fff;font-size:11px;font-weight:800;box-shadow:0 12px 24px rgba(144,73,148,.2);cursor:pointer}.streak-button:disabled{opacity:.55;cursor:default}.pet-level{padding:5px 9px;border-radius:11px;background:#f0dced;color:#92568e;font-size:10px;font-weight:800}.pet-main{display:flex;align-items:center;gap:15px;margin-top:18px}.pet-avatar{display:grid;place-items:center;width:82px;height:82px;flex:0 0 82px;border:3px solid rgba(255,255,255,.9);border-radius:28px;background:linear-gradient(145deg,#e8d0fa,#f6d7e8);font-size:48px;box-shadow:0 13px 28px rgba(124,72,143,.16);animation:pet-float 3.2s ease-in-out infinite alternate}.pet-avatar.skin-pink{background:linear-gradient(145deg,#fbd8e7,#f7c9d9)}.pet-avatar.skin-mint{background:linear-gradient(145deg,#d5f1e9,#d7e8f6)}.pet-copy{min-width:0}.pet-copy strong,.pet-copy span{display:block}.pet-copy strong{color:#593c61;font-size:14px}.pet-copy span{margin-top:5px;color:#9a849e;font-size:9px}.pet-progress{height:6px;margin-top:13px;overflow:hidden;border-radius:6px;background:#eadfeb}.pet-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#9a62c0,#e176a3);transition:width .35s ease}.pet-actions{display:flex;gap:7px;margin-top:19px}.pet-actions button{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;flex:1;height:35px;border:1px solid rgba(185,126,193,.2);border-radius:12px;background:rgba(255,255,255,.72);color:#855887;font-size:9px;cursor:pointer}.pet-actions button:disabled{opacity:.5}.widget-error{grid-column:1/-1;margin:0;padding:8px 14px;background:#ffe6ef;color:#b64f73;font-size:10px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pet-float{to{transform:translateY(-5px) rotate(2deg)}}@media(max-width:760px){.pet-streak-widget{grid-template-columns:1fr}.streak-column{border-right:0;border-bottom:1px solid rgba(157,100,176,.12)}.streak-column,.pet-column{padding:19px}.streak-number{margin-top:17px}.streak-number strong{font-size:45px}.pet-avatar{width:68px;height:68px;flex-basis:68px;font-size:39px;border-radius:23px}}
</style>
<style scoped>
/* Give the quote card a clear visual pause before the denser check-in panel. */
.pet-streak-widget{margin-top:18px;grid-template-columns:minmax(0,1fr) minmax(0,1.12fr)}
.streak-copy,.streak-protection{line-height:1.45}
.streak-copy{margin-top:10px;margin-bottom:7px}
.streak-progress{margin-bottom:6px}
.streak-protection{margin-bottom:9px}
@media(max-width:760px){.pet-streak-widget{grid-template-columns:1fr;margin-top:16px}}
</style>
<style scoped>
.partner-status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0 0 11px}.partner-status-item{display:flex;align-items:center;gap:7px;min-width:0;padding:7px;border:1px solid rgba(185,126,193,.16);border-radius:12px;background:rgba(255,255,255,.42)}.partner-status-item.done{border-color:rgba(143,191,160,.5);background:rgba(237,250,242,.62)}.partner-avatar{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;overflow:hidden;border-radius:50%;background:linear-gradient(135deg,#d7b6ee,#f1bfd8);color:#704b7b;font-size:10px;font-weight:800}.partner-avatar img{width:100%;height:100%;object-fit:cover}.partner-status-item b,.partner-status-item small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.partner-status-item b{color:#67446d;font-size:9px}.partner-status-item small{margin-top:2px;color:#9d849d;font-size:8px}.partner-status-item.done small{color:#4f9a70}.checkin-fields{display:grid;grid-template-columns:110px 1fr;gap:6px;margin:0 0 8px}.checkin-fields select,.checkin-fields input{width:100%;min-width:0;height:30px;padding:0 8px;border:1px solid rgba(185,126,193,.2);border-radius:10px;background:rgba(255,255,255,.64);color:#765d7b;font-size:9px;outline:none}.checkin-fields input::placeholder{color:#b59fb5}.reward-strip{margin:9px 0 0;color:#9b7d9b;font-size:9px}@media(max-width:760px){.partner-status{gap:5px}.partner-status-item{padding:6px}.checkin-fields{grid-template-columns:1fr}.reward-strip{font-size:8px}}
.partner-status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0 0 11px}.partner-status-item{display:flex;align-items:center;gap:7px;min-width:0;padding:7px;border:1px solid rgba(185,126,193,.16);border-radius:12px;background:rgba(255,255,255,.42)}.partner-status-item.done{border-color:rgba(143,191,160,.5);background:rgba(237,250,242,.62)}.partner-avatar{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;overflow:hidden;border-radius:50%;background:linear-gradient(135deg,#d7b6ee,#f1bfd8);color:#704b7b;font-size:10px;font-weight:800}.partner-avatar img{width:100%;height:100%;object-fit:cover}.partner-status-item b,.partner-status-item small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.partner-status-item b{color:#67446d;font-size:9px}.partner-status-item small{margin-top:2px;color:#9d849d;font-size:8px}.partner-status-item.done small{color:#4f9a70}.checkin-fields{display:grid;grid-template-columns:110px 1fr;gap:6px;margin:0 0 8px}.checkin-fields select,.checkin-fields input{width:100%;min-width:0;height:30px;padding:0 8px;border:1px solid rgba(185,126,193,.2);border-radius:10px;background:rgba(255,255,255,.64);color:#765d7b;font-size:9px;outline:none}.checkin-fields input::placeholder{color:#b59fb5}.reminder-button{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;min-height:28px;margin:0 0 7px;border:1px solid rgba(185,126,193,.18);border-radius:10px;background:rgba(255,255,255,.48);color:#8f688e;font-size:9px;cursor:pointer}.reminder-button:disabled{opacity:.55;cursor:default}.reward-strip{margin:9px 0 0;color:#9b7d9b;font-size:9px}@media(max-width:760px){.partner-status{gap:5px}.partner-status-item{padding:6px}.checkin-fields{grid-template-columns:1fr}.reward-strip{font-size:8px}}
</style>
