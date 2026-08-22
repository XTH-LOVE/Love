<script setup lang="ts">
import { Calendar, ChevronLeft, ChevronRight, LoaderCircle, MapPin, Plus, Trash2, X } from '@lucide/vue'
import { EVENT_TYPES, type EventType } from '~/composables/useSharedCalendar'

const { profile } = useCoupleAuth()
const { events, loading, busy, error, load, createEvent, deleteEvent, getEventsForMonth, getUpcomingEvents } = useSharedCalendar()

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const selectedDate = ref<string | null>(null)
const showAddForm = ref(false)
const newTitle = ref('')
const newDate = ref('')
const newTime = ref('')
const newType = ref<EventType>('other')
const newLocation = ref('')
const newDescription = ref('')

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const monthEvents = computed(() => getEventsForMonth(currentYear.value, currentMonth.value))
const upcomingEvents = computed(() => getUpcomingEvents(5))

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const days: { date: string; day: number; isCurrentMonth: boolean; isToday: boolean; events: any[] }[] = []

  const today = new Date().toISOString().slice(0, 10)

  for (let i = 0; i < firstDay; i++) {
    const d = new Date(year, month - 1, -firstDay + i + 1)
    const dateStr = d.toISOString().slice(0, 10)
    days.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, isToday: dateStr === today, events: [] })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayEvents = monthEvents.value.filter(e => e.eventDate === dateStr)
    days.push({ date: dateStr, day: d, isCurrentMonth: true, isToday: dateStr === today, events: dayEvents })
  }

  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month, i)
      const dateStr = d.toISOString().slice(0, 10)
      days.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, isToday: dateStr === today, events: [] })
    }
  }

  return days
})

const monthLabel = computed(() => `${currentYear.value}年${currentMonth.value}月`)

function prevMonth() {
  if (currentMonth.value === 1) { currentYear.value--; currentMonth.value = 12 }
  else currentMonth.value--
}

function nextMonth() {
  if (currentMonth.value === 12) { currentYear.value++; currentMonth.value = 1 }
  else currentMonth.value++
}

function selectDate(dateStr: string) {
  selectedDate.value = dateStr
  newDate.value = dateStr
}

function openAddForm() {
  showAddForm.value = true
  newTitle.value = ''
  newDate.value = selectedDate.value || new Date().toISOString().slice(0, 10)
  newTime.value = ''
  newType.value = 'other'
  newLocation.value = ''
  newDescription.value = ''
}

async function handleCreate() {
  if (!newTitle.value.trim() || !newDate.value) return
  await createEvent({
    title: newTitle.value,
    eventDate: newDate.value,
    eventTime: newTime.value || undefined,
    eventType: newType.value,
    location: newLocation.value || undefined,
    description: newDescription.value || undefined,
  })
  showAddForm.value = false
}

async function handleDelete(id: string) {
  await deleteEvent(id)
}

function eventTypeEmoji(type: EventType | string) {
  return EVENT_TYPES.find(t => t.value === type)?.emoji || '📌'
}

function eventTypeLabel(type: EventType | string) {
  return EVENT_TYPES.find(t => t.value === type)?.label || '其他'
}

const selectedDateEvents = computed(() => {
  if (!selectedDate.value) return []
  return events.value.filter(e => e.eventDate === selectedDate.value)
})

onMounted(() => { load() })
</script>

