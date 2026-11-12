// Carnet de notes du professeur : devoirs, notes, remarques, compétences, appréciations, validation.
// Enregistré à chaque saisie (prototype : dans ce navigateur ; en ligne : sur le serveur, voir online/docs.js),
// pour remplir les notes au fil du trimestre. Les épreuves d'examen blanc ne sont pas enregistrées ici : elles
// sont recalculées depuis les examens blancs (termGrades.js).
import { ONLINE } from './online/client.js';
import { fetchDoc, saveDoc, pendingOf } from './online/docs.js';

const KEY = 'ent-carnet-v1';
let remote = { loaded: false, id: null, value: null }; // en ligne : carnet lu sur le serveur au démarrage

export const carnetKey = (id) => `carnet:${id}`;

/** En ligne : lit le carnet du professeur (une écriture pas encore envoyée de cet appareil passe avant). */
export async function loadRemoteCarnet(id) {
  const doc = await fetchDoc(carnetKey(id)); // lève une erreur si le serveur ne répond pas : on ne part jamais d'un carnet vide par erreur
  const pending = pendingOf(carnetKey(id));
  remote = { loaded: true, id, value: pending?.value ?? doc?.value ?? null };
  if (pending) saveDoc(carnetKey(id), 'CARNET', id, pending.value, { delay: 0 });
  return remote.value;
}
export const remoteCarnetReady = () => remote.loaded;
export const remoteCarnetId = () => remote.id;

export function loadCarnet() {
  if (ONLINE) return remote.value;
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}
export const carnetRaw = () => (ONLINE ? JSON.stringify(remote.value) : (() => { try { return localStorage.getItem(KEY); } catch { return null; } })());

/** Ce qui est enregistré : sans les épreuves d'examen blanc (recalculées). */
export function carnetToSave(data) {
  const ev = Object.fromEntries(Object.entries(data.evaluations ?? {}).map(([k, list]) => [k, list.filter((e) => !e.fromMockExam)]));
  const gr = Object.fromEntries(Object.entries(data.grades ?? {}).map(([k, byStudent]) => [k, Object.fromEntries(Object.entries(byStudent ?? {})
    .map(([st, marks]) => [st, Object.fromEntries(Object.entries(marks ?? {}).filter(([id]) => !id.startsWith('mx-')))]))]));
  return { ...data, evaluations: ev, grades: gr, savedAt: new Date().toISOString() };
}

/** Enregistre ; renvoie false si le navigateur refuse (navigation privée, mémoire pleine). */
export function saveCarnet(data) {
  const value = carnetToSave(data);
  if (ONLINE) {
    if (!remote.loaded || !remote.id) return false;
    remote.value = value;
    saveDoc(carnetKey(remote.id), 'CARNET', remote.id, value);
    return true;
  }
  try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch { return false; }
}
