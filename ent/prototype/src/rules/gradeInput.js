// Correction intelligente de la saisie des notes.
// Principe : on ne modifie JAMAIS une note en silence quand la saisie est ambiguë
// (lettre « o » au lieu de « 0 ») : on propose une suggestion que le professeur
// accepte d'un geste (Entrée / clic). Les corrections purement typographiques
// (point → virgule) sont appliquées avec un message d'information.

const SPECIAL_CODES = {
  ABS: { status: 'ABSENT', display: 'ABS', label: 'Absent.e' },
  A: { status: 'ABSENT', display: 'ABS', label: 'Absent.e' },
  DISP: { status: 'DISPENSE', display: 'DISP', label: 'Dispensé.e' },
  D: { status: 'DISPENSE', display: 'DISP', label: 'Dispensé.e' },
  NN: { status: 'NON_NOTE', display: 'NN', label: 'Non noté.e' },
};

// Confusions lettre ↔ chiffre les plus fréquentes au clavier
const LOOKALIKES = [
  { from: /[oO]/g, to: '0', label: 'la lettre « o » remplacée par le chiffre 0' },
  { from: /[lI]/g, to: '1', label: 'la lettre « l » / « I » remplacée par le chiffre 1' },
];

export const formatFr = (n) =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',');

/**
 * @param {string} raw  saisie brute
 * @param {{max?: number}} [opts]
 * @returns {{
 *   state: 'empty'|'valid'|'suggest'|'error',
 *   status?: 'NOTE'|'ABSENT'|'DISPENSE'|'NON_NOTE',
 *   value?: number, display?: string,
 *   suggestion?: string, messages: {level: 'info'|'warning'|'error', text: string}[]
 * }}
 */
export function normalizeGrade(raw, { max = 20 } = {}) {
  const messages = [];
  const input = String(raw ?? '').trim();
  if (input === '') return { state: 'empty', messages };

  const code = SPECIAL_CODES[input.toUpperCase()];
  if (code) {
    return { state: 'valid', status: code.status, display: code.display, messages: [{ level: 'info', text: code.label }] };
  }

  let candidate = input.replace(/\s+/g, '');
  let ambiguous = false;

  // 1) Lettres ressemblant à des chiffres (uniquement si le reste est numérique)
  if (/^[0-9oOlI.,]+$/.test(candidate) && /[oOlI]/.test(candidate)) {
    for (const rule of LOOKALIKES) {
      if (rule.from.test(candidate)) {
        candidate = candidate.replace(rule.from, rule.to);
        messages.push({ level: 'warning', text: `Saisie corrigée : ${rule.label}.` });
        ambiguous = true;
      }
      rule.from.lastIndex = 0;
    }
  }

  // 2) Point décimal → virgule (convention française)
  if (/^\d+\.\d+$/.test(candidate)) {
    messages.push({ level: 'info', text: 'Point remplacé par une virgule (format français).' });
    candidate = candidate.replace('.', ',');
  }

  if (!/^\d{1,3}(,\d{1,2})?$/.test(candidate)) {
    return {
      state: 'error',
      messages: [{ level: 'error', text: `« ${input} » n'est pas une note valide (ex. 14 ; 12,5 ; ABS ; DISP).` }],
    };
  }

  let value = Number(candidate.replace(',', '.'));

  // 3) Virgule oubliée : « 125 » sur 20 → 12,5 ?
  if (value > max) {
    const digits = candidate.replace(',', '');
    const guess = Number(`${digits.slice(0, -1)}.${digits.slice(-1)}`);
    if (!candidate.includes(',') && digits.length === 3 && guess <= max) {
      return {
        state: 'suggest', status: 'NOTE', value: guess, display: formatFr(guess),
        suggestion: formatFr(guess),
        messages: [{ level: 'warning', text: `${value} dépasse le barème /${max}. Vouliez-vous saisir ${formatFr(guess)} ?` }],
      };
    }
    return { state: 'error', messages: [{ level: 'error', text: `La note ${formatFr(value)} dépasse le barème /${max}.` }] };
  }

  const display = formatFr(value);
  if (ambiguous) {
    return { state: 'suggest', status: 'NOTE', value, display, suggestion: display, messages };
  }
  return { state: 'valid', status: 'NOTE', value, display, messages };
}
