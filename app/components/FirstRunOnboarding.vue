<script setup lang="ts">
import { ArrowRight, BellRing, CalendarHeart, Camera, Check, Heart, Image, Link2, LockKeyhole, Sparkles, Users, X } from '@lucide/vue'

const props = withDefaults(defineProps<{
  phase: 'intro' | 'checklist'
  displayName?: string
  hasPartner?: boolean
  hasMedia?: boolean
}>(), {
  displayName: '',
  hasPartner: false,
  hasMedia: false,
})

const emit = defineEmits<{
  complete: []
  'upload-photo': []
  'invite-partner': []
}>()

const page = ref(0)
const introPages = [
  { icon: Heart, title: '只属于你们的双人空间', body: '把照片、视频、悄悄话、纪念日和共同计划，收进一个只有你们能看见的小家。' },
  { icon: Image, title: '每个瞬间，都值得保存', body: '从第一张共同照片开始，让时光轴和相册慢慢长成你们的故事。' },
  { icon: BellRing, title: '重要日子，不再错过', body: '纪念日可以安排系统提醒，Android、桌面端和网页都能收到通知。' },
]

const currentIntro = computed(() => introPages[page.value] || introPages[0])

function next() {
  if (page.value < introPages.length - 1) page.value += 1
  else emit('complete')
}
</script>

<template>
  <div class="onboarding-overlay" role="dialog" aria-modal="true" :aria-labelledby="phase === 'intro' ? 'onboarding-title' : 'onboarding-checklist-title'">
    <div class="onboarding-orbit orbit-one" />
    <div class="onboarding-orbit orbit-two" />
    <section v-if="phase === 'intro'" class="onboarding-card intro-card">
      <button class="onboarding-close" type="button" aria-label="跳过介绍" title="跳过介绍" @click="emit('complete')"><X :size="18" /></button>
      <div class="onboarding-brand"><span><Heart :size="20" fill="currentColor" /></span><strong>Love小家</strong><small>CoupleSpace</small></div>
      <div class="intro-visual"><div class="intro-mark"><img src="/couplespace-mark.svg" alt="Love小家"><Heart :size="18" fill="currentColor" /></div><i>♡</i><i>✦</i><i>♡</i></div>
      <div class="intro-copy"><p class="eyebrow">WELCOME HOME</p><h1 id="onboarding-title">{{ currentIntro.title }}</h1><p>{{ currentIntro.body }}</p></div>
      <div class="intro-dots" aria-label="介绍进度"><i v-for="(_, index) in introPages" :key="index" :class="{ active: index === page }" /></div>
      <button class="onboarding-primary" type="button" @click="next"><span>{{ page === introPages.length - 1 ? '开始设置我们的空间' : '继续了解' }}</span><ArrowRight :size="17" /></button>
      <small class="onboarding-footnote"><LockKeyhole :size="13" /> 私密内容仅属于同一情侣空间的两个人</small>
    </section>

    <section v-else class="onboarding-card checklist-card">
      <div class="onboarding-brand"><span><Heart :size="20" fill="currentColor" /></span><strong>Love小家</strong><small>准备好开始记录了吗？</small></div>
      <p class="eyebrow">YOUR FIRST DAY</p>
      <h1 id="onboarding-checklist-title">{{ displayName || '欢迎来到你们的小家' }}</h1>
      <p class="checklist-lead">空间已经准备好了，完成下面这一步，就可以开始收藏你们的共同回忆。</p>
      <div class="checklist">
        <div class="checklist-item done"><span><Check :size="16" /></span><div><strong>创建账户与昵称</strong><small>你的称呼已经准备好了</small></div></div>
        <div class="checklist-item done"><span><CalendarHeart :size="16" /></span><div><strong>设置在一起的日期</strong><small>首页会实时记录相爱时长</small></div></div>
        <button class="checklist-item invite-item" type="button" :class="{ done: hasPartner }" :disabled="hasPartner" @click="emit('invite-partner')"><span><Check v-if="hasPartner" :size="16" /><Users v-else :size="16" /></span><div><strong>{{ hasPartner ? '另一半已经加入' : '邀请另一半加入' }}</strong><small>{{ hasPartner ? '你们已经拥有同一个私密空间' : '点击这里打开设置并生成邀请码' }}</small></div><Link2 v-if="!hasPartner" :size="16" /></button>
        <button class="checklist-item photo-item" type="button" :class="{ done: hasMedia }" @click="hasMedia ? emit('complete') : emit('upload-photo')"><span><Check v-if="hasMedia" :size="16" /><Camera v-else :size="16" /></span><div><strong>{{ hasMedia ? '第一张共同照片已保存' : '上传第一张共同照片' }}</strong><small>{{ hasMedia ? '你们的故事已经开始' : '从一张照片开始，记录此时此刻' }}</small></div><ArrowRight :size="16" /></button>
      </div>
      <button class="onboarding-primary" type="button" @click="emit('complete')"><span>{{ hasMedia ? '进入我们的空间' : '先进入，稍后再上传' }}</span><Sparkles :size="17" /></button>
      <small class="onboarding-footnote">你可以随时在“时光”和“相册”中继续添加</small>
    </section>
  </div>
</template>

