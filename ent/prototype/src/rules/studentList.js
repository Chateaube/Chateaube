// Liste des élèves : filtres et export Excel complet (une ligne par élève).
import { csv } from './gradeSheet.js';
import { nationalityLabels, missingDocuments, accountsFor, guardianKey } from './enrollment.js';
import { usualFirstName } from './names.js';
import { seniority } from './documents.js';
import { SPECIALTIES } from './bulletin.js';

const fr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];
const rank = (cls) => { const i = ORDER.indexOf(cls); return i < 0 ? 99 : i; };

/** Tri par classe puis par nom. */
export const sortStudents = (list) => [...list].sort((a, b) => rank(a.cls) - rank(b.cls) || a.cls.localeCompare(b.cls) || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));

export function filterStudents(list, { cls = '', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return sortStudents(list.filter((p) => (!cls || p.cls === cls) && (!q || `${p.lastName} ${p.firstName} ${p.usualName ?? ''} ${p.number ?? ''}`.toLowerCase().includes(q))));
}

export const MAX_GUARDIANS = 2;

/** Export Excel : identité, scolarité, deux responsables, santé, autorisations, dossier. */
export function studentsCsv(list, title) {
  const g = (p, i, k) => p.guardians?.[i]?.[k] ?? '';
  const head = ['N°', 'Classe', 'Nom', 'Prénom(s)', 'Prénom d\'usage', 'Sexe', 'Né(e) le', 'Lieu de naissance', 'Nationalité(s)', 'Spécialités',
    'Entrée', 'Ancienneté', 'Établissement d\'origine', 'E-mail élève', 'Téléphone élève',
    ...[1, 2].flatMap((n) => [`Responsable ${n}`, `Lien ${n}`, `Téléphone ${n}`, `E-mail ${n}`, `Règle les frais ${n}`]),
    'Allergies / traitement', 'Contact d\'urgence', 'Droit à l\'image', 'Sortie', 'Pièces manquantes', 'Photo'];
  const rows = sortStudents(list).map((p) => [
    p.number ?? '', p.cls, p.lastName, p.firstName, usualFirstName(p), p.sex === 'F' ? 'F' : p.sex === 'M' ? 'M' : '', fr(p.birthDate), p.birthPlace ?? '',
    nationalityLabels(p.nationalities ?? [], p.otherNationality).join(', '), (p.specialties ?? []).map((k) => SPECIALTIES[k] ?? k).join(', '),
    fr(p.enteredOn), seniority(p.enteredOn)?.isNew ? 'Nouveau' : seniority(p.enteredOn) ? `${seniority(p.enteredOn).years} an(s)` : '', p.previousSchool ?? '',
    p.email ?? '', (p.phones ?? []).map((x) => x.value ?? x).join(' / '),
    ...[0, 1].flatMap((i) => [g(p, i, 'name'), g(p, i, 'relation'), g(p, i, 'phone'), g(p, i, 'email'), p.guardians?.[i] ? (p.guardians[i].payer ? 'oui' : 'non') : '']),
    p.health?.allergies ?? '', p.health?.emergency ?? '', p.authorizations?.image ? 'oui' : 'non', p.authorizations?.exit ?? '',
    missingDocuments(p, 'REINSCRIPTION').map((d) => d.label).join(', '), p.photo ? 'oui' : 'non',
  ]);
  return csv([[title], [`${list.length} élève(s)`], [], head, ...rows]);
}

/** Codes d'accès à remettre : un par responsable, même s'il a plusieurs enfants. */
export function accessSlips(list) {
  const slips = new Map();
  sortStudents(list).forEach((p) => {
    accountsFor(p).filter((a) => a.role === 'PARENT').forEach((a) => {
      const g = p.guardians.find((x) => x.name === a.name);
      const k = guardianKey(g);
      const prev = slips.get(k);
      const child = `${usualFirstName(p)} ${p.lastName} (${p.cls})`;
      slips.set(k, prev ? { ...prev, children: [...prev.children, child] } : { ...a, children: [child] });
    });
  });
  return [...slips.values()];
}
