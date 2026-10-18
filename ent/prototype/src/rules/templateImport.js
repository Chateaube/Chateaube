// Import du modèle Excel de l'école (onglets 1 à 10, voir ent/modeles/generer_modele.py).
// Élèves et personnel passent par les contrôles habituels (rules/importer.js) ; s'y ajoutent les
// responsables (rattachés à l'élève par son matricule ou son nom), les notes officielles de 1re des
// Terminales (projection au bac) et l'inventaire. Les lignes « Exemple » sont ignorées.
import { sheetRows } from '../xlsxRead.js';

export const SHEET_NAMES = ['1 Élèves', '2 Responsables', '3 Personnel', '4 Emploi du temps', '5 Notes', '6 Notes officielles 1re', '7 Paiements', '8 Manuels', '9 Prêts de manuels', '10 Inventaire'];
const find = (book, n) => book[Object.keys(book).find((k) => k.trim().startsWith(`${n} `)) ?? ''] ?? [];
const toTsv = (rows) => rows.map((r) => r.map((c) => String(c ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
const num = (t) => { const s = String(t ?? '').trim().replace(',', '.'); if (!s) return null; if (/^abs/i.test(s)) return 'ABS'; const n = Number(s); return Number.isFinite(n) && n >= 0 && n <= 20 ? n : undefined; };
const key = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const CATEGORIES = { mobilier: 'Mobilier', equipement: 'Équipement', fournitures: 'Fournitures', 'trousse de secours': 'Trousse de secours' };

export function bookToImport(book) {
  const students = find(book, 1).filter((r) => !/^exemple/i.test(String(r[0] ?? '').trim()));
  const studentRows = sheetRows(find(book, 1));
  const classOf = Object.fromEntries(studentRows.flatMap((r) => [[key(r['N° (matricule)']), r.Classe], [key(`${r.Nom} ${r['Prénom(s)']}`), r.Classe]]));
  const extrasOf = Object.fromEntries(studentRows.map((r) => [key(`${r.Nom} ${r['Prénom(s)']}`), { usualName: r['Prénom d\'usage'] ?? '', sex: r.Sexe ?? '', allergies: r.Allergies ?? '', treatment: r['Traitement / maladie'] ?? '', otherNationality: r['Autre nationalité'] ?? '', previousSchool: r['Établissement précédent'] ?? '', matricule: r['N° (matricule)'] ?? '' }]));
  const nameOfMatricule = Object.fromEntries(studentRows.filter((r) => r['N° (matricule)']).map((r) => [key(r['N° (matricule)']), key(`${r.Nom} ${r['Prénom(s)']}`)]));
  const studentKey = (r) => nameOfMatricule[key(r['N° élève (matricule)'])] ?? key(r['Nom de l\'élève']);

  const guardians = {};
  sheetRows(find(book, 2)).forEach((r) => {
    (guardians[studentKey(r)] ??= []).push({ link: r.Lien || 'Autre', lastName: r.Nom ?? '', firstName: r.Prénom ?? '', phone: r.Téléphone ?? '', phone2: r['Téléphone 2'] ?? '', email: (r['E-mail'] ?? '').toLowerCase(), profession: r.Profession ?? '', emergency: /^o/i.test(r['À appeler en urgence'] ?? ''), canPickUp: /^o/i.test(r['Peut venir chercher l\'élève'] ?? '') });
  });

  const staffRows = sheetRows(find(book, 3));
  const teachers = staffRows.filter((r) => /prof/i.test(r.Fonction ?? 'Professeur'));
  const staffTsv = teachers.length ? toTsv([['Nom', 'Matière', 'Classe'], ...teachers.map((r) => [`${r.Nom} ${r.Prénom ?? ''}`.trim(), r['Matière(s)'] ?? '', r['Classe(s)'] ?? ''])]) : '';

  const official = {}; const officialErrors = [];
  sheetRows(find(book, 6)).forEach((r) => {
    const k = studentKey(r); const stmg = /STMG/i.test(classOf[k] ?? classOf[key(r['N° élève (matricule)'])] ?? '');
    const marks = { FR_E: r['Français écrit'], FR_O: r['Français oral'], MA_EA: r['Mathématiques (anticipée)'], [stmg ? 'SGN' : 'SPE_AB']: r['Spécialité abandonnée (ou SGN)'],
      HG: r['Histoire-géo et EMC'], [stmg ? 'MA' : 'ES']: r['Ens. scientifique (ou maths STMG)'], LVA: r.LVA, LVB: r.LVB };
    const o = {};
    Object.entries(marks).forEach(([id, v]) => { const n = num(v); if (n === undefined) officialErrors.push(`Ligne ${r.line} : note « ${v} » illisible.`); else if (n != null) o[id] = n; });
    official[k] = o;
  });

  const inventory = sheetRows(find(book, 10)).map((r, i) => ({
    id: `imp${i}`, cat: CATEGORIES[key(r.Catégorie).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] ?? 'Équipement', name: r.Article, qty: Number(r.Quantité) || 0, broken: Number(r['Dont cassés']) || 0,
    place: r.Lieu ?? '', min: r['Seuil de recommande'] === '' || r['Seuil de recommande'] == null ? null : Number(r['Seuil de recommande']),
    expires: /^\d{2}\/\d{2}\/\d{4}$/.test(r.Péremption ?? '') ? r.Péremption.split('/').reverse().join('-') : undefined,
  })).filter((x) => x.name);

  const counts = Object.fromEntries(SHEET_NAMES.map((n, i) => [n, sheetRows(find(book, i + 1)).length]));
  return { studentsTsv: students.length > 1 ? toTsv(students) : '', staffTsv, guardians, extrasOf, official, officialErrors, inventory, counts };
}

/** Complète les élèves analysés : responsables, prénom d'usage, sexe, santé. */
export function withExtras(students, { guardians = {}, extrasOf = {} }) {
  return students.map((s) => {
    const k = key(`${s.lastName} ${s.firstName}`);
    const e = extrasOf[k] ?? {};
    return { ...s, guardians: guardians[k] ?? s.guardians ?? [], usualName: e.usualName || '', sex: e.sex || '', health: { allergies: e.allergies || '', treatment: e.treatment || '' }, previousSchool: e.previousSchool || '' };
  });
}
