// Démo — Terminales de Tamatave : procédure d'accès au supérieur (noms et données FICTIFS).
export const TLE_STUDENTS = [
  { lastName: 'ANDRIANARIVO', firstName: 'Tojo', cls: 'Terminale STMG', birthDate: '2008-02-11', nationalities: ['MG'], email: 'tojo.a@exemple.mg', parcoursup: { account: true, confirmed: false }, campus: { file: false }, tls: { appointment: false } },
  { lastName: 'RABEMANANJARA', firstName: 'Lina', cls: 'Terminale STMG', birthDate: '2008-07-23', nationalities: ['MG', 'FR'], email: 'lina.r@exemple.mg', parcoursup: { account: true, confirmed: false }, campus: { file: false }, tls: { appointment: false } },
  { lastName: 'RAKOTONDRABE', firstName: 'Fanilo', cls: 'Terminale STMG', birthDate: '2008-05-02', nationalities: ['MG'], email: 'fanilo.r@exemple.mg', parcoursup: { account: false, confirmed: false }, campus: { file: false }, tls: { appointment: false } },
  { lastName: 'RAMANANTSOA', firstName: 'Nathan', cls: 'Terminale STMG', birthDate: '2008-09-15', nationalities: ['FR'], email: 'nathan.r@exemple.mg', parcoursup: { account: false, confirmed: false }, campus: { file: false }, tls: { appointment: false } },
  { lastName: 'RANDRIANASOLO', firstName: 'Ony', cls: 'Terminale STMG', birthDate: '2008-01-30', nationalities: ['MG'], email: 'ony.r@exemple.mg', parcoursup: { account: true, confirmed: false }, campus: { file: true }, tls: { appointment: false } },
  { lastName: 'RAZANAMPARANY', firstName: 'Sarobidy', cls: 'Terminale STMG', birthDate: '2008-12-04', nationalities: ['MG'], email: 'sarobidy.r@exemple.mg', parcoursup: { account: false, confirmed: false }, campus: { file: false }, tls: { appointment: false } },
  { lastName: 'RANDRIA', firstName: 'Mamy', cls: 'Terminale Générale', birthDate: '2008-04-02', nationalities: ['MG'], email: 'mamy.r@exemple.mg', parcoursup: { account: true, confirmed: false }, campus: { file: true }, tls: { appointment: false } },
  { lastName: 'RAKOTOVAO', firstName: 'Andry', cls: 'Terminale Générale', birthDate: '2008-06-19', nationalities: ['FR', 'MG'], email: 'andry.r@exemple.mg', parcoursup: { account: false, confirmed: false }, campus: { file: false }, tls: { appointment: false } },
  { lastName: 'RAZAFINDRATSIMA', firstName: 'Volana', cls: 'Terminale Générale', birthDate: '2008-03-08', nationalities: ['BE'], email: 'volana.r@exemple.mg', parcoursup: { account: false, confirmed: false }, campus: { file: false }, tls: { appointment: false } },
];

// Étapes indicatives (dates exactes publiées chaque année). Parcoursup : tous les élèves ;
// Campus France puis TLScontact : élèves ayant besoin d'un visa (nationalité hors UE / EEE / Suisse).
export const STEPS = {
  PARCOURSUP: [
    ['Novembre – décembre', 'Information, découverte des formations'],
    ['Janvier', 'Ouverture de la plateforme : création du compte'],
    ['Janvier – mars', 'Formulation des vœux, puis date limite'],
    ['Début avril', 'Dossier complété et vœux confirmés (pas de fiche Avenir : candidats libres)'],
    ['Juin – juillet', 'Phase d\'admission : réponses aux propositions'],
  ],
  CAMPUS_FRANCE: [
    ['Après Parcoursup', 'Compte Études en France, dossier (bulletins, diplômes)'],
    ['Printemps', 'Entretien à Campus France Madagascar'],
    ['Juillet – août', 'Liste des Terminales transmise après le Bac (clôture début septembre)'],
  ],
  TLS: [
    ['Après l\'admission', 'Rendez-vous TLScontact pour la demande de visa étudiant'],
    ['Juillet – août', 'Dépôt du dossier de visa, puis retrait du passeport'],
  ],
};
export const EXPORT_WINDOW = { opensOn: '2027-07-05', closesOn: '2027-09-05' };
