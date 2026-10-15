import React, { useState } from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { loadFeedback, saveFeedback } from '../feedbackStore.js';

// « Donner mon avis » : sur chaque écran, pour le pilote (classes de Terminale). L'avis part avec
// l'écran et le profil, sans rien avoir à décrire ; la Direction les suit dans « Avis du pilote ».

export const FEEDBACK_TYPES = { PROBLEME: ['red', 'Un problème'], IDEE: ['green', 'Une idée'], QUESTION: ['navy', 'Une question'] };
const STATUS = { NOUVEAU: ['amber', 'Nouveau'], EN_COURS: ['navy', 'En cours'], TRAITE: ['green', 'Traité'] };
const PROFILE_LABEL = { DIRECTION: 'Direction', BUREAU: 'Bureau', VIE_SCOLAIRE: 'Vie scolaire', ENSEIGNANT: 'Enseignant', PARENT: 'Parent', ELEVE: 'Élève' };
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** Bouton flottant présent sur tous les écrans. */
export function FeedbackButton({ profile, who, screen }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ type: 'PROBLEME', text: '', photo: null });
  const [sent, setSent] = useState(false);
  const send = () => {
    saveFeedback([{ id: `a${Date.now()}`, at: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' '), profile, who, screen, ...draft, text: draft.text.trim(), status: 'NOUVEAU' }, ...loadFeedback()]);
    setSent(true);
    setDraft({ type: 'PROBLEME', text: '', photo: null });
  };
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setSent(false); }} aria-label="Donner mon avis"
        className="nav-control fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-coral-500 p-3 sm:px-4 sm:py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-coral-700 print:hidden">
        <Icon name="bell" className="h-4 w-4" /><span className="hidden sm:inline">Donner mon avis</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-label="Donner mon avis" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <div className="space-y-3 text-center">
                <p className="text-lg font-semibold text-navy-900">Merci !</p>
                <p className="text-sm text-slate-600">Votre avis est transmis à la Direction, avec l'écran « {screen} ».</p>
                <Button className="nav-control w-full" onClick={() => setOpen(false)}>Fermer</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-lg font-semibold text-navy-900">Donner mon avis</p>
                <p className="text-xs text-slate-500">Écran : {screen} · {who}</p>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                  {Object.entries(FEEDBACK_TYPES).map(([k, [, l]]) => (
                    <button key={k} type="button" aria-pressed={draft.type === k} onClick={() => setDraft({ ...draft, type: k })}
                      className={`nav-control rounded-md py-1.5 text-xs font-medium ${draft.type === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
                  ))}
                </div>
                <textarea rows={4} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} className={`nav-control ${inputCls}`} aria-label="Votre message"
                  placeholder={draft.type === 'PROBLEME' ? 'Qu\'est-ce qui ne marche pas ? Qu\'attendiez-vous ?' : draft.type === 'IDEE' ? 'Qu\'est-ce qui vous aiderait ?' : 'Votre question'} />
                <label className="block text-xs text-slate-600">Photo d'écran (facultatif)
                  <input type="file" accept="image/*" className="nav-control mt-1 block w-full text-xs" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setDraft((d) => ({ ...d, photo: r.result }));
                    r.readAsDataURL(f);
                  }} />
                </label>
                <div className="flex gap-2">
                  <Button className="nav-control flex-1" disabled={draft.text.trim().length < 5} onClick={send}>Envoyer</Button>
                  <Button variant="secondary" className="nav-control" onClick={() => setOpen(false)}>Annuler</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Direction : suivi des avis du pilote. */
export default function FeedbackModule() {
  const [list, setList] = useState(loadFeedback);
  const [filter, setFilter] = useState({ status: '', profile: '' });
  const update = (id, patch) => { const next = list.map((a) => (a.id === id ? { ...a, ...patch } : a)); setList(next); saveFeedback(next); };
  const shown = list.filter((a) => (!filter.status || a.status === filter.status) && (!filter.profile || a.profile === filter.profile));
  const count = (k, v) => list.filter((a) => a[k] === v).length;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Pilote · Terminale Générale et Terminale STMG</p>
        <h1 className="text-2xl font-semibold text-navy-900">Avis du pilote</h1>
        <p className="text-sm text-slate-500">Problèmes, idées et questions envoyés depuis le bouton « Donner mon avis », avec l'écran et le profil.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nouveaux" value={String(count('status', 'NOUVEAU'))} tone={count('status', 'NOUVEAU') ? 'amber' : undefined} />
        <Stat label="Problèmes" value={String(count('type', 'PROBLEME'))} tone="red" />
        <Stat label="Idées" value={String(count('type', 'IDEE'))} tone="green" />
        <Stat label="Traités" value={String(count('status', 'TRAITE'))} />
      </div>
      <Card title={`Avis (${shown.length})`}
        action={(
          <span className="flex gap-2">
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-sm" aria-label="Statut"><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select>
            <select value={filter.profile} onChange={(e) => setFilter({ ...filter, profile: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-sm" aria-label="Profil"><option value="">Tous les profils</option>{Object.entries(PROFILE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </span>
        )}>
        <ul className="divide-y divide-slate-100">
          {shown.map((a) => (
            <li key={a.id} className="space-y-1.5 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={FEEDBACK_TYPES[a.type][0]}>{FEEDBACK_TYPES[a.type][1]}</Badge>
                <span className="text-xs text-slate-500">{a.at} · {PROFILE_LABEL[a.profile]} ({a.who}) · écran « {a.screen} »</span>
                <span className="ml-auto"><select value={a.status} onChange={(e) => update(a.id, { status: e.target.value })} className="rounded-md border border-slate-300 px-1.5 py-1 text-xs" aria-label={`Statut — ${a.id}`}>{Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select></span>
              </div>
              <p className="text-slate-800">{a.text}</p>
              {a.photo && <img src={a.photo} alt="Photo jointe" className="max-h-40 rounded-lg border border-slate-200" />}
              <input value={a.note ?? ''} onChange={(e) => update(a.id, { note: e.target.value })} placeholder="Suite donnée (visible par la Direction)" className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" aria-label={`Suite donnée — ${a.id}`} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
