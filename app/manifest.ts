import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RelayOps',
    short_name: 'RelayOps',
    description: 'Operations layer for motorcycle distribution — container to dealer to delivery.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#163828',
    theme_color: '#163828',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/pwa-icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
