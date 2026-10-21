// Mouvements de caisse de la journée, gardés dans ce navigateur (démonstration).
// Prélèvement de la Direction : saisi par la Cheffe ou l'adjointe elle-même → compté tout de suite ;
// saisi par l'économe (secrétariat) → en attente, la personne concernée le confirme (ou le refuse).
import { CASH_MOVEMENTS } from './data/accounting.js';

const KEY = 'ent-caisse-mouvements-v1';
export const loadMovements = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? CASH_MOVEMENTS; } catch { return CASH_MOVEMENTS; } };
export const saveMovements = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* stockage indisponible */ } };

export const WITHDRAWERS = ['Cheffe d\'établissement', 'Directrice adjointe'];
/** Statut d'un prélèvement saisi : validé si la personne qui prélève le saisit elle-même, sinon à confirmer. */
export const withdrawalStatus = ({ role, accountName, who }) => (role === 'DIRECTION' && accountName === who ? 'VALIDE' : 'A_VALIDER');
/** Mouvements qui comptent dans la caisse (pas les prélèvements en attente ni refusés). */
export const counted = (movements) => movements.filter((m) => !m.status || m.status === 'VALIDE');
/** Prélèvements en attente de confirmation par cette personne. */
export const pendingWithdrawals = (movements, who) => movements.filter((m) => m.status === 'A_VALIDER' && m.withdrawnBy === who);
