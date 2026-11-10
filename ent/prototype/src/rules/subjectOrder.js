// Ordre des matières de l'école (bulletins, grille du conseil, réglages), donné par la Direction :
// A. humanités ; B. sciences ; C. SES et STMG ; D. arts et EPS, puis parcours d'ouverture, vie de classe en dernier.
// L'ETLV est comptée dans l'anglais. Une matière absente de la liste passe après, avant la vie de classe.
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const ORDER = [
  // A. Enseignements communs / humanités
  ['francais', 'philosophie'],
  ['histoiregeographie', 'hg'],
  ['emc', 'enseignementmoraletcivique', 'educationmoraleetcivique'],
  ['anglais', 'lva', 'etlv'],
  ['espagnol', 'mandarin', 'lvb', 'lvc'],
  // B. Sciences et technologies
  ['enseignementscientifique', 'snt', 'sciencesnumeriquesettechnologie', 'technologie'],
  ['mathematiques', 'maths'],
  ['physiquechimie'],
  ['svt', 'sciencesdelavieetdelaterre'],
  // C. Sciences économiques, sociales et tertiaires (STMG : droit et économie, management, SGN / MSGN)
  ['ses', 'scienceseconomiquesetsociales'],
  ['droit'],
  ['economie', 'eco'],
  ['management', 'mgt'],
  ['sgn', 'sciencesdegestionetnumerique', 'scdegestionetnumerique', 'msgn', 'managementsciencesdegestionetnumerique'],
  // D. Arts et éducation physique
  ['artsplastiques', 'ap', 'musique', 'educationmusicale', 'mus'],
  ['eps', 'educationphysiqueetsportive'],
  ['parcoursdouverture'],
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
