// RelayOps service worker — deliberately minimal and safe.
//
// It does NOT cache authenticated pages, API responses, or live data (that
// would risk serving stale records). Its only job is to make the app
// installable and to show a friendly offline page when a navigation fails
// because the device has no connection.

const CACHE = 'relayops-shell-v1'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  // Only intercept top-level page navigations. Everything else (data, assets,
  // auth) goes straight to the network, untouched.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
  }
})
