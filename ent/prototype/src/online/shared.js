// Données partagées en ligne entre la Direction, le secrétariat et la vie scolaire : caisse, inscriptions, élèves,
// vie scolaire, agenda, réglages… Chaque donnée de l'ENT reste enregistrée sur l'appareil (l'application marche
// sans réseau) et une copie part sur le serveur ; les autres postes la reçoivent. Deux postes qui écrivent en même
// temps ne s'écrasent pas : les listes sont fusionnées élément par élément (reçus, mouvements, absences…).
//   « gestion » : Direction et secrétariat (caisse, salaires, inscriptions, paiements) ;
//   « equipe »  : Direction, secrétariat et vie scolaire (élèves, agenda, réglages…) ;
//   « classe »  : les mêmes + les professeurs (punitions, colles, passeport, objets, absences, examens blancs) ;
//   « ecole »   : écrit par Direction, secrétariat, vie scolaire ; lu aussi par les professeurs (vie de l'école, annonces).
// Les élèves et les parents n'y ont pas accès (règles du serveur : 60_partage.sql, 80_partage_professeurs.sql).
// Un effacement sur un appareil (expiration, « Effacer les données ») reste local : il n'efface rien sur le serveur.
import { supabase } from './client.js';
import { activeSite, siteLocalKeys } from '../site.js';
import { readStored } from '../persist.js';

const GESTION = ['ent-s-hors-comptes', 'ent-s-depenses', 'ent-k-tarifs', 'ent-s-recus', 'ent-s-journal-caisse', 'ent-s-clotures', 'ent-caisse-mouvements-v1', 'ent-k-reductions',
  'ent-k-articles', 'ent-s-fournisseurs', 'ent-s-comptes-', 'ent-s-relances-envoyees', 'ent-s-relances-decisions', 'ent-tarifs-verrou-v1', 'ent-s-taux',
  'ent-s-salaires-payes', 'ent-s-paie', 'ent-s-paie-validee', 'ent-s-personnel', 'ent-s-fiches-agents', 'ent-s-pieces-demandees', 'ent-s-pieces-a-recevoir',
  'ent-s-documents-recus', 'ent-s-documents-envoyes', 'ent-campagne-v1', 'ent-remise-v1', 'ent-bulletin-dispo-v1', 'ent-k-tarifs-reels-v1', 'ent-k-message-acces'];
const EQUIPE = ['ent-import-v1', 'ent-profiles-v2', 'ent-fiche-v1', 'ent-chateaubriand-settings-v3', 'ent-s-autorisations', 'ent-sorties-v1',
  'ent-appel-v1', 'ent-passages-v1', 'ent-suivis-v1', 'ent-absences-prof-v1', 'ent-retards-prof-v1', 'ent-remplacements-v1', 'ent-changements-edt-v1', 'ent-s-reprise-absences', 'ent-demandes-v1',
  'ent-signatures-v1', 'ent-taches-v1', 'ent-s-evenements', 'ent-evenements-proposes-v1', 'ent-engagements-v1',
  'ent-engagements-valides-v1', 'ent-fratries-v1', 'ent-engagements-catalogue-v1', 'ent-fiches-orientation-v1', 'ent-manuels-v2', 'ent-inventaire-v2', 'ent-cdi-v1',
  'ent-s-cdi-rappels', 'ent-s-reservations', 'ent-k-reprise-vie-scolaire', 'ent-journal-v1', 'ent-suggestions-v1',
  'ent-remontees-conseil-v1', 'ent-s-terminales-', 'ent-s-stages-', 'ent-s-conseil-passage', 'ent-themes-parcours-v1',
  'ent-k-parcoursup-2027-ajoute', 'ent-avis-v1'];
