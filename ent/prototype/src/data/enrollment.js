// Données de démonstration — pré-inscriptions et fiches élèves de Tamatave (noms FICTIFS).

export const PREREGISTRATIONS = [
  { id: 'p1', child: 'RANDRIANARISOA Mahery', birthDate: '2014-03-11', cls: '6e', receivedOn: '2026-09-28', previousSchool: 'École primaire Les Hibiscus', contact: 'Mme Randrianarisoa Lalao', phone: '+261 34 22 145 80', email: 'lalao.randria@gmail.com', status: 'DEMANDE', source: 'Bouche-à-oreille' },
  { id: 'p2', child: 'RAZANAMPARANY Kanto', birthDate: '2011-07-02', cls: '3e', receivedOn: '2026-09-22', previousSchool: 'Collège Saint-Joseph', contact: 'M. Razanamparany Haja', phone: '+261 32 40 118 07', email: '', status: 'DOSSIER', source: 'Site internet' },
  { id: 'p3', child: 'ANDRIAMANALINA Sarobidy', birthDate: '2010-01-19', cls: '2de', receivedOn: '2026-09-15', previousSchool: 'Lycée Jules Ferry (Tana)', contact: 'Mme Andriamanalina Tiana', phone: '+261 34 05 771 20', email: 'tiana.andria@gmail.com', status: 'ENTRETIEN', source: 'Fratrie déjà scolarisée', interview: 'Jeudi 15 octobre, 10h — Direction' },
  { id: 'p4', child: 'RASOLOFO Nirina', birthDate: '2013-11-30', cls: '5e', receivedOn: '2026-09-10', previousSchool: 'Collège Le Flamboyant', contact: 'M. Rasolofo Fidy', phone: '+261 33 12 650 41', email: 'fidy.rasolofo@gmail.com', status: 'ACCEPTEE', source: 'Journée portes ouvertes' },
  { id: 'p5', child: 'RAKOTONDRAZAKA Ny Aina', birthDate: '2012-05-08', cls: '4e', receivedOn: '2026-09-05', previousSchool: 'EPP Tanambao', contact: 'Mme Rakotondrazaka Hanta', phone: '+261 34 77 012 90', email: '', status: 'ATTENTE', source: 'Bouche-à-oreille', note: 'Classe de 4e complète : place dès qu\'un départ est confirmé' },
];

// Fiches élèves existantes (réinscription 2027-2028 : la fiche est reprise et mise à jour)
export const STUDENT_PROFILES = [
  {
    id: 'f1', lastName: 'RAKOTOARISOA', firstName: 'Aina', sex: 'F', birthDate: '2010-02-14', birthPlace: 'Toamasina', nationalities: ['MG'],
    cls: '1re STMG', lv1: 'Anglais', lv2: 'Espagnol', enteredOn: '2019-09-02', previousSchool: 'École primaire Les Hibiscus',
    guardians: [
      { name: 'Mme Rakotoarisoa Hanta', relation: 'Mère', phone: '+261 34 11 223 12', email: 'hanta.rakotoarisoa@gmail.com', whatsapp: true, payer: true, pickup: true },
      { name: 'M. Rakotoarisoa Jean', relation: 'Père', phone: '+261 32 07 456 78', email: '', whatsapp: true, payer: false, pickup: true },
    ],
    health: { allergies: 'Aucune', emergency: 'Mme Rakotoarisoa Hanta — +261 34 11 223 12' },
    authorizations: { image: true, exit: 'Fin de journée uniquement' },
    documents: ['ACTE', 'PHOTOS', 'BULLETINS', 'VACCINS'],
  },
  {
    id: 'f2', lastName: 'RAKOTOARISOA', firstName: 'Toky', sex: 'M', birthDate: '2014-06-03', birthPlace: 'Toamasina', nationalities: ['MG'],
    cls: '5e', lv1: 'Anglais', lv2: 'Espagnol', enteredOn: '2023-09-04', previousSchool: 'École primaire Les Hibiscus',
    guardians: [
      { name: 'Mme Rakotoarisoa Hanta', relation: 'Mère', phone: '+261 34 11 223 12', email: 'hanta.rakotoarisoa@gmail.com', whatsapp: true, payer: true, pickup: true },
    ],
    health: { allergies: 'Arachides', emergency: 'Mme Rakotoarisoa Hanta — +261 34 11 223 12' },
    authorizations: { image: true, exit: 'Aucune sortie sans un responsable' },
    documents: ['ACTE', 'PHOTOS', 'BULLETINS'],
  },
  {
    id: 'f3', lastName: 'RANDRIA', firstName: 'Mamy', sex: 'M', birthDate: '2008-09-21', birthPlace: 'Antananarivo', nationalities: ['MG', 'FR'],
    cls: 'Terminale Générale', lv1: 'Anglais', lv2: 'Espagnol', enteredOn: '2021-09-06', previousSchool: 'Collège Saint-Joseph',
    guardians: [
      { name: 'M. Randria Feno', relation: 'Père', phone: '+261 32 44 900 48', email: 'feno.randria@gmail.com', whatsapp: false, payer: true, pickup: true },
    ],
    health: { allergies: 'Aucune', emergency: 'M. Randria Feno — +261 32 44 900 48' },
    authorizations: { image: false, exit: 'Sortie libre aux heures sans cours' },
    documents: ['ACTE', 'PHOTOS', 'BULLETINS', 'VACCINS'],
  },
];

export const ENROLL_CLASSES = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];
// LV1 Anglais et LV2 Espagnol pour tous les élèves
export const LANGUAGES = { lv1: ['Anglais'], lv2: ['Espagnol'] };
export const RELATIONS = ['Mère', 'Père', 'Tuteur / tutrice', 'Grand-parent', 'Autre'];
export const NATIONALITIES = [['MG', 'Malgache'], ['FR', 'Française'], ['KM', 'Comorienne'], ['MU', 'Mauricienne'], ['CN', 'Chinoise'], ['IN', 'Indienne'], ['XX', 'Autre']];
