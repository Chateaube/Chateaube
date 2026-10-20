// Sauvegarde complète des données de l'ENT, au cas où le site rencontre un problème : un classeur Excel
// (un onglet par type de données, lisible sans l'ENT) et un fichier JSON (copie exacte, pour restaurer).
// Les photos et signatures ne vont pas dans Excel (« [photo] ») : elles restent dans le JSON.

const MAX_CELL = 32000; // limite d'une cellule Excel : 32 767 caractères
const nameOf = (key) => key.replace(/^ent-/, '').replace(/-v\d+$/, '');
const cell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  const t = (typeof v === 'string' ? v : JSON.stringify(v)).replace(/data:(image|application)\/[^"'\s]+/g, '[photo]');
  return t.length > MAX_CELL ? `${t.slice(0, MAX_CELL)}…` : t;
};

/** Un tableau d'objets → en-tête (toutes les clés rencontrées) + lignes. */
function table(list) {
  const cols = [...new Set(list.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : ['valeur'])))];
  return [cols, ...list.map((o) => cols.map((c) => cell(o && typeof o === 'object' ? o[c] : o)))];
}

/** Données du navigateur ([clé, valeur]) → onglets pour buildXlsx, avec un sommaire en premier. */
export function backupSheets(entries, at) {
  const sheets = [];
  const used = new Set(['Sommaire']);
  const add = (name, rows) => {
    let n = name.slice(0, 28); let i = 2;
    while (used.has(n)) { n = `${name.slice(0, 26)}-${i}`; i += 1; }
    used.add(n); sheets.push({ name: n, rows, freeze: { col: 0, row: 1 } });
  };
  entries.forEach(([key, value]) => {
    const base = nameOf(key);
    if (Array.isArray(value)) add(base, table(value));
    else if (value && typeof value === 'object') {
      const arrays = Object.entries(value).filter(([, v]) => Array.isArray(v));
      arrays.forEach(([k, v]) => add(`${base}.${k}`, table(v)));
      const rest = Object.entries(value).filter(([, v]) => !Array.isArray(v));
      if (rest.length) add(base, [['clé', 'valeur'], ...rest.map(([k, v]) => [k, cell(v)])]);
    } else add(base, [['valeur'], [cell(value)]]);
  });
  const summary = [['Sauvegarde ENT Chateaubriand', at], ['Onglet', 'Lignes'], ...sheets.map((s) => [s.name, Math.max(0, s.rows.length - 1)])];
  return [{ name: 'Sommaire', rows: summary, widths: [34, 18] }, ...sheets];
}

/** Lit toutes les données de l'ENT gardées dans ce navigateur. */
export function readLocalData(storage = localStorage) {
  const out = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (!k?.startsWith('ent-')) continue;
    try { out.push([k, JSON.parse(storage.getItem(k))]); } catch { out.push([k, storage.getItem(k)]); }
  }
  return out.sort(([a], [b]) => a.localeCompare(b));
}
