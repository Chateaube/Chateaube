// Import de l'emploi du temps (Excel) : une ligne par cours de la semaine type.
// Deux présentations acceptées : celle de l'école (Jour, Classe, Créneau Horaire « 07:30-09:30 », Matière,
// Enseignant, Salle, Semaine) et celle du modèle complet (Classe, Jour, Début, Fin, Matière, Professeur, Salle).
// Les abréviations habituelles sont comprises (1e G, Tle STMG, 2nde, HGE, P-C, Spé…, E.S.…).
// Contrôles : jour, horaire lisible, classe ; chevauchements d'un professeur ou d'une classe (sauf
// semaines A et B différentes). Rien n'est rejeté sans être signalé, ligne par ligne.

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const DAYS = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
export const DAY_NAMES = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const CLASS_ALIASES = [
  [/^6(e|eme)?$/, '6e'], [/^5(e|eme)?$/, '5e'], [/^4(e|eme)?$/, '4e'], [/^3(e|eme)?$/, '3e'],
  [/^(2|2de|2nde|seconde)$/, '2de'],
  [/^1(e|ere|re)? ?(g|gen|generale)$/, '1re Générale'], [/^1(e|ere|re)? ?stmg$/, '1re STMG'],
  [/^(t|tle|term|terminale) ?(g|gen|generale)$/, 'Terminale Générale'], [/^(t|tle|term|terminale) ?stmg$/, 'Terminale STMG'],
];
/** Classe de l'école à partir de l'écriture du fichier (« 1e G » → « 1re Générale »). null si inconnue. */
export function normalizeClass(t) {
  const n = norm(t);
  return CLASS_ALIASES.find(([re]) => re.test(n))?.[1] ?? null;
}

const SUBJECT_ALIASES = {
  hge: 'Histoire-Géographie', hg: 'Histoire-Géographie', 'histoire geographie': 'Histoire-Géographie',
  'p c': 'Physique-Chimie', pc: 'Physique-Chimie', maths: 'Mathématiques', math: 'Mathématiques',
  'eco droit': 'Droit et économie', economie: 'Économie', droit: 'Droit', msgn: 'Management, sciences de gestion et numérique',
  sgn: 'Sciences de gestion et numérique', 'arts plastiques': 'Arts plastiques', 'anglais etlv': 'Anglais — ETLV',
};
/**
 * Matière de l'école : « Spé Maths » → Spécialité Mathématiques ; « E.S. P-C » / « E.S. SVT » →
 * Enseignement scientifique (un seul enseignement, partagé entre deux professeurs de sciences).
 */
export function normalizeSubject(t) {
  const raw = String(t ?? '').trim();
  const n = norm(raw);
  if (!n) return null;
  if (/^e s\b|^es\b|^enseignement scientifique/.test(n)) return { subject: 'Enseignement scientifique', part: raw.replace(/^E\.?\s?S\.?\s*/i, '').trim() || null };
  if (/^spe\b|^specialite\b/.test(n)) {
    const rest = n.replace(/^spe(cialite)?\s*/, '');
    return { subject: `Spécialité ${SUBJECT_ALIASES[rest] ?? raw.replace(/^sp[ée](cialit[ée])?\.?\s*/i, '').trim()}`, part: null };
  }
  return { subject: SUBJECT_ALIASES[n] ?? raw, part: null };
}

