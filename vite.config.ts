import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative base: the same build works at / (Netlify, Vercel, localhost) and at /Gym/ (GitHub Pages).
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than the app: separate files mean an app update re-downloads less.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeManifestIcons: false, // precache only the icons listed in globPatterns below
      manifest: {
        id: './',
        name: 'GymLog',
        short_name: 'GymLog',
        description: 'Log workouts fast at the gym: last-time numbers, rest timer, PR alerts and body-weight tracking.',
        lang: 'en',
        dir: 'ltr',
        categories: ['health', 'fitness', 'sports', 'lifestyle'],
        theme_color: '#141518',
        background_color: '#141518',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ],
        // Long-press the home-screen icon. Hash routes because the app uses HashRouter.
        shortcuts: [
          {
            name: 'Start next workout',
            short_name: 'Workout',
            description: 'Open the next workout in your plan',
            url: './#/?start=next',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Log body weight',
            short_name: 'Weight',
            description: 'Add today’s body weight',
            url: './#/body?add=1',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
          }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        // App shell only. Launch screens are read by iOS at install time and the large PNG icons by the
        // OS installer, so precaching them would only cost download on every update.
        globPatterns: ['**/*.{js,css,html,woff2}', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png'],
        // Inter: precache only the Latin files (English UI); other scripts still load on demand when online.
        globIgnores: ['splash/**', '**/*vietnamese*', '**/*cyrillic*', '**/*greek*', '**/*-italic*'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Photos from the private Supabase bucket. Signed URLs carry a ?token=… that changes, so the
            // cache key drops the query: a photo you have seen once still shows offline at the gym.
            // Paths are unique per upload (never overwritten), so cache-first is safe.
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/sign/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'gymlog-photos',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const u = new URL(request.url)
                    u.search = ''
                    return u.href
                  }
                }
              ]
            }
          }
        ]
      }
    })
  ]
})
