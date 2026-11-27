// Site d'essai : copie de l'ENT construit (ent/index.html) à l'adresse …/ent-essai/, avec un bandeau orange.
// Les nouveautés à valider s'y activent (src/essai.js) ; le vrai site …/ent/ ne change pas.
// Pas d'application installable ni de service worker ici : la page se recharge toujours dans sa dernière version.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = new URL('../../index.html', import.meta.url); // ent/index.html (construit par build:app)
const dir = new URL('../../../ent-essai/', import.meta.url);
let html = readFileSync(src, 'utf8');
// retire le manifeste, les icônes et l'enregistrement du service worker (propres au vrai site)
html = html.replace(/\n\s*<link rel="manifest"[^>]*>/, '').replace(/\n\s*<script>if \('serviceWorker' in navigator\)[^<]*<\/script>/, '');
const banner = `<meta name="robots" content="noindex, nofollow" />
    <style>#essai-bandeau{position:relative;z-index:9999;background:#f59e0b;color:#1f2937;font:600 13px/1.4 system-ui,sans-serif;padding:6px 12px;text-align:center}</style>`;
const end = html.indexOf('</head>', html.indexOf('</script>'));
html = `${html.slice(0, end)}${banner}\n  ${html.slice(end)}`;
const body = html.indexOf('<body', end);
const bodyEnd = html.indexOf('>', body) + 1;
html = `${html.slice(0, bodyEnd)}\n<div id="essai-bandeau">SITE D'ESSAI · nouveautés à valider avant la mise en ligne · les données sont les vraies : ce que vous enregistrez ici est réellement enregistré</div>${html.slice(bodyEnd)}`;
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('index.html', dir), html);
console.log('ent-essai/index.html prêt');
