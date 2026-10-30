import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register the small set of plugins used by the app shell once on the client.
// Route-specific plugins stay lazy so the initial bundle remains focused.
export default defineNuxtPlugin(() => {
  gsap.registerPlugin(ScrollTrigger)
  gsap.defaults({
    duration: 0.55,
    ease: 'power2.out',
    overwrite: 'auto',
  })

  return {
    provide: {
      gsap,
      scrollTrigger: ScrollTrigger,
    },
  }
})