// partagés avec les professeurs : vie de classe (punitions, colles, passeport, objets, absences) et examens blancs
const CLASSE = ['ent-s-sanctions', 'ent-passeport-v3', 'ent-objets-v1', 'ent-absences-eleves-v1', 'ent-surveillance-colles-v1', 'ent-examens-blancs-v3', 'ent-journal-profs-v1', 'ent-programmes-v1'];
// ce que les professeurs écrivent (130_droits_professeurs.sql) : dans ces listes, leurs propres lignes seulement
// (signées de leur compte, « uid »), et les notes des examens blancs ; le reste leur est en lecture seule
const TEACHER_LINES = ['ent-s-sanctions', 'ent-objets-v1', 'ent-passeport-v3', 'ent-journal-profs-v1'];
const TEACHER_WRITES = [...TEACHER_LINES, 'ent-examens-blancs-v3'];
// lus par les professeurs, écrits par la Direction, le secrétariat et la vie scolaire : vie de l'école, annonces, ressources
const ECOLE = ['ent-vie-ecole-v2', 'ent-annonces-v2', 'ent-ressources-v3'];
const IMPORT = 'ent-import-v1';
const PAY = '#paiements'; // les paiements de l'import : réservés à la gestion (pas à la vie scolaire)
export const GROUPS_OF = { DIRECTION: ['gestion', 'equipe', 'classe', 'ecole'], BUREAU: ['gestion', 'equipe', 'classe', 'ecole'], VIE_SCOLAIRE: ['equipe', 'classe', 'ecole'], ENSEIGNANT: ['classe', 'ecole'] };
// groupes reçus mais jamais envoyés (lecture seule) pour ce profil
const READ_ONLY = { ENSEIGNANT: ['ecole'] };

const inList = (list, k) => list.some((p) => (p.endsWith('-') ? k.startsWith(p) : k === p));
/** Groupe d'une donnée de l'appareil (null : reste sur l'appareil). */
export const groupOf = (k) => (inList(GESTION, k) ? 'gestion' : inList(EQUIPE, k) ? 'equipe' : inList(CLASSE, k) ? 'classe' : inList(ECOLE, k) ? 'ecole' : null);
// Tana : ses données partagées sont rangées à part sur le serveur (« partage:TANA:… », règles de 90_sites.sql)
const prefix = () => (activeSite() === 'TANA' ? 'partage:TANA:' : 'partage:');
const docKey = (group, k) => `${prefix()}${group}:${k}`;
const ofThisSite = (dk) => (activeSite() === 'TANA' ? dk.startsWith('partage:TANA:') : !dk.startsWith('partage:TANA:'));

