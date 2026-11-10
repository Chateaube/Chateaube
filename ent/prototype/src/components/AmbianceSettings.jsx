import React, { useState } from 'react';
import { Button } from './ui.jsx';
import { AMBIANCES, CATEGORIES, MOTIFS, PALETTES, activeAmbiance, ambianceConfig, ambianceErrors, catalog, datesLabel } from '../rules/ambiances.js';
import { AmbianceCard } from './AmbianceNote.jsx';

// Paramètres → ambiances (Direction) : automatique / imposée / désactivée, animations, note « Le saviez-vous ? »
// modifiable, et ambiances ajoutées (un thème d'histoire étudié en classe, la journée sportive…). Une ambiance
// ajoutée choisit une palette de la liste : la lisibilité est garantie quoi qu'on choisisse.

const today = () => new Date().toISOString().slice(0, 10);
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';
const toMd = (iso) => (iso ? iso.slice(5, 10) : '');
const EMPTY = { label: '', from: '', to: '', palette: 'sobre', motif: 'aucun', greeting: '', note: { title: '', text: '' } };

export default function AmbianceSettings({ settings, onChange }) {
  const config = ambianceConfig(settings);
  const set = (patch) => onChange({ ...settings, ambiance: { ...config, ...patch } });
  const all = catalog(config);
  const current = activeAmbiance(today(), config);
  const [editing, setEditing] = useState(null); // id dont on modifie la note
  const [note, setNote] = useState({ title: '', text: '' });
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState([]);

  const saveNote = () => { set({ notes: { ...config.notes, [editing]: { title: note.title.trim(), text: note.text.trim() } } }); setEditing(null); };
  const resetNote = (id) => { const notes = { ...config.notes }; delete notes[id]; set({ notes }); };
  const addCustom = () => {
    const a = { ...draft, id: `PERSO_${Date.now()}`, label: draft.label.trim(), greeting: draft.greeting.trim() || draft.label.trim(), note: draft.note.title.trim() ? draft.note : null };
    const e = ambianceErrors(a); setErr(e); if (e.length) return;
    set({ custom: [...(config.custom ?? []), a] }); setDraft(null);
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-slate-600">Ambiance
        <select value={config.mode} onChange={(e) => set({ mode: e.target.value })} className={field}>
          <option value="AUTO">Automatique, selon les dates</option>
          <option value="OFF">Désactivée</option>
          {all.map((x) => <option key={x.id} value={x.id}>Toujours : {x.label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={config.animations !== false} onChange={(e) => set({ animations: e.target.checked })} />Animation brève à l'ouverture (jamais si l'appareil demande moins d'animations)</label>
      <p className="text-xs text-slate-600">École laïque : uniquement des repères civiques, culturels, historiques, scolaires ou de saison (hémisphère sud).</p>

      {current && <AmbianceCard ambiance={current} id="amb-apercu" compact />}

      <ul className="divide-y divide-slate-100 text-sm">
        {all.map((x) => (
          <li key={x.id} className="py-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span aria-hidden="true">{x.symbol} </span><strong className="font-medium text-slate-800">{x.label}</strong> <span className="text-xs text-slate-600">· {CATEGORIES[x.category]} · {datesLabel(x, today())}{x.custom ? ' · ajoutée' : ''}</span></span>
              <span className="flex gap-2 text-xs">
                <button type="button" className="font-medium text-navy-700 underline" onClick={() => { setEditing(x.id); setNote(x.note ?? { title: '', text: '' }); }}>Note</button>
                {config.notes?.[x.id] && <button type="button" className="text-slate-600 underline" onClick={() => resetNote(x.id)}>Note d'origine</button>}
                {x.custom && <button type="button" className="text-red-700 underline" onClick={() => set({ custom: config.custom.filter((c) => c.id !== x.id) })}>Retirer</button>}
              </span>
            </div>
            {editing === x.id && (
              <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
                <input value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} aria-label="Titre de la note" placeholder="Titre" className={field} />
                <textarea rows={3} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} aria-label="Texte de la note" placeholder="Quelques lignes pour expliquer l'événement" className={field} />
                <span className="flex gap-2"><Button className="!py-1 text-xs" disabled={!note.title.trim() || !note.text.trim()} onClick={saveNote}>Enregistrer la note</Button><Button variant="secondary" className="!py-1 text-xs" onClick={() => setEditing(null)}>Annuler</Button></span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {!draft && <Button variant="secondary" onClick={() => { setDraft(EMPTY); setErr([]); }}>＋ Ajouter une ambiance</Button>}
      {draft && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-800">Nouvelle ambiance (ex. thème d'histoire étudié en classe)</p>
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} aria-label="Nom" placeholder="Nom (ex. Abolition de l'esclavage)" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">Du<input type="date" onChange={(e) => setDraft({ ...draft, from: toMd(e.target.value) })} className={field} /></label>
            <label className="text-xs text-slate-600">Au<input type="date" onChange={(e) => setDraft({ ...draft, to: toMd(e.target.value) })} className={field} /></label>
            <label className="text-xs text-slate-600">Palette<select value={draft.palette} onChange={(e) => setDraft({ ...draft, palette: e.target.value })} className={field}>{Object.entries(PALETTES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="text-xs text-slate-600">Animation<select value={draft.motif} onChange={(e) => setDraft({ ...draft, motif: e.target.value })} className={field}>{Object.entries(MOTIFS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <input value={draft.greeting} onChange={(e) => setDraft({ ...draft, greeting: e.target.value })} aria-label="Message du jour" placeholder="Message court affiché dans la bande" className={field} />
          <input value={draft.note.title} onChange={(e) => setDraft({ ...draft, note: { ...draft.note, title: e.target.value } })} aria-label="Titre de la note" placeholder="Titre de la note « Le saviez-vous ? » (facultatif)" className={field} />
          <textarea rows={3} value={draft.note.text} onChange={(e) => setDraft({ ...draft, note: { ...draft.note, text: e.target.value } })} aria-label="Texte de la note" placeholder="Contexte historique ou culturel" className={field} />
          {err.length > 0 && <ul role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-800">{err.map((x) => <li key={x}>· {x}</li>)}</ul>}
          <span className="flex gap-2"><Button onClick={addCustom}>Ajouter l'ambiance</Button><Button variant="secondary" onClick={() => setDraft(null)}>Annuler</Button></span>
          <p className="text-xs text-slate-600">Une ambiance ajoutée passe avant les ambiances prévues aux mêmes dates. {AMBIANCES.length} ambiances sont prévues.</p>
        </div>
      )}
    </div>
  );
}
