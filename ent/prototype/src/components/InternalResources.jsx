import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { RESOURCES } from '../data/resources.js';
import { documentToDataUrl } from '../image.js';
import { useScreenGuard } from '../screenGuard.js';

// Ressources internes : documents réservés aux professeurs (ou à tout le personnel), partagés par la
// Direction, le secrétariat ou la CPE. Consultation seulement : pas de bouton de téléchargement, pas
// d'impression, clic droit bloqué, écran masqué dès que la page perd le focus (outil de capture),
// filigrane au nom de la personne. Aucune page web ne peut empêcher une photo de l'écran : le
// filigrane permet de retrouver qui a laissé fuiter un document. Dans l'application Android, la
// capture d'écran est bloquée (écran noir).

const KEY = 'ent-ressources-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? RESOURCES; } catch { return RESOURCES; } };
const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch { return false; } };
const AUDIENCE = { PROFS: 'Professeurs', PERSONNEL: 'Tout le personnel' };
const fmt = (iso) => iso.split('-').reverse().join('/');
const WHO = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'Mme Ranaivo' };

function Viewer({ r, viewer, onClose }) {
  const hidden = useScreenGuard(true);
  const mark = `${viewer} · ${new Date().toLocaleDateString('fr-FR')} · usage interne · `;
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
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden text-[11px] font-semibold leading-[3.2] text-slate-500/25" style={{ transform: 'rotate(-24deg) scale(1.4)' }}>{mark.repeat(120)}</div>
          </>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-300">Consultation seulement : ni téléchargement, ni impression. Le document porte votre nom en filigrane.</p>
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
        <Card title="Partager un document" action={!d && <Button onClick={() => setD({ title: '', audience: 'PROFS', file: null })}>＋ Document</Button>}>
          {d ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Titre" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm lg:col-span-2" />
              <select value={d.audience} onChange={(e) => setD({ ...d, audience: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">{Object.entries(AUDIENCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="file" accept="image/*,application/pdf" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setError(''); setD({ ...d, file: await documentToDataUrl(f) }); } catch (err) { setError(err.message); } }} />
              </label>
              {error && <p className="text-sm text-red-700 lg:col-span-4">{error}</p>}
              <span className="flex gap-2 lg:col-span-4">
                <Button disabled={!d.title.trim() || !d.file} onClick={() => {
                  const next = [{ id: `r${Date.now()}`, title: d.title.trim(), audience: d.audience, by: viewer, at: new Date().toISOString().slice(0, 10), kind: d.file.kind, dataUrl: d.file.dataUrl }, ...list];
                  if (!save(next)) { setError('Le navigateur manque de place pour ce document.'); return; }
                  setList(next); setD(null);
                }}>Partager</Button>
                <Button variant="secondary" onClick={() => setD(null)}>Annuler</Button>
              </span>
            </div>
          ) : <p className="text-sm text-slate-500">Photo ou PDF ; les destinataires le consultent sans pouvoir le télécharger.</p>}
        </Card>
      )}
      <Card title={`Documents (${visible.length})`}>
        <ul className="divide-y divide-slate-100">
          {visible.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0"><span className="font-medium text-slate-900">{r.title}</span><span className="block text-xs text-slate-500">{r.by} · {fmt(r.at)}</span></span>
              <span className="flex items-center gap-2">
                <Badge tone={r.audience === 'PROFS' ? 'navy' : 'violet'}>{AUDIENCE[r.audience]}</Badge>
                <Button variant="secondary" className="!py-1 text-xs" onClick={() => setOpen(r)}>Consulter</Button>
                {canShare && <button type="button" className="text-xs text-slate-400 hover:text-red-700" onClick={() => { const next = list.filter((x) => x.id !== r.id); setList(next); save(next); }}>Retirer</button>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {open && <Viewer r={open} viewer={viewer} onClose={() => setOpen(null)} />}
    </div>
  );
}
