// Documents à faire signer par la Direction (prototype : gardés dans ce navigateur ; en production,
// tables official_signature, school_stamp et signature_request, avec une notification à la Direction).
const KEY = 'ent-signatures-v1';
const EMPTY = { officials: {}, stamp: null, requests: [] };

export function loadSignatures() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...EMPTY }; }
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }

/** Signature numérique d'un membre de la Direction (image déposée une fois). */
export function setOfficialSignature(signatoryId, dataUrl) {
  const d = loadSignatures();
  return save({ ...d, officials: { ...d.officials, [signatoryId]: { dataUrl, at: new Date().toISOString() } } });
}
/** Tampon numérique de l'établissement (photo du tampon sur papier blanc). */
export function setStamp(dataUrl) { return save({ ...loadSignatures(), stamp: dataUrl }); }

export function addSignatureRequest(req) {
  const d = loadSignatures();
  const r = { ...req, id: `s${Date.now()}`, status: 'DEMANDEE', requestedAt: new Date().toISOString() };
  save({ ...d, requests: [r, ...d.requests] });
  return r;
}
export function updateSignatureRequest(id, patch) {
  const d = loadSignatures();
  save({ ...d, requests: d.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
}
export const pendingSignatures = () => loadSignatures().requests.filter((r) => r.status === 'DEMANDEE');
