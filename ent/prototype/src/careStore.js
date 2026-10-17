// Passages au secrétariat et inventaire du matériel (prototype : gardés dans ce navigateur).
import { INVENTORY, CARE_VISITS } from './data/inventory.js';

const VISITS_KEY = 'ent-passages-v1';
const INV_KEY = 'ent-inventaire-v1';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const loadVisits = () => read(VISITS_KEY, CARE_VISITS);
export const saveVisits = (v) => write(VISITS_KEY, v);
export const loadInventory = () => read(INV_KEY, INVENTORY);
export const saveInventory = (v) => write(INV_KEY, v);
