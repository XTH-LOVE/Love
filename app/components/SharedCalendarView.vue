<script setup lang="ts">
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Check, CheckCircle2, Clock3, CloudSun, Edit3, Heart, LoaderCircle, MapPin, Plus, Repeat2, Sparkles, Trash2, X } from '@lucide/vue'
import { EVENT_TYPES, type EventType, type RepeatRule, type SharedEvent, type SharedEventTask } from '~/composables/useSharedCalendar'

type CalendarView = 'month' | 'week' | 'day'
const { profile } = useCoupleAuth()
const { events, tasks, loading, busy, error, load, createEvent, updateEvent, deleteEvent, addTask, toggleTask, deleteTask, startRealtime, stopRealtime, getEventsForMonth, getEventsForDate, getUpcomingEvents } = useSharedCalendar()
const reminders = useSharedCalendarReminders()
const { generate } = useHeartAi()
const { createMemory } = useMemories()
const view = ref<CalendarView>('month')
const anchorDate = ref(new Date())
const selectedDate = ref(dateKey(new Date()))
const showEditor = ref(false)
const showAi = ref(false)
const editing = ref<SharedEvent | null>(null)
const detailEvent = ref<SharedEvent | null>(null)
const title = ref('')
const date = ref('')
const time = ref('')
const eventType = ref<EventType>('date')
const location = ref('')
const description = ref('')
const repeatRule = ref<RepeatRule>('none')
const repeatUntil = ref('')
const reminderMinutes = ref<number[]>([])
const budget = ref('')
const taskDraft = ref('')
const city = ref('')
const aiBudget = ref('9000 元')
const preferences = ref('')
const aiDate = ref(selectedDate.value)
const aiStartTime = ref('10:00')
const aiDuration = ref('一天')
const aiResult = ref('')
const aiError = ref('')
const aiBusy = ref(false)
const actionError = ref('')

