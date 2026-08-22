<script setup lang="ts">
import './brand-single-card.css'
const splashRoot = ref<HTMLElement | null>(null)
const { gsap, context } = useGSAP()
const { shouldAnimate, motionReady } = useMotionSettings()
let animationContext: ReturnType<typeof context>
let startupTimeline: ReturnType<typeof gsap.timeline> | undefined
let declarationTimeline: ReturnType<typeof gsap.timeline> | undefined
const visible = ref(false)
const startupVisible = ref(false)
const seconds = ref(10)
let timer: ReturnType<typeof setInterval> | undefined
let startupTimer: ReturnType<typeof setTimeout> | undefined
let leaveFallback: ReturnType<typeof setTimeout> | undefined
const dismissed = ref(false)

// Defensive cleanup: if the Vue <Transition> leave never completes
// (e.g. transitionend dropped during GSAP revert), the splash element
// can linger as an invisible full-screen overlay that blocks all clicks.
function ensureSplashGone() {
  if (dismissed.value) return
  dismissed.value = true
  startupVisible.value = false
  visible.value = false
  const host = splashRoot.value
  if (host) host.innerHTML = ''
  if (timer) { clearInterval(timer); timer = undefined }
  if (startupTimer) { clearTimeout(startupTimer); startupTimer = undefined }
  if (leaveFallback) { clearTimeout(leaveFallback); leaveFallback = undefined }
}

function playStartupIntro() {
  const startup = splashRoot.value?.querySelector('.startup-splash')
  if (!startup || !motionReady.value) return
  const mark = startup.querySelector('.startup-mark')
  const copy = startup.querySelectorAll(':scope > strong, :scope > p')
  const progress = startup.querySelector('.startup-progress')
  startupTimeline?.kill()
  gsap.set([mark, ...copy, progress], { clearProps: 'transform,opacity,visibility' })
  animationContext?.add(() => {
    if (!shouldAnimate.value) return
    startupTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from(mark, { autoAlpha: 0, y: 18, scale: 0.78, rotation: -8, duration: 0.7 })
      .from(copy, { autoAlpha: 0, y: 10, stagger: 0.08, duration: 0.42 }, '-=0.38')
      .from(progress, { autoAlpha: 0, scaleX: 0, transformOrigin: 'left center', duration: 0.35 }, '-=0.16')
  })
}

function playDeclarationIntro() {
  const card = splashRoot.value?.querySelector('.brand-splash main')
  if (!card || !motionReady.value) return
  const brandItems = card.querySelectorAll('.brand-side > *')
  const declarationItems = card.querySelectorAll('.declaration > span, .declaration > h2, .statement p, .declaration > button, .declaration > small')
  declarationTimeline?.kill()
  gsap.set([card, ...brandItems, ...declarationItems], { clearProps: 'transform,opacity,visibility' })
  animationContext?.add(() => {
    if (!shouldAnimate.value) return
    declarationTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from(brandItems, { autoAlpha: 0, y: 14, stagger: 0.07, duration: 0.36 })
      .from(declarationItems, { autoAlpha: 0, y: 12, stagger: 0.045, duration: 0.32 }, '-=0.2')
  })
}

watch(startupVisible, async value => {
  if (!value) return
  await nextTick()
  playStartupIntro()
})

watch(visible, async value => {
  if (!value) return
  await nextTick()
  playDeclarationIntro()
})

onMounted(() => {
  animationContext = context(splashRoot.value, () => undefined)
  const accepted = localStorage.getItem('couple-space-declaration-accepted') === '1'
  startupVisible.value = true
  startupTimer = setTimeout(() => {
    startupVisible.value = false
    // Startup splash leave should finish in ~0.45s; force removal after 1.5s
    // so a stalled transition can never block input on the login page.
    leaveFallback = setTimeout(ensureSplashGone, 1500)
    if (accepted) {
      ensureSplashGone()
      return
    }
    visible.value = true
    timer = setInterval(() => {
      seconds.value -= 1
      if (seconds.value <= 0 && timer) { clearInterval(timer); timer = undefined }
    }, 1000)
  }, 1500)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (startupTimer) clearTimeout(startupTimer)
  if (leaveFallback) clearTimeout(leaveFallback)
  startupTimeline?.kill()
  declarationTimeline?.kill()
  animationContext?.revert()
})

