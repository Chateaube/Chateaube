// Démarches faites en ligne par les familles (prototype : gardées dans ce navigateur ; en production,
// tables family_request, family_document et pre_registration côté serveur).
//  - prereg   : pré-inscriptions envoyées par de nouvelles familles (formulaire public)
//  - requests : réinscription, mise à jour des informations, dépôt d'une pièce (parents inscrits)
const KEY = 'ent-demandes-v1';
const EMPTY = { prereg: [], requests: [] };

export function loadRequests() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...EMPTY }; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}
const stamp = () => new Date().toISOString();

/** Ajoute une pré-inscription en ligne ; false si le navigateur manque de place. */
export function addOnlinePrereg(item) {
  const d = loadRequests();
  return save({ ...d, prereg: [{ ...item, id: `w${Date.now()}`, online: true, status: 'DEMANDE', receivedAt: stamp() }, ...d.prereg] });
}
export function updateOnlinePrereg(id, patch) {
  const d = loadRequests();
  save({ ...d, prereg: d.prereg.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
}

export function addRequest(req) {
  const d = loadRequests();
  return save({ ...d, requests: [{ ...req, id: `r${Date.now()}`, status: 'A_TRAITER', submittedAt: stamp() }, ...d.requests] });
}
export function decideRequest(id, status, by, note = '') {
  const d = loadRequests();
  save({ ...d, requests: d.requests.map((r) => (r.id === id ? { ...r, status, decidedBy: by, decidedAt: stamp(), note } : r)) });
}
export const requestsFor = (studentKey) => loadRequests().requests.filter((r) => r.studentKey === studentKey);
export const pendingCount = () => { const d = loadRequests(); return d.requests.filter((r) => r.status === 'A_TRAITER').length + d.prereg.filter((p) => p.status === 'DEMANDE').length; };
