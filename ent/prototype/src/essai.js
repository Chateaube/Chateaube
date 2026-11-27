// Site d'essai (chateaubriand.pro/ent-essai/) : les nouveautés à valider ne s'activent qu'à cette adresse.
// Le vrai site (…/ent/) reste inchangé tant que la Direction n'a pas donné son feu vert.
export const ESSAI = typeof location !== 'undefined' && /\/ent-essai(\/|$)/.test(location.pathname);
// Nouveautés validées par la Direction le 27 novembre 2026 (trimestres séparés, carnet en trois onglets, « À faire »,
// fil de l'élève, « Voir comme… ») : actives partout. Les prochaines nouveautés à tester utiliseront ESSAI.
export const NOUVEAU = true;
