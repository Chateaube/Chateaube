// Petit générateur de PDF (une page) sans bibliothèque : texte en Helvetica (accents français), traits,
// rectangles et une image JPEG. Suffit pour le reçu officiel A5 sans alourdir l'application.
// Coordonnées en millimètres, origine en haut à gauche (comme sur papier).

const PT = 72 / 25.4;
// largeurs Helvetica (1/1000 em) des caractères 32 à 126 — normal et gras (métriques standard Adobe)
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
// caractères français hors ASCII → octet WinAnsi (cp1252) et lettre de base pour la largeur
const WIN = { 'À': [0xc0, 'A'], 'Â': [0xc2, 'A'], 'Ç': [0xc7, 'C'], 'È': [0xc8, 'E'], 'É': [0xc9, 'E'], 'Ê': [0xca, 'E'], 'Ë': [0xcb, 'E'], 'Î': [0xce, 'I'], 'Ï': [0xcf, 'I'], 'Ô': [0xd4, 'O'], 'Ù': [0xd9, 'U'], 'Û': [0xdb, 'U'], 'Ü': [0xdc, 'U'],
  'à': [0xe0, 'a'], 'â': [0xe2, 'a'], 'ç': [0xe7, 'c'], 'è': [0xe8, 'e'], 'é': [0xe9, 'e'], 'ê': [0xea, 'e'], 'ë': [0xeb, 'e'], 'î': [0xee, 'i'], 'ï': [0xef, 'i'], 'ô': [0xf4, 'o'], 'ù': [0xf9, 'u'], 'û': [0xfb, 'u'], 'ü': [0xfc, 'u'],
  'œ': [0x9c, 'e'], 'Œ': [0x8c, 'E'], '€': [0x80, 'C'], '°': [0xb0, 'o'], '·': [0xb7, '.'], '«': [0xab, '<'], '»': [0xbb, '>'], '’': [0x92, "'"], '–': [0x96, '-'], '—': [0x97, 'M'] };
const norm = (t) => String(t ?? '').replace(/[  ]/g, ' ').replace(/−/g, '-');

const charWidth = (c, bold) => {
  const base = WIN[c]?.[1] ?? c; const code = base.charCodeAt(0);
  const table = bold ? W_BOLD : W_REG;
  return code >= 32 && code <= 126 ? table[code - 32] : 556;
};
/** Largeur d'un texte en millimètres. */
export const textWidth = (t, size, bold = false) => [...norm(t)].reduce((s, c) => s + charWidth(c, bold), 0) * size / 1000 / PT;

// chaîne PDF en octets WinAnsi, avec échappements
function pdfString(t) {
  let out = '';
  for (const c of norm(t)) {
    const code = WIN[c] ? WIN[c][0] : c.charCodeAt(0);
    if (c === '(' || c === ')' || c === '\\') out += `\\${c}`;
    else if (code >= 32 && code <= 126) out += c;
    else if (code < 256) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += '?';
  }
  return `(${out})`;
}
const rgb = (c = [0, 0, 0]) => c.map((v) => (v / 255).toFixed(3)).join(' ');

export class PdfLite {
  constructor(wMm, hMm) { this.w = wMm; this.h = hMm; this.ops = []; this.image = null; }
  y(mm) { return ((this.h - mm) * PT).toFixed(2); }
  /** opt : { size, bold, italic, align: 'left'|'center'|'right', color: [r,g,b], angle (degrés), maxWidth (mm, coupe en lignes) } → hauteur utilisée (mm) */
  text(x, y, str, { size = 10, bold = false, italic = false, align = 'left', color, angle = 0, maxWidth } = {}) {
    const lines = maxWidth ? this.wrap(str, size, bold, maxWidth) : [norm(str)];
    const font = bold ? '/F2' : italic ? '/F3' : '/F1';
    lines.forEach((line, i) => {
      const w = textWidth(line, size, bold);
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      const yy = y + i * size * 0.42;
      const a = (angle * Math.PI) / 180;
      const m = angle ? `${Math.cos(a).toFixed(4)} ${Math.sin(a).toFixed(4)} ${(-Math.sin(a)).toFixed(4)} ${Math.cos(a).toFixed(4)}` : '1 0 0 1';
      this.ops.push(`BT ${rgb(color)} rg ${font} ${size} Tf ${m} ${(x0 * PT).toFixed(2)} ${this.y(yy)} Tm ${pdfString(line)} Tj ET`);
    });
    return lines.length * size * 0.42;
  }
  wrap(str, size, bold, maxWidth) {
    const words = norm(str).split(/\s+/); const lines = []; let cur = '';
    words.forEach((w) => { const t = cur ? `${cur} ${w}` : w; if (textWidth(t, size, bold) > maxWidth && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  line(x1, y1, x2, y2, { width = 0.2, color } = {}) { this.ops.push(`${rgb(color)} RG ${(width * PT).toFixed(2)} w ${(x1 * PT).toFixed(2)} ${this.y(y1)} m ${(x2 * PT).toFixed(2)} ${this.y(y2)} l S`); }
  rect(x, y, w, h, { fill, stroke, width = 0.2 } = {}) {
    const r = `${(x * PT).toFixed(2)} ${this.y(y + h)} ${(w * PT).toFixed(2)} ${(h * PT).toFixed(2)} re`;
    if (fill) this.ops.push(`${rgb(fill)} rg ${r} f`);
    if (stroke) this.ops.push(`${rgb(stroke)} RG ${(width * PT).toFixed(2)} w ${r} S`);
  }
  /** jpeg : octets d'une image JPEG (pxW × pxH), placée en x, y, largeur w (mm), hauteur proportionnelle. */
  jpeg(bytes, pxW, pxH, x, y, w) {
    const h = (w * pxH) / pxW;
    this.image = { bytes, pxW, pxH };
    this.ops.push(`q ${(w * PT).toFixed(2)} 0 0 ${(h * PT).toFixed(2)} ${(x * PT).toFixed(2)} ${this.y(y + h)} cm /Im1 Do Q`);
    return h;
  }
  /** Le fichier PDF (octets). */
  output() {
    const enc = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
    const parts = []; const offsets = []; let len = 0;
    const push = (u8) => { parts.push(u8); len += u8.length; };
    const obj = (n, body) => { offsets[n] = len; push(enc(`${n} 0 obj\n`)); (Array.isArray(body) ? body : [body]).forEach((b) => push(typeof b === 'string' ? enc(b) : b)); push(enc('\nendobj\n')); };
    push(enc('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
    const content = this.ops.join('\n');
    const fonts = '/Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >>';
    const xobj = this.image ? ' /XObject << /Im1 8 0 R >>' : '';
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(this.w * PT).toFixed(2)} ${(this.h * PT).toFixed(2)}] /Resources << ${fonts}${xobj} >> /Contents 4 0 R >>`);
    obj(4, [`<< /Length ${enc(content).length} >>\nstream\n`, content, '\nendstream']);
    obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    obj(7, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    const n = this.image ? 8 : 7;
    if (this.image) obj(8, [`<< /Type /XObject /Subtype /Image /Width ${this.image.pxW} /Height ${this.image.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${this.image.bytes.length} >>\nstream\n`, this.image.bytes, '\nendstream']);
    const xref = len;
    let x = `xref\n0 ${n + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= n; i += 1) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    push(enc(`${x}trailer\n<< /Size ${n + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    const out = new Uint8Array(len); let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }
}
