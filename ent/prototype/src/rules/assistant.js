// Assistant de rédaction des appréciations.
//
// En production : appel à un LLM côté serveur (jamais depuis le navigateur),
// avec un prompt système qui énonce les règles de l'établissement, puis passage
// OBLIGATOIRE par checkAppreciation(). Si le contrôleur relève une erreur, la
// proposition est régénérée (2 essais max) puis, à défaut, rejetée : l'IA ne
// produit qu'un brouillon que le professeur relit et valide.
//
// Dans ce prototype, generateDraft() simule le LLM par des gabarits déterministes
// construits à partir des données de l'élève (moyenne, tendance, compétences).

import { checkAppreciation } from './appreciation.js';

export const SYSTEM_PROMPT = `Tu rédiges des appréciations de bulletin pour un établissement français.
Règles impératives :
- Écrire à la 3e personne (prénom ou « il / elle »), jamais de tutoiement ni d'adresse directe.
- Au moins deux phrases complètes : un constat factuel, puis un conseil concret.
- Ton bienveillant et exigeant ; aucune formule décourageante (« devra faire ses preuves », « médiocre », etc.).
- Décisions au format inclusif officiel : « Admis.e en classe de… », « Retenu.e en classe de… ».
- Parcours d'ouverture : aucune note chiffrée, seulement une appréciation qualitative.
- 450 caractères maximum.`;

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

const LEVEL_SENTENCES = {
  high: [
    '{p} fournit un travail sérieux et régulier en {m}, avec des résultats solides.',
    'Très bon trimestre en {m} : {p} maîtrise les notions étudiées et participe avec pertinence.',
  ],
  mid: [
    '{p} obtient des résultats satisfaisants en {m} et s\'investit de manière globalement régulière.',
    'Trimestre correct en {m} : les bases sont acquises et {p} participe volontiers.',
  ],
  low: [
    '{p} rencontre des difficultés en {m} ce trimestre, mais des efforts sont visibles en classe.',
    'Les résultats de {p} en {m} restent fragiles ; l\'implication en classe est un point d\'appui.',
  ],
};
const TREND = {
  hausse: 'La progression depuis le début du trimestre est encourageante.',
  stable: 'Les résultats sont stables d\'une évaluation à l\'autre.',
  baisse: 'Une légère baisse est observée en fin de trimestre, qui peut être rapidement rattrapée.',
};
const ADVICE = {
  high: 'Il convient de poursuivre dans cette voie en visant davantage de rigueur dans la rédaction.',
  mid: 'Un travail personnel plus approfondi, notamment sur {f}, permettra de consolider ces acquis.',
  low: 'Une reprise régulière des exercices, en particulier sur {f}, et des questions posées en classe l\'aideront à progresser.',
};

const OPENING = {
  NUMERIQUE: '{p} s\'est impliqué.e dans les ateliers du volet numérique et a su mener à bien les productions demandées.',
  ORIENTATION: '{p} a participé avec intérêt aux séances d\'orientation et commence à formuler un projet personnel.',
  ART: '{p} a pris part aux ateliers artistiques avec curiosité et a fait preuve de créativité.',
};

/**
 * @param {{firstName: string, subject: string, mode?: string, strand?: string,
 *          average?: number, trend?: 'hausse'|'stable'|'baisse', focus?: string, seed?: number}} s
 */
export function generateDraft(s) {
  const seed = s.seed ?? 0;
  const fill = (t) => t.replaceAll('{p}', s.firstName).replaceAll('{m}', s.subject.toLowerCase()).replaceAll('{f}', s.focus ?? 'la méthode');

  let text;
  if (s.mode === 'APPRECIATION_SEULE') {
    text = `${fill(OPENING[s.strand] ?? OPENING.NUMERIQUE)} ${fill('Cet engagement est à poursuivre lors des prochaines séances, en osant davantage prendre la parole.')}`;
  } else {
    const band = s.average >= 14 ? 'high' : s.average >= 10 ? 'mid' : 'low';
    text = [fill(pick(LEVEL_SENTENCES[band], seed)), TREND[s.trend ?? 'stable'], fill(ADVICE[band])].join(' ');
  }

  // Garde-fou : on ne renvoie jamais un brouillon non conforme
  const check = checkAppreciation(text, { mode: s.mode });
  if (!check.ok) throw new Error(`Brouillon non conforme : ${check.errors.map((e) => e.rule).join(', ')}`);
  return text;
}
