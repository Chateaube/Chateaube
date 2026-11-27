// Fratries de l'école (partagées avec l'équipe : Direction, secrétariat, vie scolaire). Voir rules/siblings.js.
import { readStored } from './persist.js';
import { siblingIdsOf } from './rules/siblings.js';

export const SIBLINGS_KEY = 'ent-fratries-v1';
export const loadSiblings = () => readStored(SIBLINGS_KEY) ?? [];
export const siblingsOf = (id) => siblingIdsOf(loadSiblings(), id);
