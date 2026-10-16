// Pré-inscriptions, inscriptions et réinscriptions.
// Chaque inscription ou réinscription crée (ou met à jour) la FICHE ÉLÈVE ; c'est elle qui
// permet ensuite de créer les comptes de l'ENT (élève et responsables) et de tout retrouver.

// Étapes d'une pré-inscription, dans l'ordre
export const PREREG_STEPS = [
  { id: 'DEMANDE', label: 'Demande reçue' },
  { id: 'DOSSIER', label: 'Dossier complet' },
  { id: 'ENTRETIEN', label: 'Entretien / test' },
  { id: 'ACCEPTEE', label: 'Acceptée' },
  { id: 'INSCRITE', label: 'Inscrite' },
];
export const PREREG_OTHER = [
  { id: 'ATTENTE', label: 'Liste d\'attente' },
  { id: 'REFUSEE', label: 'Refusée' },
];

/** Étape suivante d'une pré-inscription ; une demande acceptée se convertit en inscription. */
export function nextPreregStep(status) {
  const i = PREREG_STEPS.findIndex((s) => s.id === status);
  if (i < 0 || i >= PREREG_STEPS.length - 2) return null; // ACCEPTEE → conversion, pas un simple « suivant »
  return PREREG_STEPS[i + 1].id;
}

// Pièces du dossier d'inscription
export const REQUIRED_DOCUMENTS = [
  { id: 'ACTE', label: 'Acte de naissance' },
  { id: 'PHOTOS', label: 'Photos d\'identité' },
  { id: 'BULLETINS', label: 'Bulletins de l\'année précédente' },
  { id: 'RADIATION', label: 'Certificat de radiation (nouvel élève)', newOnly: true },
  { id: 'VACCINS', label: 'Carnet de vaccination' },
];

// Classe suivante pour une réinscription (passage)
const NEXT = { '6e': '5e', '5e': '4e', '4e': '3e', '3e': '2de', '2de': '1re' };
export function nextClass(cls) {
  const [head] = cls.split(' ');
  if (NEXT[head]) return NEXT[head];
  if (head === '1re') return cls.replace('1re', 'Terminale');
  return null; // Terminale : fin de scolarité dans l'établissement
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s.-]{9,}$/;

/** Contrôle de la fiche élève avant enregistrement. Renvoie la liste des erreurs. */
export function validateProfile(p, { kind = 'INSCRIPTION' } = {}) {
  const errors = [];
  if (!p.lastName?.trim() || !p.firstName?.trim()) errors.push('Nom et prénom de l\'élève obligatoires.');
  if (!p.birthDate) errors.push('Date de naissance obligatoire.');
  if (!p.nationalities?.length) errors.push('Au moins une nationalité (sert pour Parcoursup et Campus France).');
  if (!p.cls) errors.push('Classe obligatoire.');
  const guardians = p.guardians ?? [];
  if (!guardians.length) errors.push('Au moins un responsable légal.');
  guardians.forEach((g, i) => {
    const n = `Responsable ${i + 1}`;
    if (!g.name?.trim()) errors.push(`${n} : nom obligatoire.`);
    if (!g.phone?.trim() && !g.email?.trim()) errors.push(`${n} : téléphone ou e-mail obligatoire.`);
    if (g.email && !EMAIL.test(g.email.trim())) errors.push(`${n} : e-mail invalide.`);
    if (g.phone && !PHONE.test(g.phone.trim())) errors.push(`${n} : téléphone invalide.`);
  });
  if (guardians.length && !guardians.some((g) => g.payer)) errors.push('Indiquer le responsable qui règle les frais.');
  if (kind === 'INSCRIPTION' && !p.previousSchool?.trim()) errors.push('Établissement d\'origine obligatoire pour une première inscription.');
  return errors;
}

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

// Code personnel d'un responsable : 8 caractères sans lettres ambiguës (0/O, 1/I/L).
// Démonstration : calculé à partir de l'identité ; en production, tiré au hasard, stocké chiffré
// (guardian_access_code) et valable pour une seule première connexion.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function accessCode(seed) {
  let h = 2166136261;
  const out = [];
  for (let round = 0; round < 8; round += 1) {
    for (const c of `${seed}#${round}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    out.push(CODE_CHARS[h % CODE_CHARS.length]);
  }
  return `${out.slice(0, 4).join('')}-${out.slice(4).join('')}`;
}
/** Identité d'un responsable : le même parent avec deux enfants garde un seul accès. */
export const guardianKey = (g) => (g.email?.trim() || g.phone?.replace(/\s/g, '') || g.name).toLowerCase();

/**
 * Comptes de l'ENT créés à partir de la fiche : un compte élève et UN COMPTE PAR RESPONSABLE
 * (deux parents = deux accès, chacun sa signature et ses accusés de lecture). Chaque responsable
 * reçoit son code personnel pour la première connexion ; il se connecte ensuite avec son compte
 * Google s'il a un e-mail, sinon avec son téléphone et le mot de passe qu'il a choisi.
 */
export function accountsFor(profile, domain = 'chateaubriand-tamatave.mg') {
  const student = {
    role: 'ELEVE',
    name: `${profile.firstName} ${profile.lastName}`,
    login: `${slug(profile.firstName)}.${slug(profile.lastName)}@${domain}`,
    method: 'Compte Google de l\'établissement',
  };
  const guardians = (profile.guardians ?? []).filter((g) => g.name?.trim()).map((g) => ({
    role: 'PARENT',
    name: g.name,
    relation: g.relation,
    phone: g.phone ?? '',
    login: g.email?.trim() || null,
    code: accessCode(guardianKey(g)),
    method: g.email?.trim() ? 'Code personnel, puis compte Google' : 'Code personnel, puis téléphone et mot de passe',
  }));
  return [student, ...guardians];
}

// Nationalités proposées dans la fiche : les autres sont regroupées dans « Autre »
export const NATIONALITY_CHOICES = [['MG', 'Malgache'], ['FR', 'Française'], ['CN', 'Chinoise'], ['XX', 'Autre']];
const KNOWN = ['MG', 'FR', 'CN'];
export const hasOtherNationality = (codes = []) => codes.some((c) => !KNOWN.includes(c));
/** Libellés lisibles (MG → Malgache ; un code non proposé → Autre (code)). */
export const nationalityLabels = (codes = []) => codes.map((c) => NATIONALITY_CHOICES.find(([k]) => k === c)?.[1] ?? `Autre (${c})`);
/** Coche ou décoche une nationalité ; décocher « Autre » retire toutes les nationalités non proposées. */
export function toggleNationality(codes = [], code) {
  if (code === 'XX') return hasOtherNationality(codes) ? codes.filter((c) => KNOWN.includes(c)) : [...codes, 'XX'];
  return codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
}

/** Pièces encore manquantes. */
export const missingDocuments = (profile, kind) => REQUIRED_DOCUMENTS
  .filter((d) => !(d.newOnly && kind === 'REINSCRIPTION'))
  .filter((d) => !profile.documents?.includes(d.id));
