// Fiches élèves partagées par Inscriptions, Liste des élèves, demandes des familles et signatures.
// Élèves importés : gardés avec l'import, dans ce navigateur seulement. Sinon : fiches fictives
// de démonstration, modifiables (photo, réinscription…) et gardées dans ce navigateur.
import { STUDENT_PROFILES } from './data/enrollment.js';
import { loadImport, saveImport } from './importStore.js';

const KEY = 'ent-profiles-v1';

export const fromImport = (s) => ({
  id: s.id, number: s.number, lastName: s.lastName, firstName: s.firstName, sex: '', birthDate: s.birthDate, birthPlace: s.birthPlace,
  nationalities: s.nationalities, cls: s.cls, lv1: 'Anglais', lv2: 'Espagnol', enteredOn: s.enteredOn ?? '', previousSchool: '', exam: s.exam, email: s.email, phones: s.phones, specialties: s.specialties ?? [],
  guardians: [], health: { allergies: '', emergency: '' }, authorizations: { image: false, exit: '' }, documents: [],
});

export function loadProfiles() {
  const imp = loadImport();
  if (imp?.profiles?.length) return imp.profiles;
  if (imp?.students?.length) return imp.students.map(fromImport);
  try { return JSON.parse(localStorage.getItem(KEY)) ?? STUDENT_PROFILES; } catch { return STUDENT_PROFILES; }
}

/** Enregistre les fiches ; renvoie false si le navigateur manque de place (photos trop nombreuses). */
export function saveProfiles(profiles) {
  const imp = loadImport();
  if (imp) return saveImport({ ...imp, profiles });
  try { localStorage.setItem(KEY, JSON.stringify(profiles)); return true; } catch { return false; }
}

export const profileKey = (p) => `${p.lastName} ${p.firstName}`;
