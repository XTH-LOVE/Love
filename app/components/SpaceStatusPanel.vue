<script setup lang="ts">
import { Activity, BellRing, CheckCircle2, CircleAlert, CloudOff, Database, Image, LoaderCircle, PhoneCall, RefreshCw, RotateCw, UploadCloud, UsersRound, Wifi, X } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import type { SpaceServiceKey } from '~/composables/useSpaceStatus'

const emit = defineEmits<{ close: []; reconnect: [] }>()
const { profile } = useCoupleAuth()
const { services, networkOnline, lastSyncAt, refresh, testCallService } = useSpaceStatus()
const { jobs, retry } = useMediaUploadQueue()
const checking = ref(true)
const reconnecting = ref(false)
const testingCall = ref(false)
const failedJobs = computed(() => jobs.value.filter(job => job.status === 'failed'))
const activeJobs = computed(() => jobs.value.filter(job => !['completed', 'failed'].includes(job.status)))
const stateLabel: Record<string, string> = { checking: '检查中', ok: '正常', warning: '需处理', error: '异常', offline: '离线' }
const serviceRows: Array<{ key: SpaceServiceKey; label: string; icon: any }> = [
  { key: 'supabase', label: 'Supabase 数据库', icon: Database },
  { key: 'media', label: '私有图片服务', icon: Image },
  { key: 'push', label: '系统推送通知', icon: BellRing },
  { key: 'call', label: '语音与视频通话', icon: PhoneCall },
]
const syncLabel = computed(() => {
  if (!lastSyncAt.value) return '尚未同步'
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(lastSyncAt.value))
})
const accountLabel = computed(() => profile.value?.email?.replace(/^account\.([^@]+)@users\.love-home\.invalid$/, '$1') || profile.value?.email || '未登录')

async function refreshStatus() {
  checking.value = true
  try { await refresh() } finally { checking.value = false }
}
async function reconnect() {
  reconnecting.value = true
  emit('reconnect')
  await new Promise(resolve => window.setTimeout(resolve, 650))
  await refreshStatus()
  reconnecting.value = false
}
async function retryAll() {
  await Promise.allSettled(failedJobs.value.map(job => retry(job.id)))
  await refreshStatus()
}
async function testCall() {
  testingCall.value = true
  try { await testCallService() } finally { testingCall.value = false }
}
onMounted(() => { void refreshStatus() })
</script>

