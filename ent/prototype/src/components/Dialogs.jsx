import React, { useEffect, useRef, useState } from 'react';

// Fenêtres de l'application à la place de confirm / prompt / alert du navigateur : lisibles sur téléphone,
// aux couleurs de l'ENT, au clavier (Entrée valide, Échap annule) et lues par les lecteurs d'écran.
//   if (await askConfirm('Supprimer ?')) …      const motif = await askText('Motif ?')      tell('Enregistré.')
let show = null;
const queue = [];
const open = (d) => new Promise((resolve) => { const item = { ...d, resolve }; if (show) show(item); else queue.push(item); });

export const askConfirm = (message, opts = {}) => open({ kind: 'confirm', message, ...opts });
export const askText = (message, opts = {}) => open({ kind: 'prompt', message, ...opts });
export const tell = (message) => open({ kind: 'alert', message });

export function DialogHost() {
  const [d, setD] = useState(null);
  const [text, setText] = useState('');
  const okRef = useRef(null); const inputRef = useRef(null); const before = useRef(null);
  useEffect(() => { show = (item) => { before.current = document.activeElement; setText(item.initial ?? ''); setD(item); }; if (queue.length) show(queue.shift()); return () => { show = null; }; }, []);
  useEffect(() => { if (d) (inputRef.current ?? okRef.current)?.focus(); }, [d]);
  if (!d) return null;
  const close = (value) => { d.resolve(value); setD(null); before.current?.focus?.(); if (queue.length) setTimeout(() => show?.(queue.shift()), 0); };
  const cancel = () => close(d.kind === 'confirm' ? false : d.kind === 'prompt' ? null : undefined);
  const ok = () => { if (d.kind === 'prompt' && d.required !== false && !text.trim()) return; close(d.kind === 'confirm' ? true : d.kind === 'prompt' ? text.trim() : undefined); };
  const danger = d.danger ?? /supprim|effacer|retirer|annuler|déverrouiller|remettre/i.test(d.message);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center" onClick={cancel}>
      <div role={d.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="ent-dialog-msg" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter' && d.kind !== 'alert' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); ok(); } }}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <p id="ent-dialog-msg" className="whitespace-pre-line text-[15px] text-slate-900">{d.message}</p>
        {d.kind === 'prompt' && <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={d.placeholder ?? ''} aria-label={d.message}
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" />}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {d.kind !== 'alert' && <button type="button" onClick={cancel} className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">{d.cancelLabel ?? 'Annuler'}</button>}
          <button ref={okRef} type="button" onClick={ok} disabled={d.kind === 'prompt' && d.required !== false && !text.trim()}
            className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold text-white disabled:bg-slate-300 ${danger && d.kind === 'confirm' ? 'bg-red-700 hover:bg-red-800' : 'bg-navy-500 hover:bg-navy-700'}`}>{d.okLabel ?? (d.kind === 'alert' ? 'J\'ai compris' : d.kind === 'prompt' ? 'Valider' : 'Confirmer')}</button>
        </div>
      </div>
    </div>
  );
}
