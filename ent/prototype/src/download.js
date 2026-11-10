// Téléchargement d'un fichier généré (exports Excel, agenda…).
import { tell } from './components/Dialogs.jsx';
// Dans la page publiée sur claude.ai, le fichier passe par la capacité « downloads » (le
// visiteur confirme l'enregistrement) ; ailleurs (application installée, dist/index.html), par un lien classique.
const MIME = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ics: 'text/calendar;charset=utf-8',
  html: 'text/html;charset=utf-8',
};

/** data : texte ou octets (Uint8Array). Renvoie false si le format n'est pas proposé dans cette vue. */
export async function saveFile(filename, data) {
  let downloads = null;
  try { downloads = await window.claude?.use?.('downloads'); } catch { downloads = null; }
  if (downloads) {
    try { await downloads.save({ filename, data }); return true; } catch (e) {
      if (e?.code === 'rejected_extension') { tell('Ce format se télécharge depuis l\'application de l\'école (lien du téléphone), pas depuis cet aperçu.'); return false; }
      return false; // refus du visiteur ou indisponible : rien à faire
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: MIME[filename.split('.').pop()] ?? 'application/octet-stream' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
