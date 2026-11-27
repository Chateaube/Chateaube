// Site d'essai (chateaubriand.pro/ent-essai/) : les nouveautés à valider ne s'activent qu'à cette adresse.
// Le vrai site (…/ent/) reste inchangé tant que la Direction n'a pas donné son feu vert.
export const ESSAI = typeof location !== 'undefined' && /\/ent-essai(\/|$)/.test(location.pathname);
