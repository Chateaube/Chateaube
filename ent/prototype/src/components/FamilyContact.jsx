import React, { useState } from 'react';
import { Badge, Button } from './ui.jsx';
import { DocumentInput, DocumentThumb } from './PhotoInput.jsx';
import { addRequest, requestsFor } from '../requestsStore.js';

// « Rendez-vous et dispenses » du portail des familles, d'après le passeport de vie scolaire :
//  - À qui s'adresser ? (les personnes ressources et ce dont elles s'occupent) ;
//  - demande de rendez-vous (avec qui, motif, deux créneaux proposés ; réponse : accord ou autre proposition) ;
//  - dispense d'EPS : ponctuelle (demande écrite des parents, validée par la vie scolaire ; l'élève assiste
//    au cours) ou inaptitude avec certificat médical (au-delà d'un mois : formulaire de l'établissement).
export const CONTACTS = [
  ['Cheffe d\'établissement (directrice) et adjoint·e de direction', 'Direction', ['Rencontrer la direction', 'L\'orientation, les choix de filières', 'Une situation difficile ou confidentielle', 'Les projets scolaires', 'Être écouté·e et accompagné·e']],
  ['Intendance / administration', 'Secrétariat', ['Les démarches administratives', 'Les certificats et attestations', 'Les frais de scolarité', 'Les documents officiels']],
  ['C.P.E. / vie scolaire', 'Vie scolaire', ['Les absences et les retards', 'La vie quotidienne au collège et au lycée', 'Une question ou une difficulté', 'Le lien avec les professeur·e·s']],
  ['Les professeur·e·s', 'Professeur', ['Les résultats scolaires', 'Le travail et les méthodes', 'Les difficultés, les besoins particuliers', 'L\'orientation']],
  ['Les élèves délégué·e·s', 'Délégués', ['Faire entendre la voix des élèves', 'Transmettre une question ou une idée', 'Signaler une difficulté', 'Participer au conseil de classe']],
];
const WITH = ['La cheffe d\'établissement', 'L\'adjointe de direction', 'La vie scolaire (CPE)', 'Le secrétariat', 'Un·e professeur·e'];
const STATUS = { A_TRAITER: ['amber', 'en attente'], VALIDEE: ['green', 'répondu'], REFUSEE: ['red', 'refusé'] };
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm';
const fmt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export default function FamilyContact({ profile, studentKey, guardianName, isParent, go }) {
  const [rdv, setRdv] = useState({ with: WITH[0], teacher: '', reason: '', slots: [{ date: '', time: '' }, { date: '', time: '' }] });
  const [eps, setEps] = useState({ type: 'PONCTUELLE', from: '', to: '', reason: '', certificate: null });
  const [sent, setSent] = useState(() => requestsFor(studentKey).filter((r) => ['RDV', 'DISPENSE_EPS'].includes(r.kind)));
  const [msg, setMsg] = useState('');
  const refresh = (text) => { setSent(requestsFor(studentKey).filter((r) => ['RDV', 'DISPENSE_EPS'].includes(r.kind))); setMsg(text); };
  const slots = rdv.slots.filter((s) => s.date && s.time);
  const rdvOk = rdv.reason.trim() && slots.length > 0 && (rdv.with !== WITH[4] || rdv.teacher.trim());
  const epsOk = eps.from && eps.reason.trim() && (eps.type === 'PONCTUELLE' || (eps.to && eps.to >= eps.from));
  const send = (kind, payload, documents) => addRequest({ kind, studentKey, studentId: profile?.id, from: guardianName, payload, documents });
  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-[15px] font-semibold text-slate-900">À qui s'adresser ?</h2>
        <p className="mb-2 text-xs text-slate-600">Plusieurs personnes sont là pour écouter, accompagner, conseiller et aider. Choisissez la plus adaptée.</p>
        <ul className="space-y-2">
          {CONTACTS.map(([who, , topics]) => (
            <li key={who} className="rounded-xl bg-slate-50 p-2.5"><p className="text-sm font-semibold text-navy-900">{who}</p><p className="text-xs text-slate-700">{topics.join(' · ')}</p></li>
          ))}
        </ul>
        {go && <Button variant="secondary" className="mt-2 w-full" onClick={() => go('messages')}>Écrire un message</Button>}
      </section>

      {msg && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ {msg}</p>}

      {isParent && (
        <section className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">Demander un rendez-vous</h2>
          <label className="mt-2 block text-xs text-slate-600">Avec<select value={rdv.with} onChange={(e) => setRdv({ ...rdv, with: e.target.value })} className={field}>{WITH.map((w) => <option key={w}>{w}</option>)}</select></label>
          {rdv.with === WITH[4] && <label className="mt-2 block text-xs text-slate-600">Quel professeur ?<input value={rdv.teacher} onChange={(e) => setRdv({ ...rdv, teacher: e.target.value })} className={field} /></label>}
          <label className="mt-2 block text-xs text-slate-600">Motif<input value={rdv.reason} onChange={(e) => setRdv({ ...rdv, reason: e.target.value })} className={field} /></label>
          <p className="mt-2 text-xs text-slate-600">Deux créneaux qui vous conviendraient</p>
          {rdv.slots.map((s, i) => (
            <div key={i} className="mt-1 grid grid-cols-2 gap-2">
              <input type="date" value={s.date} onChange={(e) => setRdv({ ...rdv, slots: rdv.slots.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)) })} aria-label={`Date ${i + 1}`} className={field} />
              <input type="time" value={s.time} onChange={(e) => setRdv({ ...rdv, slots: rdv.slots.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)) })} aria-label={`Heure ${i + 1}`} className={field} />
            </div>
          ))}
          <Button className="mt-3 w-full" disabled={!rdvOk} onClick={() => { send('RDV', { with: rdv.with === WITH[4] ? `${rdv.teacher.trim()} (professeur)` : rdv.with, reason: rdv.reason.trim(), slots }); setRdv({ ...rdv, reason: '', slots: [{ date: '', time: '' }, { date: '', time: '' }] }); refresh('Demande de rendez-vous envoyée : la réponse arrive ici.'); }}>Envoyer la demande</Button>
        </section>
      )}

      {isParent && (
        <section className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">Dispense d'EPS</h2>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1" role="group" aria-label="Type de dispense">
            {[['PONCTUELLE', 'Une séance'], ['INAPTITUDE', 'Inaptitude (certificat)']].map(([k, l]) => <button key={k} type="button" aria-pressed={eps.type === k} onClick={() => setEps({ ...eps, type: k })} className={`rounded-full px-2 py-2 text-xs font-medium ${eps.type === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>)}
          </div>
          <p className="mt-2 text-xs text-slate-600">{eps.type === 'PONCTUELLE' ? 'Demande écrite des parents, validée par la vie scolaire avant le cours ; l\'élève assiste néanmoins au cours.' : 'Un mois ou moins : certificat médical. Au-delà d\'un mois ou pour l\'année : certificat sur le formulaire de l\'établissement. L\'élève reste présent au cours et réalise des tâches adaptées (arbitrage, observation).'}</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">{eps.type === 'PONCTUELLE' ? 'Séance du' : 'Du'}<input type="date" value={eps.from} onChange={(e) => setEps({ ...eps, from: e.target.value })} className={field} /></label>
            {eps.type === 'INAPTITUDE' && <label className="text-xs text-slate-600">Au<input type="date" value={eps.to} onChange={(e) => setEps({ ...eps, to: e.target.value })} className={field} /></label>}
          </div>
          <label className="mt-2 block text-xs text-slate-600">Motif<input value={eps.reason} onChange={(e) => setEps({ ...eps, reason: e.target.value })} className={field} /></label>
          {eps.type === 'INAPTITUDE' && <div className="mt-2 flex items-center gap-2">{eps.certificate && <DocumentThumb doc={eps.certificate} title="Certificat médical" />}<DocumentInput label={eps.certificate ? 'Changer le certificat' : '＋ Certificat médical (photo)'} onAdd={(certificate) => setEps({ ...eps, certificate })} /></div>}
          <Button className="mt-3 w-full" disabled={!epsOk} onClick={() => { send('DISPENSE_EPS', { type: eps.type, from: eps.from, to: eps.type === 'INAPTITUDE' ? eps.to : eps.from, reason: eps.reason.trim(), certificate: Boolean(eps.certificate) }, eps.certificate ? [{ ...eps.certificate, code: 'AUTRE', label: 'Certificat médical EPS' }] : []); setEps({ type: eps.type, from: '', to: '', reason: '', certificate: null }); refresh('Demande de dispense envoyée à la vie scolaire.'); }}>Envoyer la demande</Button>
        </section>
      )}

      {sent.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">Mes demandes</h2>
          <ul className="mt-1 divide-y divide-slate-100">
            {sent.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <p className="flex items-center justify-between gap-2"><span>{r.kind === 'RDV' ? `Rendez-vous — ${r.payload.with}` : 'Dispense d\'EPS'} · {fmt(r.submittedAt)}</span><Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge></p>
                {r.note && <p className="text-xs text-slate-700">{r.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
