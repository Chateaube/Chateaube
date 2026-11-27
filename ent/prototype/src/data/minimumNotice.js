// Messages de l'administration aux professeurs qui n'ont pas encore le minimum de notes, à l'approche de
// l'arrêt des notes (texte de la Direction, tel quel). EPS : seuil adapté de 3 notes.
export const NOTICE_GENERAL = {
  intro: 'À l\'approche de l\'arrêt des notes, nous constatons que certaines matières ne comptent encore que 2 ou 3 évaluations. Sachant que le calendrier ne permet plus d\'organiser de nouvelles évaluations en classe, nous vous proposons des solutions pour atteindre le minimum réglementaire de 4 notes en vous appuyant uniquement sur le travail déjà accompli ce trimestre :',
  points: [
    ['Scinder une évaluation existante', 'Diviser la note d\'une évaluation complète en deux notes distinctes (par exemple : Compréhension / Analyse d\'un côté, et Expression / Rédaction / Méthode de l\'autre).'],
    ['Évaluer le suivi et la participation', 'Attribuer une note globale sur le trimestre basée sur l\'implication orale, la régularité du travail à la maison ou la bonne tenue du cahier.'],
    ['Valoriser un travail déjà rendu', 'Noter un exercice fait en classe, un travail de groupe ou une recherche documentaire qui n\'avait fait l\'objet que d\'une correction collective.'],
  ],
  outro: ['Ces ajustements permettent de garantir une moyenne représentative et équitable pour les élèves sans bouleverser vos dernières séances.', 'Nous vous remercions pour votre réactivité et restons à votre écoute en cas de besoin.'],
  closing: 'Cordialement,',
};

export const NOTICE_EPS = {
  intro: 'Dans le cadre de la clôture des bulletins, et en tenant compte des spécificités de votre discipline, l\'administration maintient le seuil adapté de 3 notes minimum en EPS.\nPuisqu\'il n\'est plus possible de mettre en place de nouvelles situations d\'évaluation d\'ici l\'arrêt des notes, voici comment atteindre ce quota de 3 notes à partir de vos observations et barèmes déjà réalisés ce trimestre :',
  points: [
    ['Décomposer votre grille d\'évaluation principale', 'Séparer une note globale en deux notes distinctes (par exemple : une note pour la performance / maîtrise motrice et une seconde pour l\'investissement dans les rôles sociaux comme l\'arbitrage, l\'observation ou l\'assurage).'],
    ['Attribuer une note d\'engagement trimestriel', 'Évaluer sur l\'ensemble de la période l\'assiduité, le sérieux lors des échauffements, le respect des règles de sécurité et l\'esprit d\'équipe.'],
    ['Dissocier l\'évolution et le résultat', 'Si votre barème le permet, isoler une note pour la progression de l\'élève au cours du cycle et une autre pour son niveau final.'],
  ],
  outro: ['N\'hésitez pas à nous solliciter si vous rencontrez la moindre difficulté lors de la saisie.', 'Merci pour votre collaboration et votre engagement auprès des élèves.'],
  closing: 'Bien cordialement,',
};

/** Le message s'affiche à partir de 15 jours avant l'arrêt des notes, tant que le minimum n'est pas atteint. */
export const NOTICE_FROM_DAYS = 15;
/** Faut-il afficher le message ? count : devoirs saisis ; min : minimum de la matière (4, EPS 3) ; stop : arrêt des notes. */
// from (facultatif) : premier jour d'affichage choisi par la Direction (sinon 15 jours avant stop)
export function minimumNoticeDue({ count, min, validated, date, stop, from: first }) {
  if (validated || min < 3 || count >= min || !stop || date > stop) return false;
  if (first) return date >= first;
  const from = new Date(`${stop}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - NOTICE_FROM_DAYS);
  return date >= from.toISOString().slice(0, 10);
}
