// Tableaux lisibles sur téléphone : sous 640 px, chaque ligne d'un tableau devient une carte et chaque
// cellule reprend le titre de sa colonne (data-label). Les boutons d'action restent visibles.
// Les vraies grilles (notes, conseil, bulletin, examens blancs) gardent leur forme : elles défilent,
// avec une ombre sur le bord pour montrer qu'il y a une suite (data-grid sur le <table>).

function label(table) {
  if (table.dataset.grid !== undefined || table.closest('[data-grid]')) return;
  const head = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!head) return;
  const titles = [];
  [...head.cells].forEach((c) => { for (let k = 0; k < (c.colSpan || 1); k += 1) titles.push(c.innerText.trim()); });
  table.classList.add('auto-cards');
  [...table.tBodies].forEach((tb) => [...tb.rows].forEach((tr) => {
    let col = 0;
    [...tr.cells].forEach((td) => {
      const t = titles[col] ?? '';
      if (td.dataset.label !== t) td.dataset.label = t;
      col += td.colSpan || 1;
    });
  }));
}

/** Pose les étiquettes maintenant et à chaque changement de l'écran. */
export function watchTables(root = document.body) {
  let queued = false;
  const run = () => { queued = false; root.querySelectorAll('table').forEach(label); };
  const obs = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } });
  obs.observe(root, { childList: true, subtree: true });
  run();
  return () => obs.disconnect();
}
