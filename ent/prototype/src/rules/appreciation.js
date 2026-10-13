// Contrôleur de règles de rédaction des appréciations de bulletin.
// Il sert de garde-fou DÉTERMINISTE autour de l'assistant IA : toute proposition
// générée est re-vérifiée ici, et une appréciation ne peut être validée qu'avec
// zéro erreur (contrainte reprise en base : report_comment.rule_check).

const MIN_SENTENCES = 2;
const MIN_WORDS_PER_SENTENCE = 3;
const MAX_LENGTH = 450; // place disponible dans la case du bulletin

// Frontières de mots Unicode : en JS, \b ignore les lettres accentuées
// (« exprimées » contiendrait sinon le mot « es »).
const B = '(?<![\\p{L}\\p{N}_])';
const E = '(?![\\p{L}\\p{N}_])';
const w = (src, flags = 'giu') => new RegExp(src.replaceAll('⟨', B).replaceAll('⟩', E), flags);

// --- Tutoiement --------------------------------------------------------------
const TUTOIEMENT = [
  { re: w('⟨tu⟩'), hint: 'Remplacer « tu » par le prénom ou « il / elle ».' },
  { re: w('⟨toi⟩'), hint: 'Supprimer « toi » (adresse directe à l\'élève).' },
  { re: w("⟨t['’]\\s?\\p{L}+"), hint: 'Forme élidée de « tu / te » à reformuler.' },
  { re: w('⟨(?:te|tes|ta)⟩'), hint: 'Déterminant/pronom de 2e personne : utiliser « son / sa / ses ».' },
  // « ton » est aussi un nom (« le ton de ses écrits ») : on exclut ces cas
  { re: w('(?<!⟨(?:le|un|du|au|ce|son|bon|même)\\s)⟨ton⟩'), hint: 'Remplacer « ton » par « son ».' },
  { re: w('⟨es⟩'), hint: '« es » correspond à « tu es » : écrire « est ».' },
];
// Impératifs de 2e personne en début de phrase (souvent involontaires)
const IMPERATIVES = w('(?:^|[.!?]\\s+)(Continue|Persévère|Ne lâche|Accroche|Reprends|Concentre)⟩', 'gu');

// --- Formules décourageantes ------------------------------------------------
const DISCOURAGING_ERRORS = [
  { re: w('⟨(?:devra|doit|devrait|aura à|a à)\\s+faire\\s+ses\\s+preuves⟩'), alt: 'Les progrès engagés sont à poursuivre avec régularité.' },
  { re: w('⟨faire\\s+ses\\s+preuves⟩'), alt: 'Préciser l\'objectif concret attendu.' },
  { re: w('⟨aucun(?:e)?\\s+(?:effort|travail|investissement)⟩'), alt: 'Un investissement plus régulier permettra de progresser.' },
  { re: w('⟨ne\\s+fait\\s+rien⟩'), alt: 'Le travail personnel doit gagner en régularité.' },
  { re: w('⟨(?:médiocre|nul(?:le)?|catastrophique|désastreu(?:x|se)|lamentable|irrécupérable|inadmissible)⟩'), alt: 'Décrire factuellement la difficulté et la piste de progrès.' },
  { re: w('⟨(?:paresseu(?:x|se)|fainéant(?:e)?)⟩'), alt: 'Parler du travail (« le travail personnel manque de régularité »), pas de la personne.' },
  { re: w('⟨(?:sans espoir|peine perdue|ne sert à rien)⟩'), alt: 'Formuler une perspective de progrès.' },
];
const DISCOURAGING_WARNINGS = [
  { re: w('⟨peut\\s+mieux\\s+faire⟩'), alt: 'Indiquer précisément ce qui permettra de progresser.' },
  { re: w('⟨décevant(?:e|s|es)?⟩'), alt: 'Préférer un constat factuel suivi d\'un conseil.' },
  { re: w('⟨doit\\s+se\\s+ressaisir⟩'), alt: 'Proposer une action concrète (méthode, régularité, participation).' },
];

// --- Formulation inclusive officielle des décisions -------------------------
// Admis / Admise / Admis(e) / Admis·e … en classe de → « Admis.e en classe de »
const DECISION = w('⟨(Admis|Retenu|Réorienté|Maintenu)(\\(e\\)|·e|-e|e|\\.e)?(?=\\s+en\\s+classe⟩)');

