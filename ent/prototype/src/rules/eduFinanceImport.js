// Reprise de l'export du logiciel de caisse « EduFinance » (classeur avec les onglets classes, eleves,
// entrees, mois_ecolage, sorties) : tarifs par classe, frais déjà réglés par élève, historique des
// encaissements et dépenses de l'année en cours. Les élèves sont rapprochés de ceux déjà importés
// (même nom, ou nom très proche) ; les autres sont listés pour correction, jamais devinés.
import { sheetRows } from '../xlsxRead.js';

const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => { const n = Number(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n) : 0; };
const isoDate = (v) => { const s = String(v ?? '').trim(); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`; const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/); return m2 ? m2[1] : null; };

/** Classe EduFinance → classe de l'ENT (null : à préciser). */
export function mapClass(name) {
  const k = fold(name);
  const table = { '6E': '6e', '5E': '5e', '4E': '4e', '3E': '3e', '2NDE': '2de', '2DE': '2de', '1E STMG': '1re STMG', '1RE STMG': '1re STMG', '1E GENERALE': '1re Générale', '1RE GENERALE': '1re Générale', 'TLE STMG': 'Terminale STMG', 'TLE GENERALE': 'Terminale Générale', 'TERMINALE STMG': 'Terminale STMG', 'TERMINALE GENERALE': 'Terminale Générale' };
  return table[k] ?? null;
}

/** Catégorie d'une dépense d'après son motif ; 'TRANSFERT' pour un versement en banque (ce n'est pas une dépense). */
export function expenseCategory(motif) {
  const t = fold(motif).toLowerCase();
  if (/salaire|avance|gardien|\bprof|main d.?oeuvre/.test(t)) return 'Salaires et avances';
  if (/versement|depot|banque|remise en banque/.test(t)) return 'TRANSFERT';
  if (/jirama|electricite|\beau\b/.test(t)) return 'Électricité et eau';
  if (/credit|internet|telephone|airtel|telma|orange|wifi/.test(t)) return 'Internet et téléphone';
  if (/loyer|appartement/.test(t)) return 'Loyer';
  if (/menuisier|electricien|ciment|sable|peinture|pinceau|cadenas|reparation|travaux|cire|plomb/.test(t)) return 'Entretien et réparations';
  if (/deplacement|transport|taxi|carburant|essence|colis/.test(t)) return 'Transport';
  if (/examen|dnb|bac\b/.test(t)) return 'Frais d\'examen';
  if (/achat|fourniture|papier|encre|ramette|plastique|stylo|craie/.test(t)) return 'Fournitures';
  return 'Autre';
}

/** Rapprochement d'un nom avec les élèves importés : exact, sinon le seul élève qui partage au moins 2/3 des mots. */
export function matcher(students) {
  const byKey = new Map(students.map((s) => [fold(`${s.lastName} ${s.firstName}`), s]));
  const tokens = students.map((s) => [s, new Set(fold(`${s.lastName} ${s.firstName}`).split(' '))]);
  return (name) => {
    const k = fold(name);
    if (!k) return { student: null, how: 'aucun' };
    if (byKey.has(k)) return { student: byKey.get(k), how: 'exact' };
    const words = new Set(k.split(' '));
    const scored = tokens.map(([s, t]) => [s, [...words].filter((w) => t.has(w)).length / Math.max(words.size, 1)]).filter(([, r]) => r >= 0.66).sort((a, b) => b[1] - a[1]);
    if (scored.length && (scored.length === 1 || scored[0][1] > scored[1][1])) return { student: scored[0][0], how: 'proche' };
    return { student: null, how: 'aucun' };
  };
}

export const isEduFinance = (book) => ['eleves', 'entrees', 'classes'].every((n) => Object.keys(book).some((k) => k.trim().toLowerCase() === n));

/**
 * book : { nomOnglet: lignes } ; students : élèves déjà importés ; firstMonth : mois de rentrée (9).
 * Renvoie { year, fees, unmappedClasses, paid, movements, expenses, transfers, matched, unmatched }.
 */
export function readEduFinance(book, students, { firstMonth = 9 } = {}) {
  const sheet = (n) => sheetRows(book[Object.keys(book).find((k) => k.trim().toLowerCase() === n)] ?? []);
  const years = sheet('annees_scolaires');
  const year = years.find((y) => String(y.courante) === '1') ?? years.at(-1) ?? null;
  const inYear = (r) => !year || String(r.annee_id) === String(year.id);

  const classes = sheet('classes');
  const clsName = Object.fromEntries(classes.map((c) => [String(c.id), c.nom]));
  const fees = []; const unmappedClasses = [];
  classes.forEach((c) => {
    const cls = mapClass(c.nom);
    if (!cls) { if (!/test/i.test(c.nom)) unmappedClasses.push(c.nom); return; }
    fees.push({ cls, inscription: num(c.tarif_inscription), reinscription: num(c.tarif_reinscription), ecolage: num(c.tarif_ecolage), fascicule: num(c.tarif_fascicule), location: num(c.tarif_location) });
  });

  const find = matcher(students);
  const eleves = sheet('eleves').filter(inYear);
  const who = {}; const matched = { exact: 0, proche: 0 }; const unmatched = [];
  eleves.forEach((e) => {
    const r = find(`${e.nom} ${e.prenom}`);
    if (r.student) { who[String(e.id)] = r.student; matched[r.how] += 1; } else unmatched.push({ name: `${e.nom} ${e.prenom}`.trim(), cls: clsName[String(e.classe_id)] ?? '' });
  });
  const keyOf = (s) => `${s.lastName} ${s.firstName}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const paid = {}; const add = (s, k) => { const key = keyOf(s); paid[key] = [...new Set([...(paid[key] ?? []), k])]; };
  eleves.forEach((e) => { const s = who[String(e.id)]; if (!s) return; if (String(e.fascicule_paye) === '1') add(s, 'FASCICULE'); if (String(e.location_payee) === '1') add(s, 'LOCATION'); });
  sheet('mois_ecolage').filter(inYear).forEach((m) => {
    const s = who[String(m.eleve_id)]; if (!s) return;
    const month = ((firstMonth - 1 + num(m.mois_index)) % 12) + 1;
    add(s, `ECO-${String(month).padStart(2, '0')}`);
  });

  const KEY = { inscription: 'INSCRIPTION', reinscription: 'REINSCRIPTION', fascicule: 'FASCICULE', location: 'LOCATION' };
  const movements = sheet('entrees').filter(inYear).map((e) => {
    const s = who[String(e.eleve_id)] ?? find(e.eleve_nom).student;
    const type = String(e.type ?? '').toLowerCase();
    if (s && KEY[type]) add(s, KEY[type]);
    return {
      id: `edu-${e.id}`, date: isoDate(e.date), time: '08:00', agent: 'Reprise EduFinance', dir: 'IN', nature: 'Encaissement famille',
      journal: type === 'ecolage' ? 'ECOLAGE' : /dnb|bac|examen/i.test(type) ? 'DROITS_EXAMEN' : 'FRAIS_ANNEXES',
      label: e.description || `${e.type} — ${e.eleve_nom}`, method: e.numero ? `reçu ${e.numero}` : 'Espèces', amount: num(e.montant), student: s ? keyOf(s) : null,
    };
  }).filter((m) => m.date && m.amount > 0);

  const out = sheet('sorties').filter(inYear).map((x) => ({ x, category: expenseCategory(x.motif) }));
  const toExpense = ({ x, category }) => ({ id: `edu-${x.id}`, supplierId: null, category, label: String(x.motif ?? '').trim() || 'Dépense', amount: num(x.montant), date: isoDate(x.date), due: isoDate(x.date), status: 'PAYE', method: 'ESPECES', ref: x.numero ?? '', imported: true });
  const expenses = out.filter((o) => o.category !== 'TRANSFERT').map(toExpense).filter((x) => x.date && x.amount > 0);
  const transfers = out.filter((o) => o.category === 'TRANSFERT').map(toExpense).filter((x) => x.date && x.amount > 0);
  return { year: year?.libelle ?? null, fees, unmappedClasses, paid, movements, expenses, transfers, matched, unmatched, students: eleves.length };
}
