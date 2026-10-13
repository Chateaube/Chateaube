import React, { useMemo, useState } from 'react';
import { Badge, Button, Icon } from './ui.jsx';
import { PARENT } from '../data/people.js';
import { FAMILIES, JOURNALS } from '../data/accounting.js';
import { accountStatement } from '../rules/accounting.js';
import { formatAr } from '../rules/finance.js';

const fmtDate = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const TABS = [['home', 'Accueil', 'home'], ['school', 'Scolarité', 'cap'], ['pay', 'Paiements', 'wallet'], ['msg', 'Messages', 'bell']];

function Section({ title, children }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {title && <h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2>}
      {children}
    </section>
  );
}

function Home({ child }) {
  return (
    <>
      {PARENT.alerts.map((a) => (
        <div key={a.title} className={`rounded-xl p-3 ring-1 ${a.tone === 'red' ? 'bg-red-50 ring-red-200' : 'bg-amber-50 ring-amber-200'}`}>
          <p className={`text-sm font-semibold ${a.tone === 'red' ? 'text-red-900' : 'text-amber-900'}`}>{a.title}</p>
          <p className={`text-sm ${a.tone === 'red' ? 'text-red-800' : 'text-amber-800'}`}>{a.body}</p>
        </div>
      ))}
      <Section title={`Aujourd'hui — ${child.name}`}>
        <ul className="space-y-1.5">
          {child.timetable.map(([t, s]) => (
            <li key={t} className="flex gap-3 text-sm"><span className="w-12 tabular-nums font-medium text-navy-900">{t.replace(':', 'h')}</span><span className="text-slate-700">{s}</span></li>
          ))}
        </ul>
      </Section>
      <Section title="Actualités">
        <ul className="space-y-3">
          {PARENT.news.map((n) => (
            <li key={n.title}><p className="text-xs text-slate-500">{n.date}</p><p className="text-sm font-medium text-slate-800">{n.title}</p><p className="text-sm text-slate-600">{n.body}</p></li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function School({ child }) {
  return (
    <>
      <Section title="Dernières notes">
        <ul className="divide-y divide-slate-100">
          {child.grades.map((g) => (
            <li key={g.subject + g.title} className="flex items-center justify-between py-2">
              <div><p className="text-sm font-medium text-slate-800">{g.subject}</p><p className="text-xs text-slate-500">{g.title} · {g.date} · moyenne de classe {g.avg}</p></div>
              <span className="rounded-md bg-navy-50 px-2 py-1 text-sm font-semibold tabular-nums text-navy-900">{g.value}<span className="text-xs font-normal text-slate-500">/20</span></span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Bulletins">
        <p className="text-sm text-slate-600">Le bulletin du 1er trimestre sera disponible après le conseil de classe (décembre).</p>
      </Section>
      <Section title="Absences et retards">
        {child.attendance.length === 0
          ? <p className="text-sm text-slate-600">Aucune absence ni aucun retard ce trimestre.</p>
          : child.attendance.map((a) => (
            <div key={a.date} className="flex items-center justify-between text-sm">
              <div><p className="font-medium text-slate-800">{a.kind} — {a.date}</p><p className="text-xs text-slate-500">{a.detail}</p></div>
              <Badge tone={a.justified ? 'green' : 'amber'}>{a.justified ? 'Justifié' : 'À justifier'}</Badge>
            </div>
          ))}
      </Section>
      {child.exam && <Section title="Examens"><p className="text-sm text-slate-600">{child.exam}</p></Section>}
    </>
  );
}

function Payments() {
  const fam = FAMILIES.find((f) => f.id === PARENT.familyId);
  const { rows, byJournal, totals } = useMemo(() => accountStatement(fam.lines), [fam]);
  const [info, setInfo] = useState(false);
  return (
    <>
      <Section>
        <p className="text-xs text-slate-500">Reste à payer (famille)</p>
        <p className={`text-2xl font-semibold tabular-nums ${totals.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatAr(totals.balance)}</p>
        <div className="mt-3 space-y-1.5">
          {Object.entries(JOURNALS).map(([k, j]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <Badge tone={j.tone}>{j.label}</Badge>
              <span className="tabular-nums">{(byJournal[k]?.balance ?? 0) > 0 ? formatAr(byJournal[k].balance) : 'À jour'}</span>
            </div>
          ))}
        </div>
        <Button className="mt-4 w-full" onClick={() => setInfo(!info)}>Payer par mobile money</Button>
        {info && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Paiement Mvola / Orange Money / Airtel Money : intégration à définir avec l'opérateur. En attendant, la caisse enregistre le paiement et le reçu apparaît ici.</p>}
      </Section>
      <Section title="Prochaine échéance">
        <p className="text-sm text-slate-700">Écolage de novembre : <span className="font-semibold">760 000 Ar</span> le jeudi 5 novembre.</p>
      </Section>
      <Section title="Historique">
        <ul className="divide-y divide-slate-100">
          {[...rows].reverse().map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0"><p className="truncate text-sm text-slate-800">{r.label}</p><p className="text-xs text-slate-500">{fmtDate(r.date)} · {JOURNALS[r.journal].label}</p></div>
              <span className={`whitespace-nowrap text-sm font-medium tabular-nums ${r.credit ? 'text-emerald-700' : 'text-slate-800'}`}>{r.credit ? `− ${formatAr(r.credit)}` : formatAr(r.debit)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function Messages() {
  const [sent, setSent] = useState(false);
  const [text, setText] = useState('');
  return (
    <>
      <Section title="Messages reçus">
        <ul className="space-y-3 text-sm">
          <li><p className="text-xs text-slate-500">05/10 · SMS · Vie scolaire</p><p className="text-slate-700">Aina est arrivée en retard (10 min) ce matin.</p></li>
          <li><p className="text-xs text-slate-500">09/10 · E-mail · Vie scolaire</p><p className="text-slate-700">Dossier Pré-Bac d'Aina : merci de déposer une photo d'identité avant le 30 octobre.</p></li>
        </ul>
      </Section>
      <Section title="Écrire à la vie scolaire">
        {sent ? <p className="text-sm text-emerald-700">Message envoyé. Réponse sous 48 h ouvrées.</p> : (
          <>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Motif d'absence, question…" className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
            <Button className="mt-2 w-full" disabled={!text.trim()} onClick={() => setSent(true)}>Envoyer</Button>
          </>
        )}
      </Section>
    </>
  );
}

export default function ParentPortal() {
  const [tab, setTab] = useState('home');
  const [childId, setChildId] = useState(PARENT.children[0].id);
  const child = PARENT.children.find((c) => c.id === childId);
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <p className="mb-2 text-center text-xs text-slate-500">Aperçu du portail parents (application mobile)</p>
      <div className="flex h-[780px] max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-[28px] border-8 border-slate-900 bg-slate-100 shadow-xl">
        <header className="bg-navy-900 px-4 pb-3 pt-4 text-white">
          <p className="text-xs text-navy-200">Chateaubriand · Tamatave</p>
          <p className="text-base font-semibold">Bonjour {PARENT.name}</p>
          {tab !== 'pay' && tab !== 'msg' && (
            <div className="mt-3 flex gap-2">
              {PARENT.children.map((c) => (
                <button key={c.id} onClick={() => setChildId(c.id)}
                  className={`rounded-full px-3 py-1 text-sm ${c.id === childId ? 'bg-white text-navy-900' : 'bg-white/10 text-white'}`}>
                  {c.name} · {c.cls}
                </button>
              ))}
            </div>
          )}
        </header>
        <main className="flex-1 space-y-3 overflow-y-auto p-3">
          {tab === 'home' && <Home child={child} />}
          {tab === 'school' && <School child={child} />}
          {tab === 'pay' && <Payments />}
          {tab === 'msg' && <Messages />}
        </main>
        <nav className="grid grid-cols-4 border-t border-slate-200 bg-white" aria-label="Navigation portail parents">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === id ? 'text-navy-500' : 'text-slate-500'}`}>
              <Icon name={icon} className="h-5 w-5" />{label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
