// Ancienne adresse de l'ENT (…/ent/app/) : l'application est maintenant à …/ent/.
// Ce service worker efface l'ancienne copie hors ligne puis se retire, pour que l'ancienne adresse renvoie vers la nouvelle.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach((c) => c.navigate('../'));
  })());
});
