import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 2
      }
    },
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        navigateFallback: 'offline.html',
        navigateFallbackAllowlist: [/^\/$/],
        runtimeCaching: [
          {
            urlPattern: /\/data\/nuforc-manifest\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nuforc-manifest',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 }
            }
          },
          {
            urlPattern: /\/data\/chronology-manifest\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'chronology-manifest',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 }
            }
          },
          {
            urlPattern: /\/data\/hatch-manifest\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hatch-manifest',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 }
            }
          },
          {
            urlPattern: /\/data\/nuforc-.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'nuforc-data',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /\/data\/chronology-.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'chronology-data',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /\/data\/hatch-.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hatch-data',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      },
      manifest: {
        name: 'UAP Monitor',
        short_name: 'UAP MON',
        description: 'Real-time UAP/UFO sighting monitor — CJK + Russia intelligence layer',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
