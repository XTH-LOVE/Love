<script setup lang="ts">
import { ChevronLeft, ChevronRight, Flame, LoaderCircle, Sparkles } from '@lucide/vue'

const { days, events, milestones, rewards, month, loading, error, load } = useStreakHistory()
const { members, loadMembers } = useAccountManagement()
const milestoneOptions = [3, 7, 14, 30, 100]
const sourceLabels: Record<string, string> = { manual: '签到', message: '消息', photo: '照片', video: '视频', memory: '时光', checklist: '清单', letter: '情书', ai: 'AI', pet: '宠物', other: '互动' }
const monthTitle = computed(() => { const [year, value] = month.value.split('-'); return year && value ? `${year} 年 ${Number(value)} 月` : '火花历史' })
const dayMap = computed(() => new Map(days.value.map(day => [day.date, day])))
const calendarCells = computed(() => {
  if (!month.value) return []
  const first = new Date(`${month.value}-01T00:00:00Z`)
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const offset = first.getUTCDay()
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => `${month.value}-${String(index + 1).padStart(2, '0')}`)]
})
const recentEvents = computed(() => events.value.slice(0, 6))
const memberName = (id: string) => members.value.find(member => member.id === id)?.displayName || 'TA'
const milestoneDone = (day: number) => milestones.value.some(item => item.days === day)
function shiftMonth(offset: number) { const current = new Date(`${month.value || new Intl.DateTimeFormat('en-CA').format(new Date()).slice(0, 7)}-01T00:00:00Z`); current.setUTCMonth(current.getUTCMonth() + offset); void load(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`) }
onMounted(async () => { await Promise.all([load(), loadMembers()]) })
</script>

<template>
  <section class="streak-history panel" aria-label="火花历史">
    <header class="history-header"><div><p class="eyebrow">OUR STREAK MEMORY</p><h2>火花历史</h2><span>每天留一点痕迹，回头看见你们一起坚持过的日子。</span></div><div class="history-month"><button type="button" title="上个月" @click="shiftMonth(-1)"><ChevronLeft :size="16"/></button><strong>{{ monthTitle }}</strong><button type="button" title="下个月" @click="shiftMonth(1)"><ChevronRight :size="16"/></button></div></header>
    <div v-if="loading" class="history-loading"><LoaderCircle class="spin" :size="18"/>正在整理你们的火花</div>
    <template v-else>
      <div class="week-labels"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="heatmap"><div v-for="(date, index) in calendarCells" :key="date || `empty-${index}`" class="heat-cell" :class="{empty: !date, level1: date && dayMap.get(date)?.count === 1, level2: date && dayMap.get(date)?.count >= 2}" :title="date ? `${date} · ${dayMap.get(date)?.count || 0}/2 人完成` : ''"><span v-if="date">{{ Number(date.slice(-2)) }}</span></div></div>
      <div class="history-legend"><span><i class="level0"/>未完成</span><span><i class="level1"/>一人完成</span><span><i class="level2"/>双方完成</span></div>
      <div class="milestone-row"><div v-for="day in milestoneOptions" :key="day" class="milestone" :class="{done: milestoneDone(day)}"><Flame :size="14" fill="currentColor"/><b>{{ day }}</b><small>天</small></div></div>
      <div v-if="recentEvents.length" class="history-events"><div v-for="event in recentEvents" :key="`${event.createdAt}-${event.actorId}`" class="history-event"><span class="event-dot"><Sparkles :size="12"/></span><div><strong>{{ memberName(event.actorId) }} · {{ sourceLabels[event.activityType] || '互动' }}</strong><small>{{ event.date }}<template v-if="event.note"> · {{ event.note }}</template></small></div></div></div>
      <p v-else class="history-empty">还没有记录，今天先留下一颗小火花吧。</p>
      <p class="reward-summary">已解锁 {{ rewards.length }} 个宠物/小屋奖励</p>
    </template>
    <p v-if="error" class="history-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.streak-history{margin-top:16px;padding:22px;background:rgba(255,251,255,.84)}.history-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.history-header h2{margin:4px 0 5px;color:#52355b;font-size:21px}.history-header span{color:#927d98;font-size:10px}.history-month{display:flex;align-items:center;gap:8px}.history-month button{display:grid;place-items:center;width:28px;height:28px;border:1px solid rgba(185,126,193,.2);border-radius:9px;background:#fff;color:#805783;cursor:pointer}.history-month strong{min-width:86px;text-align:center;color:#6d4c73;font-size:11px}.week-labels,.heatmap{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.week-labels{margin-top:22px;color:#aa94a8;font-size:9px;text-align:center}.heatmap{margin-top:6px}.heat-cell{position:relative;display:grid;place-items:center;aspect-ratio:1;border-radius:8px;background:#f1eaf3;color:#a990a8;font-size:9px}.heat-cell.level1{background:#e5c8e9;color:#805783}.heat-cell.level2{background:linear-gradient(135deg,#a876c5,#e48caf);color:#fff}.heat-cell.empty{visibility:hidden}.history-legend{display:flex;gap:12px;margin-top:10px;color:#a28da1;font-size:9px}.history-legend span{display:flex;align-items:center;gap:4px}.history-legend i{width:8px;height:8px;border-radius:3px;background:#f1eaf3}.history-legend i.level1{background:#e5c8e9}.history-legend i.level2{background:#c58ac4}.milestone-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:20px}.milestone{display:flex;align-items:center;justify-content:center;gap:3px;padding:8px 3px;border:1px solid #eadfed;border-radius:10px;color:#b19aaf;background:#fff;font-size:10px}.milestone.done{border-color:#dfb25a;background:#fff6df;color:#c58b2e}.milestone small{font-size:8px}.history-events{display:grid;gap:8px;margin-top:18px}.history-event{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:11px;background:rgba(248,239,249,.72)}.event-dot{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#ead8ef;color:#955ea4}.history-event strong,.history-event small{display:block}.history-event strong{color:#715174;font-size:9px}.history-event small{margin-top:2px;color:#a18ca0;font-size:8px}.history-empty,.reward-summary{margin:18px 0 0;color:#a18da0;font-size:9px}.reward-summary{color:#92568e;font-weight:800}.history-error{margin:12px 0 0;color:#b64f73;font-size:9px}.history-loading{display:flex;align-items:center;justify-content:center;gap:7px;min-height:140px;color:#927d98;font-size:10px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:700px){.streak-history{padding:17px;border-radius:20px}.history-header{display:block}.history-month{margin-top:13px;justify-content:space-between}.week-labels,.heatmap{gap:4px}.milestone-row{gap:4px}.milestone{font-size:9px}}
</style>
