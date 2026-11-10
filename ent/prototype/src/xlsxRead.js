// Lecture d'un classeur Excel (.xlsx) dans le navigateur, sans bibliothèque : décompression du zip
// (DecompressionStream « deflate-raw »), puis lecture des feuilles et des textes partagés.
// Renvoie { "1 Élèves": [["N° (matricule)", "Nom", …], […], …], … } (toutes les cellules en texte).

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const utf8 = new TextDecoder('utf-8');

async function inflate(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Fichiers du zip : { nom: Uint8Array } (seulement ceux demandés par `want`). */
export async function unzip(buffer, want = () => true) {
  const b = new Uint8Array(buffer);
  let eocd = b.length - 22;
  while (eocd >= 0 && u32(b, eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('Ce fichier n\'est pas un classeur Excel (.xlsx).');
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const out = {};
  for (let i = 0; i < count; i += 1) {
    const method = u16(b, p + 10); const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28); const extraLen = u16(b, p + 30); const commentLen = u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = utf8.decode(b.subarray(p + 46, p + 46 + nameLen));
    if (want(name)) {
      const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      const raw = b.subarray(start, start + size);
      out[name] = method === 8 ? await inflate(raw) : raw.slice();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const unescape = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('');
const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Date Excel (nombre de jours depuis 1899-12-30) → JJ/MM/AAAA, pour les colonnes de dates. */
export const excelDate = (n) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
const DATE_HEADER = /date|née le|ne le|péremption|peremption/i;

export async function readXlsx(buffer) {
  const files = await unzip(buffer, (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || n.startsWith('xl/worksheets/sheet'));
  const xml = (n) => (files[n] ? utf8.decode(files[n]) : '');
  const shared = [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const rels = Object.fromEntries([...xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const relsAlt = Object.fromEntries([...xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)].map((m) => [m[2], m[1]]));
  const out = {};
  for (const m of xml('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const target = (rels[m[2]] ?? relsAlt[m[2]] ?? '').replace(/^\/?xl\//, '');
    const sheet = xml(`xl/${target}`);
    const rows = [];
    for (const r of sheet.matchAll(/<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row = [];
      for (const c of (r[1] ?? '').matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]; const body = c[2] ?? '';
        const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
        const type = attrs.match(/t="([^"]+)"/)?.[1];
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = texts(body);
        else if (v != null) value = unescape(v);
        row[ref ? colIndex(ref) : row.length] = value;
      }
      rows.push(Array.from(row, (x) => x ?? ''));
    }
    // dates saisies comme dates dans Excel : nombres → JJ/MM/AAAA
    const head = rows[0] ?? [];
    head.forEach((h, k) => { if (DATE_HEADER.test(h)) rows.slice(1).forEach((row) => { if (/^\d{5}(\.\d+)?$/.test(row[k] ?? '')) row[k] = excelDate(Number(row[k])); }); });
    out[unescape(m[1])] = rows;
  }
  return out;
}

/** Lignes d'une feuille en objets { en-tête: valeur }, sans les lignes vides ni la ligne « Exemple ». */
export function sheetRows(rows) {
  const [head = [], ...body] = rows;
  return body.map((r, i) => ({ line: i + 2, cells: r }))
    .filter(({ cells }) => cells.some((x) => String(x).trim()) && !/^exemple/i.test(String(cells[0] ?? '').trim()))
    .map(({ line, cells }) => ({ line, ...Object.fromEntries(head.map((h, k) => [h, String(cells[k] ?? '').trim()])) }));
}
