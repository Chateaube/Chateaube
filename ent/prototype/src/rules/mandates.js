// Mandats d'élèves : délégués de classe et Bureau des élèves (BDE).
// Ce ne sont pas des profils à part : un élève garde son compte et ses accès d'élève (ses notes, son
// agenda…) ; son mandat, tiré de ses engagements de l'année (DELEGUE, SUPPLEANT, BDE, BDE_PRESIDENT),
// lui ajoute quelques capacités précises, limitées à sa classe (délégué) ou à son site (BDE).
// Le mandat prend fin avec l'inscription de l'année. Il ne donne JAMAIS accès aux données des autres.

export const MANDATES = {
  DELEGUE: { label: 'Délégué(e) de classe', from: ['DELEGUE', 'SUPPLEANT'], scope: 'CLASS',
    capabilities: ['ANNONCE_CLASSE', 'LIAISON_CONSEIL'] }, // la CPE : par la messagerie, comme tout élève
  BDE: { label: 'Bureau des élèves (BDE)', from: ['BDE', 'BDE_PRESIDENT'], scope: 'SITE',
    capabilities: ['ANNONCE_ELEVES', 'EVENEMENT', 'VIE_ECOLE'] },
};

/** Ce qu'aucun mandat d'élève ne peut ouvrir, quel que soit le mandat (liste vérifiée par les tests). */
export const NEVER = ['NOTES_AUTRES_ELEVES', 'APPRECIATIONS', 'VIE_SCOLAIRE_AUTRES', 'FICHES_ELEVES', 'CAISSE', 'PARAMETRES', 'PUBLIER', 'VALIDER'];

/** Mandats d'un élève d'après ses engagements de l'année. */
export function mandatesOf(engagements = [], { cls, site = 'TMV' } = {}) {
  return Object.entries(MANDATES).filter(([, m]) => m.from.some((c) => engagements.includes(c)))
    .map(([kind, m]) => ({ kind, label: m.label, cls, site, president: kind === 'BDE' && engagements.includes('BDE_PRESIDENT') }));
}

/** L'élève (avec ses mandats) a-t-il cette capacité ? */
export function can(student, capability) {
  if (NEVER.includes(capability)) return false;
  return (student.mandates ?? []).some((m) => MANDATES[m.kind].capabilities.includes(capability));
}

/** Rôle d'auteur dans le circuit de publication : « DELEGUE » ou « BDE ». */
export const authorRole = (kind) => kind;
export const serviceLabel = (m) => (m.kind === 'DELEGUE' ? `Délégués de ${m.cls}` : 'Bureau des élèves (BDE)');

/**
 * Destinataires permis : un délégué écrit aux élèves de SA classe ; le BDE aux élèves de son site (toute
 * l'école, un cycle ou des niveaux). Ni parents, ni professeurs, ni personnel : la Direction peut élargir
 * en validant.
 */
export function audienceErrors(m, audience) {
  const e = [];
  if (audience.roles.some((r) => r !== 'ELEVE')) e.push('Un mandat d\'élève s\'adresse aux élèves seulement.');
  if (m.kind === 'DELEGUE' && (audience.scope !== 'CLASS' || audience.values.length !== 1 || audience.values[0] !== m.cls)) e.push(`Un délégué écrit seulement à sa classe (${m.cls}).`);
  if (m.kind === 'BDE' && audience.site !== m.site) e.push('Le BDE écrit aux élèves de son site.');
  return e;
}

/** Au plus deux délégués titulaires et deux suppléants par classe (comme en base). */
export function classMandateErrors(byStudent) {
  const count = (code) => Object.values(byStudent).filter((ids) => ids.includes(code)).length;
  return [count('DELEGUE') > 2 && 'Au plus 2 délégués par classe.', count('SUPPLEANT') > 2 && 'Au plus 2 suppléants par classe.', count('BDE_PRESIDENT') > 1 && 'Un seul président du BDE.'].filter(Boolean);
}
