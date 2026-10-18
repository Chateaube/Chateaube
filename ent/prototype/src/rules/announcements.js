// Annonces de la Direction, du secrétariat et de la vie scolaire (publiées par la Direction seule, voir
// rules/publication.js ; les professeurs n'en rédigent pas) :
// à qui (parents, élèves, professeurs, personnel), où (Tamatave, Tana, les deux), et quelle partie
// de l'école (toute l'école, un cycle, des niveaux, des classes). Application et e-mail ; pas de SMS.

export const ROLES = { PARENT: 'Parents', ELEVE: 'Élèves', PROFESSEUR: 'Professeurs', PERSONNEL: 'Personnel' };
export const SCOPES = { ALL: 'Toute l\'école', CYCLE: 'Un cycle', LEVEL: 'Des niveaux', CLASS: 'Des classes' };
export const CYCLES = { COLLEGE: 'Collège', LYCEE: 'Lycée' };
export const LEVELS = ['6e', '5e', '4e', '3e', '2de', '1re', 'Terminale'];

/** Niveau et cycle d'une classe (« 1re STMG » → 1re, lycée). */
export function levelOf(cls) {
  const head = cls.split(' ')[0];
  return LEVELS.includes(head) ? head : null;
}
export const cycleOf = (cls) => (['6e', '5e', '4e', '3e'].includes(levelOf(cls)) ? 'COLLEGE' : 'LYCEE');

/** La classe fait-elle partie de la portée choisie ? */
export function classInScope(cls, { scope, values = [] }) {
  if (scope === 'ALL') return true;
  if (scope === 'CYCLE') return values.includes(cycleOf(cls));
  if (scope === 'LEVEL') return values.includes(levelOf(cls));
  return values.includes(cls);
}

/**
 * Une personne reçoit-elle l'annonce ? person = { role, site, classes: [...] } (classe de l'enfant pour
 * un parent ou un élève, classes enseignées pour un professeur). Le personnel ne reçoit que les annonces
 * à toute l'école.
 */
export function receives(a, person) {
  if ((a.status ?? 'PUBLIEE') !== 'PUBLIEE') return false; // brouillons et attentes : jamais diffusés
  const au = a.audience;
  if (!au.roles.includes(person.role)) return false;
  if (au.site !== 'ALL' && au.site !== person.site) return false;
  if (au.scope === 'ALL') return true;
  if (person.role === 'PERSONNEL') return false;
  return (person.classes ?? []).some((c) => classInScope(c, au));
}

/** Nombre de destinataires, à partir des effectifs par site. */
export function recipientCount(audience, population) {
  const out = { students: 0, families: 0, teachers: 0, staff: 0 };
  Object.entries(population).forEach(([site, pop]) => {
    if (audience.site !== 'ALL' && audience.site !== site) return;
    const n = Object.entries(pop.classes).filter(([c]) => classInScope(c, audience)).reduce((s, [, v]) => s + v, 0);
    if (audience.roles.includes('ELEVE')) out.students += n;
    if (audience.roles.includes('PARENT')) out.families += n;
    if (audience.roles.includes('PROFESSEUR')) {
      if (audience.scope === 'ALL') out.teachers += pop.teachers.all;
      else {
        const per = Object.entries(pop.teachers.byClass).filter(([c]) => classInScope(c, audience)).map(([, v]) => v);
        out.teachers += per.length ? Math.min(pop.teachers.all, Math.max(...per) + per.length - 1) : 0;
      }
    }
    if (audience.roles.includes('PERSONNEL') && audience.scope === 'ALL') out.staff += pop.staff;
  });
  return out;
}

/** « Parents · Tamatave · Terminale STMG, Terminale Générale » */
export function audienceLabel(au, sites) {
  const who = au.roles.length === Object.keys(ROLES).length ? 'Tout le monde' : au.roles.map((r) => ROLES[r]).join(', ');
  const where = au.site === 'ALL' ? 'Tamatave et Tana' : sites[au.site];
  const what = au.scope === 'ALL' ? 'toute l\'école'
    : au.scope === 'CYCLE' ? au.values.map((v) => CYCLES[v]).join(', ')
      : au.scope === 'LEVEL' ? `niveau${au.values.length > 1 ? 'x' : ''} ${au.values.join(', ')}`
        : au.values.join(', ');
  return `${who} · ${where} · ${what}`;
}

/** Erreurs avant envoi ou publication ; un professeur n'écrit pas d'annonce. */
export function announcementErrors(a, { role } = {}) {
  if (role === 'ENSEIGNANT') return ['Les annonces sont rédigées par la Direction, le secrétariat ou la CPE.'];
  const e = [];
  if (!a.title?.trim()) e.push('Titre obligatoire.');
  if (!a.text?.trim() && !a.photos?.length) e.push('Texte ou photo obligatoire.');
  if (!a.audience.roles.length) e.push('Choisir au moins un destinataire.');
  if (a.audience.scope !== 'ALL' && !a.audience.values.length) e.push('Choisir au moins une classe, un niveau ou un cycle.');
  return e;
}

/** Texte prêt à coller dans un groupe WhatsApp. */
export const whatsappText = (a) => `*${a.title}*\n\n${a.text}\n\n— ${a.author}, École Collège Lycée Chateaubriand`;
