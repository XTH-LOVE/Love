<script setup lang="ts">
import { Check, Database, ExternalLink, GitFork, Heart, Info, LockKeyhole, RefreshCw, Scale, ShieldCheck, X } from '@lucide/vue'

const emit = defineEmits<{ close: [] }>()
const { currentVersion, checking, manifest, check, openUpdate } = useAppUpdate()
const checkMessage = ref('')
const githubUrl = 'https://github.com/XTH-LOVE/Love-'
const appVersion = computed(() => `v${currentVersion}`)
const buildTarget = computed(() => import.meta.client
  ? /Android/i.test(navigator.userAgent) ? 'Android' : /Electron/i.test(navigator.userAgent) ? 'Windows 桌面版' : 'Web 版'
  : 'Web / Android / Windows')
const buildDate = '2026.07'
const releaseNotes = [
  '统一通知中心：悄悄话、通话、纪念日、火花和上传状态集中提醒',
  '媒体体验升级：缩略图优先、视频封面、断网恢复和失败重试',
  '情侣空间升级：共同回忆、宠物互动、AI 日记与情书持续完善',
]

async function checkUpdates() {
  checkMessage.value = ''
  await check()
  checkMessage.value = manifest.value ? `发现新版本 ${manifest.value.version}` : '当前已是最新版本'
}

