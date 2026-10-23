import React, { useState } from 'react';
import { Button, Card } from './ui.jsx';
import { backupSheets, readLocalData } from '../rules/backup.js';
import { buildXlsx } from '../xlsx.js';
import { saveFile } from '../download.js';

// Sauvegarde (Direction, secrétariat) : à faire chaque mois, et avant toute grosse opération.
// Prototype : les données sont celles de CE navigateur ; en production, la sauvegarde vient du serveur.
export default function BackupCard() {
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
  return (
    <Card title="Sauvegarder les données" subtitle="Élèves, caisse, notes, vie scolaire… tout ce que l'ENT contient, à exporter chaque mois">
      <div className="flex flex-wrap gap-2">
        <Button onClick={excel}>Tout exporter en Excel</Button>
        <Button variant="secondary" onClick={json}>Sauvegarde complète (avec photos)</Button>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-emerald-700">{msg}</p>}
      <p className="mt-2 text-xs text-slate-600">Excel : un onglet par type de données, lisible sans l'ENT (les photos n'y sont pas). Sauvegarde complète : tout, photos comprises, pour restaurer l'ENT. La caisse a aussi son export mensuel (Caisse → Reçus & clôture). Conservez ces fichiers dans un endroit sûr : ils contiennent des données personnelles.</p>
    </Card>
  );
}
