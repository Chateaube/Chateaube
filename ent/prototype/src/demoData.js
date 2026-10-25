// Données de démonstration ou données réelles. Dès qu'un vrai fichier est importé (Importer et
// sauvegarder), les exemples disparaissent de tous les écrans : absences, punitions, soins, caisse,
// tâches, annonces, événements… repartent de zéro, et seules les vraies données (et ce que l'équipe
// saisit ensuite) apparaissent. Sans import, le prototype garde ses exemples fictifs.
import { loadImport } from './importStore.js';

export const realData = () => Boolean(loadImport()?.students?.length);
export const demoOr = (demo, empty) => (realData() ? empty : demo);

/** Tableau « vivant » : relu à chaque usage (exemples sans import, vide avec les vraies données). */
export function liveArray(fn) {
  return new Proxy([], {
    get: (_, k) => { const a = fn(); const v = a[k]; return typeof v === 'function' ? v.bind(a) : v; },
    has: (_, k) => k in fn(),
  });
}
/** Objet « vivant » (clés lues à chaque usage). */
export function liveObject(fn) {
  return new Proxy({}, {
    get: (_, k) => fn()[k],
    has: (_, k) => k in fn(),
    ownKeys: () => Reflect.ownKeys(fn()),
    getOwnPropertyDescriptor: (_, k) => (k in fn() ? { value: fn()[k], enumerable: true, configurable: true, writable: false } : undefined),
  });
}

// Ce qui a été saisi pendant la démonstration (gardé dans ce navigateur) : effacé au premier vrai import.
// On garde les réglages, les documents de l'école, les tarifs, les favoris et l'acceptation des chartes.
export const DEMO_STATE_KEYS = [
  'ent-absences-eleves-v1', 'ent-absences-prof-v1', 'ent-annonces-v2', 'ent-appel-v1', 'ent-appgen-v1', 'ent-bulletin-dispo-v1',
  'ent-caisse-mouvements-v1', 'ent-cdi-v1', 'ent-changements-edt-v1', 'ent-demandes-v1', 'ent-devoirs-faits-v1', 'ent-engagements-v1',
  'ent-engagements-valides-v1', 'ent-examens-blancs-v3', 'ent-fiche-v1', 'ent-fiches-orientation-v1', 'ent-inventaire-v2', 'ent-journal-v1',
  'ent-manuels-v2', 'ent-objets-v1', 'ent-passages-v1', 'ent-passeport-v3', 'ent-remise-v1', 'ent-remplacements-v1', 'ent-retards-prof-v1',
  'ent-signatures-v1', 'ent-sorties-v1', 'ent-suivis-v1', 'ent-surveillance-colles-v1', 'ent-taches-v1', 'ent-vie-ecole-v2', 'ent-vus-v1',
  'ent-push-envoyes-v1', 'ent-suggestions-v1', 'ent-brouillons-v1', 'ent-profiles-v2',
];
export function resetDemoState() {
  DEMO_STATE_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch { /* stockage indisponible */ } });
}
