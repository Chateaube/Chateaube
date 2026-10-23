// Rubriques modulaires : chaque rubrique optionnelle a un identifiant et un mode d'affichage réglable
// par la Direction (Droits d'accès → Rubriques de l'école), sans toucher au code :
//   TOUS : visible par les profils concernés · DIRECTION : Direction seulement · AUCUN : masquée.
// Masquer une rubrique n'efface aucune donnée : tarifs, articles, inventaire… continuent de servir.
// Pour supprimer une rubrique du code plus tard : retirer son entrée ici et l'élément qui porte son `feature`.
export const FEATURES = [
  { id: 'caisse.tarifs', label: 'Classes et tarifs', where: 'Caisse et comptabilité', default: 'DIRECTION',
    note: 'Les tarifs servent à l\'encaissement et aux échéanciers : masqués, ils restent appliqués ; réaffichez-les pour les changer.' },
  { id: 'caisse.articles', label: 'Articles et services', where: 'Caisse et comptabilité', default: 'DIRECTION',
    note: 'Les articles (uniforme, manuels, droits d\'examen…) restent proposés à l\'encaissement avec leur prix.' },
  { id: 'caisse.reductions', label: 'Réductions', where: 'Caisse et comptabilité', default: 'TOUS' },
  { id: 'vie-ecole', label: 'Vie de l\'école (photos)', where: 'Communication', default: 'TOUS' },
  { id: 'examens-blancs', label: 'Examens blancs', where: 'Pédagogie / Notes', default: 'TOUS' },
  { id: 'soins', label: 'Soins (secrétariat)', where: 'Vie scolaire', default: 'TOUS' },
  { id: 'inventaire', label: 'Inventaire du matériel', where: 'Matériel', default: 'TOUS' },
  { id: 'bibliotheque', label: 'Bibliothèque (salle d\'étude)', where: 'Matériel', default: 'TOUS' },
  { id: 'reservations', label: 'Réservations de matériel', where: 'Matériel', default: 'TOUS' },
];
export const MODES = { TOUS: 'Visible', DIRECTION: 'Direction seulement', AUCUN: 'Masquée' };

export function featureMode(settings, id) {
  return settings?.features?.[id] ?? FEATURES.find((f) => f.id === id)?.default ?? 'TOUS';
}
/** La rubrique est-elle affichée pour ce profil ? */
export function featureVisible(settings, id, role) {
  if (!id) return true;
  const mode = featureMode(settings, id);
  return mode === 'TOUS' || (mode === 'DIRECTION' && role === 'DIRECTION');
}
