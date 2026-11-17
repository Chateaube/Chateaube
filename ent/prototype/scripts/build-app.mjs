// Version installable (application web progressive) : copie le fichier construit dans ent/ (adresse …/ent/)
// avec le manifeste, les icônes et le service worker qui le garde disponible hors ligne.
// Le service worker est versionné à chaque construction : l'application se met à jour
// d'elle-même dès qu'elle retrouve la connexion.
import { readFileSync, writeFileSync } from 'node:fs';
import { transform } from 'lightningcss';

/**
 * Anciens téléphones (Chrome 64+, iOS 12+) : la feuille de style de Tailwind utilise des notations récentes
 * qu'ils ignorent (blocs « @layer », couleurs oklch, media « width>=… »), ce qui donnerait un écran sans couleurs.
 * 1. les blocs @layer sont déroulés dans le même ordre (theme, base, components, utilities, puis le reste) ;
 * 2. Lightning CSS ajoute des couleurs classiques (#rrggbb) avant les couleurs modernes, et réécrit les media.
 * Les navigateurs récents gardent les couleurs modernes (déclarées après).
 */
export function unwrapLayers(css) {
  let out = css.replace(/@layer\s+[\w-]+(\s*,\s*[\w-]+)*\s*;/g, '');
  for (let i = out.indexOf('@layer'); i !== -1; i = out.indexOf('@layer', i)) {
    const open = out.indexOf('{', i);
    let depth = 0; let j = open;
    for (; j < out.length; j += 1) { if (out[j] === '{') depth += 1; else if (out[j] === '}') { depth -= 1; if (depth === 0) break; } }
    out = out.slice(0, i) + out.slice(open + 1, j) + out.slice(j + 1);
  }
  return out;
}
const OLD_TARGETS = { chrome: 64 << 16, safari: 12 << 16, firefox: 60 << 16, edge: 79 << 16 };
function compatCss(html) {
  return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (all, attrs, css) => {
    if (!css.includes('@layer')) return all;
    const code = transform({ filename: 'app.css', code: Buffer.from(unwrapLayers(css)), minify: true, targets: OLD_TARGETS }).code.toString();
    return `<style${attrs}>${code}</style>`;
  });
}

const out = new URL('../../', import.meta.url); // ent/ : l'ENT est à l'adresse …/ent/
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
let html = compatCss(readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8'));
const head = `
    <link rel="manifest" href="manifest.webmanifest" />
    <meta name="theme-color" content="#003366" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="ENT Chateaubriand" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="icon-192.png" />
    <script>if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>`;
// le vrai </head> de la page : le premier après la fin du script intégré de l'application (le code de l'application
// contient d'autres « </head> » et « <body> » dans ses chaînes, par exemple pour les impressions)
const end = html.indexOf('</head>', html.indexOf('</script>'));
if (end < 0) throw new Error('</head> introuvable');
html = `${html.slice(0, end)}${head}\n  ${html.slice(end)}`;
// garde-fou : l'ajout ne doit jamais tomber dans le code de l'application (page blanche)
if (html.indexOf('rel="manifest"') < html.indexOf('</script>')) throw new Error('ajout mal placé dans index.html');
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
    // « no-cache » : toujours redemander la dernière version à GitHub (qui fait garder les pages 10 minutes)
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
// Notifications envoyées par le serveur de l'école (Web Push, sans SMS) : { title, body, tag, urgent }
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ENT Chateaubriand', { body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', requireInteraction: !!d.urgent }));
});
// Toucher la notification ouvre (ou remet devant) l'application
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
`);
console.log(`Application installable écrite dans ent/ (version ${version})`);
