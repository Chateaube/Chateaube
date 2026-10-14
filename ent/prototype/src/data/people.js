// Données de démonstration — personnel et portails (noms FICTIFS).

export const POSTES = [
  'Enseignant.e', 'Intervenant.e', 'Surveillant.e', 'Secrétaire-comptable', 'Agent d\'entretien', 'Gardien.ne', 'Chauffeur', 'Autre',
];
export const CONTRATS = ['CDI', 'CDD', 'Vacataire', 'Stagiaire'];

// Registre du personnel de Tamatave : entrées et sorties
export const STAFF = [
  { id: 'p1', name: 'RANAIVO Fara', poste: 'Enseignant.e', detail: 'Management, SGN', contrat: 'CDI', entry: '2021-09-01', exit: null, email: 'f.ranaivo@exemple.mg', access: 'PROFESSEUR' },
  { id: 'p2', name: 'RASOLO Jean', poste: 'Enseignant.e', detail: 'Histoire-Géographie', contrat: 'CDI', entry: '2021-09-01', exit: null, email: 'j.rasolo@exemple.mg', access: 'PROFESSEUR' },
  { id: 'p3', name: 'VOAHANGY Lalao', poste: 'Enseignant.e', detail: 'Physique-Chimie, SVT', contrat: 'CDD', entry: '2024-09-02', exit: '2027-07-04', email: 'l.voahangy@exemple.mg', access: 'PROFESSEUR' },
  { id: 'p4', name: 'HERY Nomena', poste: 'Enseignant.e', detail: 'Anglais', contrat: 'CDI', entry: '2022-09-01', exit: null, email: 'n.hery@exemple.mg', access: 'PROFESSEUR' },
  { id: 'p5', name: 'TOJO Andry', poste: 'Enseignant.e', detail: 'Mathématiques, Parcours Numérique', contrat: 'CDI', entry: '2023-09-01', exit: null, email: 'a.tojo@exemple.mg', access: 'PROFESSEUR' },
  { id: 'p6', name: 'FALY Rado', poste: 'Intervenant.e', detail: 'Parcours Art (musique)', contrat: 'Vacataire', entry: '2025-10-01', exit: null, email: 'r.faly@exemple.mg', access: 'PROFESSEUR' },
  { id: 'p7', name: 'SOA Miora', poste: 'Secrétaire-comptable', detail: 'Caisse et accueil', contrat: 'CDI', entry: '2021-08-16', exit: null, email: 'm.soa@exemple.mg', access: 'BUREAU' },
  { id: 'p8', name: 'BE Tahina', poste: 'Surveillant.e', detail: 'Vie scolaire', contrat: 'CDI', entry: '2022-01-10', exit: null, email: 't.be@exemple.mg', access: 'VIE_SCOLAIRE' },
  { id: 'p9', name: 'NAINA Paul', poste: 'Agent d\'entretien', detail: 'Bâtiments et salles', contrat: 'CDI', entry: '2023-03-01', exit: null, email: null, access: null },
  { id: 'p10', name: 'KOTO Jean-Marie', poste: 'Gardien.ne', detail: 'Nuit', contrat: 'CDI', entry: '2021-08-01', exit: null, email: null, access: null },
  { id: 'p11', name: 'LANTO Haja', poste: 'Surveillant.e', detail: 'Vie scolaire', contrat: 'CDD', entry: '2024-09-02', exit: '2026-07-31', exitReason: 'Fin de contrat', email: 'h.lanto@exemple.mg', access: 'VIE_SCOLAIRE' },
  { id: 'p12', name: 'RAZAKA Mialy', poste: 'Enseignant.e', detail: 'Philosophie', contrat: 'CDD', entry: '2026-11-02', exit: null, email: 'm.razaka@exemple.mg', access: 'PROFESSEUR' },
];

