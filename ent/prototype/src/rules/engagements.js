// Engagements de l'élève, portés sur le bulletin (comme le « livret scolaire » du lycée et la fiche
// Avenir de Parcoursup) : utiles pour l'orientation et pour un changement d'établissement.

export const ENGAGEMENTS = [
  { id: 'DELEGUE', masc: 'Délégué de classe', fem: 'Déléguée de classe', neutral: 'Délégué(e) de classe' },
  { id: 'SUPPLEANT', masc: 'Délégué suppléant', fem: 'Déléguée suppléante', neutral: 'Délégué(e) suppléant(e)' },
  { id: 'ECO_DELEGUE', masc: 'Éco-délégué', fem: 'Éco-déléguée', neutral: 'Éco-délégué(e)' },
  { id: 'CVL', masc: 'Élu au conseil de la vie lycéenne', fem: 'Élue au conseil de la vie lycéenne', neutral: 'Élu(e) au conseil de la vie lycéenne' },
  { id: 'CVC', masc: 'Élu au conseil de la vie collégienne', fem: 'Élue au conseil de la vie collégienne', neutral: 'Élu(e) au conseil de la vie collégienne' },
  { id: 'TUTEUR', masc: 'Tuteur d\'un élève (aide aux devoirs)', fem: 'Tutrice d\'un élève (aide aux devoirs)', neutral: 'Tutorat d\'un élève (aide aux devoirs)' },
  { id: 'SPORT', masc: 'Membre de l\'équipe sportive de l\'établissement', fem: 'Membre de l\'équipe sportive de l\'établissement', neutral: 'Membre de l\'équipe sportive de l\'établissement' },
  { id: 'PSC1', masc: 'Formé aux premiers secours (PSC1)', fem: 'Formée aux premiers secours (PSC1)', neutral: 'Formation aux premiers secours (PSC1)' },
];

/** Libellés accordés selon le sexe (« Délégué(e) » si inconnu). */
export const engagementLabels = (ids = [], sex) => ids.map((id) => {
  const e = ENGAGEMENTS.find((x) => x.id === id);
  if (!e) return id;
  return sex === 'F' ? e.fem : sex === 'M' ? e.masc : e.neutral;
});

/** Une classe a au plus 2 délégués et 2 suppléants. */
export function engagementErrors(byStudent) {
  const count = (id) => Object.values(byStudent).filter((ids) => ids.includes(id)).length;
  return [count('DELEGUE') > 2 && 'Au plus 2 délégués par classe.', count('SUPPLEANT') > 2 && 'Au plus 2 suppléants par classe.'].filter(Boolean);
}
