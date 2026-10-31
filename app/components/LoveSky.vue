<script setup lang="ts">
import { Heart, Sparkles, Star } from '@lucide/vue'

// Deterministic placement keeps SSR and hydration identical while giving the ambient
// layer enough density to fill the viewport instead of clustering behind the hero.
const pieces = Array.from({ length: 120 }, (_, index) => {
  const seed = (index * 9301 + 49297) % 233280
  const kind = index % 11 === 0 ? 'sparkle' : index % 7 === 0 ? 'star' : 'heart'
  const driftSeed = (seed * 17 + index * 97) % 1000
  const verticalSeed = (seed * 31 + index * 53) % 1000
  const startY = -14 + (verticalSeed % 26)
  const tilt = -18 + (seed % 36)
  return {
    id: index,
    icon: kind === 'sparkle' ? Sparkles : kind === 'star' ? Star : Heart,
    left: `${(seed * 17) % 10000 / 100}%`,
    top: `${(seed * 31 + index * 13) % 10000 / 100}%`,
    size: 10 + seed % 17,
    delay: `${-(seed % 320) / 10}s`,
    duration: `${18 + seed % 18}s`,
    startX: `${-18 + (driftSeed % 18)}vw`,
    endX: `${8 + (driftSeed % 30)}vw`,
    startY: `${startY}vh`,
    endY: `${-4 - (verticalSeed % 30)}vh`,
    midY: `${Math.round(startY * -0.35 * 10) / 10}vh`,
    tilt: `${tilt}deg`,
    inverseTilt: `${-tilt}deg`,
    color: index % 3 === 0 ? '#d281d6' : index % 3 === 1 ? '#ef8fb8' : '#b88bdd',
    opacity: 0.12 + (seed % 8) * 0.018,
  }
})

// Render the full desktop layer during SSR, then trim it on small screens after
// hydration. This avoids a mobile hydration mismatch while keeping the phone
// compositor from carrying a desktop-sized particle field.
const pieceLimit = ref(120)
const isPaused = ref(false)
const visiblePieces = computed(() => pieces.slice(0, pieceLimit.value))
let viewportQuery: MediaQueryList | undefined

function syncViewport() {
  if (!import.meta.client) return
  pieceLimit.value = window.innerWidth <= 650 ? 36 : window.innerWidth <= 1100 ? 64 : 120
}

function syncVisibility() {
  if (import.meta.client) isPaused.value = document.visibilityState !== 'visible'
}

onMounted(() => {
  syncViewport()
  syncVisibility()
  viewportQuery = window.matchMedia('(max-width: 1100px)')
  viewportQuery.addEventListener('change', syncViewport)
  window.addEventListener('resize', syncViewport, { passive: true })
  document.addEventListener('visibilitychange', syncVisibility, { passive: true })
})

onBeforeUnmount(() => {
  viewportQuery?.removeEventListener('change', syncViewport)
  viewportQuery = undefined
  window.removeEventListener('resize', syncViewport)
  document.removeEventListener('visibilitychange', syncVisibility)
})
</script>

<template>
  <div class="love-sky" :class="{ paused: isPaused }" aria-hidden="true">
    <component v-for="piece in visiblePieces" :key="piece.id" :is="piece.icon" class="love-piece" :size="piece.size" :fill="piece.icon === Heart ? 'currentColor' : 'none'" :style="{ left: piece.left, top: piece.top, color: piece.color, opacity: piece.opacity, animationDelay: piece.delay, animationDuration: piece.duration, '--start-x': piece.startX, '--end-x': piece.endX, '--start-y': piece.startY, '--mid-y': piece.midY, '--end-y': piece.endY, '--tilt': piece.tilt, '--inverse-tilt': piece.inverseTilt }" />
  </div>
</template>

<style scoped>
.love-sky{position:fixed;z-index:0;inset:0;overflow:hidden;pointer-events:none;contain:strict}.love-piece{position:absolute;transform-origin:center;animation:float-heart 18s ease-in-out infinite alternate;will-change:transform;filter:drop-shadow(0 3px 7px rgba(185,91,164,.08))}.love-sky.paused .love-piece{animation-play-state:paused}@keyframes float-heart{0%{transform:translate3d(var(--start-x),var(--start-y),0) rotate(var(--inverse-tilt)) scale(.7);opacity:.2}50%{transform:translate3d(0,var(--mid-y),0) rotate(0deg) scale(.92);opacity:.68}100%{transform:translate3d(var(--end-x),var(--end-y),0) rotate(var(--tilt)) scale(1.08);opacity:.88}}@media(max-width:1100px){.love-piece{filter:none}}@media(max-width:650px){.love-piece{width:clamp(6px,2.4vw,10px)!important;height:clamp(6px,2.4vw,10px)!important;animation-duration:28s;filter:none;opacity:.5!important}}@media(prefers-reduced-motion:reduce){.love-piece{animation:none;will-change:auto;opacity:.5!important;transform:none!important}}
</style>