// Portail enseignant : Mme Ranaivo, mardi 13 octobre 2026
export const TEACHER = {
  name: 'Mme RANAIVO', subjects: 'Management · SGN', site: 'Tamatave',
  today: [
    { start: '07:00', end: '09:00', cls: '1re STMG', subject: 'Management', room: 'Salle 12', appel: 'FAIT' },
    { start: '10:00', end: '12:00', cls: 'Terminale STMG', subject: 'Management', room: 'Salle 12', appel: 'A_FAIRE', booking: 'Vidéoprojecteur Epson #1' },
    { start: '13:30', end: '15:30', cls: '1re STMG', subject: 'SGN', room: 'Salle informatique', appel: 'A_VENIR' },
  ],
  todo: [
    { label: 'Appréciations du 1er trimestre — 1re STMG', detail: '3 / 5 rédigées · conseil de classe le 10 décembre', tone: 'amber' },
    { label: 'Notes du DS n°2 — Terminale STMG', detail: 'Saisie à terminer avant le 20 octobre', tone: 'amber' },
    { label: 'Parcours Orientation — séance du 22 octobre', detail: 'Préparer la salle polyvalente', tone: 'navy' },
  ],
  news: [
    { date: '12/10', title: 'Conseils de classe du 1er trimestre', body: 'Calendrier publié : du 7 au 11 décembre.' },
    { date: '09/10', title: 'Dossiers candidats libres', body: 'Merci de signaler à la vie scolaire toute pièce manquante avant le 30 octobre.' },
  ],
};

export const CLASS_LIST = [
  'ANDRIAMBOLOLONA Mialy', 'RAHARISON Fanja', 'RAJAONARIVELO Tsiry', 'RAKOTOARISOA Aina', 'RANDRIAMAMPIANINA Hery',
  'RAZAFY Kanto', 'RAVELOJAONA Sitraka', 'RAMAROSON Fitia',
];

// Portail parent : Famille RAKOTOARISOA (fam1 dans accounting.js)
export const PARENT = {
  name: 'Mme RAKOTOARISOA', familyId: 'fam1',
  children: [
    {
      id: 'aina', name: 'Aina', cls: '1re STMG', site: 'Tamatave',
      grades: [
        { subject: 'Management', title: 'Étude de cas', date: '08/10', value: '16', avg: '12,4' },
        { subject: 'Mathématiques', title: 'DS n°1', date: '02/10', value: '14,5', avg: '11,1' },
        { subject: 'Français', title: 'Commentaire', date: '29/09', value: '13', avg: '12,0' },
        { subject: 'Anglais', title: 'Oral', date: '25/09', value: '15', avg: '13,2' },
      ],
      attendance: [{ date: 'Lun. 5 oct.', kind: 'Retard', detail: '10 min · motif : transport', justified: true }],
      timetable: [['07:00', 'Management'], ['09:45', 'Mathématiques'], ['13:30', 'SGN'], ['15:30', 'Anglais']],
      exam: 'Pré-Bac (EAF) en juin 2027 au Lycée Français de Tananarive · départ à Tana en avril',
    },
    {
      id: 'toky', name: 'Toky', cls: '5e', site: 'Tamatave',
      grades: [
        { subject: 'Mathématiques', title: 'Interrogation', date: '07/10', value: '12', avg: '11,8' },
        { subject: 'SVT', title: 'TP', date: '01/10', value: '15', avg: '13,0' },
      ],
      attendance: [],
      timetable: [['07:00', 'Français'], ['09:45', 'Histoire-Géographie'], ['13:30', 'EPS — natation']],
      exam: null,
    },
  ],
  alerts: [
    { tone: 'red', title: 'Frais de scolarité d\'octobre en attente', body: '760 000 Ar à régler (échéance du 5 octobre). Les relances reprennent en novembre.' },
    { tone: 'amber', title: 'Pièce manquante — dossier Pré-Bac d\'Aina', body: 'Photo d\'identité à déposer avant le 30 octobre.' },
  ],
  news: [
    { date: '12/10', title: 'Réunion parents-professeurs', body: 'Jeudi 22 octobre à 16h, salle polyvalente (1re et Terminale).' },
    { date: '06/10', title: 'Natation', body: 'Reprise des séances de natation pour les 6e et 5e le vendredi.' },
  ],
};
