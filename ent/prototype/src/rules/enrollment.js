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

/**
 * Comptes de l'ENT créés à partir de la fiche : un compte élève et un compte par responsable
 * ayant un e-mail (connexion Google). Les responsables sans e-mail reçoivent un code d'activation.
 */
export function accountsFor(profile, domain = 'chateaubriand-tamatave.mg') {
  const student = {
    role: 'ELEVE',
    name: `${profile.firstName} ${profile.lastName}`,
    login: `${slug(profile.firstName)}.${slug(profile.lastName)}@${domain}`,
    method: 'Compte Google de l\'établissement',
  };
  const guardians = (profile.guardians ?? []).map((g) => ({
    role: 'PARENT',
    name: g.name,
    relation: g.relation,
    login: g.email?.trim() || null,
    method: g.email?.trim() ? 'Connexion avec son compte Google' : 'Code d\'activation remis au bureau',
  }));
  return [student, ...guardians];
}

/** Pièces encore manquantes. */
export const missingDocuments = (profile, kind) => REQUIRED_DOCUMENTS
  .filter((d) => !(d.newOnly && kind === 'REINSCRIPTION'))
  .filter((d) => !profile.documents?.includes(d.id));