/* ---------------- Fusion à trois (base commune, appareil, serveur) ---------------- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const idOf = (x) => (x && typeof x === 'object' ? x.id ?? x.number ?? x.key ?? null : null);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const keyed = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => idOf(x) != null);

function mergeList(base, local, server) {
  const m = (a) => new Map((a ?? []).map((x) => [String(idOf(x)), x]));
  const b = m(base); const l = m(local); const s = m(server);
  const order = [...new Set([...(server ?? []).map((x) => String(idOf(x))), ...(local ?? []).map((x) => String(idOf(x)))])];
  const out = [];
  order.forEach((id) => {
    const bv = b.get(id); const lv = l.get(id); const sv = s.get(id);
    if (lv === undefined && bv !== undefined) { if (sv !== undefined && !same(sv, bv)) out.push(sv); return; } // effacé ici
    if (sv === undefined && bv !== undefined) { if (lv !== undefined && !same(lv, bv)) out.push(lv); return; } // effacé ailleurs
    out.push(merge3(bv, lv, sv));
  });
  return out;
}

/** Fusion : ce qui a changé ici et ce qui a changé ailleurs depuis la base commune sont gardés tous les deux. */
export function merge3(base, local, server) {
  if (local === undefined) return server;
  if (server === undefined || same(local, server)) return local;
  if (base !== undefined && same(base, local)) return server;
  if (base !== undefined && same(base, server)) return local;
  if ((keyed(local) || (Array.isArray(local) && !local.length)) && (keyed(server) || (Array.isArray(server) && !server.length))) {
    return mergeList(Array.isArray(base) ? base : [], local, server);
  }
  if (isObj(local) && isObj(server)) {
    const b = isObj(base) ? base : {};
    const out = {};
    new Set([...Object.keys(server), ...Object.keys(local)]).forEach((k) => {
      const inB = k in b;
      if (!(k in local) && inB) { if (k in server && !same(server[k], b[k])) out[k] = server[k]; return; }
      if (!(k in server) && inB) { if (k in local && !same(local[k], b[k])) out[k] = local[k]; return; }
      const v = merge3(inB ? b[k] : undefined, local[k], server[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  return local; // valeur simple modifiée des deux côtés : la dernière saisie l'emporte
}

/**
 * Restauration d'une sauvegarde : on remet ce qui manque, sans jamais rien effacer ni remplacer de ce qui a été
 * saisi depuis (sur ce poste ou un autre). Listes : celles du serveur + les éléments de la sauvegarde absents ;
 * fiches : les champs du serveur + ceux qui lui manquent ; valeurs simples : celle du serveur.
 */
export function unionKeep(server, local) {
  if (server === undefined) return local;
  if (local === undefined) return server;
  const listish = (a) => Array.isArray(a) && (!a.length || keyed(a));
  if (listish(server) && listish(local)) {
    const ids = new Set(server.map((x) => String(idOf(x))));
    return [...server, ...local.filter((x) => !ids.has(String(idOf(x))))];
  }
  if (isObj(server) && isObj(local)) {
    const out = { ...server };
    Object.keys(local).forEach((k) => { out[k] = unionKeep(server[k], local[k]); });
    return out;
  }
  return server;
}

/* ---------------- Synchronisation ---------------- */
let groups = []; let readOnly = []; let teacher = false; let active = false; let applying = false;
let suspended = false; // restauration en cours : rien ne part avant le rechargement
const RESTORE = 'ent-sync-restaure';
const readRestore = () => { try { return new Set(JSON.parse(localStorage.getItem(RESTORE)) ?? []); } catch { return new Set(); } };
const writeRestore = (s) => { applying = true; try { if (s.size) localStorage.setItem(RESTORE, JSON.stringify([...s])); else localStorage.removeItem(RESTORE); } catch { /* rien */ } applying = false; };
/** Avant d'écrire une sauvegarde sur l'appareil : plus aucun envoi jusqu'au rechargement ; ces données seront
 *  ensuite ajoutées au serveur sans rien y effacer (unionKeep). */
export function beginRestore(keys) {
  suspended = true; clearTimeout(timer);
  const r = readRestore(); keys.forEach((k) => r.add(k)); writeRestore(r);
  const d = readDirty(); keys.forEach((k) => d.add(k)); writeDirty(d);
}
const base = {}; // dernière version commune connue, par clé (en mémoire)
const DIRTY = 'ent-sync-dirty';
const readDirty = () => { try { return new Set(JSON.parse(localStorage.getItem(DIRTY)) ?? []); } catch { return new Set(); } };
const writeDirty = (s) => { applying = true; try { localStorage.setItem(DIRTY, JSON.stringify([...s])); } catch { /* plein */ } applying = false; };
const readLocal = (k) => { try { const r = localStorage.getItem(k); return r === null ? undefined : JSON.parse(r); } catch { return undefined; } };
const listeners = new Set();
let status = { state: 'idle', at: null };
export const sharedStatus = () => status;
export function onShared(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const setStatus = (s) => { status = s; listeners.forEach((fn) => fn(s)); };

function writeLocal(k, v) {
  const raw = JSON.stringify(v);
  applying = true;
  try { localStorage.setItem(k, raw); } catch { /* plein */ }
  applying = false;
  // écrans ouverts (usePersistent) : reprennent la nouvelle valeur
  try { window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: raw })); } catch { /* hors navigateur */ }
}
const allowed = (k) => groups.includes(groupOf(k));
const writable = (k) => allowed(k) && !readOnly.includes(groupOf(k)) && (!teacher || TEACHER_WRITES.includes(k));

// Serveur : clé du document → { value, at } (at = updated_at, sert de numéro de version)
const val = (map, key) => map.get(key)?.value;
// valeur côté serveur d'une clé de l'appareil (l'import est en deux morceaux : élèves / paiements)
function fromServer(map, k) {
  if (k !== IMPORT) return val(map, docKey(groupOf(k), k));
  const main = val(map, docKey('equipe', IMPORT));
  const pay = val(map, docKey('gestion', IMPORT + PAY));
  if (main === undefined && pay === undefined) return undefined;
  return { ...(main ?? {}), ...(groups.includes('gestion') && pay !== undefined ? { payments: pay } : {}) };
}
function toServer(k, v) {
  if (k !== IMPORT) return [{ key: docKey(groupOf(k), k), value: v }];
  const { payments, ...rest } = v ?? {};
  return [{ key: docKey('equipe', IMPORT), value: rest }, ...(groups.includes('gestion') && payments !== undefined ? [{ key: docKey('gestion', IMPORT + PAY), value: payments }] : [])];
}
// la vie scolaire ne reçoit pas les paiements : on ne compare / fusionne que ce qu'elle voit
const visible = (k, v) => (k === IMPORT && !groups.includes('gestion') && isObj(v) ? (({ payments, ...r }) => r)(v) : v);

// Dossiers déjà reçus (clé → { value, at }) : à chaque passage, on demande seulement la liste des dossiers et
// leur date de modification (quelques centaines d'octets), puis le contenu de ceux qui ont changé. Avant, tout
// le contenu de tous les dossiers repartait toutes les 30 secondes, même sans aucun changement.
let known = new Map();
async function fetchAll() {
  const { data, error } = await supabase.from('ent_doc').select('key, updated_at').eq('kind', 'PARTAGE');
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((d) => ofThisSite(d.key));
  const changed = rows.filter((d) => known.get(d.key)?.at !== d.updated_at).map((d) => d.key);
  const next = new Map(rows.filter((d) => known.get(d.key)?.at === d.updated_at).map((d) => [d.key, known.get(d.key)]));
  for (let i = 0; i < changed.length; i += 40) { // par paquets, pour garder des adresses courtes
    const { data: docs, error: e } = await supabase.from('ent_doc').select('key, value, updated_at').eq('kind', 'PARTAGE').in('key', changed.slice(i, i + 40));
    if (e) throw new Error(e.message);
    (docs ?? []).forEach((d) => next.set(d.key, { value: d.value, at: d.updated_at }));
  }
  known = next;
  return next;
}
const localKeys = () => siteLocalKeys().filter((k) => allowed(k));
const serverKeys = (map) => [...map.keys()].map((dk) => dk.slice(prefix().length).split(':').slice(1).join(':').replace(PAY, '')).filter((k) => allowed(k));

// une seule opération à la fois sur cet appareil (réception / envoi)
let chain = Promise.resolve();
const exclusive = (fn) => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };

/** Reçoit les données du serveur ; envoie ce qui n'y est pas encore. */
export function pullShared() {
  if (!active || suspended) return Promise.resolve();
  return exclusive(async () => {
    const map = await fetchAll();
    const dirty = readDirty();
    new Set([...serverKeys(map), ...localKeys(), ...dirty]).forEach((k) => {
      const srv = fromServer(map, k); const local = readLocal(k);
      if (!writable(k)) { if (srv !== undefined && !same(local, srv)) writeLocal(k, srv); base[k] = srv; dirty.delete(k); return; } // lecture seule : le serveur fait foi
      if (dirty.has(k) || srv === undefined) {
        if (local !== undefined) dirty.add(k); // modifié ici (ou absent du serveur) : sera fusionné puis envoyé
      } else if (!same(visible(k, local), visible(k, srv))) {
        writeLocal(k, srv); base[k] = srv; // la vie scolaire n'a jamais les paiements
      } else base[k] = srv;
    });
    writeDirty(dirty);
    await sendDirty(map);
  });
}

/**
 * Écrit les documents d'une donnée sur le serveur seulement s'ils n'ont pas changé depuis la lecture (version) :
 * sinon un autre poste vient d'écrire, et on recommence la fusion avec sa version (rien n'est écrasé).
 */
async function writeDocs(docs, map) {
  for (const d of docs) {
    const cur = map.get(d.key);
    if (cur && same(cur.value, d.value)) continue;
    const q = cur
      ? supabase.from('ent_doc').update({ value: d.value }).eq('key', d.key).eq('updated_at', cur.at).select('key, updated_at')
      : supabase.from('ent_doc').insert({ key: d.key, kind: 'PARTAGE', owner: null, value: d.value }).select('key, updated_at');
    const { data, error } = await q;
    if (error) { if (error.code === '23505' || /duplicate/i.test(error.message)) return false; throw new Error(error.message); }
    if (!data?.length) return false; // version changée entre-temps
    map.set(d.key, { value: d.value, at: data[0].updated_at });
    known.set(d.key, { value: d.value, at: data[0].updated_at }); // déjà connu : pas besoin de le retélécharger
  }
  return true;
}

// professeur : chaque ligne qu'il ajoute est signée de son compte (le serveur vérifie qu'il ne touche qu'aux siennes)
const myId = () => readStored('ent-k-moi')?.id ?? null;
function signLines(v, srv, uid) {
  if (Array.isArray(v)) {
    const known = new Set((Array.isArray(srv) ? srv : []).map((x) => String(idOf(x))));
    return v.map((x) => (isObj(x) && !x.uid && !known.has(String(idOf(x))) ? { ...x, uid } : x));
  }
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([f, x]) => [f, Array.isArray(x) ? signLines(x, isObj(srv) ? srv[f] : [], uid) : x]));
  return v;
}
const signed = (k, v, srv) => (teacher && TEACHER_LINES.includes(k) && myId() ? signLines(v, srv, myId()) : v);
// refus du serveur pour une saisie non permise à ce profil : on reprend la version du serveur au lieu de bloquer l'envoi
const refused = (e) => /PROF_INTERDIT|row-level security|permission denied/i.test(e?.message ?? '');
let refusedNote = null;