const time = (t) => { const m = /^(\d{1,2})[:h](\d{2})$/.exec(String(t ?? '').trim()); return m && Number(m[1]) < 24 ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const pick = (r, ...names) => { const k = Object.keys(r).find((h) => names.includes(norm(h))); return k ? String(r[k] ?? '').trim() : ''; };

/** Lignes du tableur (objets { en-tête: valeur, line }) → créneaux, erreurs, avertissements. */
export function parseTimetable(rows) {
  const slots = []; const errors = []; let ignored = 0;
  rows.forEach((r) => {
    const day = pick(r, 'jour'); const cls = pick(r, 'classe'); const subj = pick(r, 'matiere');
    const range = pick(r, 'creneau horaire', 'creneau', 'horaire');
    let start = time(pick(r, 'debut')); let end = time(pick(r, 'fin'));
    if (range) { const [a, b] = range.split(/\s*[-–]\s*/); start = time(a); end = time(b); }
    if (!day && !cls && !subj && !start) { ignored += 1; return; }
    const where = `Ligne ${r.line}`;
    const weekday = DAYS[norm(day)];
    const klass = normalizeClass(cls);
    const s = normalizeSubject(subj);
    const problems = [];
    if (!weekday) problems.push(`jour « ${day || 'vide'} » inconnu`);
    if (!klass) problems.push(`classe « ${cls || 'vide'} » inconnue`);
    if (!s) problems.push('matière vide');
    if (!start || !end) problems.push(`horaire « ${range || `${pick(r, 'debut')}-${pick(r, 'fin')}`} » illisible (format 08:00-09:30)`);
    else if (minutes(end) <= minutes(start)) problems.push(`l'horaire finit avant de commencer (${start}-${end})`);
    if (problems.length) { errors.push(`${where} : ${problems.join(', ')}.`); return; }
    const salle = pick(r, 'salle');
    const week = /\bb\b/.test(norm(pick(r, 'semaine'))) ? 'B' : /\ba\b/.test(norm(pick(r, 'semaine'))) ? 'A' : null;
    slots.push({ id: `edt${r.line}`, line: r.line, weekday, cls: klass, subject: s.subject, ...(s.part ? { part: s.part } : {}), teacherId: pick(r, 'enseignant', 'professeur') || 'À désigner',
      start, end, room: salle === '-' ? '' : salle, ...(week ? { week } : {}) });
  });
  return { slots, errors, ignored, warnings: overlaps(slots) };
}

/** Chevauchements : un professeur ou une classe à deux endroits à la fois (semaines A et B différentes : pas de conflit). */
const GROUPED = /^(Spécialité|Anglais|Espagnol|Mandarin|Allemand|Malgache)/;
export function overlaps(slots) {
  const out = [];
  const clash = (a, b) => a.weekday === b.weekday && (!a.week || !b.week || a.week === b.week)
    && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i]; const b = slots[j];
      if (!clash(a, b)) continue;
      const when = `${DAY_NAMES[a.weekday]} ${a.start}-${a.end} / ${b.start}-${b.end}`;
      if (a.teacherId === b.teacherId && a.teacherId !== 'À désigner' && !(a.subject === b.subject && a.start === b.start && a.end === b.end))
        out.push(`${a.teacherId} a deux cours en même temps (lignes ${a.line} et ${b.line}, ${when} : ${a.cls}, ${b.cls}).`);
      // Deux spécialités (ou deux langues) à la même heure : les élèves sont répartis en groupes, c'est voulu.
      if (a.cls === b.cls && !(GROUPED.test(a.subject) && GROUPED.test(b.subject) && a.subject !== b.subject))
        out.push(`La ${a.cls} a deux cours en même temps (lignes ${a.line} et ${b.line}, ${when} : ${a.subject}, ${b.subject}).`);
    }
  }
  return out;
}

/** Heures par classe et par semaine (A et B). */
export function hoursByClass(slots) {
  const h = (s) => (minutes(s.end) - minutes(s.start)) / 60;
  const out = {};
  slots.forEach((s) => {
    const c = (out[s.cls] ??= { A: 0, B: 0 });
    if (s.week !== 'B') c.A += h(s);
    if (s.week !== 'A') c.B += h(s);
  });
  return out;
}

/** Trouve l'onglet de l'emploi du temps dans un classeur : « 4 Emploi du temps », « EDT… », ou un onglet aux bonnes colonnes. */
export function timetableSheet(book) {
  const names = Object.keys(book);
  const byName = names.find((n) => /^4 emploi du temps/.test(norm(n)) || /^edt/.test(norm(n)) || /emploi du temps/.test(norm(n)));
  if (byName) return book[byName];
  const byHead = names.find((n) => { const h = (book[n][0] ?? []).map(norm); return h.includes('jour') && h.includes('classe') && h.includes('matiere'); });
  return byHead ? book[byHead] : [];
}

/** La matière d'un cours correspond-elle à celle d'un enseignement ? (spécialité ↔ matière, Eco-Droit ↔ Économie ou Droit, ETLV ↔ Anglais) */
function sameSubject(course, taught) {
  if (course === taught) return true;
  if (course === `Spécialité ${taught}`) return true;
  if (course === 'Droit et économie') return ['Économie', 'Droit'].includes(taught);
  if (course === 'Anglais — ETLV') return taught === 'Anglais';
  return false;
}
/**
 * Contrôle de l'emploi du temps avec la liste des enseignements : chaque cours doit être donné par un
 * professeur qui a cette matière dans cette classe. Renvoie les écarts, à vérifier (rien n'est bloqué).
 */
export function checkAgainstAssignments(slots, assignments) {
  const names = new Set(assignments.map((a) => a.name));
  const out = [];
  const seen = new Set();
  slots.forEach((s) => {
    const k = `${s.teacherId}|${s.subject}|${s.cls}`;
    if (seen.has(k)) return; seen.add(k);
    const lines = slots.filter((x) => `${x.teacherId}|${x.subject}|${x.cls}` === k).map((x) => x.line).join(', ');
    if (!names.has(s.teacherId)) { out.push(`${s.teacherId} n'est pas dans la liste des enseignements (${s.subject}, ${s.cls} — ligne${lines.includes(',') ? 's' : ''} ${lines}).`); return; }
    const ok = assignments.some((a) => a.name === s.teacherId && a.classes.includes(s.cls) && a.subjects.some((t) => sameSubject(s.subject, t)));
    if (!ok) out.push(`${s.teacherId} : ${s.subject} en ${s.cls} ne figure pas dans ses enseignements (ligne${lines.includes(',') ? 's' : ''} ${lines}).`);
  });
  return out;
}
