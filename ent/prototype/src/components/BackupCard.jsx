import React, { useState } from 'react';
import { Button, Card } from './ui.jsx';
import { backupSheets, readLocalData, restoreLocalData } from '../rules/backup.js';
import { askConfirm } from './Dialogs.jsx';
import { buildXlsx } from '../xlsx.js';
import { saveFile } from '../download.js';

// Sauvegarde (Direction, secrétariat) : à faire chaque mois, et avant toute grosse opération.
// Prototype : les données sont celles de CE navigateur ; en production, la sauvegarde vient du serveur.
export default function BackupCard({ role }) {
  const [msg, setMsg] = useState('');
  const day = new Date().toISOString().slice(0, 10);
  const excel = async () => {
    const data = readLocalData();
    const ok = await saveFile(`sauvegarde-ent-${day}.xlsx`, buildXlsx(backupSheets(data, day)));
    setMsg(ok ? `Sauvegarde Excel prête (${data.length} types de données).` : '');
  };
  const json = async () => {
    const ok = await saveFile(`sauvegarde-ent-${day}.json`, JSON.stringify(Object.fromEntries(readLocalData()), null, 1));
    setMsg(ok ? 'Sauvegarde complète prête : à garder pour restaurer.' : '');
  };
  // Restaurer : Direction seulement ; remplace tout ce que ce navigateur contient par la sauvegarde choisie
  const restore = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!(await askConfirm(`Restaurer la sauvegarde « ${file.name} » ? Tout ce que cet ordinateur contient (élèves importés, caisse, vie scolaire…) sera remplacé par le contenu du fichier.`))) return;
      const n = restoreLocalData(data);
      try { sessionStorage.setItem('ent-flash', JSON.stringify({ screen: 'import', text: `Sauvegarde « ${file.name} » restaurée (${n} types de données).` })); } catch { /* rien */ }
      window.location.reload();
    } catch (e) { setMsg(e instanceof SyntaxError ? 'Ce fichier n\'est pas une sauvegarde complète de l\'ENT (fichier .json).' : e.message); }
  };
  return (
    <Card title="Sauvegarder les données" subtitle="Élèves, caisse, notes, vie scolaire… tout ce que l'ENT contient, à exporter chaque mois">
      <div className="flex flex-wrap gap-2">
        <Button onClick={excel}>Tout exporter en Excel</Button>
        <Button variant="secondary" onClick={json}>Sauvegarde complète (avec photos)</Button>
        {role === 'DIRECTION' && (
          <label className="inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300 hover:bg-slate-50">
            Restaurer une sauvegarde complète…
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-emerald-700">{msg}</p>}
      <p className="mt-2 text-xs text-slate-600">Excel : pour lire, imprimer ou archiver (un onglet par type de données) ; il ne se réimporte pas. Sauvegarde complète (.json) : tout, photos comprises ; c'est elle qui se recharge avec « Restaurer » (Direction). La caisse a aussi son export mensuel (Caisse → Reçus & clôture). Conservez ces fichiers dans un endroit sûr : ils contiennent des données personnelles.</p>
    </Card>
  );
}
