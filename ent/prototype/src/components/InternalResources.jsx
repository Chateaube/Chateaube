import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { RESOURCES, SUGGESTIONS } from '../data/resources.js';
import { AUDIENCES, forOf, isProtected, visibleFor, SUGGESTION_CATEGORIES, SUGGESTION_STATUS, suggestionErrors, answerSuggestion } from '../rules/resources.js';
import { documentToDataUrl } from '../image.js';
import { useScreenGuard } from '../screenGuard.js';

// Ressources internes : documents réservés aux professeurs (ou à tout le personnel), partagés par la
// Direction, le secrétariat ou la CPE : un document, un lien ou un simple texte (une consigne, une
// annonce). Consultation seulement : pas de téléchargement, pas d'impression, clic droit et copie
// bloqués, écran noir dès que la page perd le focus (outil de capture, changement d'application).
// Dans l'application installée, la capture d'écran donne un écran noir (Android) ; voir la doc pour
// iPhone. Aucun écran ne peut empêcher une photo prise avec un autre appareil.

const KEY = 'ent-ressources-v3'; // v2 : un ou plusieurs publics (élèves, parents, professeurs, personnel)
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? RESOURCES; } catch { return RESOURCES; } };
const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch { return false; } };
const SKEY = 'ent-suggestions-v1';
export const loadSuggestions = () => { try { return JSON.parse(localStorage.getItem(SKEY)) ?? SUGGESTIONS; } catch { return SUGGESTIONS; } };
const saveS = (l) => { try { localStorage.setItem(SKEY, JSON.stringify(l)); } catch { /* stockage indisponible */ } };
const fmt = (iso) => iso.split('-').reverse().join('/');
const WHO = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'Mme Ranaivo' };

