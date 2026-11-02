/* Loaded into the service worker (vite.config.ts → workbox.importScripts): shows the rest-over alert the server
   sends (supabase/functions/rest-push), and opens the app when it is tapped. */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Rest over' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rest over', {
      body: data.body || '',
      tag: data.tag || 'gymlog-rest',
      renotify: true,
      vibrate: [200, 100, 200],
      icon: 'icon-192.png',
      badge: 'icon-192.png'
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus()
      return self.clients.openWindow('./')
    })
  )
})