async function sendDirty(known) {
  const dirty = readDirty();
  if (!dirty.size) { setStatus({ state: 'saved', at: new Date() }); return; }
  setStatus({ state: 'sending', at: status.at });
  try {
    let map = known ?? await fetchAll();
    for (const k of [...dirty]) {
      const local = readLocal(k);
      if (!writable(k) || local === undefined) { const n = readDirty(); n.delete(k); writeDirty(n); continue; }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const restoring = readRestore().has(k);
        const srv = fromServer(map, k);
        const merged = signed(k, restoring ? unionKeep(srv, local) : merge3(base[k], local, srv), srv);
        let ok;
        try { ok = await writeDocs(toServer(k, merged), map); } catch (e) {
          if (!refused(e)) throw e;
          // non permis : la version du serveur revient sur l'appareil, les autres saisies partent quand même
          if (srv !== undefined) { writeLocal(k, srv); base[k] = srv; }
          const n = readDirty(); n.delete(k); writeDirty(n);
          refusedNote = 'Une modification non permise pour votre compte n\'a pas été enregistrée.';
          try { window.dispatchEvent(new CustomEvent('ent-refused')); } catch { /* hors navigateur */ }
          break;
        }
        if (ok) {
          base[k] = merged;
          if (restoring) { const r = readRestore(); r.delete(k); writeRestore(r); }
          // une saisie faite pendant l'envoi n'est pas écrasée : elle reste à envoyer
          if (same(readLocal(k), local)) { if (!same(merged, local)) writeLocal(k, merged); const n = readDirty(); n.delete(k); writeDirty(n); }
          break;
        }
        map = await fetchAll();
      }
    }
    setStatus({ state: readDirty().size ? 'pending' : 'saved', at: new Date(), ...(refusedNote ? { message: refusedNote } : {}) });
    refusedNote = null;
  } catch (e) {
    setStatus({ state: 'error', at: status.at, message: e.message });
  }
}
/** Envoie les données modifiées sur cet appareil (fusionnées avec celles du serveur). */
export function pushShared() { return active && !suspended ? exclusive(() => sendDirty()) : Promise.resolve(); }

