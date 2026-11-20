// Se déconnecter : envoyer d'abord ce qui attend encore, puis effacer les données de l'appareil (poste partagé :
// rien ne reste dans le navigateur). Si des saisies n'ont pas pu partir (pas de réseau), on prévient avant.
import { signOut } from './client.js';
import { pushShared, sharedPending } from './shared.js';
import { flushAll, hasPending } from './docs.js';
import { forgetMe } from '../identity.js';
import { wipeDevice } from '../site.js';

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

export async function signOutAndWipe(confirm) {
  try { await Promise.race([Promise.all([pushShared(), flushAll()]), wait(10000)]); } catch { /* hors ligne */ }
  if (sharedPending() || hasPending()) {
    const go = await confirm('Des saisies ne sont pas encore arrivées sur le serveur (pas de réseau ?). Si vous vous déconnectez maintenant, elles seront perdues. Se déconnecter quand même ?');
    if (!go) return false;
  }
  forgetMe();
  try { await Promise.race([signOut(), wait(5000)]); } catch { /* session déjà expirée */ }
  wipeDevice();
  window.location.reload();
  return true;
}
