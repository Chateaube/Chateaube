// Démo — Terminales de Tamatave : procédure d'accès au supérieur (noms et données FICTIFS).
export const TLE_STUDENTS = [
  { lastName: 'ANDRIANARIVO', firstName: 'Tojo', cls: 'Terminale STMG', birthDate: '2008-02-11', nationalities: ['MG'], email: 'tojo.a@exemple.mg', account: true, wishes: 0, docs: false },
  { lastName: 'RABEMANANJARA', firstName: 'Lina', cls: 'Terminale STMG', birthDate: '2008-07-23', nationalities: ['MG', 'FR'], email: 'lina.r@exemple.mg', account: true, wishes: 0, docs: false },
  { lastName: 'RAKOTONDRABE', firstName: 'Fanilo', cls: 'Terminale STMG', birthDate: '2008-05-02', nationalities: ['MG'], email: 'fanilo.r@exemple.mg', account: false, wishes: 0, docs: false },
  { lastName: 'RAMANANTSOA', firstName: 'Nathan', cls: 'Terminale STMG', birthDate: '2008-09-15', nationalities: ['FR'], email: 'nathan.r@exemple.mg', account: false, wishes: 0, docs: false },
  { lastName: 'RANDRIANASOLO', firstName: 'Ony', cls: 'Terminale STMG', birthDate: '2008-01-30', nationalities: ['MG'], email: 'ony.r@exemple.mg', account: true, wishes: 0, docs: true },
  { lastName: 'RAZANAMPARANY', firstName: 'Sarobidy', cls: 'Terminale STMG', birthDate: '2008-12-04', nationalities: ['MG'], email: 'sarobidy.r@exemple.mg', account: false, wishes: 0, docs: false },
  { lastName: 'RANDRIA', firstName: 'Mamy', cls: 'Terminale Générale', birthDate: '2008-04-02', nationalities: ['MG'], email: 'mamy.r@exemple.mg', account: true, wishes: 0, docs: true },
  { lastName: 'RAKOTOVAO', firstName: 'Andry', cls: 'Terminale Générale', birthDate: '2008-06-19', nationalities: ['FR', 'MG'], email: 'andry.r@exemple.mg', account: false, wishes: 0, docs: false },
  { lastName: 'RAZAFINDRATSIMA', firstName: 'Volana', cls: 'Terminale Générale', birthDate: '2008-03-08', nationalities: ['BE'], email: 'volana.r@exemple.mg', account: false, wishes: 0, docs: false },
];

// Étapes indicatives (dates exactes publiées chaque année par Parcoursup et Campus France)
export const STEPS = {
  PARCOURSUP: [
    ['Novembre – décembre', 'Information, découverte des formations, semaine de l\'orientation'],
    ['Janvier', 'Ouverture de la plateforme : création du compte'],
    ['Janvier – mars', 'Formulation des vœux (jusqu\'à 10), puis date limite'],
    ['Début avril', 'Dossier complété et vœux confirmés'],
    ['Juin – juillet', 'Phase d\'admission : réponses aux propositions'],
  ],
  CAMPUS_FRANCE: [
    ['Octobre – décembre', 'Création du compte Études en France, choix des formations'],
    ['Décembre – janvier', 'Dépôt du dossier (bulletins, diplômes, test de français si demandé)'],
    ['Janvier – mars', 'Entretien pédagogique à Campus France Madagascar'],
    ['Avril – mai', 'Réponses des établissements, choix définitif'],
    ['Juillet – août', 'Liste des Terminales envoyée après le Bac, puis demande de visa (clôture début septembre)'],
  ],
};
export const EXPORT_WINDOW = { opensOn: '2027-07-05', closesOn: '2027-09-05' };
