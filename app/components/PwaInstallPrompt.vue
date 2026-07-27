<script setup lang="ts">
import { Download, X } from '@lucide/vue'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const visible = ref(false)
const deferredPrompt = ref<InstallPromptEvent | null>(null)
const dismissedKey = 'love-home-pwa-install-dismissed-v1'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  deferredPrompt.value = event as InstallPromptEvent
  visible.value = localStorage.getItem(dismissedKey) !== '1'
}

function dismiss() {
  visible.value = false
  localStorage.setItem(dismissedKey, '1')
}

async function install() {
  if (!deferredPrompt.value) return
  await deferredPrompt.value.prompt()
  const choice = await deferredPrompt.value.userChoice
  deferredPrompt.value = null
  if (choice.outcome === 'accepted') visible.value = false
}

onMounted(() => {
  if (isStandalone()) return
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', dismiss)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', dismiss)
})
</script>

<template>
  <Transition name="pwa-install">
    <aside v-if="visible && deferredPrompt" class="pwa-install" role="status" aria-live="polite">
      <div class="pwa-icon"><Download :size="18" /></div>
      <div class="pwa-copy"><strong>安装 Love小家</strong><span>添加到主屏幕，随时打开你们的空间</span></div>
      <button class="pwa-action" type="button" @click="install">安装</button>
      <button class="pwa-close" type="button" aria-label="稍后再说" title="稍后再说" @click="dismiss"><X :size="15" /></button>
    </aside>
  </Transition>
</template>

<style scoped>
.pwa-install{position:fixed;z-index:118;right:22px;bottom:22px;display:grid;grid-template-columns:auto minmax(160px,1fr) auto;align-items:center;gap:10px;width:min(390px,calc(100vw - 28px));padding:12px 13px;border:1px solid rgba(255,255,255,.88);border-radius:20px;background:linear-gradient(135deg,rgba(255,251,255,.94),rgba(255,232,246,.9));box-shadow:0 18px 45px rgba(82,43,98,.2);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.pwa-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:13px;background:linear-gradient(135deg,#8c50bb,#df669e);color:#fff}.pwa-copy{min-width:0}.pwa-copy strong,.pwa-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwa-copy strong{color:#5c3967;font-size:11px}.pwa-copy span{margin-top:3px;color:#967b9b;font-size:9px}.pwa-action{min-height:34px;padding:0 13px;border:0;border-radius:12px;background:linear-gradient(135deg,#8d4eb7,#d8629d);color:#fff;font-size:10px;font-weight:800;cursor:pointer}.pwa-close{position:absolute;top:4px;right:5px;display:grid;place-items:center;width:21px;height:21px;border:0;border-radius:50%;background:transparent;color:#9b829f;cursor:pointer}.pwa-close:hover{background:rgba(145,81,164,.1)}.pwa-install-enter-active,.pwa-install-leave-active{transition:opacity .25s ease,transform .25s ease}.pwa-install-enter-from,.pwa-install-leave-to{opacity:0;transform:translateY(10px) scale(.97)}@media(max-width:650px){.pwa-install{right:12px;bottom:calc(86px + env(safe-area-inset-bottom));width:calc(100vw - 24px);grid-template-columns:auto minmax(0,1fr) auto;padding:11px 12px}.pwa-copy span{font-size:8px}.pwa-action{min-height:36px}}@media(prefers-reduced-motion:reduce){.pwa-install-enter-active,.pwa-install-leave-active{transition:none}}
</style>