let timer = null;
function markDirty(k) {
  const d = readDirty(); if (!d.has(k)) { d.add(k); writeDirty(d); }
  if (suspended) return;
  setStatus({ state: 'pending', at: status.at });
  clearTimeout(timer); timer = setTimeout(() => pushShared(), 1500);
}

/**
 * Démarre le partage pour ce profil : reçoit tout depuis le serveur avant l'ouverture des écrans, puis
 * envoie chaque saisie (1,5 s après la dernière frappe), reçoit les nouveautés des autres postes toutes les
 * 30 secondes et au retour sur la page. Sans réseau, tout reste sur l'appareil et repart ensuite.
 */
export async function startShared(role) {
  groups = GROUPS_OF[role] ?? []; readOnly = READ_ONLY[role] ?? []; teacher = role === 'ENSEIGNANT';
  if (!groups.length || active) return;
  active = true;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function patched(k, v) {
    set.call(this, k, v);
    try { if (!applying && this === window.localStorage && writable(k)) markDirty(k); } catch { /* rien */ }
  };
  const tick = () => pullShared().catch((e) => setStatus({ state: 'error', at: status.at, message: e.message }));
  setInterval(tick, 30_000);
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  window.addEventListener('beforeunload', (e) => { if (!suspended && readDirty().size) { pushShared(); e.preventDefault(); e.returnValue = ''; } });
  // premier démarrage sur cet appareil : tout ce qu'il contient est fusionné avec le serveur (rien n'est écrasé)
  const INIT = 'ent-sync-init-v1';
  let first = false; try { first = !localStorage.getItem(INIT); } catch { /* rien */ }
  if (first) { const d = readDirty(); localKeys().filter(writable).forEach((k) => d.add(k)); writeDirty(d); }
  await pullShared();
  if (first) { applying = true; try { localStorage.setItem(INIT, new Date().toISOString()); } catch { /* rien */ } applying = false; }
}
export const sharedPending = () => readDirty().size > 0;
