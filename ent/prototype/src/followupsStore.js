// Suivis individuels (Direction, CPE), gardés dans ce navigateur pour la démonstration ; en base : student_followup.
const KEY = 'ent-suivis-v1';
export const DEMO_FOLLOWUPS = [
  { id: 's1', student: 'RAJAONARIVELO Tsiry', kind: 'DOSSIER', referent: 'M. Be (CPE)', since: '2026-09-07', every: 'SEMAINE', conditions: { maxUnjustified: 2, maxLates: 3, minAverage: 10, maxMeasures: 2 }, contact: null, notes: [{ at: '2026-10-05', by: 'M. Be (CPE)', text: 'Entretien avec la mère : point chaque vendredi.' }], closed: null },
  { id: 's2', student: 'RAZAFY Kanto', kind: 'CONTRAT', referent: 'Direction — Directrice adjointe', since: '2026-09-15', every: 'MOIS', conditions: { maxUnjustified: 0, maxLates: 2, minAverage: 12, maxMeasures: 0 }, contact: { name: 'M. Rabe', role: 'Président du club de basket de Tamatave', phone: '+261 34 00 000 00', email: 'club.basket@exemple.mg', parentConsent: true }, notes: [{ at: '2026-09-15', by: 'Direction', text: 'Financement du club pour la saison, à condition d\'être assidu et d\'avoir au moins 12.' }], closed: null },
  { id: 's3', student: 'RAMAROSON Fitia', kind: 'PARENTS', referent: 'M. Be (CPE)', since: '2026-10-01', every: 'SEMAINE', conditions: { maxLates: 1 }, contact: null, notes: [{ at: '2026-10-01', by: 'M. Be (CPE)', text: 'Les parents souhaitent un point sur les retards chaque semaine.' }], closed: null },
];
export const loadFollowUps = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? DEMO_FOLLOWUPS; } catch { return DEMO_FOLLOWUPS; } };
export const saveFollowUps = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* stockage indisponible */ } };