function enter() {
  if (seconds.value > 0) return
  localStorage.setItem('couple-space-declaration-accepted', '1')
  visible.value = false
  // Declaration splash leave is 0.5s; force removal as a safety net.
  leaveFallback = setTimeout(ensureSplashGone, 1500)
}
</script>

<template>
  <div ref="splashRoot" class="brand-splash-host" :class="{ 'motion-ready': motionReady }">
  <Transition name="startup-splash">
    <div v-if="startupVisible" class="startup-splash" aria-label="Love小家正在启动">
      <div class="startup-orbit startup-orbit-one" />
      <div class="startup-orbit startup-orbit-two" />
      <div class="startup-mark"><img src="/couplespace-mark.svg" alt="Love小家"><span>♡</span></div>
      <strong>Love小家</strong>
      <p>把相爱的每一天，认真收藏。</p>
      <div class="startup-progress"><i /></div>
    </div>
  </Transition>
  <Transition name="splash">
    <div v-if="visible" id="brand-splash-card" class="brand-splash">
      <div class="glow" />
      <main>
        <section class="brand-side">
          <img src="/couplespace-mark.svg" alt="CoupleSpace">
          <small>Love小家</small>
          <h1>双人空间</h1>
          <p>把相爱的每一天，认真收藏。</p>
        </section>
        <section class="declaration">
          <span>使用前请阅读</span>
          <h2>软件声明</h2>
          <div class="statement">
            <p><strong>开发者</strong>本软件由缐廷华开发与维护。</p>
            <p><strong>隐私边界</strong>情侣内容仅供同一双人空间成员访问，请妥善保管账户与邀请码。</p>
            <p><strong>AI 辅助</strong>智能内容由小米 MiMo 辅助生成，仅作为创作建议，不代表开发者立场。</p>
            <p><strong>内容归属</strong>照片、视频、信件、日记及其他用户上传内容归用户本人所有。</p>
          </div>
          <button type="button" :disabled="seconds > 0" @click="enter">
            {{ seconds > 0 ? `请阅读声明（${seconds} 秒）` : '下一步，进入双人空间' }}
          </button>
          <small>点击下一步即表示已阅读并理解以上内容。本声明仅需确认一次。</small>
        </section>
      </main>
      <footer><i /><span>缐廷华开发</span><i /></footer>
    </div>
  </Transition>
  </div>
</template>

