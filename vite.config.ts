import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import basicSsl from '@vitejs/plugin-basic-ssl'

/** Inline all extracted CSS into <style> tags — eliminates render-blocking <link>. */
function cssInlinePlugin () {
  return {
    name: 'css-inline',
    enforce: 'post' as const,
    apply: 'build' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler (html: string, ctx: { bundle?: Record<string, { type: string; fileName: string; source?: string }> }) {
        if (!ctx.bundle) return html

        for (const [, chunk] of Object.entries(ctx.bundle)) {
          if (chunk.type !== 'asset' || !chunk.fileName.endsWith('.css')) continue

          const css = chunk.source
            ?? readFileSync(resolve('dist', chunk.fileName), 'utf-8')

          const linkRe = new RegExp(
            `<link[^>]+href=["']/?${chunk.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
            'g'
          )
          html = html.replace(linkRe, `<style>${css}</style>`)

          // Remove the now-inlined CSS asset from the bundle
          delete ctx.bundle[chunk.fileName]
        }

        return html
      }
    }
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    // https: true
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
    // basicSsl(),
    // cssInlinePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/(?!api)/],
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
            urlPattern: /\/data\/gdelt-articles\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gdelt-articles',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 6 }
            }
          },
          {
            urlPattern: /\/data\/gnews-articles\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gnews-articles',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 6 }
            }
          },
          {
            urlPattern: /\/data\/nasa-fireballs\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nasa-fireballs',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /\/favicon.*\.(svg|png|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'favicon',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      manifest: {
        name: 'UAP Monitor — Global UAP/UFO Sighting Intelligence',
        short_name: 'UAP MON',
        description: 'Global UAP intelligence platform aggregating 230,000+ verified sighting reports from 15 sources spanning 70 AD to present. Credibility scoring, shape analysis, NASA fireball correlation, and real-time news feeds.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: './',
        scope: './',
        lang: 'en',
        dir: 'ltr',
        categories: ['education', 'news', 'reference'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'favicon-16.png',
            sizes: '16x16',
            type: 'image/png'
          },
          {
            src: 'favicon-32.png',
            sizes: '32x32',
            type: 'image/png'
          }
        ],
        related_applications: [],
        prefer_related_applications: false
      }
    })
  ]
})
