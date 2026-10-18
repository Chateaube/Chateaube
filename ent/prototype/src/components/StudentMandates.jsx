import React, { useState } from 'react';
import { Badge, Button } from './ui.jsx';
import { create, STATUS } from '../rules/publication.js';
import { audienceErrors, serviceLabel, can } from '../rules/mandates.js';
import { loadAnnouncements, saveAnnouncement } from '../announcementsStore.js';
import { loadEventProposals, saveEventProposal, addCouncilFeedback, loadCouncilFeedback } from '../studentInitiativesStore.js';
import { TERM } from '../data/grades.js';

// Outils des élèves mandatés (portail élève) : un délégué écrit à sa classe et prépare le conseil ; le BDE
// rédige des annonces pour les élèves et propose des événements. Tout passe par la validation de la Direction ;
// aucun de ces outils ne donne accès aux notes, à la vie scolaire des autres ni aux paramètres.

const now = () => new Date().toISOString().slice(0, 16);
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

function MySubmissions({ items }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {items.map((a) => (
        <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2">
          <span className="flex items-center justify-between gap-2"><span className="font-medium text-slate-800">{a.title}</span><Badge tone={STATUS[a.status][0]}>{STATUS[a.status][1]}</Badge></span>
          {a.status === 'A_REVOIR' && <span className="block text-xs text-red-700">Remarque de la Direction : {a.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function AnnouncementForm({ mandate, me, scopeChoices }) {
  const [d, setD] = useState({ title: '', text: '', scope: scopeChoices[0][0] });
  const [err, setErr] = useState([]);
  const [msg, setMsg] = useState('');
  const [list, setList] = useState(() => loadAnnouncements().list.filter((a) => a.authorName === me && a.authorRole === mandate.kind));
  const send = () => {
    const audience = mandate.kind === 'DELEGUE' ? { roles: ['ELEVE'], site: mandate.site, scope: 'CLASS', values: [mandate.cls] } : { roles: ['ELEVE'], site: mandate.site, scope: d.scope, values: [] };
    const e = [...(!d.title.trim() ? ['Donner un titre.'] : []), ...(!d.text.trim() ? ['Écrire le message.'] : []), ...audienceErrors(mandate, audience)];
    setErr(e); if (e.length) return;
    const a = create('ANNONCE', { title: d.title.trim(), text: d.text.trim(), photos: [], audience, ack: false, email: false, service: serviceLabel(mandate) }, { role: mandate.kind, name: me, at: now() }, { send: true });
    saveAnnouncement(a);
    setList([a, ...list]); setD({ ...d, title: '', text: '' }); setMsg('Envoyée : relue par la CPE puis validée par la Direction avant publication.');
  };
  return (
    <div className="space-y-2">
      <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Titre" className={inputCls} />
      <textarea rows={3} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder="Votre message…" className={inputCls} />
      {scopeChoices.length > 1 && <select value={d.scope} onChange={(e) => setD({ ...d, scope: e.target.value })} aria-label="Destinataires" className={inputCls}>{scopeChoices.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
      {err.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-xs text-red-800">{err.map((x) => <li key={x}>· {x}</li>)}</ul>}
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      <Button className="w-full" onClick={send}>Envoyer pour relecture</Button>
      <MySubmissions items={list} />
    </div>
  );
}

function EventForm({ me }) {
  const [d, setD] = useState({ title: '', text: '', date: '', start: '12:00', end: '13:00', place: '' });
  const [err, setErr] = useState([]);
  const [list, setList] = useState(() => loadEventProposals().filter((e) => e.authorName === me));
  const send = () => {
    const e = [!d.title.trim() && 'Donner un titre.', !d.date && 'Choisir une date.', d.end <= d.start && 'L\'heure de fin doit suivre l\'heure de début.'].filter(Boolean);
    setErr(e); if (e.length) return;
    const ev = { ...create('EVENEMENT', { ...d, title: d.title.trim(), service: 'Bureau des élèves (BDE)' }, { role: 'BDE', name: me, at: now() }, { send: true }), id: `ev${Date.now()}` };
    saveEventProposal(ev); setList([ev, ...list]); setD({ ...d, title: '', text: '', date: '', place: '' });
  };
  return (
    <div className="space-y-2">
      <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Événement (ex. tournoi, collecte, soirée)" className={inputCls} />
      <textarea rows={2} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder="Description, organisation" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} aria-label="Date" className={inputCls} />
        <input type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} aria-label="Début" className={inputCls} />
        <input type="time" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} aria-label="Fin" className={inputCls} />
      </div>
      <input value={d.place} onChange={(e) => setD({ ...d, place: e.target.value })} placeholder="Lieu" className={inputCls} />
      {err.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-xs text-red-800">{err.map((x) => <li key={x}>· {x}</li>)}</ul>}
      <Button className="w-full" onClick={send}>Proposer l'événement</Button>
      <p className="text-[11px] text-slate-600">Relu par la CPE, validé par la Direction, puis ajouté au calendrier de l'école.</p>
      <MySubmissions items={list} />
    </div>
  );
}

function CouncilPrep({ mandate, me }) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(() => loadCouncilFeedback().filter((f) => f.by === me));
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">Conseil de classe : <strong>{TERM.council}</strong>.</p>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ce que la classe souhaite dire au conseil : ambiance, charge de travail, demandes… (pas de cas individuel)" className={inputCls} />
      <Button className="w-full" disabled={!text.trim()} onClick={() => { const f = { cls: mandate.cls, by: me, at: now(), text: text.trim(), term: TERM.id }; addCouncilFeedback(f); setSent([f, ...sent]); setText(''); }}>Envoyer au secrétariat</Button>
      {sent.map((f, i) => <p key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">Envoyé le {f.at.slice(8, 10)}/{f.at.slice(5, 7)} : {f.text}</p>)}
    </div>
  );
}

export default function StudentMandates({ student, me, view }) {
  const delegate = student.mandates.find((m) => m.kind === 'DELEGUE');
  const bde = student.mandates.find((m) => m.kind === 'BDE');
  const box = (title, sub, children) => <section className="rounded-2xl bg-white p-4 shadow-soft"><h2 className="font-display text-[15px] font-semibold text-slate-900">{title}</h2><p className="mb-3 text-xs text-slate-600">{sub}</p>{children}</section>;
  return (
    <div className="space-y-3">
      {view === 'mandate-class' && delegate && can(student, 'ANNONCE_CLASSE') && box(`Écrire à ma classe — ${delegate.cls}`, 'Message aux élèves de la classe : relu par la CPE, validé par la Direction.', <AnnouncementForm mandate={delegate} me={me} scopeChoices={[['CLASS', delegate.cls]]} />)}
      {view === 'mandate-council' && delegate && can(student, 'LIAISON_CONSEIL') && box('Préparer le conseil de classe', 'Les remarques de la classe, transmises au secrétariat pour le conseil.', <CouncilPrep mandate={delegate} me={me} />)}
      {view === 'mandate-bde' && bde && box(`BDE${bde.president ? ' — présidence' : ''}`, 'Annonces aux élèves et événements : relus par la CPE, validés par la Direction.', <>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Proposer un événement</h3>
        {can(student, 'EVENEMENT') && <EventForm me={me} />}
        <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-800">Rédiger une annonce</h3>
        {can(student, 'ANNONCE_ELEVES') && <AnnouncementForm mandate={bde} me={me} scopeChoices={[['ALL', 'Tous les élèves du site']]} />}
      </>)}
    </div>
  );
}
