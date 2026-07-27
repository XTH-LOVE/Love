<script setup lang="ts">
import { Check, CloudOff, LoaderCircle, RefreshCw, UploadCloud, X } from '@lucide/vue'

const { jobs, retry, dismissJob } = useMediaUploadQueue()
const visibleJobs = computed(() => jobs.value.filter(job => job.status !== 'completed'))
</script>

<template>
  <aside v-if="visibleJobs.length" class="upload-queue" aria-live="polite">
    <header><div><UploadCloud :size="17" /><strong>媒体上传</strong><span>{{ visibleJobs.length }} 项</span></div><button type="button" aria-label="关闭上传列表" title="关闭已失败项目" @click="visibleJobs.filter(job => job.status === 'failed').forEach(job => dismissJob(job.id))"><X :size="15" /></button></header>
    <article v-for="job in visibleJobs" :key="job.id">
      <div class="job-title"><span>{{ job.name }}</span><small>{{ (job.size / 1024 / 1024).toFixed(1) }} MB</small></div>
      <div class="job-progress"><i :style="{ width: `${job.progress}%` }" /></div>
      <footer>
        <span v-if="job.status === 'uploading' || job.status === 'retrying'"><LoaderCircle class="spin" :size="13" /> {{ job.status === 'retrying' ? `准备第 ${job.attempts + 1} 次重试` : `${job.progress}%` }}</span>
        <span v-else-if="job.status === 'paused' && job.restored"><UploadCloud :size="13" /> 已从本地恢复</span>
        <span v-else-if="job.status === 'paused'"><CloudOff :size="13" /> 等待网络</span>
        <span v-else-if="job.status === 'failed'" class="failed"><CloudOff :size="13" /> {{ job.error || '上传失败' }}</span>
        <span v-else><Check :size="13" /> 已完成</span>
        <button v-if="job.status === 'failed'" type="button" @click="retry(job.id)"><RefreshCw :size="13" />重试</button>
      </footer>
    </article>
  </aside>
</template>

<style scoped>
.upload-queue{position:fixed;z-index:180;right:22px;bottom:22px;width:min(360px,calc(100vw - 32px));padding:13px;border:1px solid rgba(255,255,255,.82);border-radius:19px;background:rgba(255,250,255,.9);box-shadow:0 18px 48px rgba(67,38,78,.18);backdrop-filter:blur(18px)}.upload-queue header{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.upload-queue header>div{display:flex;align-items:center;gap:7px;color:#70447d}.upload-queue header span{padding:3px 6px;border-radius:7px;background:#f1e5f6;color:#9b75a4;font-size:9px}.upload-queue header button{display:grid;place-items:center;width:27px;height:27px;border:0;border-radius:9px;background:#f3ebf5;color:#8d6c93;cursor:pointer}.upload-queue article{padding:9px 0;border-top:1px solid rgba(177,130,192,.14)}.job-title{display:flex;justify-content:space-between;gap:8px;color:#624168;font-size:10px}.job-title span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.job-title small{flex:none;color:#aa93ae;font-size:8px}.job-progress{height:5px;margin:7px 0;overflow:hidden;border-radius:99px;background:#eee5f1}.job-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#8e55bc,#de6b9f,#75b7e3);transition:width .25s ease}.upload-queue footer{display:flex;align-items:center;justify-content:space-between;color:#9b849f;font-size:9px}.upload-queue footer span{display:flex;align-items:center;gap:4px}.upload-queue footer .failed{max-width:220px;overflow:hidden;color:#ba607d;text-overflow:ellipsis;white-space:nowrap}.upload-queue footer button{display:flex;align-items:center;gap:4px;padding:5px 8px;border:0;border-radius:8px;background:#f1e7f7;color:#80508d;font-size:9px;cursor:pointer}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:650px){.upload-queue{right:12px;bottom:calc(95px + env(safe-area-inset-bottom));width:calc(100vw - 24px)}}
</style>
