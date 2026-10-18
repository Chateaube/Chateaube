// Propositions des élèves mandatés : événements du BDE (circuit de validation de la Direction) et
// remontées des délégués pour le conseil de classe (lues par la Direction et la CPE, jamais publiées).
const EV = 'ent-evenements-proposes-v1';
const FB = 'ent-remontees-conseil-v1';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
const DEMO_EVENTS = [
  { id: 'ev1', kind: 'EVENEMENT', title: 'Tournoi de basket inter-classes', text: 'Pendant la pause de midi, inscriptions auprès du BDE.', date: '2026-11-13', start: '12:00', end: '13:30', place: 'Terrain de sport',
    authorRole: 'BDE', authorName: 'RANDRIA Mamy', service: 'Bureau des élèves (BDE)', status: 'EN_ATTENTE', createdAt: '2026-10-12T17:00',
    history: [{ at: '2026-10-12T17:00', by: 'RANDRIA Mamy', role: 'BDE', action: 'CREEE' }, { at: '2026-10-12T17:01', by: 'RANDRIA Mamy', role: 'BDE', action: 'ENVOYEE' }] },
];
export const loadEventProposals = () => read(EV, DEMO_EVENTS);
export function saveEventProposal(e) { const l = loadEventProposals(); write(EV, l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [e, ...l]); }
export const loadCouncilFeedback = () => read(FB, []);
export function addCouncilFeedback(f) { write(FB, [{ ...f, id: `r${Date.now()}` }, ...loadCouncilFeedback()]); }
