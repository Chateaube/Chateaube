import React, { useEffect, useState } from 'react';
import { Card, Button } from './ui.jsx';
import GradebookModule from './GradebookModule.jsx';
import { fetchDoc } from '../online/docs.js';
import { setCurrentRoster, servicesFor } from '../online/roster.js';
import { loadRemoteCarnet } from '../gradebookStore.js';
import { loadMe } from '../identity.js';

// « Mes notes » pour un compte Direction qui enseigne aussi (ex. Arts plastiques) : le même carnet que les
// professeurs, avec les classes envoyées par la Direction. Le fichier importé de cet ordinateur n'est pas touché.
export default function MyGrades({ settings, go }) {
  const [state, setState] = useState({ step: 'loading' });
  const load = async () => {
    setState({ step: 'loading' });
    try {
      const me = loadMe();
      const roster = (await fetchDoc('roster'))?.value ?? null;
      setCurrentRoster(roster);
      if (!roster || !servicesFor(roster, me?.id).length) { setState({ step: 'none' }); return; }
      await loadRemoteCarnet(me.id);
      setState({ step: 'ready' });
    } catch (e) { setState({ step: 'error', message: e.message }); }
  };
  useEffect(() => { load(); }, []);
  if (state.step === 'ready') return <GradebookModule settings={settings} go={go} role="ENSEIGNANT" />;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-navy-900">Mes notes</h1>
      <Card>
        {state.step === 'loading' && <p className="text-sm text-slate-600">Chargement de vos classes…</p>}
        {state.step === 'none' && <p className="text-sm text-slate-700">Aucune classe ne vous est attribuée. Si vous enseignez, ajoutez vos matières et classes sur votre fiche (Gestion des agents) ou dans l'onglet 3 de l'import, puis « Envoyer les classes » dans Notes reçues.</p>}
        {state.step === 'error' && <><p className="text-sm text-red-800">Vos classes n'ont pas pu être chargées ({state.message}).</p><Button className="mt-3" onClick={load}>Réessayer</Button></>}
      </Card>
    </div>
  );
}
