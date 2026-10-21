// Surveillance des colles : pour chaque créneau (un mercredi après-midi, un samedi matin), la CPE ou le
// secrétariat, qui alternent ou choisissent. Gardé dans ce navigateur (démonstration).
const KEY = 'ent-surveillance-colles-v1';
export const WATCHERS = { VIE_SCOLAIRE: 'CPE (M. Be)', BUREAU: 'Secrétariat (Mme Hanta)' };
export const loadWatch = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
export const saveWatch = (w) => { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* stockage indisponible */ } };
