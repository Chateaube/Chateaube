import React, { useId, useState } from 'react';
import { CATEGORIES } from '../rules/ambiances.js';
import { loadAmbiancePrefs, saveAmbiancePrefs } from '../ambianceRuntime.js';

// Ambiance du moment : une bande sous la barre du haut (message du jour + « Le saviez-vous ? ») et l'encart
// contextuel qui explique l'événement. Tout est du vrai texte (lu par les lecteurs d'écran), contrastes AAA
// garantis par la palette ; les symboles sont décoratifs (aria-hidden). L'encart replié est mémorisé par ambiance.

export function AmbianceCard({ ambiance, id, onClose, compact = false }) {
  if (!ambiance?.note) return null;
  const titleId = `${id}-titre`;
  return (
    <aside id={id} aria-labelledby={titleId} className={`amb-note rounded-xl ${compact ? 'p-3' : 'p-4'} text-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">Le saviez-vous ? · {CATEGORIES[ambiance.category] ?? ''}</p>
          <h2 id={titleId} className="mt-0.5 font-display text-base font-semibold"><span aria-hidden="true">{ambiance.symbol} </span>{ambiance.note.title}</h2>
        </div>
        {onClose && <button type="button" onClick={onClose} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium underline">Masquer</button>}
      </div>
      <p className="mt-1.5 leading-relaxed">{ambiance.note.text}</p>
    </aside>
  );
}

/** Bande de l'ambiance dans la coquille de l'ENT. */
export default function AmbianceBand({ ambiance }) {
  const uid = useId().replace(/:/g, '');
  const [prefs, setPrefs] = useState(loadAmbiancePrefs);
  const [open, setOpen] = useState(!!prefs.opened?.[ambiance?.id]); // repliée par défaut
  if (!ambiance) return null;
  const toggle = (next) => {
    setOpen(next);
    const p = { ...prefs, opened: { ...prefs.opened, [ambiance.id]: next } };
    setPrefs(p); saveAmbiancePrefs(p);
  };
  const noteId = `amb-note-${uid}`;
  return (
    <div className="amb-band print:hidden">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm lg:px-8">
        <p><span aria-hidden="true">{ambiance.symbol} </span><strong>{ambiance.label}</strong>{ambiance.greeting && ambiance.greeting !== ambiance.label ? ` — ${ambiance.greeting}` : ''}</p>
        {ambiance.note && <button type="button" aria-expanded={open} aria-controls={noteId} onClick={() => toggle(!open)} className="text-xs font-semibold">{open ? 'Replier' : 'Le saviez-vous ?'}</button>}
      </div>
      {ambiance.note && open && <div className="mx-auto max-w-[1500px] px-4 pb-3 lg:px-8"><AmbianceCard ambiance={ambiance} id={noteId} onClose={() => toggle(false)} /></div>}
    </div>
  );
}

/** Encart de l'accueil (portail familles) : masquable, mémorisé par ambiance. */
export function AmbianceHomeCard({ ambiance }) {
  const [prefs, setPrefs] = useState(loadAmbiancePrefs);
  const uid = useId().replace(/:/g, '');
  if (!ambiance?.note || prefs.closed?.[ambiance.id]) return null;
  const close = () => { const p = { ...prefs, closed: { ...prefs.closed, [ambiance.id]: true } }; setPrefs(p); saveAmbiancePrefs(p); };
  return <AmbianceCard ambiance={ambiance} id={`amb-home-${uid}`} onClose={close} compact />;
}
