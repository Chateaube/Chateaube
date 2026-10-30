import { useNarrow } from '../useNarrow.js';
import React, { useEffect, useRef, useState } from 'react';
import { Avatar, Button, Icon } from './ui.jsx';
import { THREADS, RECIPIENTS, RECIPIENT_GROUPS, broadcastSize } from '../data/messages.js';
import { takeIntent } from '../navIntent.js';
import { useDraft } from '../draftStore.js';
import { usePersistent, readStored } from '../persist.js';
import { demoOr } from '../demoData.js';
import { imageToDataUrl } from '../image.js';
import { atWork, nextOpening, openingLabel } from '../rules/workHours.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';

// Messagerie de l'ENT, pour tous les profils et dans tous les sens : professeurs ↔ élèves,
// professeurs ↔ parents, professeurs ↔ collègues, familles ↔ établissement ; une classe entière
// en un envoi (réponses en privé). Texte et photos ; application et e-mail, pas de SMS.
// Téléphone : liste des conversations puis la conversation en plein écran ; ordinateur : côte à côte.

const keyOf = (audience) => (['PARENT', 'ELEVE', 'TEACHER'].includes(audience) ? audience : audience === 'ENSEIGNANT' ? 'TEACHER' : 'STAFF');

const DEMO_PHOTOS = { ticket: 'Photo : ticket du taxi-be', id: 'Photo : pièce d\'identité' };
const time = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
const MAX_PHOTOS = 4;

function Photo({ photo }) {
  if (DEMO_PHOTOS[photo]) {
    return <span className="mt-1.5 flex h-24 w-36 items-center justify-center rounded-lg bg-slate-200 px-2 text-center text-[11px] text-slate-600"><Icon name="pin" className="mr-1 h-3.5 w-3.5" />{DEMO_PHOTOS[photo]}</span>;
  }
  return <img src={photo} alt="Photo jointe" className="mt-1.5 max-h-48 rounded-lg object-cover" />;
}

// Pas de réponse en dehors des horaires de travail : la famille le sait au moment d'écrire.
function WorkHoursNotice() {
  const now = `2026-10-13T${new Date().toTimeString().slice(0, 5)}`;
  const next = nextOpening(now, DEFAULT_SETTINGS);
  return atWork(now, DEFAULT_SETTINGS)
    ? <span className="mt-1 block text-[11px] text-slate-600">L'équipe répond pendant les horaires de travail : du lundi au vendredi 7h–17h, le mercredi 7h–12h. Urgence : appelez la vie scolaire.</span>
    : <span className="mt-1 block text-[11px] font-medium text-amber-800">En dehors des horaires de travail : votre message sera lu {next ? openingLabel(next) : 'à la reprise'}. Urgence : appelez l'école.</span>;
}

