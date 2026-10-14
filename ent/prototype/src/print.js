// Impression d'une partie de l'écran seulement (tickets de caisse, rapport mensuel) :
// le contenu est copié à la racine de la page et le reste de l'application est masqué
// le temps de l'impression, avec un format de page propre au document.
export function printOnly(selector, pageCss) {
  const source = document.querySelector(selector);
  if (!source) return;
  const copy = document.createElement('div');
  copy.id = 'print-root';
  copy.innerHTML = source.innerHTML;
  const style = document.createElement('style');
  style.textContent = `@media print { @page { ${pageCss} } #root { display: none; } }`;
  document.body.append(copy, style);
  const done = () => { copy.remove(); style.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
