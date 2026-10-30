<script setup lang="ts">
import { Heart, Sparkles, Star } from '@lucide/vue'

// Stable placement keeps SSR and hydration identical without a large decorative DOM.
const pieces = Array.from({ length: 96 }, (_, index) => {
  const seed = (index * 9301 + 49297) % 233280
  const kind = index % 11 === 0 ? 'sparkle' : index % 7 === 0 ? 'star' : 'heart'
  return {
    id: index,
    icon: kind === 'sparkle' ? Sparkles : kind === 'star' ? Star : Heart,
    left: `${(seed * 17) % 10000 / 100}%`,
    top: `${(seed * 31 + index * 13) % 10000 / 100}%`,
    size: 10 + seed % 14,
    delay: `${-(seed % 240) / 10}s`,
    duration: `${14 + seed % 13}s`,
    color: index % 3 === 0 ? '#d281d6' : index % 3 === 1 ? '#ef8fb8' : '#b88bdd',
    opacity: 0.085 + (seed % 8) * 0.014,
  }
})
</script>

<template>
  <div class="love-sky" aria-hidden="true">
    <component v-for="piece in pieces" :key="piece.id" :is="piece.icon" class="love-piece" :size="piece.size" :fill="piece.icon === Heart ? 'currentColor' : 'none'" :style="{ left: piece.left, top: piece.top, color: piece.color, opacity: piece.opacity, animationDelay: piece.delay, animationDuration: piece.duration }" />
  </div>
</template>

<style scoped>
.love-sky{position:fixed;z-index:0;inset:0;overflow:hidden;pointer-events:none;contain:strict}.love-piece{position:absolute;transform-origin:center;animation:float-heart 18s ease-in-out infinite alternate;will-change:transform,opacity}@keyframes float-heart{0%{transform:translate3d(-10px,14px,0) rotate(-10deg) scale(.9);opacity:.42}100%{transform:translate3d(12px,-18px,0) rotate(10deg) scale(1.12);opacity:1}}@media(max-width:1100px){.love-piece:nth-child(n+73){display:none}}@media(max-width:650px){.love-piece:nth-child(n+43){display:none;}}@media(prefers-reduced-motion:reduce){.love-piece{animation:none;will-change:auto;opacity:.72!important}}
</style>
