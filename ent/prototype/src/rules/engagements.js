// Engagements de l'élève, portés sur le bulletin : nos élèves passent les examens en candidats
// libres, sans livret scolaire ; le bulletin est donc le seul document qui les montre (Parcoursup,
// changement d'établissement). Éco-délégué : élève chargé des gestes écologiques de la classe
// (tri, économies d'eau et d'énergie, projets environnement).

export const ENGAGEMENTS = [
  { id: 'DELEGUE', masc: 'Délégué de classe', fem: 'Déléguée de classe', neutral: 'Délégué(e) de classe' },
  { id: 'SUPPLEANT', masc: 'Délégué suppléant', fem: 'Déléguée suppléante', neutral: 'Délégué(e) suppléant(e)' },
  { id: 'ECO_DELEGUE', masc: 'Éco-délégué', fem: 'Éco-déléguée', neutral: 'Éco-délégué(e)' },
  { id: 'BDE', masc: 'Membre du Bureau des élèves (BDE)', fem: 'Membre du Bureau des élèves (BDE)', neutral: 'Membre du Bureau des élèves (BDE)' },
  { id: 'BDE_PRESIDENT', masc: 'Président du Bureau des élèves (BDE)', fem: 'Présidente du Bureau des élèves (BDE)', neutral: 'Président(e) du Bureau des élèves (BDE)' },
  { id: 'TUTEUR', masc: 'Tuteur d\'un élève (aide aux devoirs)', fem: 'Tutrice d\'un élève (aide aux devoirs)', neutral: 'Tutorat d\'un élève (aide aux devoirs)' },
  { id: 'SPORT', masc: 'Membre de l\'équipe sportive de l\'établissement', fem: 'Membre de l\'équipe sportive de l\'établissement', neutral: 'Membre de l\'équipe sportive de l\'établissement' },
  { id: 'PSC1', masc: 'Formé aux premiers secours (PSC1)', fem: 'Formée aux premiers secours (PSC1)', neutral: 'Formation aux premiers secours (PSC1)' },
];

// Attestations de l'établissement (formations internes, sans valeur officielle) : sécurité routière
// sur le modèle des ASSR 1 et 2, compétences numériques sur le modèle Pix / B2i.
export const ATTESTATIONS = [
  { id: 'ASSR1', masc: 'Sécurité routière niveau 1 (programme ASSR 1)', fem: 'Sécurité routière niveau 1 (programme ASSR 1)', neutral: 'Sécurité routière niveau 1 (programme ASSR 1)' },
  { id: 'ASSR2', masc: 'Sécurité routière niveau 2 (programme ASSR 2)', fem: 'Sécurité routière niveau 2 (programme ASSR 2)', neutral: 'Sécurité routière niveau 2 (programme ASSR 2)' },
  { id: 'NUMERIQUE', masc: 'Compétences numériques (référentiel Pix / B2i)', fem: 'Compétences numériques (référentiel Pix / B2i)', neutral: 'Compétences numériques (référentiel Pix / B2i)' },
];
const ALL = [...ENGAGEMENTS, ...ATTESTATIONS];

/* Catalogue propre à l'école : la Direction ajoute ses engagements et attestations (parrainage, club, ASSR…),
 * les renomme, ou cesse de proposer ceux qui ne servent plus (sans rien effacer des bulletins passés).
 * custom = [{ id, label, kind: 'ENGAGEMENT' | 'ATTESTATION', hidden? }] ; les intégrés peuvent être masqués. */
export function catalogue(custom = []) {
  const own = custom.map((c) => ({ id: c.id, masc: c.label, fem: c.label, neutral: c.label, kind: c.kind, custom: true, hidden: !!c.hidden }));
  const hide = new Set(custom.filter((c) => c.builtin && c.hidden).map((c) => c.id));
  return [
    ...ENGAGEMENTS.map((e) => ({ ...e, kind: 'ENGAGEMENT', hidden: hide.has(e.id) })),
    ...ATTESTATIONS.map((e) => ({ ...e, kind: 'ATTESTATION', hidden: hide.has(e.id) })),
    ...own.filter((c) => !ALL.some((e) => e.id === c.id)),
  ];
}
const find = (id, custom) => catalogue(custom).find((x) => x.id === id);
const isAttestation = (id, custom) => find(id, custom)?.kind === 'ATTESTATION';

/** Nouvel engagement ou attestation : un libellé, pas de doublon. */
export function addToCatalogue(custom, { label, kind }) {
  const l = String(label ?? '').trim();
  if (l.length < 3) return { error: 'Donner un libellé (3 caractères au moins).' };
  if (catalogue(custom).some((x) => x.neutral.toLowerCase() === l.toLowerCase())) return { error: `« ${l} » existe déjà.` };
  return { custom: [...custom, { id: `X${Date.now()}-${custom.length}`, label: l, kind: kind === 'ATTESTATION' ? 'ATTESTATION' : 'ENGAGEMENT' }] };
}

/** Libellés accordés selon le sexe (« Délégué(e) » si inconnu). */
export const engagementLabels = (ids = [], sex, custom = []) => ids.filter((id) => !isAttestation(id, custom)).map((id) => {
  const e = find(id, custom);
  if (!e) return id;
  return sex === 'F' ? e.fem : sex === 'M' ? e.masc : e.neutral;
});

/** Attestations de l'établissement obtenues. */
export const attestationLabels = (ids = [], custom = []) => ids.filter((id) => isAttestation(id, custom)).map((id) => find(id, custom).neutral);

/** Saisie groupée : donne (ou retire) un engagement à une liste d'élèves d'un coup. */
export function setForStudents(byStudent, code, students, on) {
  const next = { ...byStudent };
  students.forEach((st) => {
    const cur = next[st] ?? [];
    next[st] = on ? (cur.includes(code) ? cur : [...cur, code]) : cur.filter((c) => c !== code);
  });
  return next;
}

/** Une classe a au plus 2 délégués et 2 suppléants. */
export function engagementErrors(byStudent) {
  const count = (id) => Object.values(byStudent).filter((ids) => ids.includes(id)).length;
  return [count('DELEGUE') > 2 && 'Au plus 2 délégués par classe.', count('SUPPLEANT') > 2 && 'Au plus 2 suppléants par classe.'].filter(Boolean);
}
