import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { BOOK_TYPES, availability, searchCatalog, reserve, canReserve } from '../rules/library.js';
import { inStock } from '../rules/manuals.js';
import { loadLibrary, saveLibrary } from '../libraryStore.js';
import { loadManuals } from '../manualsStore.js';

// Catalogue pour tous : livres de la salle d'étude et manuels, avec une barre de recherche.
// Élèves et professeurs réservent un livre pour une date ; les parents consultent seulement.

const TODAY = '2026-10-13';
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const FILTERS = [['ALL', 'Tout'], ...Object.entries(BOOK_TYPES).map(([k, t]) => [k, t.label.split(' (')[0]]), ['MANUEL', 'Manuels']];
const STATUS = { A_RETIRER: ['green', 'mis de côté'], ATTENTE: ['amber', 'liste d\'attente'], REMISE: ['navy', 'remis'], ANNULEE: ['slate', 'annulée'], EXPIREE: ['slate', 'non retirée'] };

export default function BookCatalog({ who, kind, cls, compact = false }) {
  const [data, setData] = useState(loadLibrary);
  const manuals = useMemo(() => loadManuals(), []);
  const [q, setQ] = useState('');
  const [type, setType] = useState('ALL');
  const [picking, setPicking] = useState(null); // { id, date }
  const [msg, setMsg] = useState(null);
  const reservations = data.reservations ?? [];
  const results = searchCatalog(q, data.books, manuals.manuals, { type });
  const mine = reservations.filter((r) => r.who === who && ['A_RETIRER', 'ATTENTE'].includes(r.status));
  const update = (next) => { setData(next); saveLibrary(next); };
  const book = (id) => data.books.find((b) => b.id === id);

  const confirm = (b) => {
    const res = reserve(b, { who, kind, cls, date: picking.date }, { loans: data.loans, reservations, today: TODAY });
    if (res.error) { setMsg({ tone: 'red', text: res.error }); return; }
    update({ ...data, reservations: [...reservations, res.reservation] });
    setMsg({ tone: 'green', text: res.reservation.status === 'A_RETIRER'
      ? `« ${b.title} » est mis de côté pour vous à partir du ${fmt(picking.date)}, à retirer au secrétariat avant le ${fmt(res.reservation.holdUntil)}.`
      : `Tous les exemplaires sont empruntés : vous êtes n° ${res.reservation.rank} sur la liste d'attente. Vous serez prévenu dès le retour.` });
    setPicking(null);
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Bibliothèque et manuels</h1>
          <p className="text-sm text-slate-500">Tous les livres de la salle d'étude et les manuels de l'école. {canReserve(kind) ? 'Réservez un livre pour le jour qui vous arrange.' : kind === 'PARENT' ? 'La réservation se fait depuis le compte de l\'élève.' : ''}</p>
        </div>
      )}
      {mine.length > 0 && (
        <Card title="Mes réservations">
          <ul className="space-y-1.5 text-sm">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{book(r.bookId)?.title} <span className="text-xs text-slate-500">· {r.status === 'A_RETIRER' ? `à retirer du ${fmt(r.date)} au ${fmt(r.holdUntil)}` : `n° ${r.rank} sur la liste d'attente`}</span></span>
                <span className="flex items-center gap-2"><Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge>
                  <button type="button" className="text-xs text-slate-500 hover:text-red-700" onClick={() => update({ ...data, reservations: reservations.map((x) => (x.id === r.id ? { ...x, status: 'ANNULEE' } : x)) })}>Annuler</button></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Rechercher un titre, un auteur, une matière, une classe…" aria-label="Rechercher un livre ou un manuel"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ${type === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>)}
      </div>
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{msg.text}</p>}
      <p className="text-xs text-slate-500">{results.length} résultat{results.length > 1 ? 's' : ''}</p>
      <ul className="space-y-2">
        {results.map((r) => {
          if (r.source === 'MANUEL') {
            const n = inStock(r.manual); // jamais le nombre d'exemplaires : disponible ou non
            return (
              <li key={`m-${r.id}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-medium text-slate-900">{r.title}</p><p className="text-xs text-slate-500">{r.type} · {r.detail}</p></div>
                  <Badge tone={n ? 'green' : 'slate'}>{n ? 'disponible' : 'plus disponible'}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Les manuels se prennent avec le lot de la classe, au secrétariat.</p>
              </li>
            );
          }
          const a = availability(r.book, data.loans, reservations);
          return (
            <li key={`b-${r.id}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-medium text-slate-900">{r.title}</p><p className="text-xs text-slate-500">{r.type}{r.detail ? ` · ${r.detail.replace(/^ — /, '')}` : ''}</p></div>
                <Badge tone={a.available ? 'green' : 'amber'}>{a.available ? 'disponible' : `déjà emprunté${a.nextReturn ? ` · retour prévu le ${fmt(a.nextReturn)}` : ''}`}</Badge>
              </div>
              {canReserve(kind) && (picking?.id === r.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-xs text-slate-600">Je viens le <input type="date" min={TODAY} value={picking.date} onChange={(e) => setPicking({ ...picking, date: e.target.value })} className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm" /></label>
                  <Button className="!px-2.5 !py-1 text-xs" onClick={() => confirm(r.book)}>{a.available ? 'Réserver' : 'Liste d\'attente'}</Button>
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setPicking(null)}>Annuler</Button>
                </div>
              ) : <Button variant="secondary" className="mt-2 !px-2.5 !py-1 text-xs" onClick={() => { setPicking({ id: r.id, date: TODAY }); setMsg(null); }}>{a.available ? 'Réserver' : 'Me mettre en liste d\'attente'}</Button>)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
