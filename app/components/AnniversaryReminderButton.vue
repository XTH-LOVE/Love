<script setup lang="ts">
import { Bell, BellRing, Check, LoaderCircle, X } from '@lucide/vue'
import { useAnniversaries } from '~/composables/useAnniversaries'

const { anniversaries, loadAnniversaries } = useAnniversaries()
const { enabled, busy, enable, disable, sync } = useAnniversaryReminders()
const message = ref('')

onMounted(async () => {
  await loadAnniversaries()
  await sync(anniversaries.value)
})

watch(anniversaries, value => {
  if (enabled.value) void sync(value)
}, { deep: true })

async function toggle() {
  message.value = ''
  if (enabled.value) {
    await disable()
    message.value = '纪念日提醒已关闭'
    return
  }
  const allowed = await enable(anniversaries.value)
  message.value = allowed ? '已开启系统提醒' : '请允许 Love小家使用通知权限'
}
</script>

<template>
  <div class="anniversary-reminder">
    <button type="button" :disabled="busy" @click="toggle">
      <LoaderCircle v-if="busy" class="spin" :size="16" />
      <BellRing v-else-if="enabled" :size="16" />
      <Bell v-else :size="16" />
      <span>{{ enabled ? '纪念日提醒已开启' : '开启纪念日系统提醒' }}</span>
    </button>
    <span v-if="message" class="reminder-feedback"><Check :size="13" /> {{ message }} <button type="button" aria-label="关闭提示" @click="message = ''"><X :size="13" /></button></span>
  </div>
</template>

<style scoped>
.anniversary-reminder{display:flex;align-items:center;gap:9px;margin:0 auto 13px;width:min(100%,1000px)}.anniversary-reminder>button{display:flex;align-items:center;gap:7px;min-height:37px;padding:0 13px;border:1px solid rgba(170,113,194,.2);border-radius:14px;background:rgba(255,255,255,.7);color:#765080;font-size:10px;font-weight:800;box-shadow:0 8px 20px rgba(100,52,116,.06);cursor:pointer}.anniversary-reminder>button:disabled{opacity:.6;cursor:wait}.reminder-feedback{display:flex;align-items:center;gap:4px;color:#5d976f;font-size:9px}.reminder-feedback button{display:grid;place-items:center;width:21px;height:21px;border:0;border-radius:8px;background:rgba(255,255,255,.54);color:#7d9b84;cursor:pointer}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:650px){.anniversary-reminder{align-items:flex-start;flex-direction:column;margin-bottom:9px}.anniversary-reminder>button{width:100%;justify-content:center;min-height:40px}}
</style>