function sentences(text) {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isCompleteSentence(s) {
  const words = s.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  return /^[\p{Lu}«"]/u.test(s) && /[.!?…]$/u.test(s) && words.length >= MIN_WORDS_PER_SENTENCE;
}

function collect(text, re, build) {
  const out = [];
  for (const m of text.matchAll(re)) out.push(build(m));
  return out;
}

/**
 * @param {string} text
 * @param {{mode?: 'NUMERIQUE'|'APPRECIATION_SEULE'}} [ctx]
 * @returns {{ok: boolean, errors: Issue[], warnings: Issue[], checks: Check[], stats: {sentences: number, complete: number, length: number}}}
 * Issue = {rule, message, excerpt?, index?, fix?}
 */
export function checkAppreciation(text, ctx = {}) {
  const body = String(text ?? '').trim();
  const errors = [];
  const warnings = [];

  // R1 — au moins deux phrases complètes
  const all = sentences(body);
  const complete = all.filter(isCompleteSentence).length;
  if (complete < MIN_SENTENCES) {
    errors.push({
      rule: 'MIN_SENTENCES',
      message: `Au moins ${MIN_SENTENCES} phrases complètes sont requises (${complete} détectée${complete > 1 ? 's' : ''}).`,
    });
  }

  // R2 — pas de tutoiement
  for (const { re, hint } of TUTOIEMENT) {
    errors.push(...collect(body, re, (m) => ({
      rule: 'TUTOIEMENT', message: `Tutoiement interdit : « ${m[0]} ». ${hint}`, excerpt: m[0], index: m.index,
    })));
  }
  warnings.push(...collect(body, IMPERATIVES, (m) => ({
    rule: 'TUTOIEMENT', message: `« ${m[1]} » en début de phrase ressemble à un impératif de 2e personne : préférer « Il faut… » ou « Que [prénom]… ».`, excerpt: m[1],
  })));

  // R3 — formules décourageantes
  // les motifs se recouvrent (« devra faire ses preuves » ⊃ « faire ses preuves ») :
  // on ne signale pas deux fois le même passage
  const covered = [];
  for (const { re, alt } of DISCOURAGING_ERRORS) {
    for (const m of body.matchAll(re)) {
      const [start, end] = [m.index, m.index + m[0].length];
      if (covered.some(([s, e]) => start < e && s < end)) continue;
      covered.push([start, end]);
      errors.push({ rule: 'DECOURAGEANT', message: `Formule décourageante : « ${m[0]} ». ${alt}`, excerpt: m[0], index: m.index });
    }
  }
  for (const { re, alt } of DISCOURAGING_WARNINGS) {
    warnings.push(...collect(body, re, (m) => ({
      rule: 'DECOURAGEANT', message: `Formule à éviter : « ${m[0]} ». ${alt}`, excerpt: m[0],
    })));
  }

  // R4 — décision au format inclusif officiel
  errors.push(...collect(body, DECISION, (m) => m).filter((m) => (m[2] ?? '') !== '.e').map((m) => ({
    rule: 'INCLUSIF',
    message: `Formulation officielle requise : « ${m[1]}.e en classe de… » au lieu de « ${m[0]} ».`,
    excerpt: m[0], index: m.index, fix: `${m[1]}.e`,
  })));

  // R5 — longueur (avertissement)
  if (body.length > MAX_LENGTH) {
    warnings.push({ rule: 'LONGUEUR', message: `Texte long (${body.length} car.) : la case du bulletin en affiche environ ${MAX_LENGTH}.` });
  }

  // R6 — parcours d'ouverture : pas de note chiffrée dans l'appréciation
  if (ctx.mode === 'APPRECIATION_SEULE' && /\d{1,2}(?:[.,]\d+)?\s*\/\s*20(?!\d)/.test(body)) {
    errors.push({ rule: 'SANS_NOTE', message: 'Le Parcours d\'ouverture est évalué sans note chiffrée : retirer la note /20.' });
  }

  const has = (rule) => errors.some((e) => e.rule === rule);
  const checks = [
    { rule: 'MIN_SENTENCES', label: 'Au moins deux phrases complètes', ok: !has('MIN_SENTENCES') },
    { rule: 'TUTOIEMENT', label: 'Aucun tutoiement', ok: !has('TUTOIEMENT') },
    { rule: 'DECOURAGEANT', label: 'Aucune formule décourageante', ok: !has('DECOURAGEANT') },
    { rule: 'INCLUSIF', label: 'Décision au format « Admis.e / Retenu.e »', ok: !has('INCLUSIF') },
  ];
  if (ctx.mode === 'APPRECIATION_SEULE') checks.push({ rule: 'SANS_NOTE', label: 'Aucune note chiffrée (Parcours)', ok: !has('SANS_NOTE') });

  return { ok: errors.length === 0, errors, warnings, checks, stats: { sentences: all.length, complete, length: body.length } };
}

/** Corrections sûres et automatiques (sans changer le sens) */
export function autoFix(text) {
  let out = String(text ?? '')
    .replace(DECISION, (_m, base) => `${base}.e`)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
  if (out && !/[.!?…]$/u.test(out)) out += '.';
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function decisionText(decision, levelLabel) {
  const base = { ADMIS: 'Admis.e', RETENU: 'Retenu.e', REORIENTE: 'Réorienté.e' }[decision];
  return base ? `${base} en classe de ${levelLabel}` : '';
}
