// Anciens téléphones (Android 7-9, iOS 12-15, navigateur intégré de WhatsApp) : fonctions récentes du navigateur
// que l'application utilise, ajoutées seulement si elles manquent. Chargé en tout premier (main.jsx).
/* eslint-disable no-extend-native */
const def = (obj, name, fn) => { if (!obj[name]) Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); };
function at(i) { const n = Math.trunc(i) || 0; const k = n < 0 ? this.length + n : n; return k >= 0 && k < this.length ? this[k] : undefined; }
def(Array.prototype, 'at', at);
def(String.prototype, 'at', at);
def(String.prototype, 'replaceAll', function replaceAll(search, repl) {
  if (search instanceof RegExp) return this.replace(search, repl);
  return this.split(String(search)).join(typeof repl === 'function' ? repl(String(search)) : repl);
});
def(Array.prototype, 'flat', function flat(depth = 1) {
  return depth < 1 ? Array.prototype.slice.call(this) : Array.prototype.reduce.call(this, (acc, v) => acc.concat(Array.isArray(v) ? v.flat(depth - 1) : v), []);
});
def(Array.prototype, 'flatMap', function flatMap(fn, thisArg) { return Array.prototype.map.call(this, fn, thisArg).flat(1); });
def(Object, 'fromEntries', (entries) => { const o = {}; for (const [k, v] of entries) o[k] = v; return o; });
def(String.prototype, 'matchAll', function* matchAll(re) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`); let m;
  while ((m = r.exec(this)) !== null) { yield m; if (m[0] === '') r.lastIndex += 1; }
});
def(Promise, 'allSettled', (list) => Promise.all([...list].map((p) => Promise.resolve(p).then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason })))));
if (typeof globalThis === 'undefined') { try { window.globalThis = window; } catch { /* rien */ } }
