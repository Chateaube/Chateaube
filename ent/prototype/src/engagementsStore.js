// Engagements de l'année (délégués, suppléants, BDE…) : portés sur le bulletin et source des mandats
// d'élèves (rules/mandates.js). Prototype : gardés dans ce navigateur ; en base : student_engagement.
const KEY = 'ent-engagements-v1';
export const DEMO_ENGAGEMENTS = {
  'RAKOTOARISOA Aina': ['DELEGUE', 'BDE'], 'RAZAFY Kanto': ['SUPPLEANT'], 'RAMAROSON Fitia': ['ECO_DELEGUE'],
  'RANDRIA Mamy': ['DELEGUE', 'BDE_PRESIDENT', 'NUMERIQUE'], 'RAZAFINDRATSIMA Volana': ['SUPPLEANT'], 'RABEMANANTSOA Fitia': ['PSC1'],
};
export const loadEngagements = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? DEMO_ENGAGEMENTS; } catch { return DEMO_ENGAGEMENTS; } };
export const saveEngagements = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage indisponible */ } };

// Validation par trimestre (Direction) : { T1: { at, by } }. Une fois validés, les engagements du trimestre
// sont ceux qui partent sur les bulletins ; on peut rouvrir pour corriger.
const VKEY = 'ent-engagements-valides-v1';
export const loadValidation = () => { try { return JSON.parse(localStorage.getItem(VKEY)) ?? {}; } catch { return {}; } };
export const saveValidation = (v) => { try { localStorage.setItem(VKEY, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
