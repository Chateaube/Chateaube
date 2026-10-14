import { parseEntry } from './documents.js';
import { parseSpecialties, specialtyErrors, SPECIALTY_COUNT } from './bulletin.js';

// Import des données existantes (copier-coller depuis Excel, ou fichier CSV) :
// élèves de l'année en cours et enseignements des professeurs.
// Les lignes sont normalisées (classes, téléphones, nationalités) et chaque problème est signalé
// AVANT l'import, pour que le bureau complète ou corrige le fichier d'origine.

/** Découpe un tableau collé depuis Excel (tabulations) ou un CSV (« ; » ou « , »). */
export function parseTable(text) {
  const lines = String(text).replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return { headers: [], rows: [] };
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const split = (l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  const headers = split(lines[0]);
  const rows = lines.slice(1).map((l, i) => {
    const cells = split(l);
    return { line: i + 2, ...Object.fromEntries(headers.map((h, k) => [h, cells[k] ?? ''])) };
  });
  return { headers, rows };
}

const strip = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Trouve la colonne correspondant à l'une des étiquettes (sans accents, début du titre). */
const col = (row, ...labels) => {
  const key = Object.keys(row).find((h) => labels.some((l) => strip(h).startsWith(strip(l))));
  return key ? String(row[key] ?? '').trim() : '';
};

// Classes : « 1e STMG » → « 1re STMG », « 2nde » → « 2de », « Tle Générale » → « Terminale Générale »
export function normalizeClass(raw) {
  const t = strip(raw).replace(/\s+/g, ' ');
  if (!t) return '';
  const m = t.match(/^(6|5|4|3)e?$/);
  if (m) return `${m[1]}e`;
  if (/^2(nde|de|nd)?$/.test(t)) return '2de';
  const serie = /stmg/.test(t) ? 'STMG' : /g(en|é)?/.test(t.replace(/^(1|t)\S*\s*/, '')) ? 'Générale' : '';
  if (/^1/.test(t)) return serie ? `1re ${serie}` : '1re';
  if (/^(t|terminale)/.test(t)) return serie ? `Terminale ${serie}` : 'Terminale';
  return String(raw).trim();
}

// Nationalités (libellés français) → codes ISO, qui décident Parcoursup / Campus France
const NATIONALITY = {
  malgache: 'MG', francais: 'FR', francaise: 'FR', chinois: 'CN', chinoise: 'CN', canadien: 'CA', canadienne: 'CA',
  allemand: 'DE', allemande: 'DE', yemenite: 'YE', comorien: 'KM', comorienne: 'KM', mauricien: 'MU', mauricienne: 'MU',
  indien: 'IN', indienne: 'IN', italien: 'IT', italienne: 'IT', americain: 'US', americaine: 'US', belge: 'BE', suisse: 'CH',
};
export const nationalityCode = (label) => NATIONALITY[strip(label).replace(/[^a-z]/g, '')] ?? null;

/** Téléphone malgache : « 03 40 97 71 50 » → « +261 34 09 771 50 » ; plusieurs numéros séparés par « / ». */
export function normalizePhones(raw) {
  return String(raw ?? '').split(/[\/,;]| ou /).map((p) => p.replace(/[^\d+]/g, '')).filter(Boolean).map((d) => {
    const n = d.startsWith('+261') ? d.slice(4) : d.startsWith('261') ? d.slice(3) : d.replace(/^0/, '');
    if (!/^3\d{8}$/.test(n)) return { raw: d, ok: false };
    return { ok: true, value: `+261 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 7)} ${n.slice(7)}` };
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const EXAMS = { 'bac t': 'Bac technologique', 'bac g': 'Bac général', dnb: 'DNB', 'ea t': 'Épreuves anticipées (techno)', 'ea g': 'Épreuves anticipées (général)' };

/**
 * Normalise une ligne élève. Retourne `null` pour une ligne vide (n° sans nom),
 * sinon `{ student, issues }` : issues = [{ level: 'error' | 'warning', text }].
 */
export function normalizeStudentRow(row, { nationalityIsExtra = false } = {}) {
  const number = col(row, 'N°', 'No', 'Numero');
  const lastName = col(row, 'Nom');
  const firstName = col(row, 'Prénom', 'Prenom');
  if (!lastName && !firstName) return null;
  const issues = [];
  const cls = normalizeClass(col(row, 'Classe'));
  let birthPlace = col(row, 'Lieu');
  let nat = col(row, 'Nationalité', 'Nationalite');
  // colonne décalée : une nationalité saisie dans « Lieu de naissance »
  if (!nat && birthPlace && nationalityCode(birthPlace)) {
    nat = birthPlace; birthPlace = '';
    issues.push({ level: 'warning', text: 'Nationalité saisie dans la colonne « Lieu de naissance » : déplacée.' });
  }
  const codes = nat.split(/[\/,;]| et /).map((n) => n.trim()).filter(Boolean).map((n) => ({ n, code: nationalityCode(n) }));
  // « Nationalité (en +) » : les élèves sont malgaches, la colonne indique une nationalité EN PLUS
  if (nationalityIsExtra && !codes.some((c) => c.code === 'MG')) codes.unshift({ n: 'Malgache', code: 'MG' });
  codes.filter((c) => !c.code).forEach((c) => issues.push({ level: 'warning', text: `Nationalité non reconnue : « ${c.n} ».` }));
  const birth = col(row, 'Née le', 'Ne le', 'Date de naissance');
  const dm = birth.match(DATE);
  if (!birth) issues.push({ level: 'warning', text: 'Date de naissance manquante.' });
  else if (!dm) issues.push({ level: 'error', text: `Date de naissance illisible : « ${birth} » (attendu JJ/MM/AAAA).` });
  if (!firstName) issues.push({ level: 'error', text: 'Prénom manquant.' });
  if (!cls) issues.push({ level: 'error', text: 'Classe manquante.' });
  if (!codes.length) issues.push({ level: 'warning', text: 'Nationalité manquante (nécessaire pour Parcoursup / Campus France).' });
  const email = col(row, 'Adresse', 'E-mail', 'Email', 'Mail');
  if (email && !EMAIL.test(email)) issues.push({ level: 'error', text: `E-mail invalide : « ${email} ».` });
  const phones = normalizePhones(col(row, 'Contact', 'Téléphone', 'Telephone'));
  phones.filter((p) => !p.ok).forEach((p) => issues.push({ level: 'warning', text: `Téléphone non reconnu : « ${p.raw} ».` }));
  const exam = EXAMS[strip(col(row, 'Examen'))] ?? (col(row, 'Examen') || null);
  if (/^(3e|Terminale)/.test(cls) && !exam) issues.push({ level: 'warning', text: 'Examen non renseigné.' });
  // Ancienneté (optionnelle) : « 2024 », « 2 ans », « nouveau », date d'entrée
  const entryRaw = col(row, 'Entrée', 'Entree', 'Date d\'entrée', 'Année d\'entrée', 'Ancienneté', 'Anciennete');
  const enteredOn = parseEntry(entryRaw);
  if (entryRaw && !enteredOn) issues.push({ level: 'warning', text: `Ancienneté illisible : « ${entryRaw} » (ex. 2024, 2 ans, nouveau).` });
  // Spécialités (1re et Tle générales) : « Maths, PC », « Maths / SVT »…
  const speRaw = col(row, 'Spécialités', 'Specialites', 'Spé', 'Spe');
  const specialties = parseSpecialties(speRaw);
  if (SPECIALTY_COUNT[cls]) {
    if (!speRaw) issues.push({ level: 'warning', text: 'Spécialités non renseignées (à choisir dans Bulletins ou la fiche élève).' });
    else specialtyErrors(cls, specialties).forEach((text) => issues.push({ level: 'warning', text }));
  }
  issues.push({ level: 'warning', text: 'Aucun responsable légal (parent ou tuteur) : à compléter.' });
  return {
    student: {
      id: number || `${cls}-${lastName}-${firstName}`, number, cls, lastName: lastName.toUpperCase(), firstName,
      birthDate: dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : '', birthPlace, nationalities: codes.map((c) => c.code).filter(Boolean),
      exam, email: email.toLowerCase(), phones: phones.filter((p) => p.ok).map((p) => p.value), guardians: [], enteredOn: enteredOn ?? '', specialties,
    },
    issues,
  };
}

/** Analyse complète d'un import d'élèves : élèves retenus, lignes ignorées, numéros manquants, doublons. */
export function analyzeStudents(rows, headers = Object.keys(rows[0] ?? {})) {
  const nationalityIsExtra = headers.some((h) => /nationalit/i.test(h) && /\(\s*en\s*\+\s*\)|en plus/i.test(h));
  const students = [];
  const ignored = [];
  const byNumber = {};
  for (const row of rows) {
    const r = normalizeStudentRow(row, { nationalityIsExtra });
    if (!r) { ignored.push({ line: row.line, number: col(row, 'N°', 'No') }); continue; }
    if (r.student.number && byNumber[r.student.number]) {
      r.issues.unshift({ level: 'error', text: `N° ${r.student.number} en double (ligne ${byNumber[r.student.number]}).` });
      r.student.id = `${r.student.number}#${row.line}`; // identifiant unique malgré le doublon
      r.duplicate = true;
    } else byNumber[r.student.number] = row.line;
    students.push({ ...r, line: row.line });
  }
  // numéros sautés dans chaque classe (ex. 6E-015 absent entre 6E-014 et 6E-016) : départs ou inscrits jamais venus
  const gaps = [];
  const groups = {};
  for (const { student } of students) {
    const m = student.number.match(/^(.*?)-?(\d+)$/);
    if (m) (groups[m[1]] ??= []).push(Number(m[2]));
  }
  for (const [prefix, nums] of Object.entries(groups)) {
    const max = Math.max(...nums);
    const width = (students.find((s) => s.student.number.startsWith(prefix))?.student.number.match(/(\d+)$/)?.[1].length) ?? 3;
    for (let n = 1; n < max; n++) if (!nums.includes(n)) gaps.push(`${prefix}-${String(n).padStart(width, '0')}`);
  }
  // Doublons : numéro libre proposé dans la même série (après le plus grand numéro utilisé)
  for (const s of students.filter((x) => x.duplicate)) {
    const m = s.student.number.match(/^(.*?)-?(\d+)$/);
    if (!m) continue;
    const used = groups[m[1]] ?? [];
    const next = Math.max(...used) + 1;
    used.push(next);
    s.student.suggestedNumber = `${m[1]}-${String(next).padStart(m[2].length, '0')}`;
    s.issues[0].text += ` N° proposé : ${s.student.suggestedNumber}.`;
  }
  const byClass = students.reduce((acc, { student }) => ({ ...acc, [student.cls]: (acc[student.cls] ?? 0) + 1 }), {});
  return { students, ignored, gaps, byClass, nationalityIsExtra };
}

// Matières : abréviations courantes ; Économie et Droit sont deux matières distinctes
const SUBJECT_ALIASES = { maths: 'Mathématiques', math: 'Mathématiques', 'spe mathematiques': 'Spécialité Mathématiques', 'spe maths': 'Spécialité Mathématiques',
  'spe svt': 'Spécialité SVT', 'spe physique-chimie': 'Spécialité Physique-chimie', eco: 'Économie', economie: 'Économie', droit: 'Droit' };
export function normalizeSubjects(raw) {
  return String(raw ?? '').split(/,| et /).map((s) => s.trim()).filter(Boolean).flatMap((s) => {
    const k = strip(s);
    if (/^eco(nomie)?[\s-]*droit$|^droit[\s-]*eco(nomie)?$/.test(k)) return ['Économie', 'Droit'];
    return [SUBJECT_ALIASES[k] ?? s];
  });
}

/** Enseignements : « Mme Karele | SES, Eco-Droit, Management | 2nde - 1e STMG - Tle STMG ». */
export function parseAssignments(rows) {
  return rows.map((row) => {
    const name = col(row, 'Nom', 'Professeur', 'Enseignant');
    if (!name) return null;
    return {
      name,
      subjects: normalizeSubjects(col(row, 'Matière', 'Matiere')),
      classes: col(row, 'Classe').split(/\s+-\s+|,/).map(normalizeClass).filter(Boolean),
    };
  }).filter(Boolean);
}
