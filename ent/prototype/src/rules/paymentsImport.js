// Reprise des paiements déjà reçus (onglet « 7 Paiements » du modèle) : chaque ligne marque les frais
// réglés sur le compte de l'élève (inscription, mois de scolarité, fascicule…) et rejoint l'historique de
// la caisse. Les lignes illisibles sont signalées, jamais importées à moitié.

const MONTHS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const METHODS = [[/esp/, 'Espèces'], [/ch[eè]q/, 'Chèque'], [/vir/, 'Virement'], [/mobile|mvola|orange|airtel/, 'Mobile money']];

/** Frais réglés d'après le libellé : « Frais de scolarité septembre et octobre », « Réinscription + fascicule »… */
export function articleKeys(label) {
  const t = fold(label);
  const keys = [];
  if (/reinscri/.test(t)) keys.push('REINSCRIPTION');
  else if (/inscri/.test(t)) keys.push('INSCRIPTION');
  if (/fascicule/.test(t)) keys.push('FASCICULE');
  if (/location|manuel/.test(t)) keys.push('LOCATION');
  if (/cahier/.test(t)) keys.push('CAHIERS');
  if (/examen|bac\b|brevet|dnb/.test(t)) keys.push('EXAMEN');
  if (/scolarit|ecolage|mensualit/.test(t)) {
    const months = Object.entries(MONTHS).filter(([m]) => new RegExp(`\\b${m}\\b`).test(t)).map(([, n]) => `ECO-${String(n).padStart(2, '0')}`);
    keys.push(...(months.length ? months : ['ECO-?']));
  }
  return keys;
}
const journalOf = (keys) => (keys[0]?.startsWith('ECO') ? 'ECOLAGE' : keys[0] === 'EXAMEN' ? 'DROITS_EXAMEN' : 'FRAIS_ANNEXES');

/** Date JJ/MM/AAAA, AAAA-MM-JJ ou date Excel (nombre de jours) → AAAA-MM-JJ, sinon null. */
export function readDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Math.round((Number(s) - 25569) * 86_400_000)).toISOString().slice(0, 10);
  return null;
}
export const readAmount = (v) => { const n = Number(String(v ?? '').replace(/[\s  ]|ar$/gi, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

/**
 * rows : lignes de l'onglet (sheetRows) ; studentKey(r) → clé de l'élève (NOM PRÉNOM sans accents) ;
 * known : clés des élèves de l'onglet 1 (pour signaler les noms inconnus).
 * Renvoie { paid: { clé: [frais] }, movements: [...], errors: [...] }.
 */
export function parsePayments(rows, studentKey, known) {
  const paid = {}; const movements = []; const errors = [];
  rows.forEach((r) => {
    const who = studentKey(r); const name = r['Nom de l\'élève'] || r['N° élève (matricule)'];
    const keys = articleKeys(r.Article); const amount = readAmount(r['Montant (Ar)']); const date = readDate(r.Date);
    const pb = [];
    if (!who) pb.push('élève manquant');
    else if (known && !known.has(who)) pb.push(`élève « ${name} » absent de l'onglet 1`);
    if (!keys.length) pb.push(`article « ${r.Article ?? ''} » non reconnu`);
    if (keys.includes('ECO-?')) pb.push('mois de scolarité à préciser (ex. « Frais de scolarité octobre »)');
    if (!amount) pb.push(`montant « ${r['Montant (Ar)'] ?? ''} » illisible`);
    if (!date) pb.push(`date « ${r.Date ?? ''} » illisible (JJ/MM/AAAA)`);
    if (pb.length) { errors.push(`Ligne ${r.line} : ${pb.join(', ')}.`); return; }
    paid[who] = [...new Set([...(paid[who] ?? []), ...keys])];
    const method = METHODS.find(([re]) => re.test(fold(r.Mode)))?.[1] ?? (r.Mode || 'Espèces');
    movements.push({
      id: `rep${r.line}`, date, time: '08:00', agent: 'Reprise de l\'existant', dir: 'IN', nature: 'Encaissement famille', journal: journalOf(keys),
      label: `${r.Article} — ${name}`, method: r['N° de reçu'] ? `${method} — reçu n° ${r['N° de reçu']}` : method, amount, student: who, payer: r['Payé par'] ?? '',
    });
  });
  movements.sort((a, b) => a.date.localeCompare(b.date));
  return { paid, movements, errors };
}