<style scoped>
.brand-splash{background:linear-gradient(145deg,#7b45ad 0%,#d765a0 48%,#78bce7 100%)!important;color:#fff!important}.brand-splash::before{content:'';position:absolute;inset:18px;border:1px solid rgba(255,255,255,.24);border-radius:42px;pointer-events:none}.glow{display:block!important;width:76vw!important;height:220px!important;border-radius:44px!important;background:linear-gradient(90deg,rgba(255,255,255,.22),rgba(255,255,255,.03))!important;filter:blur(34px)!important;transform:rotate(-11deg);animation:declaration-float 8s ease-in-out infinite alternate}main{border:1px solid rgba(255,255,255,.58)!important;border-radius:38px!important;background:linear-gradient(145deg,rgba(89,35,107,.48),rgba(255,194,222,.24))!important;box-shadow:0 35px 90px rgba(55,19,75,.3),inset 0 1px rgba(255,255,255,.5)!important;backdrop-filter:blur(24px) saturate(125%)!important}.brand-side{position:relative;background:linear-gradient(155deg,rgba(91,35,119,.56),rgba(228,93,157,.43))!important}.brand-side::after{content:'';position:absolute;width:150px;height:150px;border:1px solid rgba(255,255,255,.28);border-radius:28px;transform:rotate(26deg);opacity:.7}.brand-side img{position:relative;z-index:1;filter:drop-shadow(0 22px 27px rgba(44,9,58,.32))!important;animation:mark-bounce 2.7s ease-in-out infinite!important}.brand-side small,.brand-side h1,.brand-side p{position:relative;z-index:1;color:#fff!important}.brand-side p{color:rgba(255,255,255,.76)!important}.declaration{background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,219,240,.12))!important}.declaration>span{color:#ffe5f3!important;letter-spacing:.14em!important}.declaration h2{color:#fff!important;text-shadow:0 4px 18px rgba(58,13,72,.25)}.statement p{padding:10px 12px!important;border:1px solid rgba(255,255,255,.17);border-radius:13px;background:rgba(63,22,82,.16);color:rgba(255,255,255,.86)!important}.statement strong{color:#fff!important}.declaration>button{border:1px solid rgba(255,255,255,.5)!important;border-radius:21px!important;background:linear-gradient(100deg,#8f4bc1,#e35f9f 56%,#67b8e9)!important;box-shadow:0 15px 30px rgba(75,23,97,.28)!important;animation:enter-bounce 2.5s ease-in-out infinite}.declaration>button:disabled{background:rgba(57,17,74,.22)!important;color:rgba(255,255,255,.66)!important;animation:none}.declaration>small{color:rgba(255,255,255,.66)!important}.brand-splash>footer{color:rgba(255,255,255,.72)!important}.brand-splash>footer i{background:rgba(255,255,255,.46)!important}@keyframes declaration-float{to{transform:translateY(-18px) rotate(-7deg)}}@keyframes mark-bounce{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-9px) scale(1.035)}}@keyframes enter-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@media(max-width:650px){.brand-splash::before{inset:10px;border-radius:27px}main{border-radius:28px!important}.declaration{background:rgba(255,255,255,.1)!important}.statement p{padding:8px 9px!important}.glow{width:120vw!important}}
</style>

<style scoped>
.brand-splash-host{display:contents}
.motion-ready .startup-mark,.motion-ready .startup-orbit,.motion-ready .startup-mark span,.motion-ready .startup-progress i,.motion-ready .brand-side img,.motion-ready .glow,.motion-ready .declaration>button{animation:none!important}.motion-ready .startup-progress i{width:100%!important}
</style>

<style scoped>
.startup-splash{position:fixed;z-index:210;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 18% 18%,rgba(210,167,255,.92),transparent 30%),radial-gradient(circle at 82% 78%,rgba(255,170,214,.9),transparent 32%),linear-gradient(145deg,#6f3b9f,#d45c9c 54%,#72b7e9);color:#fff;text-align:center}
.startup-splash::before,.startup-splash::after{content:'';position:absolute;border:1px solid rgba(255,255,255,.28);border-radius:50%;pointer-events:none}
.startup-splash::before{width:min(74vw,520px);height:min(74vw,520px);animation:startup-spin 18s linear infinite}
.startup-splash::after{width:min(58vw,400px);height:min(58vw,400px);border-style:dashed;opacity:.45;animation:startup-spin 13s linear infinite reverse}
.startup-orbit{position:absolute;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.82);box-shadow:0 0 24px rgba(255,255,255,.7);animation:startup-float 3.6s ease-in-out infinite}
.startup-orbit-one{top:24%;left:25%}.startup-orbit-two{right:22%;bottom:27%;width:11px;height:11px;animation-delay:-1.4s}
.startup-mark{position:relative;display:grid;place-items:center;width:128px;height:128px;margin-bottom:20px;border:1px solid rgba(255,255,255,.62);border-radius:40px;background:rgba(255,255,255,.17);box-shadow:0 24px 60px rgba(51,17,76,.28),inset 0 1px rgba(255,255,255,.58);backdrop-filter:blur(18px);animation:startup-mark-in .9s cubic-bezier(.2,1.2,.35,1)}
.startup-mark img{width:82px;filter:drop-shadow(0 12px 18px rgba(49,12,73,.28))}.startup-mark span{position:absolute;right:10px;bottom:6px;font-size:25px;color:#fff;animation:startup-heart 1.2s ease-in-out infinite}
.startup-splash>strong{position:relative;font-size:30px;letter-spacing:.02em;text-shadow:0 5px 22px rgba(49,12,73,.24);animation:startup-copy-in .8s .12s both}.startup-splash>p{position:relative;margin:8px 0 25px;color:rgba(255,255,255,.82);font-size:12px;letter-spacing:.12em;animation:startup-copy-in .8s .2s both}.startup-progress{position:relative;width:110px;height:3px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.25)}.startup-progress i{display:block;width:35%;height:100%;border-radius:inherit;background:#fff;animation:startup-progress 1.45s ease-in-out forwards}
.startup-splash-enter-active{transition:opacity .35s ease}.startup-splash-leave-active{transition:opacity .45s ease,filter .45s ease;pointer-events:none}.startup-splash-enter-from,.startup-splash-leave-to{opacity:0;filter:blur(9px)}
@keyframes startup-mark-in{from{opacity:0;transform:scale(.72) rotate(-9deg)}to{opacity:1;transform:none}}@keyframes startup-copy-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes startup-heart{50%{transform:scale(1.18) rotate(-8deg)}}@keyframes startup-float{50%{transform:translateY(-18px) scale(1.12)}}@keyframes startup-spin{to{transform:rotate(360deg)}}@keyframes startup-progress{to{width:100%;transform:translateX(0)}}
@media(max-width:650px){.startup-mark{width:104px;height:104px;border-radius:32px}.startup-mark img{width:68px}.startup-splash>strong{font-size:26px}.startup-splash>p{font-size:10px;letter-spacing:.08em}}
@media(prefers-reduced-motion:reduce){.startup-splash *{animation:none!important}.startup-progress i{width:100%}}
</style>

<style scoped>
.brand-splash{position:fixed;z-index:200;inset:0;display:grid;place-items:center;padding:max(22px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(42px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));overflow:auto;background:linear-gradient(145deg,#fffaff,#eee0f7 48%,#fbdce8);color:#53365d}.glow{position:absolute;width:620px;height:620px;border-radius:50%;background:rgba(255,255,255,.4);filter:blur(55px)}main{position:relative;display:grid;grid-template-columns:280px minmax(0,520px);width:min(100%,800px);overflow:hidden;border:1px solid rgba(255,255,255,.88);border-radius:32px;background:rgba(255,255,255,.46);box-shadow:0 32px 90px rgba(78,48,88,.18);backdrop-filter:blur(22px)}.brand-side{display:flex;align-items:center;justify-content:center;flex-direction:column;padding:38px;background:linear-gradient(155deg,rgba(228,201,245,.7),rgba(249,210,228,.65));text-align:center}.brand-side img{width:132px;filter:drop-shadow(0 20px 28px rgba(99,60,111,.17));animation:mark-in .8s cubic-bezier(.2,1.25,.4,1)}.brand-side small,.declaration>span{margin-top:22px;color:#93669c;font-size:9px;font-weight:850;letter-spacing:.18em}.brand-side h1{margin:8px 0 5px;font-size:30px}.brand-side p{margin:0;color:#88728c;font-size:10px}.declaration{padding:38px}.declaration>span{margin:0}.declaration h2{margin:7px 0 22px;font-size:27px}.statement{display:grid;gap:13px}.statement p{margin:0;color:#75667a;font-size:11px;line-height:1.7}.statement strong{display:block;margin-bottom:2px;color:#55405b;font-size:11px}.declaration>button{width:100%;min-height:49px;margin-top:25px;border:0;border-radius:20px;background:linear-gradient(135deg,#8c4fb1,#d8649d);color:#fff;font-size:12px;font-weight:850;box-shadow:0 12px 28px rgba(143,64,148,.22)}.declaration>button:disabled{background:rgba(121,91,128,.14);color:#927f96;box-shadow:none}.declaration>small{display:block;margin-top:10px;color:#a18ea4;font-size:8px;line-height:1.6;text-align:center}.brand-splash>footer{position:absolute;bottom:max(17px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:11px;color:#947799;font-size:9px;font-weight:750}.brand-splash>footer i{width:25px;height:1px;background:#cbb4d0}.splash-leave-active{transition:opacity .5s ease,filter .5s ease;pointer-events:none}.splash-leave-to{opacity:0;filter:blur(7px)}@keyframes mark-in{from{opacity:0;transform:translateY(15px) scale(.85)}to{opacity:1;transform:none}}@media(max-width:650px){.brand-splash{align-items:start;padding-top:max(14px,env(safe-area-inset-top))}main{grid-template-columns:1fr;border-radius:25px}.brand-side{padding:22px}.brand-side img{width:82px}.brand-side small{margin-top:10px}.brand-side h1{font-size:23px}.declaration{padding:23px 19px}.declaration h2{margin-bottom:16px;font-size:22px}.statement{gap:9px}.statement p,.statement strong{font-size:10px}.declaration>button{min-height:46px;margin-top:18px}.brand-splash>footer{position:fixed}}@media(prefers-reduced-motion:reduce){.brand-side img{animation:none}}
</style>
<style scoped>
.brand-splash{background:radial-gradient(circle at 16% 20%,rgba(191,132,246,.45),transparent 25%),radial-gradient(circle at 86% 78%,rgba(255,139,193,.38),transparent 27%),linear-gradient(145deg,#eee0f7,#fbdce8);color:#4a2d54}.glow{display:block;background:rgba(255,255,255,.42);filter:blur(60px)}main{border:1px solid rgba(255,255,255,.85);border-radius:32px;background:rgba(255,255,255,.52);box-shadow:0 32px 90px rgba(78,48,88,.2);backdrop-filter:blur(20px)}.brand-side{background:linear-gradient(155deg,rgba(228,201,245,.8),rgba(249,210,228,.72))}.brand-side img{width:128px;filter:drop-shadow(0 20px 28px rgba(99,60,111,.2));animation:mark-in .8s cubic-bezier(.2,1.25,.4,1)}.brand-side small,.declaration>span{color:#93669c;letter-spacing:.16em}.brand-side h1{color:#4a2d54}.declaration h2{color:#4a2d54}.declaration>button{border:1px solid rgba(255,255,255,.42);border-radius:20px;background:linear-gradient(135deg,#8c4fb1,#d8649d 60%,#70b5e8);box-shadow:0 12px 28px rgba(143,64,148,.24)}.brand-splash>footer{color:#947799}.brand-splash>footer i{background:#cbb4d0}@media(max-width:650px){main{border-radius:25px}.brand-side img{width:82px}}
</style>
<style scoped>
.brand-splash{background:radial-gradient(circle at 16% 20%,rgba(191,132,246,.45),transparent 25%),radial-gradient(circle at 86% 78%,rgba(255,139,193,.38),transparent 27%),linear-gradient(145deg,#eee0f7,#fbdce8);color:#4a2d54}.glow{display:block;background:rgba(255,255,255,.42);filter:blur(60px)}main{width:min(100%,800px);border:1px solid rgba(255,255,255,.85);border-radius:32px;background:rgba(255,255,255,.52);box-shadow:0 32px 90px rgba(78,48,88,.2);backdrop-filter:blur(20px)}.brand-side{padding:38px;background:linear-gradient(155deg,rgba(228,201,245,.8),rgba(249,210,228,.72))}.brand-side img{width:128px;filter:drop-shadow(0 20px 28px rgba(99,60,111,.2));animation:mark-in .8s cubic-bezier(.2,1.25,.4,1)}.brand-side small,.declaration>span{color:#93669c;letter-spacing:.16em}.brand-side h1{color:#4a2d54;font-size:30px;font-weight:750}.brand-side p{color:#88728c}.declaration{padding:38px}.declaration h2{color:#4a2d54;font-size:27px;font-weight:750}.statement{gap:13px}.statement strong{color:#55405b}.statement p{color:#75667a}.declaration>button{min-height:49px;border:1px solid rgba(255,255,255,.42);border-radius:20px;background:linear-gradient(135deg,#8c4fb1,#d8649d 60%,#70b5e8);box-shadow:0 12px 28px rgba(143,64,148,.24)}.declaration>button:disabled{background:rgba(121,91,128,.14);color:#927f96}.brand-splash>footer{color:#947799}.brand-splash>footer i{background:#cbb4d0}@media(max-width:650px){main{border-radius:25px}.brand-side{padding:22px}.brand-side img{width:82px}.declaration{padding:23px 19px}.declaration h2{font-size:22px}}
</style>
