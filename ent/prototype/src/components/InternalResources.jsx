import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { RESOURCES } from '../data/resources.js';
import { documentToDataUrl } from '../image.js';
import { useScreenGuard } from '../screenGuard.js';

// Ressources internes : documents réservés aux professeurs (ou à tout le personnel), partagés par la
// Direction, le secrétariat ou la CPE : un document, un lien ou un simple texte (une consigne, une
// annonce). Consultation seulement : pas de téléchargement, pas d'impression, clic droit et copie
// bloqués, écran noir dès que la page perd le focus (outil de capture, changement d'application).
// Dans l'application installée, la capture d'écran donne un écran noir (Android) ; voir la doc pour
// iPhone. Aucun écran ne peut empêcher une photo prise avec un autre appareil.

const KEY = 'ent-ressources-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? RESOURCES; } catch { return RESOURCES; } };
const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch { return false; } };
const AUDIENCE = { PROFS: 'Professeurs', PERSONNEL: 'Tout le personnel' };
const fmt = (iso) => iso.split('-').reverse().join('/');
const WHO = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'Mme Ranaivo' };

function Viewer({ r, onClose }) {
  const hidden = useScreenGuard(true);
  return (
    <div className="protected-view fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-3 sm:p-6" role="dialog" aria-label={r.title}
      onContextMenu={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 pb-2 text-white">
        <p className="min-w-0 truncate text-sm font-semibold">{r.title}</p>
        <Button variant="secondary" className="!py-1 text-xs" onClick={onClose}>Fermer</Button>
      </div>
      <div className="relative mx-auto w-full max-w-3xl flex-1 overflow-auto rounded-xl bg-white">
        {hidden ? <div className="flex h-full items-center justify-center bg-black text-sm text-slate-400">Document masqué</div> : (
          <>
            {r.kind === 'TEXT' && <div className="whitespace-pre-line p-6 text-sm leading-relaxed text-slate-800">{r.text}</div>}
            {r.kind === 'image' && <img src={r.dataUrl} alt={r.title} draggable={false} className="pointer-events-none mx-auto max-w-full" />}
            {r.kind === 'pdf' && <iframe title={r.title} src={`${r.dataUrl}#toolbar=0&navpanes=0`} className="h-full min-h-[70vh] w-full" />}
            {r.kind === 'LINK' && (
              <div className="p-6 text-sm text-slate-800">
                {r.text && <p className="mb-3 whitespace-pre-line">{r.text}</p>}
                <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-navy-500 underline">Ouvrir le lien</a>
                <p className="mt-2 text-xs text-slate-500">Le contenu d'un lien extérieur (site, vidéo, Google Drive…) n'est pas protégé par l'ENT : réglez son partage chez le fournisseur.</p>
              </div>
            )}
          </>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-300">Consultation seulement : ni téléchargement, ni impression, ni copie. L'écran devient noir en cas de capture.</p>
    </div>
  );
}

export default function InternalResources({ role }) {
  const canShare = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(role);
  const [list, setList] = useState(load);
  const [open, setOpen] = useState(null);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const visible = list.filter((r) => role !== 'ENSEIGNANT' || ['PROFS', 'PERSONNEL'].includes(r.audience));
  const viewer = WHO[role] ?? role;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Réservé à l'équipe · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Ressources internes</h1>
        <p className="text-sm text-slate-500">Documents partagés avec les professeurs ou tout le personnel, à consulter dans l'ENT seulement. Pour une information, utilisez Annonces (Professeurs ou Personnel).</p>
      </div>
      {canShare && (
        <Card title="Partager un document" action={!d && <Button onClick={() => setD({ kind: 'DOC', title: '', audience: 'PROFS', file: null, url: '', text: '' })}>＋ Partager</Button>}>
          {d ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex gap-1.5 lg:col-span-4">
                {[['DOC', 'Document (photo ou PDF)'], ['LINK', 'Lien'], ['TEXT', 'Texte / annonce']].map(([k, l]) => <button key={k} type="button" aria-pressed={d.kind === k} onClick={() => setD({ ...d, kind: k })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${d.kind === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>)}
              </div>
              <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Titre" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm lg:col-span-2" />
              <select value={d.audience} onChange={(e) => setD({ ...d, audience: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">{Object.entries(AUDIENCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              {d.kind === 'DOC' && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="file" accept="image/*,application/pdf" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setError(''); setD({ ...d, file: await documentToDataUrl(f) }); } catch (err) { setError(err.message); } }} />
                </label>
              )}
              {d.kind === 'LINK' && <input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://…" aria-label="Lien" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />}
              {d.kind !== 'DOC' && <textarea rows={4} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder={d.kind === 'LINK' ? 'Présentation du lien (facultatif)' : 'Texte de la consigne ou de l\'annonce'} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm lg:col-span-4" />}
              {error && <p className="text-sm text-red-700 lg:col-span-4">{error}</p>}
              <span className="flex gap-2 lg:col-span-4">
                <Button disabled={!d.title.trim() || (d.kind === 'DOC' ? !d.file : d.kind === 'LINK' ? !/^https?:\/\/\S+\.\S+/.test(d.url.trim()) : !d.text.trim())} onClick={() => {
                  const base = { id: `r${Date.now()}`, title: d.title.trim(), audience: d.audience, by: viewer, at: new Date().toISOString().slice(0, 10) };
                  const item = d.kind === 'DOC' ? { ...base, kind: d.file.kind, dataUrl: d.file.dataUrl } : d.kind === 'LINK' ? { ...base, kind: 'LINK', url: d.url.trim(), text: d.text.trim() } : { ...base, kind: 'TEXT', text: d.text.trim() };
                  const next = [item, ...list];
                  if (!save(next)) { setError('Le navigateur manque de place pour ce document.'); return; }
                  setList(next); setD(null);
                }}>Partager</Button>
                <Button variant="secondary" onClick={() => setD(null)}>Annuler</Button>
              </span>
            </div>
          ) : <p className="text-sm text-slate-500">Un document (photo ou PDF), un lien ou un texte ; les destinataires le consultent dans l'ENT, sans pouvoir le télécharger ni l'imprimer.</p>}
        </Card>
      )}
      <Card title={`Documents (${visible.length})`}>
        <ul className="divide-y divide-slate-100">
          {visible.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0"><span className="font-medium text-slate-900">{r.title}</span><span className="block text-xs text-slate-500">{{ LINK: 'Lien', TEXT: 'Texte', pdf: 'PDF', image: 'Photo' }[r.kind] ?? 'Document'} · {r.by} · {fmt(r.at)}</span></span>
              <span className="flex items-center gap-2">
                <Badge tone={r.audience === 'PROFS' ? 'navy' : 'violet'}>{AUDIENCE[r.audience]}</Badge>
                <Button variant="secondary" className="!py-1 text-xs" onClick={() => setOpen(r)}>Consulter</Button>
                {canShare && <button type="button" className="text-xs text-slate-400 hover:text-red-700" onClick={() => { const next = list.filter((x) => x.id !== r.id); setList(next); save(next); }}>Retirer</button>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {open && <Viewer r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