export function Viewer({ r, onClose }) {
  const hidden = useScreenGuard(isProtected(r)); // documents de l'équipe : écran noir en cas de capture
  return (
    <div className={`${isProtected(r) ? 'protected-view ' : ''}fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-3 sm:p-6`} role="dialog" aria-label={r.title}
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
      {isProtected(r) && <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-300">Consultation seulement : ni téléchargement, ni impression, ni copie. L'écran devient noir en cas de capture.</p>}
    </div>
  );
}

export default function InternalResources({ role }) {
  const canShare = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(role);
  const [list, setList] = useState(load);
  const [open, setOpen] = useState(null);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const visible = visibleFor(list, role);
  const viewer = WHO[role] ?? role;
  const [tab, setTab] = useState('docs');
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Élèves, parents, professeurs, équipe · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Documents et ressources</h1>
        <p className="text-sm text-slate-500">Chacun voit les documents de son public : règlement intérieur, chartes, guides… Les ressources de l'équipe se consultent dans l'ENT seulement. Pour une information ponctuelle, utilisez Annonces.</p>
      </div>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
        {[['docs', 'Documents'], ['ideas', 'Boîte à idées']].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>)}
      </div>
      {tab === 'ideas' && <IdeaBox role={role} viewer={viewer} />}
      {tab === 'docs' && canShare && (
        <Card title="Partager un document" action={!d && <Button onClick={() => setD({ kind: 'DOC', title: '', for: ['PROFS'], file: null, url: '', text: '' })}>＋ Partager</Button>}>
          {d ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex gap-1.5 lg:col-span-4">
                {[['DOC', 'Document (photo ou PDF)'], ['LINK', 'Lien'], ['TEXT', 'Texte / annonce']].map(([k, l]) => <button key={k} type="button" aria-pressed={d.kind === k} onClick={() => setD({ ...d, kind: k })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${d.kind === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>)}
              </div>
              <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Titre" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm lg:col-span-2" />
              <div className="flex flex-wrap items-center gap-1.5 lg:col-span-2">
                <span className="text-xs text-slate-500">Pour :</span>
                {Object.entries(AUDIENCES).map(([k, l]) => <button key={k} type="button" aria-pressed={d.for.includes(k)} onClick={() => setD({ ...d, for: d.for.includes(k) ? d.for.filter((x) => x !== k) : [...d.for, k] })}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${d.for.includes(k) ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>)}
              </div>
              {d.kind === 'DOC' && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="file" accept="image/*,application/pdf" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setError(''); setD({ ...d, file: await documentToDataUrl(f) }); } catch (err) { setError(err.message); } }} />
                </label>
              )}
              {d.kind === 'LINK' && <input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://…" aria-label="Lien" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />}
              {d.kind !== 'DOC' && <textarea rows={4} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder={d.kind === 'LINK' ? 'Présentation du lien (facultatif)' : 'Texte de la consigne ou de l\'annonce'} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm lg:col-span-4" />}
              {error && <p className="text-sm text-red-700 lg:col-span-4">{error}</p>}
              <span className="flex gap-2 lg:col-span-4">
                <Button disabled={!d.title.trim() || !d.for.length || (d.kind === 'DOC' ? !d.file : d.kind === 'LINK' ? !/^https?:\/\/\S+\.\S+/.test(d.url.trim()) : !d.text.trim())} onClick={() => {
                  const base = { id: `r${Date.now()}`, title: d.title.trim(), for: d.for, by: viewer, at: new Date().toISOString().slice(0, 10) };
                  const item = d.kind === 'DOC' ? { ...base, kind: d.file.kind, dataUrl: d.file.dataUrl } : d.kind === 'LINK' ? { ...base, kind: 'LINK', url: d.url.trim(), text: d.text.trim() } : { ...base, kind: 'TEXT', text: d.text.trim() };
                  const next = [item, ...list];
                  if (!save(next)) { setError('Le navigateur manque de place pour ce document.'); return; }
                  setList(next); setD(null);
                }}>Partager</Button>
                <Button variant="secondary" onClick={() => setD(null)}>Annuler</Button>
              </span>
            </div>
          ) : <p className="text-sm text-slate-500">Un document (photo ou PDF), un lien ou un texte, pour un ou plusieurs publics. Réservé aux professeurs ou au personnel : consultation seulement, écran noir en cas de capture.</p>}
        </Card>
      )}
      {tab === 'docs' && <Card title={`Documents (${visible.length})`}>
        <ul className="divide-y divide-slate-100">
          {visible.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0"><span className="font-medium text-slate-900">{r.title}</span><span className="block text-xs text-slate-500">{{ LINK: 'Lien', TEXT: 'Texte', pdf: 'PDF', image: 'Photo' }[r.kind] ?? 'Document'} · {r.by} · {fmt(r.at)}</span></span>
              <span className="flex flex-wrap items-center gap-2">
                {forOf(r).map((a) => <Badge key={a} tone={['PROFS', 'PERSONNEL'].includes(a) ? 'navy' : 'violet'}>{AUDIENCES[a].split(' (')[0]}</Badge>)}
                <Button variant="secondary" className="!py-1 text-xs" onClick={() => setOpen(r)}>Consulter</Button>
                {canShare && <button type="button" className="text-xs text-slate-600 hover:text-red-700" onClick={() => { const next = list.filter((x) => x.id !== r.id); setList(next); save(next); }}>Retirer</button>}
              </span>
            </li>
          ))}
        </ul>
      </Card>}
      {open && <Viewer r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Boîte à idées : professeurs et personnel proposent ; la Direction répond. */
function IdeaBox({ role, viewer }) {
  const [list, setList] = useState(loadSuggestions);
  const [d, setD] = useState({ category: 'METHODOLOGIE', text: '', anonymous: false });
  const [tried, setTried] = useState(false);
  const [reply, setReply] = useState({});
  const [error, setError] = useState('');
  const isDirection = role === 'DIRECTION';
  const set = (next) => { setList(next); saveS(next); };
  const errors = suggestionErrors(d);
  return (
    <div className="space-y-5">
      {!isDirection && (
        <Card title="Proposer une idée" subtitle="Sur l'école, les ressources, la méthodologie, la vie scolaire… La Direction lit chaque proposition et répond.">
          <div className="flex flex-wrap gap-1.5">{Object.entries(SUGGESTION_CATEGORIES).map(([k, l]) => <button key={k} type="button" aria-pressed={d.category === k} onClick={() => setD({ ...d, category: k })}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${d.category === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>)}</div>
          <textarea rows={3} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder="Votre idée, et ce qu'elle changerait" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={d.anonymous} onChange={(e) => setD({ ...d, anonymous: e.target.checked })} />Envoyer sans mon nom</label>
          {tried && errors.length > 0 && <p className="mt-1 text-sm text-red-700">{errors.join(' ')}</p>}
          <Button className="mt-2" onClick={() => { setTried(true); if (errors.length) return; set([{ id: `s${Date.now()}`, ...d, text: d.text.trim(), by: d.anonymous ? null : viewer, at: new Date().toISOString().slice(0, 10), status: 'NOUVELLE', answer: '' }, ...list]); setD({ ...d, text: '' }); setTried(false); }}>Envoyer</Button>
        </Card>
      )}
      <Card title={`Idées de l'équipe (${list.length})`}>
        {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
        <ul className="divide-y divide-slate-100">
          {list.map((x) => (
            <li key={x.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-xs text-slate-500">{SUGGESTION_CATEGORIES[x.category]} · {x.anonymous ? 'anonyme' : x.by} · {fmt(x.at)}</p><p className="text-slate-800">{x.text}</p>
                  {x.answer && <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700">Direction : {x.answer}</p>}</div>
                <Badge tone={SUGGESTION_STATUS[x.status][0]}>{SUGGESTION_STATUS[x.status][1]}</Badge>
              </div>
              {isDirection && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={reply[x.id] ?? ''} onChange={(e) => setReply({ ...reply, [x.id]: e.target.value })} placeholder="Réponse (facultative, sauf si non retenue)" className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
                  {['ETUDE', 'RETENUE', 'NON_RETENUE'].map((st) => <Button key={st} variant="secondary" className="!px-2 !py-0.5 text-xs" onClick={() => { const r = answerSuggestion(x, { role, status: st, answer: reply[x.id] ?? x.answer }); if (r.error) { setError(r.error); return; } setError(''); set(list.map((y) => (y.id === x.id ? r.suggestion : y))); }}>{SUGGESTION_STATUS[st][1]}</Button>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Documents de l'école dans le portail des familles (élèves ou parents). */
export function FamilyDocuments({ audience }) {
  const [open, setOpen] = useState(null);
  const docs = visibleFor(load(), audience);
  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft">
      <h2 className="mb-2 font-display text-[15px] font-semibold text-slate-900">Documents de l'école</h2>
      <ul className="divide-y divide-slate-100">
        {docs.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0 text-slate-800">{r.title}</span><Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setOpen(r)}>Lire</Button></li>)}
        {!docs.length && <li className="py-2 text-sm text-slate-500">Aucun document pour l'instant.</li>}
      </ul>
      {open && <Viewer r={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/* ---------- Conditions à lire et accepter à la première connexion ----------
 * Règlement intérieur, charte informatique et IA, réseaux sociaux (élèves, parents) ; règlement des
 * professeurs (enseignants). Chaque document s'ouvre avant d'être accepté ; un document nouveau ou
 * remplacé est redemandé à la connexion suivante. L'acceptation est datée (en base : document_acceptance). */
const ACCEPT_KEY = 'ent-conditions-v1';
const loadAcc = () => { try { return JSON.parse(localStorage.getItem(ACCEPT_KEY)) ?? {}; } catch { return {}; } };
export const toAccept = (viewer, account) => {
  const done = loadAcc()[account] ?? {};
  return visibleFor(load(), viewer).filter((r) => r.accept && done[r.id] !== r.at);
};

export function TermsGate({ viewer, account, children, phone = false }) {
  const [pending, setPending] = useState(() => toAccept(viewer, account));
  const [read, setRead] = useState({});
  const [open, setOpen] = useState(null);
  if (!pending.length) return children;
  const all = pending.every((r) => read[r.id]);
  const accept = () => {
    const acc = loadAcc();
    acc[account] = { ...(acc[account] ?? {}), ...Object.fromEntries(pending.map((r) => [r.id, r.at])), acceptedAt: new Date().toISOString() };
    try { localStorage.setItem(ACCEPT_KEY, JSON.stringify(acc)); } catch { /* stockage indisponible */ }
    setPending([]);
  };
  return (
    <div className={phone ? 'space-y-3' : 'mx-auto max-w-xl space-y-4 py-6'}>
      <div className={phone ? 'px-1' : ''}>
        <h1 className="font-display text-lg font-semibold text-navy-900">Bienvenue sur l'ENT de Chateaubriand</h1>
        <p className="text-sm text-slate-600">Avant de commencer, lisez {pending.length > 1 ? 'ces documents' : 'ce document'} de l'école et acceptez-{pending.length > 1 ? 'les' : 'le'}.</p>
      </div>
      <ul className="space-y-2">
        {pending.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-soft">
            <p className="text-sm font-medium text-slate-800">{r.title}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => { setOpen(r); setRead({ ...read, [r.id]: true }); }}>Lire</Button>
              <span className={`text-xs ${read[r.id] ? 'text-emerald-700' : 'text-slate-400'}`}>{read[r.id] ? '✓ lu' : 'à lire'}</span>
            </div>
          </li>
        ))}
      </ul>
      <Button className="w-full" disabled={!all} onClick={accept}>{all ? 'J\'ai lu et j\'accepte' : 'Lisez chaque document pour continuer'}</Button>
      {open && <Viewer r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