<template>
  <Teleport to="body">
    <div class="status-overlay" @click.self="emit('close')">
      <section class="status-panel" aria-labelledby="space-status-title">
        <header class="status-header">
          <div>
            <p class="eyebrow">SPACE HEALTH</p>
            <h2 id="space-status-title">空间状态</h2>
            <span>把连接、同步和上传情况放在一个地方。</span>
          </div>
          <button class="close-button" type="button" aria-label="关闭空间状态" @click="emit('close')"><X :size="19" /></button>
        </header>

        <section class="network-card" :class="{ offline: !networkOnline }">
          <div class="network-icon"><Wifi v-if="networkOnline" :size="19" /><CloudOff v-else :size="19" /></div>
          <div><strong>{{ networkOnline ? '网络连接正常' : '设备处于离线状态' }}</strong><span>{{ networkOnline ? '最近同步 ' + syncLabel : '恢复网络后会自动重新连接' }}</span></div>
          <span class="state-pill" :class="networkOnline ? 'ok' : 'offline'">{{ networkOnline ? '在线' : '离线' }}</span>
        </section>

        <section class="service-list" aria-label="服务状态">
          <article v-for="row in serviceRows" :key="row.key" class="service-row">
            <div class="service-icon"><component :is="row.icon" :size="18" /></div>
            <div class="service-copy"><strong>{{ row.label }}</strong><span>{{ services[row.key].detail }}</span></div>
            <span class="state-pill" :class="services[row.key].state"><LoaderCircle v-if="services[row.key].state === 'checking'" class="spin" :size="12" /><CheckCircle2 v-else-if="services[row.key].state === 'ok'" :size="12" /><CircleAlert v-else :size="12" />{{ stateLabel[services[row.key].state] }}</span>
          </article>
        </section>

        <section class="upload-card">
          <header><div><UploadCloud :size="17" /><strong>上传队列</strong></div><span>{{ activeJobs.length }} 进行中 · {{ failedJobs.length }} 失败</span></header>
          <div v-if="activeJobs.length || failedJobs.length" class="upload-summary">
            <p v-for="job in [...activeJobs, ...failedJobs].slice(0, 3)" :key="job.id"><span>{{ job.name }}</span><b>{{ job.status === 'failed' ? '失败' : job.progress + '%' }}</b></p>
            <small v-if="activeJobs.length + failedJobs.length > 3">还有 {{ activeJobs.length + failedJobs.length - 3 }} 项在队列中</small>
          </div>
          <p v-else class="empty-copy">当前没有等待处理的上传任务。</p>
          <button v-if="failedJobs.length" class="retry-all" type="button" @click="retryAll"><RefreshCw :size="14" />重试全部失败任务</button>
        </section>

        <section class="identity-card">
          <div class="identity-icon"><UsersRound :size="18" /></div>
          <div><strong>{{ profile?.displayName || '未登录' }}</strong><span>{{ accountLabel }}</span><small>{{ profile?.coupleId ? '情侣空间：' + profile.coupleId : '尚未绑定情侣空间' }}</small></div>
        </section>

        <footer class="status-actions">
          <button type="button" @click="refreshStatus" :disabled="checking"><LoaderCircle v-if="checking" class="spin" :size="16" /><RotateCw v-else :size="16" />刷新状态</button>
          <button type="button" @click="testCall" :disabled="testingCall"><LoaderCircle v-if="testingCall" class="spin" :size="16" /><PhoneCall v-else :size="16" />测试通话</button>
          <button class="primary" type="button" @click="reconnect" :disabled="reconnecting"><LoaderCircle v-if="reconnecting" class="spin" :size="16" /><RefreshCw v-else :size="16" />一键重新连接</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.status-overlay{position:fixed;z-index:190;inset:0;display:grid;place-items:center;padding:20px;background:rgba(45,39,52,.28);backdrop-filter:blur(12px)}.status-panel{width:min(100%,620px);max-height:min(820px,calc(100dvh - 40px));overflow:auto;padding:28px;border:1px solid rgba(255,255,255,.9);border-radius:30px;background:linear-gradient(145deg,#fffaff,#fff3f9);box-shadow:0 30px 90px rgba(50,39,61,.22)}.status-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.status-header h2{margin:0;color:#4d2c57;font-size:28px}.status-header>div>span{color:#99889d;font-size:10px}.close-button{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:13px;background:#f0e8f3;color:#7c6583;cursor:pointer}.network-card,.service-row,.upload-card,.identity-card{border:1px solid rgba(181,112,207,.16);background:rgba(255,255,255,.72)}.network-card{display:flex;align-items:center;gap:11px;margin-top:22px;padding:14px;border-radius:20px}.network-card.offline{border-color:#efc8d2;background:#fff1f4}.network-icon,.identity-icon,.service-icon{display:grid;place-items:center;flex:none;border-radius:14px;background:#f0e2f7;color:#80509a}.network-icon{width:38px;height:38px}.network-card.offline .network-icon{background:#f8dce5;color:#b85877}.network-card>div:nth-child(2),.service-copy,.identity-card>div:nth-child(2){min-width:0;flex:1}.network-card strong,.network-card span,.service-copy strong,.service-copy span,.identity-card strong,.identity-card span,.identity-card small{display:block}.network-card strong{color:#5b3e64;font-size:12px}.network-card>div:nth-child(2) span{margin-top:3px;color:#a28fa5;font-size:9px}.service-list{display:grid;gap:8px;margin-top:12px}.service-row{display:flex;align-items:center;gap:11px;padding:12px 13px;border-radius:17px}.service-icon{width:34px;height:34px;background:#f5eaf8;color:#8b5a9c}.service-copy strong{color:#604268;font-size:11px}.service-copy span{margin-top:3px;color:#9b899e;font-size:9px;overflow-wrap:anywhere}.state-pill{display:inline-flex;align-items:center;gap:4px;flex:none;padding:5px 8px;border-radius:99px;font-size:8px;font-weight:800}.state-pill.ok{background:#e8f7ed;color:#4d946a}.state-pill.warning{background:#fff3d8;color:#a2772c}.state-pill.error{background:#ffe6ed;color:#bb5575}.state-pill.offline{background:#eeeaf0;color:#837987}.state-pill.checking{background:#eee7f7;color:#78579b}.upload-card{margin-top:12px;padding:14px;border-radius:20px}.upload-card header{display:flex;align-items:center;justify-content:space-between;gap:12px}.upload-card header>div{display:flex;align-items:center;gap:7px;color:#70447d}.upload-card header>span{color:#9a879f;font-size:9px}.upload-summary{display:grid;gap:5px;margin-top:11px}.upload-summary p{display:flex;justify-content:space-between;gap:10px;margin:0;color:#78617e;font-size:9px}.upload-summary p span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.upload-summary p b{color:#a26c9a}.upload-summary small{color:#ad9bab;font-size:8px}.empty-copy{margin:12px 0 2px;color:#a392a6;font-size:9px}.retry-all{display:flex;align-items:center;gap:5px;margin-top:11px;padding:8px 10px;border:0;border-radius:11px;background:#f4e7f7;color:#80508d;font-size:9px;font-weight:750;cursor:pointer}.identity-card{display:flex;align-items:center;gap:11px;margin-top:12px;padding:13px;border-radius:18px}.identity-icon{width:36px;height:36px;background:#eaf4ef;color:#659576}.identity-card strong{color:#5d4564;font-size:11px}.identity-card span,.identity-card small{margin-top:3px;color:#98869d;font-size:9px}.identity-card small{overflow-wrap:anywhere}.status-actions{display:flex;gap:8px;margin-top:18px}.status-actions button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;flex:1;padding:0 11px;border:1px solid #e4dce8;border-radius:15px;background:#fff;color:#785a82;font-size:9px;font-weight:750;cursor:pointer}.status-actions button.primary{border:0;background:linear-gradient(135deg,#8b4db9,#d85f99);color:#fff}.status-actions button:disabled{cursor:wait;opacity:.58}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:650px){.status-overlay{align-items:end;padding:0}.status-panel{max-height:calc(100dvh - env(safe-area-inset-top));padding:21px 16px calc(20px + env(safe-area-inset-bottom));border-radius:25px 25px 0 0}.status-header h2{font-size:23px}.status-actions{display:grid;grid-template-columns:1fr 1fr}.status-actions .primary{grid-column:1/-1}.network-card{margin-top:17px}}
</style>