export default function Messenger({ audience, compact: forceCompact = false, me = 'Moi' }) {
  const key = keyOf(audience);
  const narrow = useNarrow();
  const compact = forceCompact || narrow;
  const [threads, setThreads] = usePersistent(`ent-s-messages-${key}`, () => demoOr(THREADS[key] ?? [], []));
  const [openId, setOpenId] = useState(compact ? null : threads[0]?.id);
  const [text, setText, clearText, restored] = useDraft(`message-${key}`, '');
  const [photos, setPhotos] = useState([]);
  const [newTo, setNewTo] = useState(() => takeIntent('messages')?.to ?? null);
  const fileRef = useRef(null);
  const [side, setSide] = useState('ALL'); // personnel : Familles (parents, élèves) ou Équipe
  const isFamily = (w) => /parent|mère|père|élève|famille|toute la classe|tuteur|tutrice/i.test(w);
  const staffSide = ['STAFF', 'TEACHER'].includes(audience);
  const open = threads.find((t) => t.id === openId);

  const addPhotos = (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length);
    // photos réduites et gardées dans le message (une adresse temporaire disparaîtrait au rechargement)
    Promise.all(imgs.map((f) => imageToDataUrl(f, 1200, 0.7).catch(() => null))).then((urls) => setPhotos((prev) => [...prev, ...urls.filter(Boolean)]));
  };
  const send = () => {
    const now = '2026-10-13T' + new Date().toTimeString().slice(0, 5);
    const msgs = [...(text.trim() ? [{ from: 'me', at: now, text: text.trim() }] : []), ...photos.map((p) => ({ from: 'me', at: now, text: '', photo: p }))];
    if (!msgs.length) return;
    if (newTo) {
      const id = `n${Date.now()}`;
      setThreads([{ id, with: newTo, about: 'Nouveau message', unread: 0, broadcast: broadcastSize(newTo) || undefined, messages: msgs }, ...threads]);
      setOpenId(id); setNewTo(null);
    } else {
      setThreads(threads.map((t) => (t.id === openId ? { ...t, messages: [...t.messages, ...msgs] } : t)));
    }
    clearText(); setPhotos([]);
  };
  const openThread = (id) => { setOpenId(id); setNewTo(null); setThreads(threads.map((t) => (t.id === id ? { ...t, unread: 0 } : t))); };

  const list = (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Conversations</p>
        <Button variant="secondary" className="!px-3 !py-1 text-xs" onClick={() => { setNewTo(RECIPIENTS[key][0]); setOpenId(null); }}>＋ Nouveau</Button>
      </div>
      {staffSide && (
        <div className="mb-2 flex gap-1 rounded-full bg-slate-100 p-1" role="group" aria-label="Filtrer les conversations">
          {[['ALL', 'Tout'], ['FAM', 'Familles'], ['TEAM', 'Équipe']].map(([k, l]) => <button key={k} type="button" aria-pressed={side === k} onClick={() => setSide(k)} className={`flex-1 rounded-full px-2 py-1 text-xs font-medium ${side === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>)}
        </div>
      )}
      <ul className="space-y-1">
        {threads.filter((t) => side === 'ALL' || (side === 'FAM') === isFamily(t.with)).map((t) => {
          const last = t.messages[t.messages.length - 1];
          return (
            <li key={t.id}>
              <button onClick={() => openThread(t.id)} className={`flex w-full items-start gap-2.5 rounded-xl p-2 text-left ${t.id === openId ? 'bg-navy-50' : 'hover:bg-slate-50'}`}>
                <Avatar name={t.with} className="h-9 w-9 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{t.with}</span>
                    {t.unread > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{t.unread}</span>}</span>
                  <span className="block truncate text-xs text-slate-500">{last ? (last.photo && !last.text ? '📷 Photo' : last.text) : t.about}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const thread = (open || newTo) && (
    <div className="flex min-h-[420px] min-w-0 flex-col rounded-2xl bg-slate-50">
      <div className="flex items-center gap-2 border-b border-slate-200 p-3">
        {compact && <button onClick={() => { setOpenId(null); setNewTo(null); }} className="text-sm font-medium text-navy-500">‹</button>}
        {newTo ? (
          <label className="flex-1 text-xs text-slate-600">À
            <select value={newTo} onChange={(e) => setNewTo(e.target.value)} className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm">
              {RECIPIENT_GROUPS[key].map(([g, list]) => <optgroup key={g} label={g}>{list.map((r) => <option key={r}>{r}</option>)}</optgroup>)}
            </select>
            {['PARENT', 'ELEVE'].includes(key) && <WorkHoursNotice />}
            {broadcastSize(newTo) > 0 && <span className="mt-1 block text-[11px] text-navy-700">Envoyé à {broadcastSize(newTo)} destinataires ; les réponses arrivent en privé.</span>}
          </label>
        ) : (<><Avatar name={open.with} className="h-8 w-8 text-[11px]" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{open.with}</span><span className="text-xs text-slate-500">{open.about}{open.broadcast ? ` · envoyé à ${open.broadcast} destinataires` : ''}</span></span></>)}
      </div>
      <ol className="flex-1 space-y-2 overflow-y-auto p-3">
        {(open?.messages ?? []).map((m, i) => (
          <li key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'rounded-br-md bg-navy-500 text-white' : 'rounded-bl-md bg-white text-slate-800 shadow-sm'}`}>
              {m.text && <p>{m.text}</p>}
              {m.photo && <Photo photo={m.photo} />}
              <p className={`mt-0.5 text-[10px] ${m.from === 'me' ? 'text-navy-100' : 'text-slate-400'}`}>{time(m.at)}</p>
            </div>
          </li>
        ))}
        {newTo && <li className="text-center text-xs text-slate-400">Nouveau message à {newTo}</li>}
      </ol>
      {photos.length > 0 && (
        <div className="flex gap-2 px-3 pt-2">
          {photos.map((p, i) => (
            <span key={p} className="relative">
              <img src={p} alt={`Photo ${i + 1} à envoyer`} className="h-14 w-14 rounded-lg object-cover" />
              <button aria-label="Retirer la photo" onClick={() => setPhotos(photos.filter((x) => x !== p))} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-800 p-0.5 text-white"><Icon name="x" className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" aria-label="Joindre des photos"
          onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
        <button type="button" aria-label="Joindre une photo" title={`Joindre des photos (${MAX_PHOTOS} max.)`} disabled={photos.length >= MAX_PHOTOS}
          onClick={() => fileRef.current.click()} className="rounded-full bg-white p-2 text-navy-500 shadow-sm disabled:opacity-40">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h3l1.5-2h5L14 7h3v9H3zM10 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></svg>
        </button>
        {restored && text && <span className="sr-only">Brouillon retrouvé</span>}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Écrire un message…" className="min-h-[38px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        <Button onClick={send} disabled={!text.trim() && !photos.length}>Envoyer</Button>
      </div>
    </div>
  );

  if (compact) return thread || list;
  return <div className="grid gap-4 lg:grid-cols-[320px_1fr]">{list}{thread || <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">Choisissez une conversation.</div>}</div>;
}

export const unreadCount = (audience) => (readStored(`ent-s-messages-${keyOf(audience)}`) ?? demoOr(THREADS[keyOf(audience)] ?? [], [])).reduce((s, t) => s + t.unread, 0);
