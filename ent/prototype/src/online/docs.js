// Documents partagés en ligne (table ent_doc) : la liste des classes publiée par la Direction (« roster ») et
// le carnet de notes de chaque professeur. Toute écriture est d'abord gardée sur l'appareil (« en attente »)
// puis envoyée ; en cas d'échec (pas de réseau), elle repart toute seule dès que possible. Rien n'est perdu
// tant que l'appareil n'a pas confirmé l'envoi.
import { supabase, ONLINE } from './client.js';

const PENDING = (key) => `ent-pending-${key}`;
const listeners = new Set();
const state = {}; // key → { status: 'saved' | 'pending' | 'error', at }

export const syncState = (key) => state[key] ?? null;
export function onSync(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (key, s) => { state[key] = s; listeners.forEach((fn) => fn(key, s)); };

/** Lit un document sur le serveur ; null s'il n'existe pas ; lève une erreur si le serveur ne répond pas. */
export async function fetchDoc(key) {
  const { data, error } = await supabase.from('ent_doc').select('value, updated_at').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { value: data.value, at: data.updated_at } : null;
}

/** Tous les documents d'un type (Direction, secrétariat : tous les carnets). */
export async function fetchDocs(kind) {
  const { data, error } = await supabase.from('ent_doc').select('key, owner, value, updated_at').eq('kind', kind);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Écriture gardée en attente sur l'appareil (si elle n'est pas encore confirmée). */
export function pendingOf(key) {
  try { return JSON.parse(localStorage.getItem(PENDING(key))) ?? null; } catch { return null; }
}
const keepPending = (key, doc) => { try { localStorage.setItem(PENDING(key), JSON.stringify(doc)); return true; } catch { return false; } };
const dropPending = (key, stamp) => { try { if (pendingOf(key)?.stamp === stamp) localStorage.removeItem(PENDING(key)); } catch { /* rien */ } };

const timers = {};
const inflight = {};
/** Enregistre : tout de suite sur l'appareil, puis sur le serveur (regroupé : une seconde après la dernière frappe). */
export function saveDoc(key, kind, owner, value, { delay = 1000 } = {}) {
  const doc = { key, kind, owner, value, stamp: Date.now() };
  keepPending(key, doc);
  emit(key, { status: 'pending', at: null });
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => push(key), delay);
}

async function push(key) {
  const doc = pendingOf(key);
  if (!doc || !ONLINE) return;
  if (inflight[key]) { timers[key] = setTimeout(() => push(key), 800); return; }
  inflight[key] = true;
  try {
    const { error } = await supabase.from('ent_doc').upsert({ key: doc.key, kind: doc.kind, owner: doc.owner, value: doc.value });
    if (error) throw new Error(error.message);
    dropPending(key, doc.stamp);
    emit(key, { status: pendingOf(key) ? 'pending' : 'saved', at: new Date() });
    if (pendingOf(key)) timers[key] = setTimeout(() => push(key), 300);
  } catch (e) {
    emit(key, { status: 'error', at: null, message: e.message });
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => push(key), 15000); // nouvel essai dans 15 secondes
  } finally { inflight[key] = false; }
}

/** Renvoie tout ce qui attend sur cet appareil (au démarrage, au retour du réseau). */
export function flushAll() {
  try { Object.keys(localStorage).filter((k) => k.startsWith('ent-pending-')).forEach((k) => push(k.slice('ent-pending-'.length))); } catch { /* rien */ }
}
export const hasPending = () => { try { return Object.keys(localStorage).some((k) => k.startsWith('ent-pending-')); } catch { return false; } };

if (typeof window !== 'undefined' && ONLINE) {
  window.addEventListener('online', flushAll);
  setInterval(flushAll, 60000);
  window.addEventListener('beforeunload', (e) => { if (hasPending()) { e.preventDefault(); e.returnValue = ''; } });
}
