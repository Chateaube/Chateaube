// Ordre des matières de l'école (bulletins, grille du conseil, réglages), donné par la Direction :
// 1. tronc commun et enseignements généraux ; 2. sciences ; 3. SES et STMG ; 4. arts, sport, options.
// L'ETLV est comptée dans l'anglais. Une matière absente de la liste passe après, avant la vie de classe.
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const ORDER = [
  ['francais', 'philosophie'],
  ['histoiregeographie', 'hg'],
  ['emc', 'enseignementmoraletcivique', 'educationmoraleetcivique'],
  ['anglais', 'lva', 'languevivante', 'etlv'],
  ['espagnol', 'lvb', 'languevivante'],
  ['mandarin', 'lvc'],
  ['snt', 'sciencesnumeriquesettechnologie', 'technologie'],
  ['enseignementscientifique'],
  ['mathematiques', 'maths', 'specialitemathematiques', 'spemathematiques'],
  ['physiquechimie', 'specialitephysiquechimie'],
  ['svt', 'specialitesvt', 'sciencesdelavieetdelaterre'],
  ['ses', 'scienceseconomiquesetsociales'],
  ['economie', 'eco'],
  ['droit'],
  ['management', 'mgt'],
  ['sgn', 'sciencesdegestionetnumerique', 'scdegestionetnumerique'],
  ['msgn', 'managementsciencesdegestionetnumerique'],
  ['artsplastiques', 'ap'],
  ['musique', 'educationmusicale', 'mus'],
  ['eps', 'educationphysiqueetsportive'],
];
/** Rang d'une matière (libellé ou code) ; les matières inconnues après la liste, la vie de classe en dernier. */
export function subjectRank(labelOrId) {
  const k = fold(labelOrId).replace(/^(specialite|spe)(?=.)/, '');
  if (k === 'viedeclasse' || k === 'vdc') return 1000;
  // Français avant Philosophie (même ligne) : un léger écart
  const i = ORDER.findIndex((alts) => alts.includes(k));
  if (i >= 0) return i * 2 + (k === 'philosophie' ? 1 : 0);
  return 900;
}
/** Trie une liste de matières { label, id } selon l'ordre de l'école. */
export const sortSubjects = (list) => [...list].sort((a, b) => (subjectRank(a.label) === 900 ? subjectRank(a.id) : subjectRank(a.label)) - (subjectRank(b.label) === 900 ? subjectRank(b.id) : subjectRank(b.label)) || String(a.label).localeCompare(String(b.label), 'fr'));
