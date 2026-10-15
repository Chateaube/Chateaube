// Version installable (application web progressive) : copie le fichier construit dans ent/app/
// avec le manifeste, les icônes et le service worker qui le garde disponible hors ligne.
// Le service worker est versionné à chaque construction : l'application se met à jour
// d'elle-même dès qu'elle retrouve la connexion.
import { readFileSync, writeFileSync } from 'node:fs';

const out = new URL('../../app/', import.meta.url);
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
let html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const head = `
    <link rel="manifest" href="manifest.webmanifest" />
    <meta name="theme-color" content="#003366" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="ENT Chateaubriand" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="icon-192.png" />
    <script>if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>`;
html = html.replace('</head>', `${head}\n  </head>`);
writeFileSync(new URL('index.html', out), html);

writeFileSync(new URL('manifest.webmanifest', out), JSON.stringify({
  name: 'ENT Chateaubriand',
  short_name: 'Chateaubriand',
  description: 'Espace numérique de travail — École Collège Lycée Chateaubriand',
  lang: 'fr',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#003366',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}, null, 2));

writeFileSync(new URL('sw.js', out), `// ENT Chateaubriand — disponible hors ligne (version ${version})
const CACHE = 'ent-${version}';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (dernière version quand on est en ligne), sinon la copie gardée sur le téléphone
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
`);
console.log(`Application installable écrite dans ent/app (version ${version})`);
