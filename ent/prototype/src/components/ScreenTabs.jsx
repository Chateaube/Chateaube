import React, { useId, useRef } from 'react';

// Onglets d'écran conformes au modèle WAI-ARIA : flèches gauche/droite, Début/Fin, un seul onglet
// atteignable à la tabulation, chaque onglet relié à son panneau (aria-controls / aria-labelledby).
export default function ScreenTabs({ tabs, value, onChange, label }) {
  const uid = useId().replace(/:/g, '');
  const refs = useRef({});
  const ids = tabs.map(([id]) => id);
  const move = (e) => {
    const i = ids.indexOf(value);
    const next = { ArrowRight: ids[(i + 1) % ids.length], ArrowLeft: ids[(i - 1 + ids.length) % ids.length], Home: ids[0], End: ids[ids.length - 1] }[e.key];
    if (!next) return;
    e.preventDefault(); onChange(next); refs.current[next]?.focus();
  };
  const current = tabs.find(([id]) => id === value) ?? tabs[0];
  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={move} className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(([id, title]) => (
          <button key={id} ref={(el) => { refs.current[id] = el; }} type="button" role="tab" id={`${uid}-tab-${id}`} aria-controls={`${uid}-panel`} aria-selected={id === value}
            tabIndex={id === value ? 0 : -1} data-nav={`onglet-${id}`} onClick={() => onChange(id)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium ${id === value ? 'border-navy-700 text-navy-900' : 'border-transparent text-slate-600 hover:text-navy-900'}`}>{title}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${current[0]}`} tabIndex={0} className="focus:outline-none">{current[2]}</div>
    </div>
  );
}