<template>
  <section class="calendar-widget panel" aria-label="共享日历">
    <div class="calendar-header">
      <div>
        <p class="eyebrow">SHARED SCHEDULE</p>
        <h3>我们的日历</h3>
      </div>
      <Calendar :size="18" />
    </div>

    <!-- Month navigation -->
    <div class="calendar-nav">
      <button type="button" class="cal-nav-btn" @click="prevMonth"><ChevronLeft :size="16" /></button>
      <span class="cal-month-label">{{ monthLabel }}</span>
      <button type="button" class="cal-nav-btn" @click="nextMonth"><ChevronRight :size="16" /></button>
    </div>

    <!-- Weekday headers -->
    <div class="calendar-weekdays">
      <span v-for="wd in weekDays" :key="wd" class="cal-wd">{{ wd }}</span>
    </div>

    <!-- Calendar grid -->
    <div class="calendar-grid">
      <button
        v-for="(day, idx) in calendarDays"
        :key="idx"
        type="button"
        class="cal-day"
        :class="{
          'other-month': !day.isCurrentMonth,
          'is-today': day.isToday,
          'is-selected': day.date === selectedDate,
          'has-events': day.events.length > 0,
        }"
        @click="selectDate(day.date)"
      >
        <span class="cal-day-num">{{ day.day }}</span>
        <div v-if="day.events.length > 0" class="cal-day-dots">
          <span v-for="(ev, ei) in day.events.slice(0, 3)" :key="ei" class="cal-dot" :title="ev.title">{{ eventTypeEmoji(ev.eventType) }}</span>
        </div>
      </button>
    </div>

    <!-- Selected date detail -->
    <div v-if="selectedDate" class="cal-detail">
      <div class="cal-detail-header">
        <h4>{{ selectedDate }}</h4>
        <button type="button" class="cal-add-btn" title="添加事件" @click="openAddForm"><Plus :size="14" /></button>
      </div>
      <div v-if="selectedDateEvents.length > 0" class="cal-event-list">
        <div v-for="ev in selectedDateEvents" :key="ev.id" class="cal-event-item">
          <span class="cal-event-emoji">{{ eventTypeEmoji(ev.eventType) }}</span>
          <div class="cal-event-info">
            <span class="cal-event-title">{{ ev.title }}</span>
            <span v-if="ev.eventTime" class="cal-event-time">{{ ev.eventTime }}</span>
            <span v-if="ev.location" class="cal-event-location"><MapPin :size="10" /> {{ ev.location }}</span>
          </div>
          <button v-if="ev.createdBy === profile?.id" type="button" class="cal-event-delete" title="删除" @click="handleDelete(ev.id)"><Trash2 :size="11" /></button>
        </div>
      </div>
      <p v-else class="cal-no-events">这天还没有安排</p>
    </div>

    <!-- Upcoming events -->
    <div v-if="upcomingEvents.length > 0" class="cal-upcoming">
      <p class="cal-upcoming-title">即将到来</p>
      <div v-for="ev in upcomingEvents" :key="ev.id" class="cal-upcoming-item" @click="selectDate(ev.eventDate)">
        <span class="cal-upcoming-date">{{ ev.eventDate.slice(5) }}</span>
        <span class="cal-upcoming-emoji">{{ eventTypeEmoji(ev.eventType) }}</span>
        <span class="cal-upcoming-title">{{ ev.title }}</span>
        <span v-if="ev.eventTime" class="cal-upcoming-time">{{ ev.eventTime }}</span>
      </div>
    </div>

    <!-- Add event modal -->
    <Transition name="modal-fade">
      <div v-if="showAddForm" class="cal-modal-overlay" @click.self="showAddForm = false">
        <div class="cal-modal">
          <div class="cal-modal-header">
            <h4>新建事件</h4>
            <button type="button" class="cal-modal-close" @click="showAddForm = false"><X :size="16" /></button>
          </div>
          <div class="cal-modal-body">
            <input v-model="newTitle" maxlength="100" placeholder="事件标题" class="cal-field" />
            <input v-model="newDate" type="date" class="cal-field" />
            <input v-model="newTime" type="time" class="cal-field" />
            <select v-model="newType" class="cal-field">
              <option v-for="t in EVENT_TYPES" :key="t.value" :value="t.value">{{ t.emoji }} {{ t.label }}</option>
            </select>
            <input v-model="newLocation" maxlength="200" placeholder="地点（可选）" class="cal-field" />
            <textarea v-model="newDescription" maxlength="500" placeholder="描述（可选）" class="cal-field cal-textarea" rows="2" />
          </div>
          <div class="cal-modal-footer">
            <button type="button" class="cal-btn-cancel" @click="showAddForm = false">取消</button>
            <button type="button" class="cal-btn-create" :disabled="!newTitle.trim() || !newDate || busy" @click="handleCreate">
              <LoaderCircle v-if="busy" class="spin" :size="14" />
              创建
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <p v-if="error" class="widget-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.calendar-widget{padding:20px 22px;background:linear-gradient(135deg,rgba(245,250,255,.95),rgba(250,248,255,.9));overflow:hidden}
.calendar-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px}
.calendar-header h3{margin:3px 0 0;color:#3d4a6e;font-size:17px}
.calendar-header>svg{color:#8098c0}
.calendar-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px}
.cal-nav-btn{display:grid;place-items:center;width:28px;height:28px;border:1px solid rgba(140,160,200,.2);border-radius:8px;background:rgba(255,255,255,.6);color:#6a7da0;cursor:pointer}
.cal-nav-btn:hover{background:rgba(230,240,255,.7)}
.cal-month-label{font-size:14px;font-weight:700;color:#4a5a80;min-width:100px;text-align:center}
.calendar-weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px}
.cal-wd{text-align:center;font-size:9px;font-weight:700;color:#8a96b0;text-transform:uppercase;padding:4px 0}
.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-day{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border:1px solid transparent;border-radius:8px;background:transparent;cursor:pointer;transition:all .15s ease;min-height:38px}
.cal-day:hover{background:rgba(220,230,255,.4)}
.cal-day.other-month{opacity:.35}
.cal-day.is-today{border-color:rgba(100,140,220,.3);background:rgba(230,240,255,.5)}
.cal-day.is-selected{border-color:rgba(100,140,220,.5);background:rgba(210,225,255,.6);box-shadow:0 2px 6px rgba(100,140,220,.1)}
.cal-day.has-events{font-weight:700}
.cal-day-num{font-size:11px;color:#4a5a80}
.cal-day-dots{display:flex;gap:1px;font-size:8px;line-height:1}
.cal-detail{margin-top:14px;padding:12px;border-radius:12px;background:rgba(255,255,255,.5);border:1px solid rgba(140,160,200,.1)}
.cal-detail-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.cal-detail-header h4{margin:0;font-size:12px;font-weight:700;color:#4a5a80}
.cal-add-btn{display:grid;place-items:center;width:24px;height:24px;border:1px solid rgba(100,140,220,.2);border-radius:8px;background:rgba(230,240,255,.5);color:#5a7ab0;cursor:pointer}
.cal-add-btn:hover{background:rgba(210,225,255,.7)}
.cal-event-list{display:flex;flex-direction:column;gap:6px}
.cal-event-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.5)}
.cal-event-emoji{font-size:16px}
.cal-event-info{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}
.cal-event-title{font-size:11px;font-weight:600;color:#3d4a6e}
.cal-event-time{font-size:10px;color:#6a7da0;font-variant-numeric:tabular-nums}
.cal-event-location{display:flex;align-items:center;gap:2px;font-size:9px;color:#8a96b0}
.cal-event-delete{display:grid;place-items:center;width:20px;height:20px;border:0;border-radius:6px;background:transparent;color:#b0b8d0;cursor:pointer;opacity:0;transition:opacity .15s}
.cal-event-item:hover .cal-event-delete{opacity:1}
.cal-event-delete:hover{background:rgba(220,100,130,.1);color:#d06080}
.cal-no-events{margin:0;font-size:10px;color:#9aa0b8;text-align:center;padding:8px 0}
.cal-upcoming{margin-top:14px;padding-top:12px;border-top:1px solid rgba(140,160,200,.1)}
.cal-upcoming-title{margin:0 0 8px;font-size:10px;font-weight:700;color:#8a96b0;text-transform:uppercase;letter-spacing:.5px}
.cal-upcoming-item{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:8px;cursor:pointer;transition:background .15s}
.cal-upcoming-item:hover{background:rgba(230,240,255,.4)}
.cal-upcoming-date{font-size:10px;color:#8a96b0;font-variant-numeric:tabular-nums;min-width:36px}
.cal-upcoming-emoji{font-size:14px}
.cal-upcoming-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;color:#4a5a80}
.cal-upcoming-time{font-size:10px;color:#6a7da0;font-variant-numeric:tabular-nums}
/* Modal */
.cal-modal-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(30,30,50,.3);backdrop-filter:blur(2px)}
.cal-modal{width:min(360px,90vw);border-radius:18px;background:#fff;box-shadow:0 20px 50px rgba(50,50,100,.15);overflow:hidden}
.cal-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(140,160,200,.1)}
.cal-modal-header h4{margin:0;font-size:14px;font-weight:700;color:#3d4a6e}
.cal-modal-close{display:grid;place-items:center;width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:#8a96b0;cursor:pointer}
.cal-modal-close:hover{background:rgba(240,240,250,.8)}
.cal-modal-body{display:flex;flex-direction:column;gap:8px;padding:14px 18px}
.cal-field{width:100%;min-height:34px;padding:8px 12px;border:1px solid rgba(140,160,200,.2);border-radius:10px;background:rgba(250,250,255,.8);color:#3d4a6e;font-size:12px;outline:none;font-family:inherit}
.cal-field:focus{border-color:rgba(100,140,220,.4)}
.cal-textarea{min-height:50px;resize:vertical}
.cal-modal-footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;border-top:1px solid rgba(140,160,200,.08)}
.cal-btn-cancel{padding:7px 16px;border:1px solid rgba(140,160,200,.2);border-radius:10px;background:transparent;color:#6a7da0;font-size:11px;cursor:pointer}
.cal-btn-cancel:hover{background:rgba(240,240,250,.5)}
.cal-btn-create{display:flex;align-items:center;gap:5px;padding:7px 20px;border:0;border-radius:10px;background:linear-gradient(135deg,#5a80c0,#7a60c0);color:#fff;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 4px 10px rgba(80,100,180,.15)}
.cal-btn-create:disabled{opacity:.5;cursor:default}
.widget-error{margin:8px 0 0;padding:6px 10px;background:#ffe6ef;color:#b64f73;font-size:10px;border-radius:8px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.modal-fade-enter-active,.modal-fade-leave-active{transition:all .2s ease}
.modal-fade-enter-from,.modal-fade-leave-to{opacity:0}
@media(max-width:760px){.cal-day{padding:4px 1px;min-height:32px}.cal-day-num{font-size:10px}.cal-month-label{font-size:12px;min-width:80px}.cal-modal{width:min(320px,92vw)}}
</style>
