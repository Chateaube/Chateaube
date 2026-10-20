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

// Pièces du dossier. Les originaux se déposent toujours au secrétariat ; une famille peut les
// envoyer en ligne avant, pour un premier aperçu (utile si elle n'est pas en ville).
//  - acte de naissance : nouvel élève, et réinscription en 1re et en Terminale (inscription aux examens)
//  - bulletins de l'année précédente : nouvel élève seulement (l'école a déjà ceux de ses élèves)
//  - relevé du brevet : nouvel élève en 2de qui l'a obtenu
//  - relevé des épreuves anticipées du bac : nouvel élève en Terminale (notes de 1re, déjà acquises)
//  - relevés de notes des examens : tout redoublant de 1re ou de Terminale (nouveau ou non)
export const REQUIRED_DOCUMENTS = [
  { id: 'ACTE', label: 'Acte de naissance', detail: 'en français, de moins de 3 mois', examOrNew: true },
  { id: 'PHOTOS', label: '2 photos d\'identité récentes', detail: 'aux normes internationales : fond clair et uni, de face, visage dégagé, sans lunettes ni couvre-chef' },
  { id: 'BULLETINS', label: 'Bulletins de l\'année précédente', newOnly: true },
  { id: 'VACCINS', label: 'Carnet de vaccination' },
  { id: 'RELEVE_DNB', label: 'Relevé de notes du brevet (DNB)', detail: 'ou l\'attestation de réussite', when: ({ isNew, level, dnb }) => isNew && level === '2de' && dnb === 'OBTENU' },
  { id: 'RELEVE_ANTICIPEES', label: 'Relevé des épreuves anticipées du bac (notes de 1re)', detail: 'français, mathématiques et épreuves de fin de 1re : elles comptent déjà pour le bac', when: ({ isNew, level }) => isNew && level === 'Terminale' },
  { id: 'RELEVES_REDOUBLANT', label: 'Relevés de notes de l\'examen de l\'an dernier', detail: 'redoublement : relevés du bac ou des épreuves de 1re', when: ({ level, repeating }) => repeating && ['1re', 'Terminale'].includes(level) },
];
const EXAM_LEVELS = ['1re', 'Terminale'];
/** Pièces exigées pour une inscription (nouvel élève) ou une réinscription dans la classe donnée. */
export function documentsFor(kind, cls = '', { dnb, repeating } = {}) {
  const isNew = kind === 'INSCRIPTION';
  const level = cls.split(' ')[0];
  const exam = EXAM_LEVELS.includes(level);
  return REQUIRED_DOCUMENTS.filter((d) => (d.when ? d.when({ isNew, level, dnb, repeating }) : d.newOnly ? isNew : d.examOrNew ? isNew || exam : true));
}

// Parcours avant l'arrivée : système de l'école d'origine (pour lire ses bulletins) et brevet à l'entrée en 2de.
export const SCHOOL_SYSTEMS = {
  FRANCAIS: 'Système français (programmes français)',
  EXPRESSION_FRANCAISE: 'Expression française (hors programmes français)',
  MALGACHE: 'Système malgache',
  ANGLOPHONE: 'Anglophone',
  AUTRE: 'Autre',
};
export const DNB_STATUS = { OBTENU: 'Brevet obtenu', NON_OBTENU: 'Présenté, non obtenu', NON_PRESENTE: 'Non présenté (autre système)' };

const schoolKey = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/**
 * Annuaire des écoles d'origine, appris des fiches déjà saisies : nom → système le plus fréquent et nombre
 * d'élèves venus de cette école. Sert à proposer le nom et le système quand une autre famille arrive.
 */
export function schoolDirectory(records = []) {
  const map = new Map();
  records.filter((r) => r.previousSchool?.trim()).forEach((r) => {
    const k = schoolKey(r.previousSchool);
    const e = map.get(k) ?? { name: r.previousSchool.trim(), count: 0, systems: {} };
    e.count += 1;
    if (r.previousSystem) e.systems[r.previousSystem] = (e.systems[r.previousSystem] ?? 0) + 1;
    map.set(k, e);
  });
  return [...map.values()].map((e) => ({ name: e.name, count: e.count, system: Object.entries(e.systems).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
/** École connue de l'annuaire (même nom, accents et majuscules ignorés). */
export const knownSchool = (dir, name) => dir.find((e) => schoolKey(e.name) === schoolKey(name)) ?? null;

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
  if (kind === 'INSCRIPTION' && !p.previousSystem) errors.push('Indiquer le système de l\'établissement d\'origine (français, expression française, malgache, anglophone…).');
  if (kind === 'INSCRIPTION' && (p.cls ?? '').startsWith('2de') && !p.dnb) errors.push('Entrée en 2de : brevet obtenu, non obtenu ou non présenté ?');
  return errors;
}

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

// Code personnel d'un responsable : 8 caractères sans lettres ambiguës (0/O, 1/I/L).
// Démonstration : calculé à partir de l'identité ; en production, tiré au hasard, stocké chiffré
// (guardian_access_code) et valable pour une seule première connexion.
export function accessCode(seed) {
  let h = 2166136261;
  const out = [];
  for (let round = 0; round < 8; round += 1) {
    for (const c of `${seed}#${round}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    out.push(h % 10);
  }
  return `${out.slice(0, 4).join('')} ${out.slice(4).join('')}`; // 8 chiffres, faciles à taper sur un téléphone
}

// Matricule : par année, code de la classe + numéro dans l'ordre des inscriptions définitives
// (TG-001, TSTMG-002…). Un numéro n'est jamais réattribué : si un élève part, on saute.
export const CLASS_CODES = { '6e': '6E', '5e': '5E', '4e': '4E', '3e': '3E', '2de': '2DE', '1re Générale': '1G', '1re STMG': '1STMG', 'Terminale Générale': 'TG', 'Terminale STMG': 'TSTMG' };
export function nextMatricule(cls, taken = []) {
  const code = CLASS_CODES[cls] ?? cls.replace(/\s+/g, '').toUpperCase();
  const used = taken.filter((n) => n?.startsWith(`${code}-`)).map((n) => Number(n.split('-').pop()) || 0);
  return `${code}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`;
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
export const nationalityLabels = (codes = [], other = '') => codes.map((c) => (c === 'XX' && other.trim() ? other.trim() : NATIONALITY_CHOICES.find(([k]) => k === c)?.[1] ?? `Autre (${c})`));
/** Coche ou décoche une nationalité ; décocher « Autre » retire toutes les nationalités non proposées. */
export function toggleNationality(codes = [], code) {
  if (code === 'XX') return hasOtherNationality(codes) ? codes.filter((c) => KNOWN.includes(c)) : [...codes, 'XX'];
  return codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
}

/** Pièces encore manquantes. */
export const missingDocuments = (profile, kind, cls = profile.cls) => documentsFor(kind, cls, profile)
  .filter((d) => !profile.documents?.includes(d.id));

// Campagne de pré-inscription en ligne : ouverte entre deux dates fixées par la Direction (ex. en mai).
export const DEFAULT_CAMPAIGN = { year: '2027-2028', opens: '2027-05-03', closes: '2027-07-16' };
export const campaignOpen = (c, today) => Boolean(c?.opens && c?.closes && today >= c.opens && today <= c.closes);
