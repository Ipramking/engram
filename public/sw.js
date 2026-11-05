// Minimal service worker: makes Engram installable (needed for the Android share target).
// Network-first; nothing is cached, so users always get the current app and API responses.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
