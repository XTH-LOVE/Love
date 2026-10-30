// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      title: 'Love小家 · CoupleSpace',
      meta: [
        { name: 'theme-color', content: '#f7edf9' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Love小家' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/desktop-icon.png' },
      ],
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  vite: {
    resolve: {
      dedupe: ['vue'],
    },
    optimizeDeps: {
      include: [
        '@capacitor/core',
        '@capacitor/geolocation',
        '@capacitor/local-notifications',
        '@capacitor/push-notifications',
        '@capacitor/splash-screen',
        '@capacitor/status-bar',
          '@lucide/vue',
        'gsap',
        'gsap/ScrollTrigger',
        'gsap/Flip',
        'gsap/Observer',
        'gsap/ScrollToPlugin',
        'gsap/SplitText',
        '@supabase/supabase-js',
        '@uppy/core',
        '@uppy/golden-retriever',
        'tus-js-client',
        'zego-express-engine-webrtc',
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ],
    },
  },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || '',
      zegoAppId: process.env.NUXT_PUBLIC_ZEGO_APP_ID || '1477734707',
      zegoServer: process.env.NUXT_PUBLIC_ZEGO_SERVER || 'wss://webliveroom-api.zego.im/ws',
      amapKey: process.env.NUXT_PUBLIC_AMAP_KEY || '',
      amapSecurityCode: process.env.NUXT_PUBLIC_AMAP_SECURITY_CODE || '',
      appVersion: process.env.NUXT_PUBLIC_APP_VERSION || '1.0.0',
      updateManifestUrl: process.env.NUXT_PUBLIC_UPDATE_MANIFEST_URL || 'https://love-home.pages.dev/app-update.json',
    },
  },
  nitro: {
    prerender: {
      failOnError: false,
    },
  },
  routeRules: {
    '/**': { headers: { 'cache-control': 'no-store, max-age=0' } },
  },
})
