// Ouvrir un écran déjà réglé : « Cahier de textes » depuis le cours de 10h ouvre la bonne classe,
// « Écrire aux parents » ouvre le message avec le bon destinataire. Lu une seule fois par l'écran visé.
let intent = null;
export const setIntent = (screen, data) => { intent = { screen, ...data }; };
export function takeIntent(screen) {
  if (intent?.screen !== screen) return null;
  const x = intent; intent = null; return x;
}
