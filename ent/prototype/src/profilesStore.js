// Fiches élèves partagées par Inscriptions, Liste des élèves, demandes des familles et signatures.
// Élèves importés : gardés avec l'import, dans ce navigateur seulement. Sinon : fiches fictives
// de démonstration, modifiables (photo, réinscription…) et gardées dans ce navigateur.
import { STUDENT_PROFILES } from './data/enrollment.js';
import { CLASSES } from './data/schoollife.js';

// Fiches de démonstration pour tous les élèves des classes (données fictives) : chaque élève a un dossier.
const BIRTH_YEAR = { '6e': 2015, '5e': 2014, '4e': 2013, '3e': 2012, '2de': 2011, '1re STMG': 2010, '1re Générale': 2010, 'Terminale STMG': 2009, 'Terminale Générale': 2009 };
const known = new Set(STUDENT_PROFILES.map((p) => `${p.lastName} ${p.firstName}`));
export const DEMO_PROFILES = [...STUDENT_PROFILES, ...Object.entries(CLASSES).flatMap(([cls, names]) => names.filter((n) => !known.has(n)).map((n, i) => {
  const [lastName, ...first] = n.split(' ');
  const k = [...n].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    id: `d-${lastName}-${first.join('-')}`.toLowerCase(), lastName, firstName: first.join(' '), sex: '', birthDate: `${BIRTH_YEAR[cls] ?? 2011}-${String((k % 12) + 1).padStart(2, '0')}-${String((k % 27) + 1).padStart(2, '0')}`,
    birthPlace: 'Toamasina', nationalities: ['MG'], cls, lv1: 'Anglais', lv2: 'Espagnol', enteredOn: k % 3 === 0 ? '2026-09-01' : '2023-09-04', previousSchool: '', specialties: [],
    guardians: [{ name: `Parent de ${first.join(' ')} ${lastName}`, relation: 'Mère', phone: `+261 34 00 ${String(100 + i).slice(-3)} ${String(k % 100).padStart(2, '0')}`, email: '', payer: true }],
    health: { allergies: '', treatment: '', emergency: '' }, authorizations: { image: k % 4 !== 0, exit: 'Sort seul' }, documents: [],
  };
}))];
import { loadImport, saveImport } from './importStore.js';

const KEY = 'ent-profiles-v2'; // v2 : une fiche pour chaque élève des classes

export const fromImport = (s) => ({
  id: s.id, number: s.number, lastName: s.lastName, firstName: s.firstName, usualName: s.usualName ?? '', sex: s.sex ?? '', birthDate: s.birthDate, birthPlace: s.birthPlace,
  nationalities: s.nationalities, cls: s.cls, lv1: 'Anglais', lv2: 'Espagnol', enteredOn: s.enteredOn ?? '', previousSchool: s.previousSchool ?? '', exam: s.exam, email: s.email, phones: s.phones, specialties: s.specialties ?? [],
  guardians: s.guardians ?? [], health: { allergies: s.health?.allergies ?? '', treatment: s.health?.treatment ?? '', emergency: '' }, authorizations: { image: false, exit: '' }, documents: [],
});

export function loadProfiles() {
  const imp = loadImport();
  if (imp?.profiles?.length) return imp.profiles;
  if (imp?.students?.length) return imp.students.map(fromImport);
  try { return JSON.parse(localStorage.getItem(KEY)) ?? DEMO_PROFILES; } catch { return DEMO_PROFILES; }
}

/** Enregistre les fiches ; renvoie false si le navigateur manque de place (photos trop nombreuses). */
export function saveProfiles(profiles) {
  const imp = loadImport();
  if (imp) return saveImport({ ...imp, profiles });
  try { localStorage.setItem(KEY, JSON.stringify(profiles)); return true; } catch { return false; }
}

export const profileKey = (p) => `${p.lastName} ${p.firstName}`;
