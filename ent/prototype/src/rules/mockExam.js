// Examens blancs « comme à l'examen » : brevet blanc (3e), épreuves anticipées blanches (1re), bac blanc
// (Terminale générale ou STMG). Chaque épreuve est notée sur 20 avec son coefficient ; le relevé donne le
// total des points, la moyenne, la mention et un résultat indicatif.
// Projection au bac (Terminale) : notes OFFICIELLES des épreuves anticipées (passées en 1re) + contrôle
// continu (moyenne des bulletins) + dernier bac blanc pour les épreuves de Terminale → ce qui est acquis,
// la moyenne visée et la moyenne qu'il reste à obtenir pour chaque mention.
// Coefficients : ceux du baccalauréat (sur 100) et du brevet tels que connus ; modifiables par la Direction.

export const EXAMS = {
  DNB: { label: 'Brevet blanc', official: 'Diplôme national du brevet', levels: /^3e/, parts: [
    { id: 'FR', label: 'Français', coef: 2 }, { id: 'MA', label: 'Mathématiques', coef: 2 },
    { id: 'HG', label: 'Histoire-géographie et EMC', coef: 1 }, { id: 'SC', label: 'Sciences', coef: 1 }, { id: 'OR', label: 'Oral', coef: 2 }] },
  EAF: { label: 'Épreuves anticipées blanches', official: 'Épreuves anticipées du baccalauréat', levels: /^1re/, parts: [
    { id: 'FR_E', label: 'Français — écrit', coef: 5 }, { id: 'FR_O', label: 'Français — oral', coef: 5 }] },
  BAC_G: { label: 'Bac blanc', official: 'Baccalauréat général', levels: /^Terminale G/, parts: [
    { id: 'PHI', label: 'Philosophie', coef: 8 }, { id: 'SPE1', label: 'Spécialité 1', coef: 16 }, { id: 'SPE2', label: 'Spécialité 2', coef: 16 }, { id: 'GO', label: 'Grand oral', coef: 10 }] },
  BAC_STMG: { label: 'Bac blanc', official: 'Baccalauréat technologique STMG', levels: /^Terminale STMG/, parts: [
    { id: 'PHI', label: 'Philosophie', coef: 4 }, { id: 'MSGN', label: 'Management, sciences de gestion et numérique', coef: 16 }, { id: 'DE', label: 'Droit et économie', coef: 16 }, { id: 'GO', label: 'Grand oral', coef: 14 }] },
};
// Baccalauréat (sur 100) : épreuves anticipées de français 10, contrôle continu 40, épreuves de Terminale 50
export const CC_COEF = 40;
export const EAF_PARTS = EXAMS.EAF.parts;

export const examsForClass = (cls) => Object.entries(EXAMS).filter(([, e]) => e.levels.test(cls)).map(([k]) => k);
export const bacKindOf = (cls) => (/STMG/.test(cls) ? 'BAC_STMG' : 'BAC_G');

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
export const validMark = (v) => v === 'ABS' || (typeof v === 'number' && v >= 0 && v <= 20);

/** parts : [{ id, label, coef }], marks : { [id]: note sur 20 | 'ABS' }. Absence = 0. */
export function examResult(parts, marks) {
  let points = 0; let coefs = 0; const missing = [];
  parts.forEach((p) => {
    const v = marks?.[p.id];
    if (v == null || v === '') { missing.push(p.label); return; }
    points += (v === 'ABS' ? 0 : v) * p.coef; coefs += p.coef;
  });
  const total = parts.reduce((s, p) => s + p.coef, 0);
  const avg = coefs ? round2(points / coefs) : null;
  return { points: round2(points), maxPoints: coefs * 20, complete: !missing.length, missing, average: avg, totalCoef: total };
}

/**
 * Projection au bac. sources : { eaf: {FR_E, FR_O} (officiel), cc: moyenne des bulletins, blanc: {PHI, …} }.
 * - acquis : épreuves anticipées officielles et contrôle continu ;
 * - à obtenir : moyenne nécessaire aux épreuves de Terminale (pondérée) pour 10, 12, 14 et 16 ;
 * - bac blanc : moyenne pondérée des épreuves de Terminale au dernier bac blanc, comparée à ce qu'il faut ;
 * - projection : moyenne au bac si l'élève refait ses notes du bac blanc.
 */
export function bacProjection(kind, { eaf = {}, cc = null, blanc = {} }) {
  const n = (v) => (v === 'ABS' ? 0 : v ?? null);
  const finals = EXAMS[kind].parts;
  const rows = [
    ...EAF_PARTS.map((p) => ({ ...p, mark: n(eaf[p.id]), source: 'Officielle (1re)' })),
    { id: 'CC', label: 'Contrôle continu (bulletins de 1re et de Terminale)', coef: CC_COEF, mark: cc, source: 'Bulletins' },
    ...finals.map((p) => ({ ...p, mark: n(blanc[p.id]), source: 'Bac blanc' })),
  ];
  const total = rows.reduce((s, r) => s + r.coef, 0); // 100
  const acquiredRows = rows.filter((r) => r.source !== 'Bac blanc' && r.mark != null);
  const acquired = acquiredRows.reduce((s, r) => s + r.mark * r.coef, 0);
  const remainingCoef = total - acquiredRows.reduce((s, r) => s + r.coef, 0);
  const needed = Object.fromEntries([10, 12, 14, 16].map((t) => {
    const v = remainingCoef ? (t * total - acquired) / remainingCoef : null;
    return [t, v == null ? null : v <= 0 ? 0 : v > 20 ? null : round2(v)]; // null : hors d'atteinte
  }));
  const blancDone = finals.filter((p) => blanc[p.id] != null && blanc[p.id] !== '');
  const blancCoef = blancDone.reduce((s, p) => s + p.coef, 0);
  const blancAverage = blancCoef ? round2(blancDone.reduce((s, p) => s + n(blanc[p.id]) * p.coef, 0) / blancCoef) : null;
  const known = rows.filter((r) => r.mark != null);
  const knownCoef = known.reduce((s, r) => s + r.coef, 0);
  const projected = knownCoef ? round2(known.reduce((s, r) => s + r.mark * r.coef, 0) / knownCoef) : null;
  return { rows, total, acquired: round2(acquired), remainingCoef, needed, blancAverage, projected, complete: knownCoef === total,
    mention: mention(projected), decision: decision(projected, kind) };
}
