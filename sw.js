// Service worker minimo: serve solo per poter installare l'app sulla Home.
// Non salva niente in memoria: i turni arrivano sempre dalla rete, quindi non possono essere vecchi.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
