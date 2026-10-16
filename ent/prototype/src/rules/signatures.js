// Documents signés par la Direction : circuit et code de vérification.
//  DEMANDEE (bureau / vie scolaire) → SIGNEE ou REFUSEE (Direction, avec motif)
//  → le bureau imprime et tamponne, ou envoie par e-mail avec le tampon numérique.

export const DOCUMENT_KINDS = {
  CERTIFICAT_SCOLARITE: 'Certificat de scolarité',
  ATTESTATION: 'Attestation',
};
export const DELIVERY = {
  PAPIER: 'Imprimé et tamponné au bureau',
  EMAIL: 'Envoyé par e-mail (tampon numérique)',
};

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Code imprimé sur le document signé : il permet de vérifier qu'il vient bien de l'école. */
export function verificationCode(seed) {
  let h = 2166136261;
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    for (const c of `${seed}|${i}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    out += CHARS[h % CHARS.length];
    if (i === 3) out += '-';
  }
  return out;
}

/** Erreurs d'une décision de la Direction. */
export function decisionErrors({ role, status, signature, note }) {
  const e = [];
  if (role !== 'DIRECTION') e.push('Seule la Direction signe ou refuse un document.');
  if (status === 'SIGNEE' && !signature) e.push('Enregistrez d\'abord votre signature.');
  if (status === 'REFUSEE' && !note?.trim()) e.push('Indiquez le motif du refus.');
  return e;
}

/** Ce que le bureau peut faire d'une demande. */
export function nextActions(r) {
  if (r.status !== 'SIGNEE') return [];
  return r.delivery === 'EMAIL' ? ['EMAIL', 'PRINT'] : ['PRINT'];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validEmail = (e) => EMAIL.test(e?.trim() ?? '');
