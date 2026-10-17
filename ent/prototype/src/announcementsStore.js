// Annonces publiées (prototype : gardées dans ce navigateur ; en production, tables announcement,
// announcement_audience et announcement_read, avec notification dans l'application et e-mail).
import { ANNOUNCEMENTS } from './data/announcements.js';

const KEY = 'ent-annonces-v1';
export function loadAnnouncements() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? { list: ANNOUNCEMENTS, acks: {} }; } catch { return { list: ANNOUNCEMENTS, acks: {} }; }
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }
export function publishAnnouncement(a) {
  const d = loadAnnouncements();
  return save({ ...d, list: [{ ...a, id: `n${Date.now()}`, at: new Date().toISOString().slice(0, 16), reads: 0 }, ...d.list] });
}
export function removeAnnouncement(id) { const d = loadAnnouncements(); save({ ...d, list: d.list.filter((a) => a.id !== id) }); }
/** « J'ai lu » d'une personne (accusé de lecture demandé). */
export function acknowledge(id, who) {
  const d = loadAnnouncements();
  save({ ...d, acks: { ...d.acks, [`${id}|${who}`]: new Date().toISOString() }, list: d.list.map((a) => (a.id === id ? { ...a, reads: (a.reads ?? 0) + 1 } : a)) });
}
export const acked = (id, who) => !!loadAnnouncements().acks[`${id}|${who}`];