function openGithub() {
  if (import.meta.client) window.open(githubUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="about-overlay" @click.self="emit('close')">
    <section class="about-panel" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <header class="about-header">
        <div>
          <p class="eyebrow">ABOUT LOVE小家</p>
          <h2 id="about-title">关于 Love小家</h2>
        </div>
        <button class="about-close" type="button" aria-label="关闭关于软件" title="关闭" @click="emit('close')"><X :size="19" /></button>
      </header>

      <div class="about-brand">
        <div class="about-mark"><img src="/couplespace-mark.svg" alt="Love小家图标"><Heart :size="16" fill="currentColor" /></div>
        <div><strong>Love小家</strong><span>把相爱的每一天，认真收藏。</span></div>
        <span class="about-version">{{ appVersion }}</span>
      </div>

      <section class="about-intro">
        <div class="about-intro-icon"><Heart :size="18" fill="currentColor" /></div>
        <div><h3>只属于你们的双人空间</h3><p>Love小家是一款面向情侣的私密陪伴软件。它把共同回忆、即时沟通、纪念日、清单、宠物和 AI 灵感放在一个安静、可靠的空间里。</p></div>
      </section>

      <div class="about-grid">
        <article><Info :size="16" /><div><span>开发者</span><strong>缐廷华</strong></div></article>
        <article><ShieldCheck :size="16" /><div><span>隐私边界</span><strong>仅同一情侣空间可见</strong></div></article>
        <article><Scale :size="16" /><div><span>构建版本</span><strong>{{ buildTarget }} · {{ buildDate }}</strong></div></article>
        <article><LockKeyhole :size="16" /><div><span>数据存储</span><strong>Supabase 私有空间</strong></div></article>
      </div>

      <section class="about-section">
        <div class="about-section-title"><div><p class="eyebrow">PRODUCT SCOPE</p><h3>我们正在认真做什么</h3></div><span class="about-status"><i /> 稳定运行</span></div>
        <div class="about-feature-grid">
          <article><Heart :size="15" /><div><strong>共同回忆</strong><p>照片、视频、时光记录和最近回忆统一沉淀。</p></div></article>
          <article><LockKeyhole :size="15" /><div><strong>私密沟通</strong><p>悄悄话、语音、位置和通话仅限情侣空间成员。</p></div></article>
          <article><RefreshCw :size="15" /><div><strong>实时同步</strong><p>消息、在线状态、火花与通知尽量保持实时。</p></div></article>
          <article><Info :size="15" /><div><strong>长期记录</strong><p>纪念日、共同清单、宠物成长和 AI 内容可持续保存。</p></div></article>
        </div>
      </section>

      <section class="about-section release-section">
        <div class="about-section-title"><div><p class="eyebrow">RELEASE NOTES</p><h3>当前版本 {{ appVersion }}</h3></div><span>{{ buildTarget }}</span></div>
        <ul><li v-for="note in releaseNotes" :key="note"><Check :size="14" /> {{ note }}</li></ul>
      </section>

      <section class="about-actions">
        <button type="button" @click="openGithub"><GitFork :size="17" /> GitHub 开源项目 <ExternalLink :size="14" /></button>
        <button type="button" :disabled="checking" @click="checkUpdates"><RefreshCw :class="{ spin: checking }" :size="17" /> 检查更新</button>
      </section>
      <p v-if="checkMessage" class="check-message"><Check :size="14" /> {{ checkMessage }} <button v-if="manifest" type="button" @click="openUpdate">立即更新</button></p>

      <details class="about-details" open><summary><ShieldCheck :size="16" /> 隐私与安全</summary><p>我们只使用实现情侣空间所需的数据。照片、视频和消息默认属于你们的私密内容，请不要把邀请码或登录凭据分享给他人。</p></details>
      <details class="about-details"><summary><Database :size="16" /> 数据如何被使用</summary><p>账号信息用于登录和情侣空间成员识别；照片、视频和消息用于在双方设备间同步；通知和上传状态用于提醒和恢复任务。删除账户或退出情侣空间后，相关数据会按服务端规则处理。</p></details>
      <details class="about-details"><summary><Info :size="16" /> 服务边界与可用性</summary><p>Love小家依赖 Supabase 存储与实时服务、浏览器或系统通知能力，以及通话服务商。网络、设备权限或第三方服务异常时，部分功能可能暂时不可用；软件会尽量保留本地状态并提供重试。</p></details>
      <details class="about-details"><summary><Scale :size="16" /> 服务与开源许可</summary><p>本软件由缐廷华开发维护，部分能力使用 Supabase、Nuxt、Vue、Lucide 等开源项目。第三方服务的可用性以其服务条款为准。</p></details>
      <details class="about-details"><summary><GitFork :size="16" /> 项目与反馈</summary><p>项目地址：<button class="inline-link" type="button" @click="openGithub">github.com/XTH-LOVE/Love-</button></p></details>
      <footer><strong>Love小家</strong><span>由缐廷华开发维护 · 构建于 {{ buildDate }}</span><small>感谢你们把平凡的日子，过成值得收藏的故事。</small></footer>
    </section>
  </div>
</template>

<style scoped>
.about-overlay{position:fixed;z-index:75;inset:0;display:grid;place-items:center;padding:20px;background:rgba(52,35,60,.32);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.about-panel{width:min(100%,590px);max-height:calc(100dvh - 40px);overflow:auto;padding:27px;border:1px solid rgba(255,255,255,.88);border-radius:30px;background:linear-gradient(145deg,rgba(255,252,255,.96),rgba(255,239,249,.92));box-shadow:0 30px 90px rgba(62,35,72,.24);color:#4d3654}
.about-header{display:flex;align-items:flex-start;justify-content:space-between}.about-header h2{margin:4px 0 0;font-size:27px;color:#4b2a57}.about-close{display:grid;place-items:center;width:37px;height:37px;border:0;border-radius:13px;background:#f2eaf4;color:#75567d;cursor:pointer}
.about-brand{display:flex;align-items:center;gap:12px;margin-top:22px;padding:14px;border:1px solid rgba(186,125,207,.18);border-radius:20px;background:linear-gradient(135deg,rgba(239,220,252,.82),rgba(255,222,237,.76))}.about-mark{position:relative;display:grid;place-items:center;width:52px;height:52px;border-radius:17px;background:linear-gradient(135deg,#8c51bb,#df699e);box-shadow:0 10px 22px rgba(137,72,157,.2);color:#fff}.about-mark img{width:36px}.about-mark svg{position:absolute;right:-4px;bottom:-3px;padding:3px;border-radius:9px;background:#fff;color:#d45c9b}.about-brand strong,.about-brand span{display:block}.about-brand strong{font-size:17px}.about-brand span{margin-top:3px;color:#936e9a;font-size:10px}.about-version{margin-left:auto!important;padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.65);color:#78448e!important;font-size:10px!important;font-weight:800}
.about-intro{display:flex;gap:11px;margin-top:17px;padding:15px;border-radius:18px;background:rgba(255,255,255,.66)}.about-intro-icon{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:12px;background:#f8d9e9;color:#c55891}.about-intro h3{margin:0;font-size:13px}.about-intro p{margin:5px 0 0;color:#846e89;font-size:10px;line-height:1.65}
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.about-grid article{display:flex;align-items:flex-start;gap:9px;padding:12px;border:1px solid rgba(186,125,207,.15);border-radius:16px;background:rgba(255,255,255,.7);color:#9a609f}.about-grid article>div{min-width:0}.about-grid span,.about-grid strong{display:block}.about-grid span{font-size:9px;color:#a086a5}.about-grid strong{margin-top:3px;font-size:10px;color:#624268;overflow-wrap:anywhere}
.about-section{margin-top:16px;padding:15px;border:1px solid rgba(186,125,207,.14);border-radius:18px;background:rgba(255,255,255,.54)}.about-section-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.about-section-title h3{margin:3px 0 0;color:#5a3b62;font-size:13px}.about-section-title>span:last-child{color:#9b7da0;font-size:9px}.about-status{display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:9px;background:#ecf8f0;color:#57916c!important;font-weight:700}.about-status i{width:6px;height:6px;border-radius:50%;background:#64b881}.about-feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.about-feature-grid article{display:flex;gap:8px;padding:10px;border-radius:13px;background:rgba(255,255,255,.68);color:#a05e99}.about-feature-grid strong{display:block;color:#64436b;font-size:10px}.about-feature-grid p{margin:3px 0 0;color:#927b97;font-size:9px;line-height:1.55}.release-section ul{display:grid;gap:7px;margin:12px 0 0;padding:0;list-style:none}.release-section li{display:flex;align-items:flex-start;gap:6px;color:#806b86;font-size:10px;line-height:1.55}.release-section li svg{flex:none;margin-top:1px;color:#68a57b}.about-panel>footer{display:flex;flex-direction:column;gap:4px;margin-top:19px;color:#ad8faf;font-size:9px;text-align:center}.about-panel>footer strong{color:#76507f;font-size:11px}.about-panel>footer small{margin-top:4px;color:#b59ab3;font-size:9px}
.about-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}.about-actions button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:43px;border:0;border-radius:15px;background:linear-gradient(135deg,#8c4eb9,#da639d);color:#fff;font-size:10px;font-weight:800;cursor:pointer}.about-actions button+button{border:1px solid #eaddea;background:#fff;color:#74517d}.about-actions button:disabled{opacity:.6;cursor:wait}.about-actions button svg:last-child{margin-left:auto;margin-right:3px}.check-message{display:flex;align-items:center;gap:5px;margin:10px 0 0;padding:9px 11px;border-radius:12px;background:#edf8f1;color:#4c8d69;font-size:10px}.check-message button{margin-left:auto;border:0;background:transparent;color:#8b4caf;font-size:10px;font-weight:800;cursor:pointer}.about-details{margin-top:10px;padding:0 12px;border:1px solid rgba(186,125,207,.14);border-radius:15px;background:rgba(255,255,255,.58)}.about-details summary{display:flex;align-items:center;gap:7px;min-height:40px;list-style:none;color:#684874;font-size:11px;font-weight:800;cursor:pointer}.about-details summary::-webkit-details-marker{display:none}.about-details p{margin:0 0 12px;color:#866f8c;font-size:10px;line-height:1.7}.inline-link{padding:0;border:0;background:transparent;color:#8950a4;font:inherit;text-decoration:underline;cursor:pointer}.about-panel>footer{margin-top:17px;color:#ad8faf;font-size:9px;text-align:center}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:650px){.about-overlay{align-items:end;padding:env(safe-area-inset-top) 0 0}.about-panel{max-height:calc(100dvh - env(safe-area-inset-top) - 74px);padding:21px 17px calc(19px + env(safe-area-inset-bottom));border-radius:26px 26px 0 0}.about-header h2{font-size:23px}.about-grid{grid-template-columns:1fr 1fr}.about-actions button{min-height:45px;font-size:9px}}
</style>
