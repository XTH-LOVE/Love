<script setup lang="ts">
import { Heart, Sparkles, Star } from '@lucide/vue'

// Deterministic placement keeps SSR and hydration identical while giving the ambient
// layer enough density to fill the viewport instead of clustering behind the hero.
const pieces = Array.from({ length: 180 }, (_, index) => {
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
</script>

<template>
  <div class="love-sky" aria-hidden="true">
    <component v-for="piece in pieces" :key="piece.id" :is="piece.icon" class="love-piece" :size="piece.size" :fill="piece.icon === Heart ? 'currentColor' : 'none'" :style="{ left: piece.left, top: piece.top, color: piece.color, opacity: piece.opacity, animationDelay: piece.delay, animationDuration: piece.duration, '--start-x': piece.startX, '--end-x': piece.endX, '--start-y': piece.startY, '--mid-y': piece.midY, '--end-y': piece.endY, '--tilt': piece.tilt, '--inverse-tilt': piece.inverseTilt }" />
  </div>
</template>

<style scoped>
.love-sky{position:fixed;z-index:0;inset:0;overflow:hidden;pointer-events:none;contain:strict}.love-piece{position:absolute;transform-origin:center;animation:float-heart 18s ease-in-out infinite alternate;will-change:transform,opacity;filter:drop-shadow(0 5px 10px rgba(185,91,164,.1))}@keyframes float-heart{0%{transform:translate3d(var(--start-x),var(--start-y),0) rotate(var(--inverse-tilt)) scale(.7);opacity:.2}50%{transform:translate3d(0,var(--mid-y),0) rotate(0deg) scale(.92);opacity:.68}100%{transform:translate3d(var(--end-x),var(--end-y),0) rotate(var(--tilt)) scale(1.08);opacity:.88}}@media(max-width:1100px){.love-piece:nth-child(n+151){display:none}}@media(max-width:650px){.love-piece:nth-child(n+111){display:none}.love-piece{filter:drop-shadow(0 4px 8px rgba(185,91,164,.08))}}@media(prefers-reduced-motion:reduce){.love-piece{animation:none;will-change:auto;opacity:.65!important;transform:none!important}}
</style>
