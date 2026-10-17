import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { STAFF } from '../data/people.js';
import { BOOK_TYPES, LOAN_DAYS, nextCode, designation, openLoan, borrow, renew, giveBackBook, overdueLoans } from '../rules/library.js';
import { CONDITIONS, conditionLabel } from '../rules/manuals.js';
import { loadLibrary, saveLibrary } from '../libraryStore.js';
import { printOnly } from '../print.js';

// Bibliothèque de la salle d'étude / permanence (Tamatave n'a pas de CDI) : romans, annales, documentaires, ouvrages de référence.
// Élèves : un mois, prolongeable d'un mois en repassant au secrétariat avec le livre.
// Professeurs : sans date limite. Chaque exemplaire porte une cote (étiquette imprimable).

const TODAY = '2026-10-13';
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const daysLate = (due) => Math.round((Date.parse(TODAY) - Date.parse(due)) / 86_400_000);
const TEACHERS = STAFF.filter((s) => /Enseignant|Intervenant/.test(s.poste)).map((s) => s.name);
const TABS = [['desk', 'Prêt et retour'], ['late', 'En retard'], ['catalog', 'Catalogue'], ['labels', 'Étiquettes']];

const bookOf = (code, books) => books.find((b) => b.copies.some((c) => c.code === code));