const today = dateKey(new Date())
const upcoming = computed(() => getUpcomingEvents(6))
const reminderEvents = computed(() => getUpcomingEvents(120))
const selectedEvents = computed(() => getEventsForDate(selectedDate.value))
const monthEvents = computed(() => getEventsForMonth(anchorDate.value.getFullYear(), anchorDate.value.getMonth() + 1))
const titleLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(anchorDate.value))
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const weekdays = computed(() => Array.from({ length: 7 }, (_, index) => {
  const day = new Date(anchorDate.value)
  day.setDate(day.getDate() - day.getDay() + index)
  return dateKey(day)
}))
const visibleAgenda = computed(() => view.value === 'day' ? [selectedDate.value] : weekdays.value)
const monthCells = computed(() => {
  const first = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    const key = dateKey(day)
    return { key, day: day.getDate(), inMonth: day.getMonth() === anchorDate.value.getMonth(), events: monthEvents.value.filter(event => event.eventDate === key) }
  })
})
const tasksForEvent = computed(() => detailEvent.value ? tasks.value.filter(task => task.eventId === detailEvent.value?.id) : [])
const monthSummary = computed(() => {
  const current = monthEvents.value
  return {
    dates: current.filter(event => event.eventType === 'date').length,
    completed: current.filter(event => event.status === 'done').length,
    total: current.length,
  }
})

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
function eventIcon(type: string) { return EVENT_TYPES.find(item => item.value === type)?.emoji || '•' }
function eventLabel(type: string) { return EVENT_TYPES.find(item => item.value === type)?.label || '其他' }
function displayDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${value}T12:00:00`)) }
function shiftPeriod(amount: number) {
  if (view.value === 'month') anchorDate.value = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() + amount, 1)
  else {
    anchorDate.value = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth(), anchorDate.value.getDate() + amount * (view.value === 'week' ? 7 : 1))
    selectedDate.value = dateKey(anchorDate.value)
  }
}
function goToday() { anchorDate.value = new Date(); selectedDate.value = today }
function selectDay(value: string) {
  selectedDate.value = value
  anchorDate.value = new Date(`${value}T12:00:00`)
}
function openCreate(value = selectedDate.value) {
  editing.value = null
  title.value = ''
  date.value = value
  time.value = ''
  eventType.value = 'date'
  location.value = ''
  description.value = ''
  repeatRule.value = 'none'
  repeatUntil.value = ''
  reminderMinutes.value = []
  budget.value = ''
  actionError.value = ''
  showEditor.value = true
}
function openEdit(event: SharedEvent) {
  editing.value = event
  title.value = event.title
  date.value = event.eventDate
  time.value = event.eventTime || ''
  eventType.value = event.eventType
  location.value = event.location
  description.value = event.description
  repeatRule.value = event.repeatRule || 'none'
  repeatUntil.value = event.repeatUntil || ''
  reminderMinutes.value = [...(event.reminderMinutes || [])]
  budget.value = event.budget == null ? '' : String(event.budget)
  actionError.value = ''
  showEditor.value = true
}
async function saveEvent() {
  if (!title.value.trim() || !date.value) return
  actionError.value = ''
  try {
    const payload = {
      title: title.value.trim(), eventDate: date.value, eventTime: time.value || undefined,
      eventType: eventType.value, location: location.value.trim() || undefined,
      description: description.value.trim() || undefined, repeatRule: repeatRule.value,
      repeatUntil: repeatUntil.value || undefined, reminderMinutes: reminderMinutes.value,
      budget: budget.value ? Number(budget.value) : null,
    }
    if (editing.value) await updateEvent(editing.value.id, payload)
    else await createEvent(payload)
    showEditor.value = false
    await reminders.schedule(reminderEvents.value)
    await load()
  } catch (cause: any) { actionError.value = cause?.message || '保存失败' }
}
async function removeEvent(event: SharedEvent) {
  const recurring = event.repeatRule !== 'none'
  if (!confirm(recurring ? `删除「${event.title}」及它的全部重复安排？` : `删除「${event.title}」？`)) return
  try { await deleteEvent(event.id); detailEvent.value = null; await reminders.schedule(reminderEvents.value) }
  catch (cause: any) { actionError.value = cause?.message || '删除失败' }
}
async function toggleDone(event: SharedEvent) {
  try {
    const status = event.status === 'done' ? 'planned' : 'done'
    await updateEvent(event.id, { status })
    if (detailEvent.value?.id === event.id) detailEvent.value = { ...detailEvent.value, status }
  } catch (cause: any) { actionError.value = cause?.message || '更新失败' }
}
async function createTask() {
  if (!detailEvent.value || !taskDraft.value.trim()) return
  try { await addTask(detailEvent.value.id, taskDraft.value); taskDraft.value = '' }
  catch (cause: any) { actionError.value = cause?.message || '添加待办失败' }
}
async function finishAsMemory(event: SharedEvent) {
  actionError.value = ''
  try {
    const content = [event.title, event.description].filter(Boolean).join('\n\n')
    const memoryId = await createMemory({ content: content.slice(0, 1000), memoryDate: event.eventDate, location: event.location, photos: [], favoriteCount: 0, isFavorite: false, reactions: {}, comments: [] }, [])
    if (typeof memoryId === 'string') await updateEvent(event.id, { memoryId })
    await updateEvent(event.id, { status: 'done' })
    if (detailEvent.value?.id === event.id) detailEvent.value = { ...detailEvent.value, status: 'done', memoryId: typeof memoryId === 'string' ? memoryId : '' }
  } catch (cause: any) { actionError.value = cause?.message || '保存回忆失败' }
}
async function recommendDate() {
  if (!city.value.trim()) {
    aiError.value = '请先填写城市，AI 才能检索真实地点'
    return
  }
  if (!aiDate.value) {
    aiError.value = '请选择出发日期'
    return
  }
  aiBusy.value = true
  aiError.value = ''
  aiResult.value = ''
  try {
    aiResult.value = await generate('date_plan', {
      city: city.value.trim(),
      budget: aiBudget.value.trim() || '适中',
      preferences: preferences.value.trim() || '轻松浪漫',
      date: aiDate.value,
      startTime: aiStartTime.value || '10:00',
      time: aiDuration.value,
    })
  } catch (cause: any) { aiError.value = cause?.message || '暂时无法生成方案' }
  finally { aiBusy.value = false }
}
function saveAiPlan() {
  const plan = aiResult.value
  showAi.value = false
  openCreate(aiDate.value)
  title.value = `${city.value || '我们的'}约会计划`
  eventType.value = 'date'
  budget.value = aiBudget.value.match(/\d+(?:\.\d+)?/)?.[0] || ''
  description.value = plan
}
function eventTasks(event: SharedEvent): SharedEventTask[] { return tasks.value.filter(task => task.eventId === event.id) }

onMounted(async () => {
  await load()
  startRealtime()
  await reminders.schedule(reminderEvents.value)
})
watch(events, () => { void reminders.schedule(reminderEvents.value) }, { deep: true })
onBeforeUnmount(stopRealtime)
</script>

<template>
  <section class="shared-calendar">
    <header class="calendar-top">
      <div class="calendar-heading">
        <span class="calendar-mark"><CalendarDays :size="19" /></span>
        <div><p class="eyebrow">OUR SHARED TIME</p><h1>共享日历</h1></div>
      </div>
      <div class="calendar-actions">
        <button class="reminder-button" type="button" :disabled="reminders.busy" :aria-pressed="reminders.enabled" @click="reminders.enabled ? reminders.disable() : reminders.enable(reminderEvents)">
          <BellRing :size="16" />{{ reminders.enabled ? '提醒已开启' : '开启提醒' }}
        </button>
        <button class="ai-button" type="button" @click="showAi = true"><Sparkles :size="16" />AI 约会推荐</button>
        <button class="add-button" type="button" @click="openCreate()"><Plus :size="17" />新建日程</button>
      </div>
    </header>

    <div class="calendar-toolbar">
      <div class="period-nav">
        <button type="button" aria-label="上一个周期" @click="shiftPeriod(-1)"><ChevronLeft :size="18" /></button>
        <button type="button" class="today-button" @click="goToday">今天</button>
        <button type="button" aria-label="下一个周期" @click="shiftPeriod(1)"><ChevronRight :size="18" /></button>
        <h2>{{ view === 'day' ? displayDate(selectedDate) : view === 'week' ? `${displayDate(weekdays[0]!)} - ${displayDate(weekdays[6]!)}` : titleLabel }}</h2>
      </div>
      <div class="view-switch" role="tablist" aria-label="日历视图">
        <button v-for="option in ([['month','月'],['week','周'],['day','日']] as const)" :key="option[0]" type="button" role="tab" :aria-selected="view === option[0]" :class="{ active: view === option[0] }" @click="view = option[0]">{{ option[1] }}</button>
      </div>
    </div>

    <div class="calendar-layout">
      <main class="calendar-main">
        <div v-if="view === 'month'" class="month-grid">
          <span v-for="day in weekDays" :key="day" class="weekday">{{ day }}</span>
          <button v-for="cell in monthCells" :key="cell.key" type="button" class="month-cell" :class="{ muted: !cell.inMonth, today: cell.key === today, selected: selectedDate === cell.key }" @click="selectDay(cell.key)">
            <span class="cell-number">{{ cell.day }}</span>
            <span v-for="event in cell.events.slice(0, 2)" :key="event.id" class="cell-event" :class="[`event-${event.eventType}`, { done: event.status === 'done' }]"><i>{{ eventIcon(event.eventType) }}</i><span>{{ event.title }}</span></span>
            <small v-if="cell.events.length > 2">+{{ cell.events.length - 2 }} 项</small>
          </button>
        </div>
        <div v-else class="agenda-view">
          <article v-for="day in visibleAgenda" :key="day" class="agenda-day" :class="{ 'agenda-day-selected': day === selectedDate }" @click="selectDay(day)">
            <header><div><span>{{ displayDate(day) }}</span><small v-if="day === today">今天</small></div><button type="button" :aria-label="`在 ${day} 新建日程`" @click.stop="openCreate(day)"><Plus :size="17" /></button></header>
            <div v-if="getEventsForDate(day).length" class="agenda-events">
              <button v-for="event in getEventsForDate(day)" :key="`${event.id}-${event.eventDate}`" type="button" class="agenda-event" :class="{ done: event.status === 'done' }" @click.stop="detailEvent = event">
                <span class="agenda-time">{{ event.eventTime || '全天' }}</span><span class="agenda-color" :class="`event-${event.eventType}`"></span><span class="agenda-event-copy"><strong>{{ event.title }}</strong><small>{{ event.location || event.description || eventLabel(event.eventType) }}</small></span><span v-if="event.repeatRule !== 'none'"><Repeat2 :size="14" /></span>
              </button>
            </div>
            <p v-else class="agenda-empty">还没有安排</p>
          </article>
        </div>
        <p v-if="loading" class="loading-note"><LoaderCircle :size="15" class="spin" />正在同步日历</p>
      </main>

      <aside class="calendar-aside">
        <section class="aside-section selected-section">
          <header><div><p class="eyebrow">SELECTED DAY</p><h3>{{ displayDate(selectedDate) }}</h3></div><button type="button" aria-label="添加日程" @click="openCreate()"><Plus :size="17" /></button></header>
          <div v-if="selectedEvents.length" class="compact-events">
            <button v-for="event in selectedEvents" :key="event.id" type="button" class="compact-event" @click="detailEvent = event">
              <span class="event-emoji">{{ eventIcon(event.eventType) }}</span><span class="compact-copy"><strong>{{ event.title }}</strong><small>{{ event.eventTime || '全天' }} · {{ eventLabel(event.eventType) }}</small></span><CheckCircle2 v-if="event.status === 'done'" :size="16" class="done-icon" />
            </button>
          </div>
          <p v-else class="aside-empty">这一天还没有日程</p>
        </section>
        <section class="aside-section">
          <header class="section-title"><div><p class="eyebrow">UP NEXT</p><h3>即将到来</h3></div></header>
          <div v-if="upcoming.length" class="upcoming-list">
            <button v-for="event in upcoming" :key="`${event.id}-${event.eventDate}`" type="button" class="upcoming-event" @click="selectDay(event.eventDate); detailEvent = event">
              <span class="upcoming-date"><strong>{{ event.eventDate.slice(8) }}</strong><small>{{ event.eventDate.slice(5, 7) }}月</small></span><span class="upcoming-copy"><strong>{{ event.title }}</strong><small>{{ event.eventTime || '全天' }} · {{ eventLabel(event.eventType) }}</small></span>
            </button>
          </div>
          <p v-else class="aside-empty">还没有未来安排</p>
        </section>
        <section class="month-summary">
          <p class="eyebrow">THIS MONTH</p><strong>{{ monthSummary.total }} <small>项安排</small></strong><div><span><Heart :size="14" />{{ monthSummary.dates }} 次约会</span><span><Check :size="14" />{{ monthSummary.completed }} 项完成</span></div>
        </section>
      </aside>
    </div>
    <p v-if="error || actionError" class="calendar-error">{{ actionError || error }}</p>

    <Transition name="calendar-modal">
      <div v-if="showEditor" class="overlay" @click.self="showEditor = false">
        <section class="dialog editor-dialog" role="dialog" aria-modal="true" aria-labelledby="event-editor-title">
          <header class="dialog-header"><div><p class="eyebrow">{{ editing ? 'EDIT EVENT' : 'NEW EVENT' }}</p><h2 id="event-editor-title">{{ editing ? '编辑日程' : '新建日程' }}</h2></div><button type="button" aria-label="关闭" @click="showEditor = false"><X :size="19" /></button></header>
          <div class="form-scroll">
            <label class="field-label">标题<input v-model="title" maxlength="100" placeholder="例如：周末一起去看电影" /></label>
            <div class="form-row"><label class="field-label">日期<input v-model="date" type="date" /></label><label class="field-label">时间<input v-model="time" type="time" /></label></div>
            <div class="form-row"><label class="field-label">类型<select v-model="eventType"><option v-for="option in EVENT_TYPES" :key="option.value" :value="option.value">{{ option.emoji }} {{ option.label }}</option></select></label><label class="field-label">预算<input v-model="budget" type="number" min="0" step="0.01" placeholder="可选" /></label></div>
            <label class="field-label">地点<input v-model="location" maxlength="200" placeholder="输入约会地点或地址" /></label>
            <label class="field-label">安排与备注<textarea v-model="description" maxlength="2000" rows="3" placeholder="写下计划内容、预订信息或想对 TA 说的话" /></label>
            <div class="form-row"><label class="field-label">重复<select v-model="repeatRule"><option value="none">不重复</option><option value="daily">每天</option><option value="weekdays">每个工作日</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="yearly">每年</option></select></label><label v-if="repeatRule !== 'none'" class="field-label">重复至<input v-model="repeatUntil" type="date" :min="date" /></label></div>
            <fieldset class="reminder-options"><legend>提醒</legend><label v-for="option in ([['0','准时'],['5','提前 5 分钟'],['30','提前 30 分钟'],['60','提前 1 小时'],['1440','提前 1 天']] as const)" :key="option[0]"><input v-model="reminderMinutes" type="checkbox" :value="Number(option[0])" /><span>{{ option[1] }}</span></label></fieldset>
            <p v-if="actionError" class="form-error">{{ actionError }}</p>
          </div>
          <footer class="dialog-footer"><button class="button-secondary" type="button" @click="showEditor = false">取消</button><button class="button-primary" type="button" :disabled="busy || !title.trim() || !date" @click="saveEvent"><LoaderCircle v-if="busy" class="spin" :size="16" />{{ editing ? '保存更改' : '创建日程' }}</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="calendar-modal">
      <div v-if="detailEvent" class="overlay" @click.self="detailEvent = null">
        <section class="dialog detail-dialog" role="dialog" aria-modal="true" :aria-label="detailEvent.title">
          <header class="dialog-header"><div><p class="eyebrow">{{ eventLabel(detailEvent.eventType) }} · {{ displayDate(detailEvent.eventDate) }}</p><h2>{{ detailEvent.title }}</h2></div><button type="button" aria-label="关闭" @click="detailEvent = null"><X :size="19" /></button></header>
          <div class="detail-scroll">
            <div class="detail-meta"><span><Clock3 :size="15" />{{ detailEvent.eventTime || '全天' }}</span><span v-if="detailEvent.location"><MapPin :size="15" />{{ detailEvent.location }}</span><span v-if="detailEvent.repeatRule !== 'none'"><Repeat2 :size="15" />{{ detailEvent.repeatRule === 'weekdays' ? '每个工作日' : ({ daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' } as Record<string,string>)[detailEvent.repeatRule] }}</span></div>
            <p v-if="detailEvent.description" class="detail-description">{{ detailEvent.description }}</p>
            <p v-if="detailEvent.budget != null" class="budget-note">预算 ¥{{ detailEvent.budget }}</p>
            <section class="task-section"><header><h3>共同待办</h3><span>{{ tasksForEvent.filter(task => task.completed).length }}/{{ tasksForEvent.length }}</span></header>
              <label v-for="task in tasksForEvent" :key="task.id" class="task-row"><input type="checkbox" :checked="task.completed" @change="toggleTask(task)" /><span :class="{ completed: task.completed }">{{ task.title }}</span><button type="button" :aria-label="`删除${task.title}`" @click="deleteTask(task.id)"><Trash2 :size="14" /></button></label>
              <form class="task-add" @submit.prevent="createTask"><input v-model="taskDraft" maxlength="160" placeholder="添加一项准备工作" /><button type="submit" aria-label="添加待办"><Plus :size="17" /></button></form>
            </section>
          </div>
          <footer class="dialog-footer detail-footer"><button class="button-secondary" type="button" @click="removeEvent(detailEvent!)"><Trash2 :size="15" />删除</button><button v-if="detailEvent.memoryId" class="button-secondary" type="button" disabled><CheckCircle2 :size="15" />已记入回忆</button><button v-else class="button-secondary" type="button" @click="finishAsMemory(detailEvent!)"><Heart :size="15" />完成并记为回忆</button><button class="button-secondary" type="button" @click="openEdit(detailEvent!); detailEvent = null"><Edit3 :size="15" />编辑</button><button class="button-primary" type="button" @click="toggleDone(detailEvent!)"><Check :size="15" />{{ detailEvent.status === 'done' ? '标记未完成' : '完成计划' }}</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="calendar-modal">
      <div v-if="showAi" class="overlay" @click.self="showAi = false">
        <section class="dialog ai-dialog" role="dialog" aria-modal="true" aria-labelledby="date-ai-title">
          <header class="dialog-header"><div><p class="eyebrow">HEART AI</p><h2 id="date-ai-title"><Sparkles :size="20" />为你们安排一次约会</h2></div><button type="button" aria-label="关闭" @click="showAi = false"><X :size="19" /></button></header>
          <div class="ai-form">
            <div class="form-row"><label class="field-label">城市<input v-model="city" maxlength="40" placeholder="例如：上海" /></label><label class="field-label">预算<input v-model="aiBudget" maxlength="40" placeholder="例如：9000 元" /></label></div>
            <div class="form-row"><label class="field-label">出发日期<input v-model="aiDate" type="date" /></label><label class="field-label">开始时间<input v-model="aiStartTime" type="time" /></label></div>
            <label class="field-label">游玩时长<select v-model="aiDuration"><option>半天</option><option>一天</option><option>两天一夜</option></select></label>
            <label class="field-label">偏好<input v-model="preferences" maxlength="200" placeholder="例如：安静、有展览、适合拍照" /></label>
            <p class="ai-hint"><CloudSun :size="15" />会分别检索景点、餐饮活动和雨天备选，生成长方案。营业时间、价格、预约和天气请出发前确认。</p>
            <button class="button-primary ai-generate" type="button" :disabled="aiBusy" @click="recommendDate"><LoaderCircle v-if="aiBusy" class="spin" :size="16" /><Sparkles v-else :size="16" />{{ aiBusy ? '正在搜索并规划' : '生成详细约会方案' }}</button><p v-if="aiError" class="form-error">{{ aiError }}</p><div v-if="aiResult" class="ai-result"><div>{{ aiResult }}</div><button class="button-primary" type="button" @click="saveAiPlan"><Plus :size="15" />加入日历</button></div>
          </div>
        </section>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.shared-calendar{width:min(100%,1280px);margin:0 auto;color:#45374d}.calendar-top,.calendar-heading,.calendar-actions,.calendar-toolbar,.period-nav,.view-switch,.calendar-layout,.aside-section>header,.section-title,.compact-event,.upcoming-event,.agenda-day>header,.agenda-event,.dialog-header,.dialog-footer,.detail-meta,.task-section>header,.task-row,.task-add,.month-summary>div{display:flex;align-items:center}.calendar-top{justify-content:space-between;gap:20px;margin-bottom:22px}.calendar-heading{gap:12px}.calendar-mark{display:grid;place-items:center;width:44px;height:44px;border:1px solid #ece4f0;border-radius:13px;background:#fff;color:#84599a}.eyebrow{margin:0 0 4px;color:#9c829f;font-size:9px;font-weight:800;letter-spacing:1px}.calendar-heading h1{margin:0;font-size:23px}.calendar-actions{gap:8px}.calendar-actions button,.period-nav button,.view-switch button,.aside-section>header>button,.agenda-day>header button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:0 13px;border:1px solid #eae3ed;border-radius:10px;background:#fff;color:#65546e;font:inherit;font-size:11px;font-weight:700;cursor:pointer}.calendar-actions button:hover,.period-nav button:hover,.view-switch button:hover{background:#f8f4fa}.calendar-actions .ai-button{border-color:#eadbf2;background:#f7eefb;color:#805096}.calendar-actions .add-button,.button-primary{border-color:#754b89;background:#754b89;color:#fff}.calendar-toolbar{justify-content:space-between;gap:16px;margin-bottom:13px}.period-nav{gap:6px}.period-nav button{width:40px;padding:0}.period-nav .today-button{width:auto;padding:0 12px}.period-nav h2{margin:0 0 0 9px;font-size:16px}.view-switch{gap:2px;padding:3px;border:1px solid #eae3ed;border-radius:10px;background:#fff}.view-switch button{min-width:43px;min-height:34px;padding:0 10px;border:0;background:transparent}.view-switch button.active{background:#f0e8f4;color:#69467c}.calendar-layout{align-items:stretch;gap:14px}.calendar-main{min-width:0;flex:1;padding:12px;border:1px solid #ece6ef;border-radius:13px;background:rgba(255,255,255,.88)}.month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:minmax(83px,1fr)}.weekday{display:grid;place-items:center;min-height:34px;color:#9a8da0;font-size:10px;font-weight:750}.month-cell{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0;padding:6px;border:0;border-top:1px solid #f1edf2;border-right:1px solid #f1edf2;background:transparent;text-align:left;cursor:pointer}.month-cell:nth-child(7n){border-right:0}.month-cell:hover{background:#faf7fb}.month-cell.muted .cell-number{color:#bcb3c0}.month-cell.today .cell-number{background:#754b89;color:#fff}.month-cell.selected{background:#f7f1f9}.cell-number{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;font-size:11px}.month-cell small{color:#8f7c96;font-size:9px}.cell-event{display:flex;align-items:center;gap:4px;width:100%;min-width:0;padding:3px 4px;border-radius:5px;background:#f2eafa;color:#6e4a85;font-size:9px}.cell-event i{font-style:normal}.cell-event>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cell-event.event-class{background:#eaf3f9;color:#4a7088}.cell-event.event-birthday{background:#fff1df;color:#9a6637}.cell-event.event-reminder,.cell-event.event-schedule{background:#eaf4ec;color:#52785b}.cell-event.done>span{text-decoration:line-through;opacity:.7}.calendar-aside{display:flex;flex:0 0 300px;flex-direction:column;gap:12px}.aside-section,.month-summary{padding:15px;border:1px solid #ece6ef;border-radius:12px;background:rgba(255,255,255,.88)}.aside-section>header{justify-content:space-between}.aside-section h3{margin:0;font-size:14px}.aside-section>header>button,.agenda-day>header button{width:36px;min-height:36px;padding:0;color:#754b89}.compact-events,.upcoming-list{display:grid;gap:4px;margin-top:12px}.compact-event,.upcoming-event{width:100%;gap:9px;padding:8px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.compact-event:hover,.upcoming-event:hover{background:#f8f4fa}.event-emoji{font-size:16px}.compact-copy,.upcoming-copy{display:grid;gap:3px;min-width:0;flex:1}.compact-copy strong,.upcoming-copy strong{overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.compact-copy small,.upcoming-copy small{color:#9b8da0;font-size:9px}.done-icon{color:#5c9b75}.aside-empty{margin:15px 0 3px;color:#a89eab;font-size:10px}.upcoming-date{display:grid;place-items:center;width:38px;height:42px;flex:0 0 38px;border-radius:8px;background:#f3ebf6;color:#76558a}.upcoming-date strong{font-size:16px}.upcoming-date small{font-size:8px}.month-summary{margin-top:auto;background:#faf7fb}.month-summary>strong{font-size:22px}.month-summary>strong small{font-size:11px;font-weight:500}.month-summary>div{gap:12px;margin-top:9px;color:#87788b;font-size:9px}.month-summary>div span{display:flex;align-items:center;gap:4px}.month-summary>div span:first-child{color:#b7668b}.agenda-view{display:grid;gap:9px}.agenda-day{padding:12px;border:1px solid #f0ebf2;border-radius:10px}.agenda-day-selected{border-color:#d9c7e2;background:#fdfbfe}.agenda-day>header{justify-content:space-between}.agenda-day>header>div{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:750}.agenda-day>header small{padding:3px 7px;border-radius:99px;background:#eee5f2;color:#714b84;font-size:9px}.agenda-day>header button{min-height:34px}.agenda-events{display:grid;gap:3px;margin-top:8px}.agenda-event{gap:10px;width:100%;padding:9px;border:0;border-radius:8px;background:#faf8fb;text-align:left;cursor:pointer}.agenda-time{width:38px;color:#8d7d92;font-size:10px}.agenda-color{width:3px;align-self:stretch;border-radius:5px;background:#b47cce}.agenda-color.event-class{background:#6b9db8}.agenda-color.event-birthday{background:#d59d5f}.agenda-color.event-reminder,.agenda-color.event-schedule{background:#75a57c}.agenda-event-copy{display:grid;gap:3px;min-width:0;flex:1}.agenda-event-copy strong{font-size:11px}.agenda-event-copy small{overflow:hidden;color:#948898;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.agenda-event.done strong{text-decoration:line-through;color:#8f9d91}.agenda-empty{margin:8px 0 0;padding:12px;color:#aa9fac;font-size:10px}.loading-note{display:flex;align-items:center;justify-content:center;gap:7px;margin:10px;color:#988a9d;font-size:10px}.spin{animation:spin .9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.calendar-error,.form-error{padding:9px 11px;border-radius:8px;background:#fff0f3;color:#ab4c67;font-size:11px}.overlay{position:fixed;z-index:150;inset:0;display:grid;place-items:center;padding:20px;background:rgba(34,27,39,.48);backdrop-filter:blur(8px)}.dialog{display:flex;flex-direction:column;width:min(100%,560px);max-height:min(92dvh,850px);overflow:hidden;border:1px solid rgba(255,255,255,.85);border-radius:14px;background:#fff;box-shadow:0 24px 80px rgba(35,24,42,.24)}.dialog-header{justify-content:space-between;gap:12px;padding:19px 21px;border-bottom:1px solid #f0ebf2}.dialog-header h2{display:flex;align-items:center;gap:8px;margin:0;font-size:19px}.dialog-header>button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:9px;background:#f7f3f8;color:#77667d;cursor:pointer}.form-scroll,.detail-scroll{overflow:auto;padding:18px 21px}.field-label{display:grid;gap:6px;min-width:0;color:#685a6d;font-size:10px;font-weight:750}.field-label input,.field-label select,.field-label textarea,.task-add input{width:100%;min-height:42px;padding:9px 11px;border:1px solid #e6dfe9;border-radius:8px;background:#fff;color:#48394e;font:inherit;font-size:12px;outline:none}.field-label textarea{resize:vertical}.field-label :focus,.task-add input:focus{border-color:#a17eaf}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.form-scroll>.field-label{margin-top:12px}.reminder-options{display:flex;flex-wrap:wrap;gap:8px 13px;margin:15px 0 0;padding:11px;border:1px solid #ebe4ee;border-radius:9px}.reminder-options legend{padding:0 5px;color:#827486;font-size:10px;font-weight:750}.reminder-options label{display:flex;align-items:center;gap:5px;color:#706477;font-size:10px}.reminder-options input,.task-row input{accent-color:#79518c}.dialog-footer{justify-content:flex-end;flex-wrap:wrap;gap:8px;padding:13px 20px;border-top:1px solid #f0ebf2}.dialog-footer button,.ai-result>button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:0 12px;border:1px solid #e6dfe9;border-radius:8px;background:#fff;color:#65566b;font:inherit;font-size:10px;font-weight:750;cursor:pointer}.dialog-footer .button-primary,.button-primary{border-color:#754b89;background:#754b89;color:#fff}.button-primary:disabled{opacity:.55;cursor:wait}.detail-scroll{padding-bottom:6px}.detail-meta{flex-wrap:wrap;gap:9px 15px;color:#817386;font-size:10px}.detail-meta span{display:flex;align-items:center;gap:5px}.detail-description{padding:12px;border-radius:8px;background:#faf7fb;color:#625667;font-size:11px;line-height:1.75;white-space:pre-wrap}.budget-note{color:#8a668f;font-size:11px}.task-section{margin-top:17px}.task-section>header{justify-content:space-between;margin-bottom:8px}.task-section h3{margin:0;font-size:12px}.task-section>header span{color:#9c8ea0;font-size:10px}.task-row{gap:8px;min-height:40px;border-bottom:1px solid #f2edf3}.task-row>span{flex:1;font-size:11px}.task-row>span.completed{color:#9caa9f;text-decoration:line-through}.task-row button,.task-add button{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:#9b8da0;cursor:pointer}.task-add{gap:6px;margin-top:8px}.task-add input{flex:1}.task-add button{background:#f1eaf4;color:#744c87}.detail-footer{justify-content:space-between}.detail-footer button{min-height:39px}.ai-form{display:grid;gap:12px;padding:18px 21px;overflow:auto}.ai-form .form-row{margin-top:0}.ai-hint{display:flex;align-items:flex-start;gap:7px;margin:0;color:#948497;font-size:10px;line-height:1.6}.ai-hint svg{flex:0 0 auto;color:#8b6999}.ai-generate{min-height:43px}.ai-result{display:grid;gap:12px}.ai-result>div{max-height:320px;overflow:auto;padding:13px;border-radius:9px;background:#faf7fb;color:#55475a;font-size:11px;line-height:1.8;white-space:pre-wrap}.ai-result>button{justify-self:end}.calendar-modal-enter-active,.calendar-modal-leave-active{transition:opacity .18s ease}.calendar-modal-enter-from,.calendar-modal-leave-to{opacity:0}.ai-dialog{min-height:0}.ai-form{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.ai-result{min-height:0}.ai-result>div{max-height:none;overflow:visible}

@media (max-width: 760px) {
  .shared-calendar {
    width: 100%;
    min-width: 0;
  }

  .calendar-top {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .calendar-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .calendar-actions button {
    flex: 1 1 auto;
    min-height: 40px;
    padding-inline: 10px;
  }

  .calendar-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .period-nav {
    width: 100%;
    gap: 4px;
  }

  .period-nav button {
    flex: 0 0 36px;
    width: 36px;
  }

  .period-nav .today-button {
    flex-basis: auto;
    padding-inline: 9px;
  }

  .period-nav h2 {
    overflow: hidden;
    min-width: 0;
    margin-left: auto;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .calendar-layout {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .calendar-main {
    width: 100%;
    padding: 6px;
  }

  .month-grid {
    grid-auto-rows: minmax(54px, auto);
  }

  .weekday {
    min-height: 30px;
  }

  .month-cell {
    align-items: center;
    gap: 3px;
    padding: 4px 1px;
  }

  .cell-number {
    width: 24px;
    height: 24px;
  }

  .cell-event {
    width: 5px;
    height: 5px;
    min-height: 5px;
    padding: 0;
    overflow: hidden;
    border-radius: 50%;
    font-size: 0;
  }

  .cell-event > * {
    display: none;
  }

  .calendar-aside {
    width: 100%;
    flex: 0 0 auto;
  }
}

@media (max-width: 380px) {
  .calendar-heading h1 {
    font-size: 21px;
  }

  .calendar-actions {
    gap: 6px;
  }

  .calendar-actions button {
    font-size: 10px;
  }

  .month-grid {
    grid-auto-rows: minmax(48px, auto);
  }
}
</style>
