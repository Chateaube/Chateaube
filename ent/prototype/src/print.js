// Impression d'une partie de l'écran seulement (grilles, listes, tickets…) : le contenu est copié à
// la racine de la page et le reste de l'application est masqué le temps de l'impression, avec un
// format de page propre au document.
// Avec un titre : marges réduites au plus juste et, en bas de chaque page, le nom de l'école,
// le titre du document et le numéro de page (« 1/2 »).
export const SCHOOL = 'École Collège Lycée Chateaubriand — Tamatave';
const quote = (t) => `"${String(t).replace(/["\\]/g, '\\$&')}"`;

export function footerCss(title) {
  const box = 'font-family: Poppins, sans-serif; font-size: 7.5pt; color: #475569;';
  return `margin: 6mm 7mm 11mm 7mm;
    @bottom-left { content: ${quote(`${SCHOOL} · ${title}`)}; ${box} }
    @bottom-right { content: counter(page) "/" counter(pages); ${box} }`;
}

export function printOnly(selector, pageCss, title) {
  const source = document.querySelector(selector);
  if (!source) return;
  const copy = document.createElement('div');
  copy.id = 'print-root';
  copy.innerHTML = source.innerHTML;
  const style = document.createElement('style');
  style.textContent = `@media print { @page { ${pageCss} ${title ? footerCss(title) : ''} } #root { display: none; } }`;
  document.body.append(copy, style);
  const done = () => { copy.remove(); style.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
