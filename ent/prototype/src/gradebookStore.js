// Carnet de notes du professeur : devoirs, notes, remarques, compétences, appréciations, validation.
// Enregistré à chaque saisie (prototype : dans ce navigateur ; en ligne : sur le serveur), pour remplir
// les notes au fil du trimestre. Les épreuves d'examen blanc ne sont pas enregistrées ici : elles sont
// recalculées depuis les examens blancs (termGrades.js).
const KEY = 'ent-carnet-v1';

export function loadCarnet() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}
export const carnetRaw = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Enregistre ; renvoie false si le navigateur refuse (navigation privée, mémoire pleine). */
export function saveCarnet(data) {
  const ev = Object.fromEntries(Object.entries(data.evaluations ?? {}).map(([k, list]) => [k, list.filter((e) => !e.fromMockExam)]));
  const gr = Object.fromEntries(Object.entries(data.grades ?? {}).map(([k, byStudent]) => [k, Object.fromEntries(Object.entries(byStudent ?? {})
    .map(([st, marks]) => [st, Object.fromEntries(Object.entries(marks ?? {}).filter(([id]) => !id.startsWith('mx-')))]))]));
  try { localStorage.setItem(KEY, JSON.stringify({ ...data, evaluations: ev, grades: gr, savedAt: new Date().toISOString() })); return true; } catch { return false; }
}
