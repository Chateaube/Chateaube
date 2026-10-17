import React, { useRef, useState } from 'react';
import { idPhotoToDataUrl, documentToDataUrl } from '../image.js';

// Photo d'identité : appareil photo du téléphone ou fichier, recadrée au format 3 × 4.
export function PhotoInput({ value, onChange, label = 'Photo d\'identité' }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  return (
    <div className="flex items-end gap-3">
      <button type="button" onClick={() => ref.current.click()} aria-label={value ? 'Changer la photo d\'identité' : 'Ajouter une photo d\'identité'}
        className="flex h-[96px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-[10px] leading-tight text-slate-500">
        {value ? <img src={value} alt="Photo d'identité" className="h-full w-full object-cover" /> : <>Photo<br />d'identité</>}
      </button>
      <div className="text-xs text-slate-600">
        <p className="font-medium">{label}</p>
        <p className="text-slate-500">Récente, aux normes internationales : fond clair uni, de face, visage dégagé, sans lunettes ni couvre-chef.</p>
        <div className="mt-1 flex gap-2">
          <button type="button" className="font-medium text-navy-500" onClick={() => ref.current.click()}>{value ? 'Changer' : 'Prendre ou choisir'}</button>
          {value && <button type="button" className="text-slate-500" onClick={() => onChange(null)}>Retirer</button>}
        </div>
        {error && <p className="text-red-700">{error}</p>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setError(''); onChange(await idPhotoToDataUrl(f)); } catch { setError('Image illisible.'); } }} />
    </div>
  );
}

// Pièce du dossier : photo de la pièce (appareil photo) ou PDF.
export function DocumentInput({ onAdd, label = 'Ajouter', className = '' }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  return (
    <span className={className}>
      <button type="button" onClick={() => ref.current.click()} className="rounded-lg px-2.5 py-1 text-xs font-medium text-navy-700 ring-1 ring-inset ring-slate-300">{label}</button>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setError(''); onAdd(await documentToDataUrl(f)); } catch (err) { setError(err.message); } }} />
      {error && <span className="block text-[11px] text-red-700">{error}</span>}
    </span>
  );
}

/** Vignette d'une pièce déposée (ouvre le document en grand). */
export function DocumentThumb({ doc, title }) {
  const open = () => { const w = window.open(); if (w) w.document.write(doc.kind === 'pdf' ? `<iframe src="${doc.dataUrl}" style="border:0;width:100%;height:100%"></iframe>` : `<img src="${doc.dataUrl}" style="max-width:100%">`); };
  return (
    <button type="button" onClick={open} title={title} className="flex h-14 w-11 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white text-[10px] font-semibold text-slate-500">
      {doc.kind === 'pdf' ? 'PDF' : <img src={doc.dataUrl} alt={title} className="h-full w-full object-cover" />}
    </button>
  );
}
