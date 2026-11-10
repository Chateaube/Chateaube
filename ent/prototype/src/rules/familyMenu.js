// Portail des familles : le menu dépend de la classe de l'enfant affiché (un parent de plusieurs
// enfants voit le menu changer quand il change d'enfant).
//  - Stages : 3e (février) et 2de (avril), 5 jours chacun, ou s'il reste un stage passé à consulter ;
//  - Orientation : de la 3e à la Terminale ;
//  - Réinscription : toutes les classes sauf la Terminale (dernière année dans l'établissement).
const level = (cls = '') => cls.split(' ')[0];
export const STAGE_LEVELS = ['3e', '2de'];
export const ORIENTATION_LEVELS = ['3e', '2de', '1re', 'Terminale'];

export function menuFor(child, { hasInternships = false } = {}) {
  const l = level(child.cls);
  return {
    stages: STAGE_LEVELS.includes(l) || hasInternships,
    orientation: ORIENTATION_LEVELS.includes(l),
    reenrol: l !== 'Terminale',
  };
}