<style scoped>
.onboarding-overlay{position:fixed;z-index:230;inset:0;display:grid;place-items:center;overflow:auto;padding:max(24px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));background:linear-gradient(145deg,#6c3a9d 0%,#d45c9d 54%,#70b8e5 100%);color:#53365d}.onboarding-overlay:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 12% 15%,rgba(226,193,255,.58),transparent 28%),radial-gradient(circle at 86% 80%,rgba(255,203,229,.48),transparent 28%);pointer-events:none}.onboarding-orbit{position:absolute;border:1px solid rgba(255,255,255,.22);border-radius:50%;pointer-events:none;animation:onboarding-spin 18s linear infinite}.orbit-one{width:min(80vw,700px);height:min(80vw,700px)}.orbit-two{width:min(62vw,520px);height:min(62vw,520px);border-style:dashed;animation-direction:reverse;animation-duration:12s}.onboarding-card{position:relative;z-index:1;width:min(100%,520px);padding:30px;border:1px solid rgba(255,255,255,.62);border-radius:32px;background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(255,235,248,.68));box-shadow:0 30px 85px rgba(55,19,75,.28),inset 0 1px rgba(255,255,255,.85);backdrop-filter:blur(25px) saturate(125%)}.intro-card{text-align:center}.onboarding-close{position:absolute;top:16px;right:16px;display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:12px;background:rgba(255,255,255,.46);color:#76527d;cursor:pointer}.onboarding-brand{display:flex;align-items:center;gap:8px}.onboarding-brand>span{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,#8a4dbc,#dc679f);color:#fff;box-shadow:0 8px 18px rgba(110,53,135,.2)}.onboarding-brand strong{font-size:15px;color:#5b3764}.onboarding-brand small{margin-left:auto;color:#a07ba4;font-size:9px}.intro-visual{position:relative;display:grid;place-items:center;height:225px;margin-top:14px}.intro-mark{position:relative;display:grid;place-items:center;width:128px;height:128px;border:1px solid rgba(255,255,255,.7);border-radius:38px;background:linear-gradient(145deg,rgba(140,81,187,.88),rgba(221,98,160,.8));box-shadow:0 20px 45px rgba(99,42,124,.25);animation:onboarding-bounce 3s ease-in-out infinite}.intro-mark img{width:82px;filter:drop-shadow(0 12px 15px rgba(51,16,72,.25))}.intro-mark svg{position:absolute;right:7px;bottom:7px;color:#ffdff0}.intro-visual i{position:absolute;color:rgba(255,255,255,.86);font-size:25px;font-style:normal;animation:onboarding-float 3s ease-in-out infinite}.intro-visual i:nth-of-type(1){top:23px;left:18%;animation-delay:-.8s}.intro-visual i:nth-of-type(2){top:44px;right:18%;font-size:17px;animation-delay:-1.5s}.intro-visual i:nth-of-type(3){bottom:22px;left:26%;font-size:17px;animation-delay:-2.1s}.intro-copy .eyebrow{margin:0;color:#9b70a1}.intro-copy h1{margin:8px 0 10px;color:#542d5f;font-size:27px}.intro-copy>p:last-child{margin:0 auto;max-width:390px;color:#846c8b;font-size:12px;line-height:1.8}.intro-dots{display:flex;justify-content:center;gap:6px;margin:19px 0 15px}.intro-dots i{width:7px;height:7px;border-radius:50%;background:#d6bfd9}.intro-dots i.active{width:21px;border-radius:7px;background:linear-gradient(90deg,#9258ba,#dc6ba3)}.onboarding-primary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:47px;border:0;border-radius:17px;background:linear-gradient(135deg,#8c4fbb,#dc639e 58%,#70b8e5);color:#fff;font-size:11px;font-weight:850;box-shadow:0 13px 27px rgba(117,50,139,.22);cursor:pointer}.onboarding-footnote{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:13px;color:#9d84a2;font-size:9px}.checklist-card{width:min(100%,580px)}.checklist-card>h1{margin:8px 0;color:#542d5f;font-size:28px}.checklist-lead{margin:0;color:#846c8b;font-size:11px;line-height:1.75}.checklist{display:grid;gap:9px;margin:22px 0}.checklist-item{display:flex;align-items:center;gap:10px;width:100%;padding:13px;border:1px solid rgba(174,122,192,.18);border-radius:17px;background:rgba(255,255,255,.68);text-align:left;font:inherit;cursor:pointer}.checklist-item:disabled{cursor:default}.checklist-item>span{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;border-radius:11px;background:#f1e4f7;color:#9563ae}.checklist-item.done>span{background:#e2f5e9;color:#4f9a70}.checklist-item>div{min-width:0;flex:1}.checklist-item strong,.checklist-item small{display:block}.checklist-item strong{color:#65406e;font-size:11px}.checklist-item small{margin-top:3px;color:#a088a5;font-size:9px;line-height:1.45}.checklist-item>svg{color:#a480ad}.photo-item,.invite-item{border:1px solid rgba(205,123,169,.28);cursor:pointer}.invite-item{border-color:rgba(174,122,192,.18)}.onboarding-card .eyebrow{margin-top:22px}.checklist-card .onboarding-brand+.eyebrow{margin-top:24px}@keyframes onboarding-bounce{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}@keyframes onboarding-float{50%{transform:translateY(-12px) scale(1.08)}}@keyframes onboarding-spin{to{transform:rotate(360deg)}}@media(max-width:650px){.onboarding-card{padding:22px 18px;border-radius:26px}.intro-visual{height:185px}.intro-mark{width:104px;height:104px;border-radius:31px}.intro-mark img{width:68px}.intro-copy h1{font-size:23px}.checklist-card>h1{font-size:24px}.checklist-item{padding:11px}.onboarding-brand small{font-size:8px}}@media(prefers-reduced-motion:reduce){.onboarding-overlay *{animation:none!important}}
</style>
