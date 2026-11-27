// Trimestres de l'année (éphéméride 2026-2027, site de Tamatave) : une note appartient au trimestre de la DATE de son évaluation.
// « Arrêt des notes » (stop) : les évaluations datées après comptent pour le trimestre suivant.
// « Fermeture de la saisie » (closeAt) : après, les professeurs ne modifient plus ce trimestre (la Direction peut
// le rouvrir pour un professeur ou pour tous). Message « notes minimum » affiché à partir de noticeFrom.
export const TERMS = [
  { id: 'T1', label: '1er trimestre', start: '2026-09-01', stop: '2026-11-27', noticeFrom: '2026-12-04', closeAt: '2026-12-07T07:00:00+03:00',
    closeText: 'lundi 7 décembre à 7 h', stopText: 'vendredi 27 novembre', council: 'vendredi 11 et samedi 12 décembre 2026' },
  { id: 'T2', label: '2e trimestre', start: '2026-11-28', stop: '2027-03-19', noticeFrom: '2027-03-19', closeAt: '2027-03-27T00:00:00+03:00',
    closeText: 'vendredi 26 mars au soir', stopText: 'vendredi 19 mars', council: 'du mardi 30 mars au vendredi 2 avril 2027' },
  { id: 'T3', label: '3e trimestre', start: '2027-03-20', stop: '2027-06-11', noticeFrom: '2027-06-11', closeAt: '2027-06-19T00:00:00+03:00',
    closeText: 'vendredi 18 juin au soir', stopText: 'vendredi 11 juin', council: 'du lundi 21 au vendredi 25 juin 2027' },
];
export const termById = (id) => TERMS.find((t) => t.id === id) ?? TERMS[0];

/** Trimestre d'une date (AAAA-MM-JJ). */
export function termOfDate(iso) {
  const d = String(iso ?? '').slice(0, 10);
  return (TERMS.find((t) => d >= t.start && d <= t.stop) ?? (d < TERMS[0].start ? TERMS[0] : TERMS[TERMS.length - 1])).id;
}

/** Trimestre des bulletins et des conseils : le dernier dont l'arrêt des notes est passé (sinon le premier). */
export function bulletinTermAt(today) {
  const done = TERMS.filter((t) => t.stop < today);
  return (done.length ? done[done.length - 1] : TERMS[0]);
}

/** Saisie fermée pour ce professeur ? now : Date ; reopen : { T1: ['ALL' | idDuProfesseur…] } (liste des classes). */
export function termClosed(termId, now, reopen = {}, teacherId = null) {
  const t = termById(termId);
  if (!t.closeAt || now < new Date(t.closeAt)) return false;
  const r = reopen?.[termId] ?? [];
  return !(r.includes('ALL') || (teacherId && r.includes(teacherId)));
}

/**
 * Carnet vu pour un trimestre : évaluations de ce trimestre ; appréciations, compétences, validations et remarques
 * pour le conseil du trimestre (1er trimestre : à la racine du carnet, comme avant ; suivants : carnet.byTerm[id]).
 */
export function carnetForTerm(carnet, termId) {
  if (!carnet) return carnet;
  const evaluations = Object.fromEntries(Object.entries(carnet.evaluations ?? {}).map(([sid, list]) => [sid, (list ?? []).filter((e) => termOfDate(e.date) === termId)]));
  if (termId === TERMS[0].id) return { ...carnet, evaluations };
  const t = carnet.byTerm?.[termId] ?? {};
  return { ...carnet, evaluations, comments: t.comments ?? {}, myComps: t.myComps ?? {}, validated: t.validated ?? {}, flags: t.flags ?? {} };
}
