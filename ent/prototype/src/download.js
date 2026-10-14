// Téléchargement d'un fichier généré (exports Excel/CSV).
// Dans la page publiée sur claude.ai, le fichier passe par la capacité « downloads » (le
// visiteur confirme l'enregistrement) ; ouverte directement (dist/index.html), par un lien classique.
export async function saveFile(filename, text) {
  let downloads = null;
  try { downloads = await window.claude?.use?.('downloads'); } catch { downloads = null; }
  if (downloads) {
    try { await downloads.save({ filename, data: text }); } catch { /* refus ou indisponible : rien à faire */ }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
