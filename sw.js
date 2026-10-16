'use strict';
/* Sert l'application déchiffrée, gardée dans l'appareil (Cache Storage), sous le dossier app/. */
const CACHE = 'celeste-app';

/* Une vidéo du cache peut être demandée par portions, notamment sur tablette.
   Les réponses partielles ne sont jamais remises en cache. */
async function videoEnCache(requete, reponse) {
  const plage = requete.headers.get('Range');
  if (requete.method !== 'GET' || reponse.status !== 200 || !plage ||
      !/^video\//i.test(reponse.headers.get('Content-Type') || '')) return reponse;
  const corps = await reponse.blob(), taille = corps.size;
  const headers = new Headers(reponse.headers);
  headers.set('Accept-Ranges', 'bytes');
  function refus() {
    headers.set('Content-Range', 'bytes */' + taille);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  const m = /^bytes=(\d*)-(\d*)$/i.exec(plage.trim());
  if (!m || (!m[1] && !m[2]) || !taille) return refus();
  let debut, fin;
  if (!m[1]) {
    const suffixe = Number(m[2]);
    if (!Number.isSafeInteger(suffixe) || suffixe <= 0) return refus();
    debut = Math.max(0, taille - suffixe); fin = taille - 1;
  } else {
    debut = Number(m[1]); fin = m[2] ? Number(m[2]) : taille - 1;
    if (!Number.isSafeInteger(debut) || !Number.isSafeInteger(fin) || debut >= taille || fin < debut) return refus();
    fin = Math.min(fin, taille - 1);
  }
  headers.set('Content-Range', 'bytes ' + debut + '-' + fin + '/' + taille);
  headers.set('Content-Length', String(fin - debut + 1));
  return new Response(corps.slice(debut, fin + 1), { status: 206, headers });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url), dossier = new URL('app/', self.registration.scope);
  if (u.origin !== dossier.origin || !u.pathname.startsWith(dossier.pathname)) return;
  /* 14/10 au soir : les bibliothèques libres (app/vendor : MediaPipe pour la chiromancie) ne sont pas dans le paquet chiffré ;
     elles viennent du site au premier usage, puis restent dans l'appareil */
  if (u.pathname.startsWith(dossier.pathname + 'vendor/')) {
    e.respondWith(caches.open('celeste-vendor').then(c => c.match(u.origin + u.pathname).then(r => r || fetch(e.request).then(rep => {
      if (rep.ok) c.put(u.origin + u.pathname, rep.clone()); return rep; }))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(u.origin + u.pathname)).then(r => r ? videoEnCache(e.request, r) : Response.redirect(self.registration.scope, 302)));
});
