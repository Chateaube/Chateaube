// Deux sites, Tamatave et Tana : chacun a ses propres données (élèves, caisse, dépenses, salaires…).
// Sur un appareil, les données de Tana sont rangées à part (« TANA:ent-… ») : tout le code de l'application
// continue de lire « ent-… » sans savoir sur quel site il est. La Direction passe d'un site à l'autre avec le
// sélecteur (rechargement) ; l'Économe et le BVS de Tana sont toujours sur Tana, le reste de l'équipe sur Tamatave.
// Ce qui ne dépend pas du site reste commun : la connexion (ent-auth…), la personne connectée (ent-k-moi), le site choisi.

const SITE_KEY = 'ent-site';
const SITES_KEY = 'ent-sites';
const COMMON = (k) => k.startsWith('ent-auth') || k === SITE_KEY || k === SITES_KEY || k === 'ent-k-moi';
export const SITE_NAMES = { TMV: 'Tamatave', TANA: 'Tana' };
// code court des documents (reçus ECO-TMV-…, ECO-TNR-…)
export const SITE_CODES = { TMV: 'TMV', TANA: 'TNR' };

const P = typeof Storage !== 'undefined' ? Storage.prototype : null;
const raw = P ? { get: P.getItem, set: P.setItem, remove: P.removeItem } : null;
const isLocal = (s) => typeof window !== 'undefined' && s === window.localStorage;
const read = (k) => { try { return raw.get.call(window.localStorage, k); } catch { return null; } };

let current = 'TMV';
/** Site sur lequel travaille cet appareil. */
export const activeSite = () => current;
/** Sites permis à la personne connectée (enregistrés à la connexion ; démonstration : les deux). */
export const allowedSites = () => { try { return JSON.parse(read(SITES_KEY)) ?? ['TMV', 'TANA']; } catch { return ['TMV', 'TANA']; } };
/** Nom réel d'une donnée dans le stockage de l'appareil. */
export const storedName = (k, site = current) => (site === 'TANA' && typeof k === 'string' && k.startsWith('ent-') && !COMMON(k) ? `TANA:${k}` : k);

/** À appeler une fois, avant tout le reste (main.jsx). */
export function installSite() {
  if (!raw) return;
  current = read(SITE_KEY) === 'TANA' ? 'TANA' : 'TMV';
  if (current !== 'TANA') return;
  P.getItem = function getItem(k) { return raw.get.call(this, isLocal(this) ? storedName(k) : k); };
  P.setItem = function setItem(k, v) { return raw.set.call(this, isLocal(this) ? storedName(k) : k, v); };
  P.removeItem = function removeItem(k) { return raw.remove.call(this, isLocal(this) ? storedName(k) : k); };
}

/** Données « ent-… » de ce site sur l'appareil (noms tels que l'application les lit). */
export function siteLocalKeys(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  const out = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (!k) continue;
      if (current === 'TANA') { if (k.startsWith('TANA:')) out.push(k.slice(5)); else if (COMMON(k)) out.push(k); }
      else if (!k.startsWith('TANA:')) out.push(k);
    }
  } catch { /* stockage indisponible */ }
  return out;
}

/** Change de site (Direction) : l'application repart sur les données de l'autre site. */
export function switchSite(site) {
  try { raw.set.call(window.localStorage, SITE_KEY, site === 'TANA' ? 'TANA' : 'TMV'); } catch { /* rien */ }
  window.location.reload();
}

/** À la connexion : sites permis ; si l'appareil est sur un site interdit, il passe sur le bon (rechargement). */
export function setAllowedSites(sites) {
  const list = (sites ?? []).filter((s) => s === 'TMV' || s === 'TANA');
  try { raw.set.call(window.localStorage, SITES_KEY, JSON.stringify(list.length ? list : ['TMV'])); } catch { /* rien */ }
  const ok = list.length ? list : ['TMV'];
  if (!ok.includes(current)) { switchSite(ok[0]); return true; }
  return false;
}

/** Nom du site affiché dans les titres des écrans (« Tamatave », « Tana »). */
export const siteName = () => SITE_NAMES[current];

// préférences de l'appareil, sans donnée personnelle : gardées à la déconnexion
// gardés à la déconnexion : réglages de l'appareil, et ce qui ne doit pas être redemandé à chaque connexion
// (charte acceptée, par compte ; messages « J'ai compris » déjà lus)
const DEVICE_PREFS = ['ent-texte-grand-v1', 'ent-ambiance-prefs-v1', 'ent-ambiance-vue', 'ent-site', 'ent-impression-auto',
  'ent-conditions-v1', 'ent-k-guide-notes-vu', 'ent-menu-court-vu'];
/**
 * Déconnexion : efface de l'appareil toutes les données de l'ENT, des deux sites (élèves, caisse, salaires, notes…),
 * pour qu'un poste partagé ne garde rien. Tout est sur le serveur et revient à la prochaine connexion.
 */
export function wipeDevice() {
  if (!raw) return;
  const ls = window.localStorage; const doomed = [];
  try {
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i); const name = k?.startsWith('TANA:') ? k.slice(5) : k;
      if (name?.startsWith('ent-') && !DEVICE_PREFS.includes(name)) doomed.push(k);
    }
    doomed.forEach((k) => raw.remove.call(ls, k));
  } catch { /* stockage indisponible */ }
  try { window.sessionStorage.clear(); } catch { /* rien */ }
}
