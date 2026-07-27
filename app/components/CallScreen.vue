<script setup lang="ts">
import { ArrowLeft, LoaderCircle, Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, Video, VideoOff, WifiOff } from '@lucide/vue'

const props = defineProps<{ partner?: { displayName?: string; avatarUrl?: string } | null }>()
const emit = defineEmits<{ minimized: [] }>()
const { callStatus, callMode, muted, cameraOff, callError, remoteAudio, localVideo, remoteVideo, acceptCall, rejectCall, hangUp, toggleMute, toggleCamera } = useCoupleCall()
const minimized = ref(false)

async function minimizeCall() {
  minimized.value = true
  emit('minimized')
  const video = remoteVideo.value as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<void> }) | null
  if (callMode.value === 'video' && video?.requestPictureInPicture && document.pictureInPictureEnabled) await video.requestPictureInPicture().catch(() => undefined)
}

async function restoreCall() {
  minimized.value = false
  if (document.pictureInPictureElement && document.exitPictureInPicture) await document.exitPictureInPicture().catch(() => undefined)
}

const statusLabel = computed(() => callStatus.value === 'ringing' ? '来电' : callStatus.value === 'calling' ? '等待接听' : '通话中')
const statusCopy = computed(() => callStatus.value === 'ringing' ? 'TA 想和你说说话' : callStatus.value === 'calling' ? '正在呼叫对方，请稍候' : muted.value ? '麦克风已静音' : '连接稳定，正在通话')
</script>

<template>
  <Teleport to="body">
    <section class="call-screen" :class="[`call-screen-${callStatus}`, { 'call-screen-video': callMode === 'video', 'is-minimized': minimized }]" role="dialog" aria-modal="true" aria-label="通话">
      <div class="call-screen-backdrop" aria-hidden="true" />
      <header class="call-screen-header">
        <button class="call-screen-back" type="button" aria-label="返回聊天" title="返回聊天" @click="hangUp"><ArrowLeft :size="20" /></button>
        <div class="call-screen-title"><span>{{ callMode === 'video' ? '视频通话' : '语音通话' }}</span><small>{{ statusLabel }}</small></div>
        <span class="call-screen-secure">双人私密通话</span>
        <button class="call-screen-minimize" type="button" aria-label="最小化通话" title="最小化通话" @click="minimizeCall"><Minimize2 :size="18" /></button>
      </header>

      <div class="call-screen-stage">
        <video v-if="callMode === 'video'" ref="remoteVideo" class="call-screen-remote" autoplay playsinline />
        <div v-if="callMode === 'video'" class="call-screen-video-placeholder"><Video :size="30" /><span>{{ callStatus === 'connected' ? '等待视频画面' : '视频连接中' }}</span></div>
        <div v-else class="call-screen-avatar-wrap" :class="{ ringing: callStatus === 'ringing' }">
          <span class="call-screen-avatar"><img v-if="partner?.avatarUrl" :src="partner.avatarUrl" alt="伴侣头像"><template v-else>{{ partner?.displayName?.slice(0, 1) || 'TA' }}</template></span>
          <i class="call-screen-ring" aria-hidden="true" />
        </div>
        <video v-if="callMode === 'video'" ref="localVideo" class="call-screen-local" autoplay muted playsinline />
        <audio ref="remoteAudio" autoplay playsinline />
        <div class="call-screen-person"><strong>{{ partner?.displayName || 'TA' }}</strong><span>{{ statusCopy }}</span></div>
      </div>

      <p v-if="callError" class="call-screen-error"><WifiOff :size="15" />{{ callError }}</p>

      <footer class="call-screen-controls">
        <template v-if="callStatus === 'ringing'">
          <button class="call-control call-control-danger" type="button" aria-label="拒绝通话" title="拒绝" @click="rejectCall"><PhoneOff :size="22" /></button>
          <button class="call-control call-control-accept" type="button" aria-label="接听通话" title="接听" @click="acceptCall"><Phone :size="22" /></button>
        </template>
        <template v-else>
          <button v-if="callStatus === 'connected'" class="call-control" :class="{ active: muted }" type="button" aria-label="切换麦克风" title="麦克风" @click="toggleMute"><MicOff v-if="muted" :size="21" /><Mic v-else :size="21" /></button>
          <button v-if="callStatus === 'connected' && callMode === 'video'" class="call-control" :class="{ active: cameraOff }" type="button" aria-label="切换摄像头" title="摄像头" @click="toggleCamera"><VideoOff v-if="cameraOff" :size="21" /><Video v-else :size="21" /></button>
          <button class="call-control call-control-danger" type="button" aria-label="结束通话" title="结束通话" @click="hangUp"><PhoneOff :size="22" /></button>
        </template>
      </footer>
      <div v-if="callStatus === 'calling'" class="call-screen-progress"><LoaderCircle :size="14" />正在建立安全连接</div>
      <div v-if="minimized" class="call-mini" role="status">
        <span class="call-mini-avatar"><img v-if="partner?.avatarUrl" :src="partner.avatarUrl" alt="伴侣头像"><template v-else>{{ partner?.displayName?.slice(0, 1) || 'TA' }}</template></span>
        <span class="call-mini-copy"><strong>{{ partner?.displayName || 'TA' }}</strong><small>{{ callMode === 'video' ? '视频通话' : '语音通话' }} · {{ statusLabel }}</small></span>
        <button type="button" aria-label="恢复全屏通话" title="恢复通话" @click="restoreCall"><Maximize2 :size="17" /></button>
        <button class="call-mini-end" type="button" aria-label="结束通话" title="结束通话" @click="hangUp"><PhoneOff :size="17" /></button>
      </div>
    </section>
  </Teleport>
