'use strict';
/* Sert l'application déchiffrée, gardée dans l'appareil (Cache Storage), sous le dossier app/. */
const CACHE = 'celeste-app';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url), dossier = new URL('app/', self.registration.scope);
  if (u.origin !== dossier.origin || !u.pathname.startsWith(dossier.pathname)) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(u.origin + u.pathname)).then(r => r || Response.redirect(self.registration.scope, 302)));
});
