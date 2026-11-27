import React, { useEffect, useState } from 'react';

// « ✓ Enregistré » : apparaît quelques secondes après chaque saisie enregistrée automatiquement.
// « Non enregistré » : le serveur a refusé une modification que ce compte n'a pas le droit de faire
// (ex. un professeur qui corrige la ligne d'un collègue) ; la version de l'école revient sur l'appareil.
export default function SavedBadge() {
  const [at, setAt] = useState(null);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    let t; let r;
    const on = () => { setAt(new Date().toTimeString().slice(0, 5)); clearTimeout(t); t = setTimeout(() => setAt(null), 4000); };
    const no = (e) => { setRefused(e?.detail ?? 'droits'); clearTimeout(r); r = setTimeout(() => setRefused(false), 10000); };
    window.addEventListener('ent-saved', on); window.addEventListener('ent-refused', no);
    return () => { window.removeEventListener('ent-saved', on); window.removeEventListener('ent-refused', no); clearTimeout(t); clearTimeout(r); };
  }, []);
  if (refused) return <span role="alert" className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">{refused === 'controle' ? 'Modification refusée par le serveur (elle aurait effacé des données) : la version de l\'école est revenue' : 'Modification non permise pour votre compte : non enregistrée'}</span>;
  return (
    <span role="status" aria-live="polite" className={`hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-opacity sm:inline ${at ? 'opacity-100' : 'opacity-0'}`}>
      {at ? `✓ Enregistré à ${at}` : ''}
    </span>
  );
}