</template>

<style>
.call-screen{position:fixed;z-index:200;inset:0;display:flex;flex-direction:column;overflow:hidden;padding:max(18px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));color:#fff;background:#24162e}.call-screen-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 18%,rgba(224,152,205,.34),transparent 32%),radial-gradient(circle at 12% 78%,rgba(138,103,211,.35),transparent 30%),linear-gradient(145deg,#2b1a39,#4a254e 62%,#211a36);pointer-events:none}.call-screen-header,.call-screen-stage,.call-screen-controls,.call-screen-error,.call-screen-progress{position:relative;z-index:1}.call-screen-header{display:flex;align-items:center;gap:13px;min-height:48px}.call-screen-back{display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer}.call-screen-title{display:flex;flex-direction:column;gap:2px}.call-screen-title span{font-size:15px;font-weight:800}.call-screen-title small,.call-screen-secure{color:rgba(255,255,255,.64);font-size:10px}.call-screen-secure{margin-left:auto}.call-screen-stage{display:grid;flex:1;place-items:center;min-height:0}.call-screen-avatar-wrap{position:relative;display:grid;place-items:center;width:190px;height:190px}.call-screen-avatar{position:relative;z-index:2;display:grid;place-items:center;width:126px;height:126px;border:4px solid rgba(255,255,255,.78);border-radius:50%;background:linear-gradient(135deg,#ab7bd0,#e58eae);box-shadow:0 20px 58px rgba(8,4,13,.38);font-size:42px;font-weight:800}.call-screen-avatar img{width:100%;height:100%;border-radius:inherit;object-fit:cover}.call-screen-ring{position:absolute;inset:18px;border:1px solid rgba(255,255,255,.3);border-radius:50%;box-shadow:0 0 0 20px rgba(255,255,255,.04),0 0 0 42px rgba(255,255,255,.025)}.call-screen-avatar-wrap.ringing .call-screen-ring{animation:call-screen-ring 1.7s ease-out infinite}.call-screen-person{position:absolute;bottom:7%;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center}.call-screen-person strong{font-size:21px}.call-screen-person span{color:rgba(255,255,255,.68);font-size:11px}.call-screen-remote{position:absolute;inset:20px 0 auto;width:100%;height:min(64vh,620px);border-radius:26px;background:#17131f;object-fit:cover}.call-screen-local{position:absolute;right:0;bottom:13%;width:min(30vw,180px);aspect-ratio:3/4;border:2px solid rgba(255,255,255,.7);border-radius:18px;background:#17131f;object-fit:cover;box-shadow:0 14px 34px rgba(0,0,0,.25)}.call-screen-video-placeholder{display:grid;place-items:center;gap:8px;color:rgba(255,255,255,.62);font-size:11px}.call-screen-video-placeholder span{display:block}.call-screen-error{display:flex;align-items:center;justify-content:center;gap:6px;max-width:600px;margin:0 auto 12px;padding:10px 13px;border:1px solid rgba(255,192,211,.26);border-radius:12px;background:rgba(92,30,61,.5);color:#ffd4e4;font-size:10px;text-align:center}.call-screen-controls{display:flex;justify-content:center;gap:13px;padding-top:14px}.call-control{display:grid;place-items:center;width:56px;height:56px;border:1px solid rgba(255,255,255,.24);border-radius:50%;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}.call-control.active{background:rgba(255,255,255,.76);color:#493157}.call-control-danger{background:#d95c7d;border-color:transparent}.call-control-accept{background:#61c79b;border-color:transparent}.call-screen-progress{display:flex;align-items:center;justify-content:center;gap:6px;padding-top:12px;color:rgba(255,255,255,.58);font-size:10px}.call-screen-progress svg{animation:call-screen-spin 1s linear infinite}@keyframes call-screen-ring{0%{transform:scale(.76);opacity:.95}100%{transform:scale(1.18);opacity:0}}@keyframes call-screen-spin{to{transform:rotate(360deg)}}@media(max-width:650px){.call-screen{padding-right:14px;padding-left:14px}.call-screen-secure{display:none}.call-screen-avatar-wrap{width:160px;height:160px}.call-screen-avatar{width:112px;height:112px}.call-screen-remote{inset:12px 0 auto;height:min(68vh,560px);border-radius:22px}.call-screen-local{right:5px;bottom:16%;width:94px;border-radius:14px}.call-screen-person{bottom:6%}.call-screen-person strong{font-size:19px}.call-control{width:53px;height:53px}}
</style>
<style>
.call-screen-minimize{display:grid;place-items:center;width:35px;height:35px;margin-left:8px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer}.call-screen.is-minimized{inset:auto 14px max(14px,env(safe-area-inset-bottom)) auto;width:min(330px,calc(100vw - 28px));height:auto;overflow:visible;padding:0;background:transparent;pointer-events:none}.call-screen.is-minimized .call-screen-backdrop,.call-screen.is-minimized .call-screen-header,.call-screen.is-minimized .call-screen-stage,.call-screen.is-minimized .call-screen-error,.call-screen.is-minimized .call-screen-controls,.call-screen.is-minimized .call-screen-progress{visibility:hidden;pointer-events:none}.call-mini{position:relative;z-index:2;display:flex;align-items:center;gap:9px;width:100%;min-height:58px;padding:8px 9px;border:1px solid rgba(255,255,255,.75);border-radius:20px;background:rgba(53,30,64,.92);box-shadow:0 16px 36px rgba(30,16,38,.32);backdrop-filter:blur(18px);pointer-events:auto}.call-mini-avatar{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;overflow:hidden;border:2px solid rgba(255,255,255,.62);border-radius:50%;background:linear-gradient(135deg,#ab7bd0,#e58eae);font-size:14px;font-weight:800}.call-mini-avatar img{width:100%;height:100%;object-fit:cover}.call-mini-copy{min-width:0;flex:1}.call-mini-copy strong,.call-mini-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.call-mini-copy strong{font-size:11px}.call-mini-copy small{margin-top:3px;color:rgba(255,255,255,.62);font-size:9px}.call-mini>button{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:11px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer}.call-mini>button.call-mini-end{background:#d95c7d}.call-screen.is-minimized .call-mini{animation:call-mini-in .25s ease-out}@keyframes call-mini-in{from{opacity:0;transform:translateY(12px) scale(.95)}to{opacity:1;transform:none}}@media(max-width:900px){.call-screen.is-minimized{right:10px;bottom:calc(88px + env(safe-area-inset-bottom));width:calc(100vw - 20px)}.call-mini{border-radius:17px}}
</style>
