// Examens blancs « comme à l'examen ». L'école présente ses élèves en candidats individuels (établissement
// hors contrat) : pas de contrôle continu ; il est remplacé par des « évaluations ponctuelles » en fin de 1re
// et en fin de Terminale (même liste de matières, notées une fois chacune). Structure vérifiée sur de vrais
// relevés (bac 2026, pré-bac 2026, DNB 2026) : histoire-géographie et EMC sont deux notes séparées.
// - Brevet blanc (3e) : épreuves écrites des candidats libres, coef. 2 chacune ; en sciences, trois notes
//   (physique-chimie, SVT, technologie) sont affichées, seules les deux meilleures comptent.
// - Épreuves de 1re blanches : épreuves anticipées (français écrit et oral, mathématiques) et épreuves
//   passées en fin de 1re (spécialité abandonnée, histoire-géographie-EMC, langues, enseignement
//   scientifique ou mathématiques en STMG).
// - Bac blanc (Terminale) : philosophie, spécialités, grand oral et épreuves de Terminale.
// Coefficients de la session 2027 (sur 100) : épreuves anticipées 12 (français 5 + 5, mathématiques 2) ;
// grand oral 8 en générale, 12 en STMG ; les épreuves hors spécialités (40 au total) sont réparties entre
// la 1re et la Terminale. Modifiables par la Direction si les textes changent.

const P = (id, label, coef, subject, extra = {}) => ({ id, label, coef, subject, ...extra });
const SCIENCES = P('SCI', 'Sciences (les 2 meilleures notes sur 3)', 2, 'Sciences', {
  bestOf: 2, subs: [{ id: 'PC', label: 'Physique-chimie' }, { id: 'SVT', label: 'SVT' }, { id: 'TECH', label: 'Technologie' }] });

export const EXAMS = {
  DNB: { label: 'Brevet blanc', official: 'Diplôme national du brevet (candidat libre)', levels: /^3e/, parts: [
    P('FR', 'Français', 2, 'Français'), P('MA', 'Mathématiques', 2, 'Mathématiques'),
    P('HG', 'Histoire-géographie', 1.5, 'Histoire-géographie'), P('EMC', 'Enseignement moral et civique', 0.5, 'EMC'), SCIENCES, P('ANG', 'Anglais (écrit)', 2, 'Anglais')] },
  PREMIERE_G: { label: 'Épreuves de 1re blanches', official: 'Baccalauréat général — épreuves de 1re', levels: /^1re G/, parts: [
    P('FR_E', 'Français — écrit', 5, 'Français'), P('FR_O', 'Français — oral', 5, 'Français'), P('MA_EA', 'Mathématiques (épreuve anticipée)', 2, 'Mathématiques'),
    P('SPE_AB', 'Spécialité abandonnée en fin de 1re', 8, 'Spécialité'), P('HG', 'Histoire-géographie', 3, 'Histoire-géographie'), P('EMC', 'Enseignement moral et civique', 1, 'EMC'),
    P('ES', 'Enseignement scientifique', 3, 'Enseignement scientifique'), P('LVA', 'Langue vivante A (anglais)', 3, 'Anglais'), P('LVB', 'Langue vivante B (espagnol)', 3, 'Espagnol')] },
  PREMIERE_STMG: { label: 'Épreuves de 1re blanches', official: 'Baccalauréat STMG — épreuves de 1re', levels: /^1re STMG/, parts: [
    P('FR_E', 'Français — écrit', 5, 'Français'), P('FR_O', 'Français — oral', 5, 'Français'), P('MA_EA', 'Mathématiques (épreuve anticipée)', 2, 'Mathématiques'),
    P('SGN', 'Sciences de gestion et numérique — étude de gestion (fin de 1re)', 8, 'Sciences de gestion et numérique'), P('HG', 'Histoire-géographie', 3, 'Histoire-géographie'), P('EMC', 'Enseignement moral et civique', 1, 'EMC'),
    P('MA', 'Mathématiques', 3, 'Mathématiques'), P('LVA', 'Langue vivante A (anglais)', 3, 'Anglais'), P('LVB', 'Langue vivante B (espagnol)', 3, 'Espagnol')] },
  BAC_G: { label: 'Bac blanc', official: 'Baccalauréat général', levels: /^Terminale G/, first: 'PREMIERE_G', parts: [
    P('PHI', 'Philosophie', 8, 'Philosophie'), P('SPE1', 'Spécialité 1', 16, 'Spécialité'), P('SPE2', 'Spécialité 2', 16, 'Spécialité'), P('GO', 'Grand oral', 8, 'Grand oral'),
    P('HG', 'Histoire-géographie', 3, 'Histoire-géographie'), P('EMC', 'Enseignement moral et civique', 1, 'EMC'), P('ES', 'Enseignement scientifique', 3, 'Enseignement scientifique'),
    P('LVA', 'Langue vivante A (anglais)', 3, 'Anglais'), P('LVB', 'Langue vivante B (espagnol)', 3, 'Espagnol'), P('EPS', 'Éducation physique et sportive', 6, 'EPS')] },
  BAC_STMG: { label: 'Bac blanc', official: 'Baccalauréat technologique STMG', levels: /^Terminale STMG/, first: 'PREMIERE_STMG', parts: [
    P('PHI', 'Philosophie', 4, 'Philosophie'), P('MSGN', 'Management, sciences de gestion et numérique — mercatique', 16, 'Management'), P('DE', 'Droit et économie', 16, 'Droit et économie'),
    P('GO', 'Grand oral', 12, 'Grand oral'), P('HG', 'Histoire-géographie', 3, 'Histoire-géographie'), P('EMC', 'Enseignement moral et civique', 1, 'EMC'), P('MA', 'Mathématiques', 3, 'Mathématiques'),
    P('LVA', 'Langue vivante A (anglais)', 3, 'Anglais'), P('LVB', 'Langue vivante B (espagnol)', 3, 'Espagnol'), P('EPS', 'Éducation physique et sportive', 6, 'EPS')] },
};