function DeskTab({ books, loans, setLoans }) {
  const [code, setCode] = useState('');
  const [who, setWho] = useState({ kind: 'ELEVE', cls: 'Terminale Générale', borrower: '' });
  const [presented, setPresented] = useState(false);
  const [returnState, setReturnState] = useState('BON');
  const [msg, setMsg] = useState(null);
  const found = code.trim().toUpperCase();
  const book = bookOf(found, books);
  const loan = book && openLoan(found, loans);
  const search = code.trim().length >= 3 && !book ? books.filter((b) => designation(b).toLowerCase().includes(code.trim().toLowerCase()) || b.isbn === code.trim()) : [];

  const done = (text) => { setMsg(text); setPresented(false); };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
      <Card title="Prêt et retour" subtitle="Saisir ou scanner la cote de l'étiquette (ex. ROM-0004), ou chercher un titre, un auteur, un ISBN">
        <input value={code} onChange={(e) => { setCode(e.target.value); setMsg(null); }} placeholder="Cote, titre, auteur ou ISBN" className={`w-full ${inputCls}`} aria-label="Cote ou recherche" autoFocus />
        {search.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            {search.map((b) => (
              <li key={b.id} className="px-3 py-2">
                <p className="font-medium">{designation(b)}</p>
                <p className="mt-1 flex flex-wrap gap-1">{b.copies.map((c) => (
                  <button key={c.code} type="button" onClick={() => setCode(c.code)} className={`rounded-full px-2 py-0.5 text-xs ring-1 ${openLoan(c.code, loans) ? 'text-slate-400 ring-slate-200' : 'text-navy-700 ring-navy-200'}`}>{c.code}{openLoan(c.code, loans) ? ' (sorti)' : ''}</button>
                ))}</p>
              </li>
            ))}
          </ul>
        )}
        {book && (
          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-800">{designation(book)}</p>
            <p className="text-xs text-slate-500">{BOOK_TYPES[book.type].label} · exemplaire {found} · {conditionLabel(book.copies.find((c) => c.code === found).state)}{book.isbn ? ` · ISBN ${book.isbn}` : ''}</p>
            {loan ? (
              <div className="mt-3 space-y-3">
                <p>Emprunté par <strong>{loan.borrower}</strong>{loan.cls ? ` (${loan.cls})` : ' (professeur)'} le {fmt(loan.out)} · {loan.due ? <>à rendre le <strong className={loan.due < TODAY ? 'text-red-700' : ''}>{fmt(loan.due)}</strong>{loan.renewals ? ` · prolongé ${loan.renewals} fois` : ''}</> : 'sans date limite'}</p>
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <span className="text-xs text-slate-600">Retour, état du livre :</span>
                  <select value={returnState} onChange={(e) => setReturnState(e.target.value)} className="rounded-md border border-slate-300 px-1.5 py-1 text-xs" aria-label="État au retour">{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                  <Button className="!py-1 text-xs" onClick={() => { setLoans(loans.map((l) => (l.id === loan.id ? giveBackBook(l, TODAY, returnState) : l))); done(`${found} rendu par ${loan.borrower}.`); }}>Enregistrer le retour</Button>
                </div>
                {loan.kind === 'ELEVE' && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={presented} onChange={(e) => setPresented(e.target.checked)} />L'élève a présenté le livre au secrétariat</label>
                    <Button variant="secondary" className="!py-1 text-xs" disabled={!presented} onClick={() => { const r = renew(loan, { on: TODAY, presented }); setLoans(loans.map((l) => (l.id === loan.id ? r.loan : l))); done(`${found} prolongé jusqu'au ${fmt(r.loan.due)}.`); }}>Prolonger d'un mois</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-[140px_180px_1fr_auto] sm:items-end">
                <select value={who.kind} onChange={(e) => setWho({ ...who, kind: e.target.value, borrower: '' })} className={inputCls} aria-label="Emprunteur : élève ou professeur"><option value="ELEVE">Élève</option><option value="PROF">Professeur</option></select>
                {who.kind === 'ELEVE' ? (
                  <select value={who.cls} onChange={(e) => setWho({ ...who, cls: e.target.value, borrower: '' })} className={inputCls} aria-label="Classe">{Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}</select>
                ) : <span />}
                <select value={who.borrower} onChange={(e) => setWho({ ...who, borrower: e.target.value })} className={inputCls} aria-label="Emprunteur">
                  <option value="">{who.kind === 'ELEVE' ? 'Élève…' : 'Professeur…'}</option>
                  {(who.kind === 'ELEVE' ? CLASSES[who.cls] : TEACHERS).map((n) => <option key={n}>{n}</option>)}
                </select>
                <Button disabled={!who.borrower} onClick={() => {
                  const r = borrow(found, loans, { borrower: who.borrower, kind: who.kind, cls: who.kind === 'ELEVE' ? who.cls : null, on: TODAY });
                  if (r.error) { setMsg(r.error); return; }
                  setLoans([...loans, r.loan]);
                  done(`${found} prêté à ${who.borrower}${r.loan.due ? ` jusqu'au ${fmt(r.loan.due)}` : ' (sans date limite)'}.`);
                }}>Prêter</Button>
              </div>
            )}
          </div>
        )}
        {msg && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{msg}</p>}
      </Card>
      <Card title="Règles de prêt">
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-600">
          <li>Élèves : {LOAN_DAYS} jours. Pour garder le livre un mois de plus, l'élève repasse au secrétariat <strong>avec le livre</strong>.</li>
          <li>Professeurs : pas de date limite.</li>
          <li>Un livre en retard est rappelé à l'élève et au parent ; il bloque la remise du bulletin comme un manuel.</li>
          <li>Livre perdu ou abîmé : à remplacer ou à régler à la caisse.</li>
        </ul>
      </Card>
    </div>
  );
}

function LateTab({ books, loans }) {
  const late = overdueLoans(loans, TODAY).sort((a, b) => a.due.localeCompare(b.due));
  const [sent, setSent] = useState({});
  return (
    <Card title={`Livres en retard (${late.length})`} subtitle="Élèves seulement : les professeurs n'ont pas de date limite">
      {late.length === 0 ? <p className="text-sm text-emerald-700">Aucun retard.</p> : (
        <ul className="divide-y divide-slate-100">
          {late.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1"><span className="font-medium">{l.borrower}</span> <span className="text-slate-500">· {l.cls}</span>
                <span className="block text-xs text-slate-500">{l.code} · {designation(bookOf(l.code, books))}</span></span>
              <Badge tone="red">{daysLate(l.due)} j de retard</Badge>
              {sent[l.id] ? <span className="text-xs text-emerald-700">Rappel envoyé (élève et parent)</span>
                : <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setSent({ ...sent, [l.id]: true })}>Envoyer un rappel</Button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CatalogTab({ books, setBooks, loans }) {
  const [type, setType] = useState('');
  const [draft, setDraft] = useState({ type: 'ROMAN', title: '', author: '', editor: '', collection: '', year: '', isbn: '', n: 1, state: 'NEUF' });
  const shown = books.filter((b) => !type || b.type === type);
  const total = books.reduce((s, b) => s + b.copies.length, 0);
  const out = loans.filter((l) => !l.returnedOn).length;
  const add = () => {
    const copies = [];
    let all = books;
    for (let i = 0; i < draft.n; i++) {
      const code = nextCode(draft.type, [...all, { copies }]);
      copies.push({ code, state: draft.state });
    }
    all = [...books, { id: `k${Date.now()}`, type: draft.type, title: draft.title.trim(), author: draft.author.trim(), editor: draft.editor.trim(), collection: draft.collection.trim(), year: Number(draft.year) || null, isbn: draft.isbn.trim(), copies }];
    setBooks(all);
    setDraft({ ...draft, title: '', author: '', collection: '', year: '', isbn: '', n: 1 });
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Titres" value={String(books.length)} />
        <Stat label="Exemplaires" value={String(total)} />
        <Stat label="Sortis" value={String(out)} />
        <Stat label="En retard" value={String(overdueLoans(loans, TODAY).length)} tone={overdueLoans(loans, TODAY).length ? 'red' : undefined} />
      </div>
      <Card title="Catalogue" subtitle="Désignation : titre — auteur — éditeur (collection, année) ; ISBN si disponible"
        action={<select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} aria-label="Type"><option value="">Tous les types</option>{Object.entries(BOOK_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>}>
        <ul className="divide-y divide-slate-100">
          {shown.map((b) => (
            <li key={b.id} className="py-2 text-sm">
              <p className="font-medium text-slate-800">{designation(b)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">{BOOK_TYPES[b.type].label}{b.isbn ? ` · ISBN ${b.isbn}` : ''} ·
                {b.copies.map((c) => <Badge key={c.code} tone={openLoan(c.code, loans) ? 'amber' : 'green'}>{c.code}{openLoan(c.code, loans) ? ' sorti' : ''}</Badge>)}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Ajouter un livre" subtitle="Les cotes sont attribuées automatiquement (ROM-0012, ANN-0010…) ; imprimez ensuite les étiquettes">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={inputCls} aria-label="Type du livre">{Object.entries(BOOK_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Titre de l'œuvre" className={`sm:col-span-2 ${inputCls}`} aria-label="Titre" />
          <input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} placeholder="Auteur" className={inputCls} aria-label="Auteur" />
          <input value={draft.editor} onChange={(e) => setDraft({ ...draft, editor: e.target.value })} placeholder="Éditeur (ex. Gallimard)" className={inputCls} aria-label="Éditeur" />
          <input value={draft.collection} onChange={(e) => setDraft({ ...draft, collection: e.target.value })} placeholder="Collection (ex. Folio)" className={inputCls} aria-label="Collection" />
          <input value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="Année" className={inputCls} aria-label="Année" />
          <input value={draft.isbn} onChange={(e) => setDraft({ ...draft, isbn: e.target.value.replace(/[^\dX]/gi, '') })} placeholder="ISBN (code-barres au dos)" className={inputCls} aria-label="ISBN" />
          <span className="flex gap-2">
            <input type="number" min={1} max={30} value={draft.n} onChange={(e) => setDraft({ ...draft, n: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} className={`w-20 ${inputCls}`} aria-label="Nombre d'exemplaires" />
            <select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} className={`flex-1 ${inputCls}`} aria-label="État">{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </span>
          <Button className="sm:col-span-3" disabled={!draft.title.trim() || !draft.editor.trim()} onClick={add}>Ajouter au catalogue</Button>
        </div>
      </Card>
    </div>
  );
}

function LabelsTab({ books }) {
  const [type, setType] = useState('');
  const shown = books.filter((b) => !type || b.type === type);
  return (
    <Card title="Étiquettes" subtitle="À coller sur la tranche ou en première page : la cote suffit pour retrouver le livre et son emprunteur"
      action={(
        <span className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} aria-label="Type"><option value="">Tous les types</option>{Object.entries(BOOK_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
          <Button onClick={() => printOnly('.labels-print', 'size: A4 portrait;', 'Étiquettes de la bibliothèque')}>Imprimer</Button>
        </span>
      )}>
      <div className="labels-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shown.flatMap((b) => b.copies.map((c) => (
          <div key={c.code} className="rounded border border-dashed border-slate-400 bg-white p-2 text-center text-black" style={{ breakInside: 'avoid' }}>
            <p className="text-[9px] uppercase tracking-wide">Chateaubriand · Salle d'étude</p>
            <p className="font-mono text-lg font-bold">{c.code}</p>
            <p className="truncate text-[10px]">{b.title}</p>
          </div>
        )))}
      </div>
    </Card>
  );
}

export default function LibraryModule() {
  const [tab, setTab] = useState('desk');
  const [data, setData] = useState(loadLibrary);
  useEffect(() => saveLibrary(data), [data]);
  const setBooks = (books) => setData((d) => ({ ...d, books }));
  const setLoans = (loans) => setData((d) => ({ ...d, loans }));
  const late = overdueLoans(data.loans, TODAY).length;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Salle d'étude · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bibliothèque</h1>
        <p className="text-sm text-slate-500">Romans, annales, documentaires et ouvrages de référence, prêtés aux élèves (un mois) et aux professeurs.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
            {label}{id === 'late' && late > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{late}</span>}
          </button>
        ))}
      </div>
      {tab === 'desk' && <DeskTab books={data.books} loans={data.loans} setLoans={setLoans} />}
      {tab === 'late' && <LateTab books={data.books} loans={data.loans} />}
      {tab === 'catalog' && <CatalogTab books={data.books} setBooks={setBooks} loans={data.loans} />}
      {tab === 'labels' && <LabelsTab books={data.books} />}
    </div>
  );
}
