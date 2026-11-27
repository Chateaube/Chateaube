// Carnets lus par les bulletins, les conseils, Notes reçues… : seulement le trimestre des bulletins
// (évaluations datées dans ce trimestre ; appréciations et compétences de ce trimestre). Site d'essai d'abord.
import { NOUVEAU } from './essai.js';
import { carnetForTerm } from './rules/terms.js';
import { TERM } from './data/grades.js';

export const termCarnet = (value) => (NOUVEAU ? carnetForTerm(value, TERM.id) : value);
/** Documents CARNET du serveur ({ owner, value, … }) vus pour le trimestre des bulletins. */
export const termCarnets = (docs) => (docs ?? []).map((d) => ({ ...d, value: termCarnet(d.value) }));