export const examsForClass = (cls) => Object.entries(EXAMS).filter(([, e]) => e.levels.test(cls)).map(([k]) => k);
export const bacKindOf = (cls) => (/STMG/.test(cls) ? 'BAC_STMG' : 'BAC_G');
export const isBac = (kind) => kind === 'BAC_G' || kind === 'BAC_STMG';

export function mention(avg) {
  if (avg == null) return '';
  if (avg >= 18) return 'Très bien avec félicitations du jury';
  if (avg >= 16) return 'Très bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez bien';
  return '';
}

/** Résultat indicatif. Bac : 10 admis, 8 à 10 second groupe (oral de rattrapage) ; brevet : 10 admis. */
export function decision(avg, kind) {
  if (avg == null) return '';
  if (avg >= 10) return 'Admis';
  if (kind !== 'DNB' && avg >= 8) return 'Second groupe';
  return 'Non admis';
}

const round2 = (x) => Math.round(x * 100) / 100;
const num = (v) => (v === 'ABS' ? 0 : v);
export const validMark = (v) => v === 'ABS' || (typeof v === 'number' && v >= 0 && v <= 20);

/** Note d'une épreuve ; épreuve à sous-notes (sciences) : une fois les trois notes saisies, moyenne des
 *  `bestOf` meilleures. null si incomplète. */
export function partMark(p, marks = {}) {
  if (!p.subs) return marks[p.id] ?? null;
  const got = p.subs.map((s) => marks[s.id]).filter((v) => v != null && v !== '').map(num).sort((a, b) => b - a);
  if (got.length < p.subs.length) return null;
  return round2(got.slice(0, p.bestOf).reduce((a, b) => a + b, 0) / p.bestOf);
}
/** Sous-notes retenues (les meilleures) pour l'affichage. */
export function keptSubs(p, marks = {}) {
  return p.subs.map((s) => ({ ...s, mark: marks[s.id] })).filter((s) => s.mark != null).sort((a, b) => num(b.mark) - num(a.mark)).slice(0, p.bestOf).map((s) => s.id);
}

/** parts : [{ id, label, coef }], marks : { [id]: note sur 20 | 'ABS' }. Absence = 0. */
export function examResult(parts, marks) {
  let points = 0; let coefs = 0; const missing = [];
  parts.forEach((p) => {
    const v = partMark(p, marks ?? {});
    if (v == null || v === '') { missing.push(p.label); return; }
    points += num(v) * p.coef; coefs += p.coef;
  });
  const total = parts.reduce((s, p) => s + p.coef, 0);
  return { points: round2(points), maxPoints: coefs * 20, complete: !missing.length, missing, average: coefs ? round2(points / coefs) : null, totalCoef: total };
}

/**
 * Projection au bac (Terminale, sur 100) : notes OFFICIELLES de 1re (épreuves anticipées et épreuves de fin
 * de 1re) + dernier bac blanc pour les épreuves de Terminale.
 * - acquis : points officiels de 1re ;
 * - à obtenir : moyenne nécessaire aux épreuves de Terminale pour 10, 12, 14 et 16 (null : hors d'atteinte) ;
 * - bac blanc : moyenne pondérée des épreuves de Terminale, à comparer ;
 * - projection : moyenne au bac si l'élève refait ses notes du bac blanc.
 */
export function bacProjection(kind, { official = {}, blanc = {} }) {
  const first = EXAMS[EXAMS[kind].first].parts;
  const finals = EXAMS[kind].parts;
  const rows = [
    ...first.map((p) => ({ ...p, mark: official[p.id] == null ? null : num(official[p.id]), source: 'Officielle (1re)' })),
    ...finals.map((p) => ({ ...p, mark: blanc[p.id] == null || blanc[p.id] === '' ? null : num(blanc[p.id]), source: 'Bac blanc' })),
  ];
  const total = rows.reduce((s, r) => s + r.coef, 0); // 100
  const acquiredRows = rows.filter((r) => r.source !== 'Bac blanc' && r.mark != null);
  const acquired = acquiredRows.reduce((s, r) => s + r.mark * r.coef, 0);
  const acquiredCoef = acquiredRows.reduce((s, r) => s + r.coef, 0);
  const remainingCoef = total - acquiredCoef;
  const needed = Object.fromEntries([10, 12, 14, 16].map((t) => {
    const v = remainingCoef ? (t * total - acquired) / remainingCoef : null;
    return [t, v == null ? null : v <= 0 ? 0 : v > 20 ? null : round2(v)];
  }));
  const blancResult = examResult(finals, blanc);
  const known = rows.filter((r) => r.mark != null);
  const knownCoef = known.reduce((s, r) => s + r.coef, 0);
  const projected = knownCoef ? round2(known.reduce((s, r) => s + r.mark * r.coef, 0) / knownCoef) : null;
  return { rows, total, acquired: round2(acquired), acquiredCoef, acquiredAverage: acquiredCoef ? round2(acquired / acquiredCoef) : null, remainingCoef, needed,
    blancAverage: blancResult.average, projected, complete: knownCoef === total, mention: mention(projected), decision: decision(projected, kind) };
}

/** Coefficient proposé au professeur pour compter l'examen blanc dans son carnet : au-dessus de ses autres évaluations. */
export const suggestedCoef = (evaluations = []) => Math.max(1, ...evaluations.map((e) => Number(e.coef) || 1)) + 1;
