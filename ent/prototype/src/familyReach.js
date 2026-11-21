// Ce que l'on peut dire honnêtement aux familles après une saisie (absence, punition, colle, objet confisqué…).
// Démonstration : le portail des parents existe, ils sont prévenus dans l'application. Version en ligne : le
// portail des parents ouvre le 17 décembre et l'ENT n'envoie ni e-mail ni SMS : l'équipe le voit, les familles
// le verront à l'ouverture de leur portail (prévenir par téléphone si c'est urgent).
import { ONLINE } from './online/client.js';

export const PARENTS_OPEN = '17 décembre';
/** « les parents sont prévenus dans l'application » ou, en ligne, ce qui se passe vraiment. */
export const familiesTold = () => (ONLINE
  ? `la vie scolaire et la Direction le voient ; les parents le verront dans leur portail dès son ouverture (${PARENTS_OPEN}) — appelez-les si c'est urgent`
  : 'les parents sont prévenus dans l\'application');
