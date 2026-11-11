import React, { useEffect, useState } from 'react';

// « ✓ Enregistré » : apparaît quelques secondes après chaque saisie enregistrée automatiquement.
export default function SavedBadge() {
  const [at, setAt] = useState(null);
  useEffect(() => {
    let t;
    const on = () => { setAt(new Date().toTimeString().slice(0, 5)); clearTimeout(t); t = setTimeout(() => setAt(null), 4000); };
    window.addEventListener('ent-saved', on);
    return () => { window.removeEventListener('ent-saved', on); clearTimeout(t); };
  }, []);
  return (
    <span role="status" aria-live="polite" className={`hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-opacity sm:inline ${at ? 'opacity-100' : 'opacity-0'}`}>
      {at ? `✓ Enregistré à ${at}` : ''}
    </span>
  );
}
