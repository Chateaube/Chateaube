// Annonces (prototype : gardées dans ce navigateur ; en production, tables announcement,
// announcement_audience, announcement_event et announcement_read). Circuit : rules/publication.js —
// seule la Direction publie ; secrétariat et CPE rédigent puis envoient pour validation.
import { ANNOUNCEMENTS } from './data/announcements.js';
import { create } from './rules/publication.js';

const KEY = 'ent-annonces-v2'; // v2 : statuts (brouillon, en attente, publiée…) et traçabilité
const ROLE_OF = { Direction: 'DIRECTION', Secrétariat: 'BUREAU', 'Vie scolaire': 'VIE_SCOLAIRE', CPE: 'VIE_SCOLAIRE' };
const normalize = (a) => ({ status: 'PUBLIEE', authorRole: ROLE_OF[a.author] ?? 'DIRECTION', authorName: a.author, ...a });

export function loadAnnouncements() {
  let d;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { d = null; }
  d = d ?? { list: ANNOUNCEMENTS, acks: {} };
  return { ...d, list: d.list.map(normalize) };
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }

/** Ajoute ou remplace une annonce (le statut est déjà fixé par rules/publication.js). */
export function saveAnnouncement(a) {
  const d = loadAnnouncements();
  const item = { reads: 0, ...a, id: a.id ?? `n${Date.now()}`, at: a.publishedAt ?? a.at ?? a.createdAt ?? new Date().toISOString().slice(0, 16) };
  const exists = d.list.some((x) => x.id === item.id);
  return save({ ...d, list: exists ? d.list.map((x) => (x.id === item.id ? item : x)) : [item, ...d.list] });
}

/** Avis automatique (bulletins, changement d'emploi du temps) : publié si la Direction l'émet, sinon envoyé à la Direction. */
export function publishAnnouncement(a, actor = { role: 'DIRECTION', name: a.author ?? 'Direction' }) {
  const at = new Date().toISOString().slice(0, 16);
  return saveAnnouncement({ ...create('ANNONCE', a, { ...actor, at }, { send: true }), author: a.author });
}

export function removeAnnouncement(id) { const d = loadAnnouncements(); save({ ...d, list: d.list.filter((a) => a.id !== id) }); }
/** « Bien reçu » d'une personne (accusé de lecture demandé). */
export function acknowledge(id, who) {
  const d = loadAnnouncements();
  save({ ...d, acks: { ...d.acks, [`${id}|${who}`]: new Date().toISOString() }, list: d.list.map((a) => (a.id === id ? { ...a, reads: (a.reads ?? 0) + 1 } : a)) });
}
export const acked = (id, who) => !!loadAnnouncements().acks[`${id}|${who}`];
