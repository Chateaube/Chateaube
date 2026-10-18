import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { RESOURCES, RESOURCE_TYPES, INITIAL_BOOKINGS, SITES, MY_SESSIONS } from '../data/demo.js';
import {
  SCHOOL_HOURS, RECESS, toMin, weekdayOf, validateSlot, findConflicts, suggestAlternatives,
} from '../rules/booking.js';

const DAY_START = toMin('07:00');
const DAY_END = toMin('17:00');
const SPAN = DAY_END - DAY_START;
const HOURS = Array.from({ length: 11 }, (_, i) => 7 + i);
const pos = (hhmm) => ((toMin(hhmm) - DAY_START) / SPAN) * 100;

const DAYS = [
  { date: '2026-10-12', label: 'Lun. 12' }, { date: '2026-10-13', label: 'Mar. 13' },
  { date: '2026-10-14', label: 'Mer. 14' }, { date: '2026-10-15', label: 'Jeu. 15' },
  { date: '2026-10-16', label: 'Ven. 16' },
];
const TYPE_LABEL = Object.fromEntries(RESOURCE_TYPES.map((t) => [t.id, t.label]));
const h = (hhmm) => hhmm.replace(':', 'h');

function Timeline({ resources, bookings, date, onPick, draft }) {
  const closesAt = SCHOOL_HOURS[weekdayOf(date)]?.[1] ?? '07:00';
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <div className="min-w-[720px]">
        {/* Échelle horaire */}
        <div className="ml-48 flex border-b border-slate-200 pb-1 text-[11px] text-slate-500">
          {HOURS.map((hr) => (
            <div key={hr} className="relative flex-1">{hr < 17 && <span className="-ml-2">{hr}h</span>}</div>
          ))}
        </div>
        {resources.map((r) => (
          <div key={r.id} className="flex items-center border-b border-slate-100 py-1.5">
            <div className="w-48 shrink-0 pr-3">
              <p className="truncate text-sm font-medium text-slate-800" title={r.label}>{r.label}</p>
              <p className="text-[11px] text-slate-500">{TYPE_LABEL[r.type]}</p>
            </div>
            <div
              className="relative h-10 flex-1 cursor-crosshair rounded-md bg-slate-50"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const minute = DAY_START + Math.floor((((e.clientX - rect.left) / rect.width) * SPAN) / 30) * 30;
                onPick(r.id, minute);
              }}
              title="Cliquer pour réserver ce créneau"
            >
              {/* Récréation commune */}
              <div className="absolute inset-y-0 bg-amber-100/70" style={{ left: `${pos(RECESS[0])}%`, width: `${pos(RECESS[1]) - pos(RECESS[0])}%` }} title="Récréation 9h30–9h45" />
              {/* Fermeture (mercredi après-midi) */}
              {toMin(closesAt) < DAY_END && (
                <div className="hatched absolute inset-y-0 right-0 rounded-r-md" style={{ left: `${pos(closesAt)}%` }} title="Établissement fermé" />
              )}
              {bookings.filter((b) => b.resourceId === r.id && b.date === date).map((b) => (
                <div
                  key={b.id}
                  className={`absolute inset-y-1 overflow-hidden rounded px-1.5 text-[11px] leading-tight text-white shadow-sm ${b.mine ? 'bg-emerald-600' : 'bg-navy-500'}`}
                  style={{ left: `${pos(b.start)}%`, width: `${pos(b.end) - pos(b.start)}%` }}
                  title={`${h(b.start)}–${h(b.end)} · ${b.who} · ${b.cls} · ${b.purpose}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="truncate font-semibold">{b.cls}</p>
                  <p className="truncate opacity-90">{b.who}</p>
                </div>
              ))}
              {draft && draft.resourceId === r.id && draft.date === date && toMin(draft.end) > toMin(draft.start) && (
                <div
                  className="pointer-events-none absolute inset-y-0.5 rounded border-2 border-dashed border-emerald-600 bg-emerald-100/40"
                  style={{ left: `${pos(draft.start)}%`, width: `${pos(draft.end) - pos(draft.start)}%` }}
                />
              )}
            </div>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-navy-500" />Réservé</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />Mes réservations</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />Récréation</span>
          <span className="flex items-center gap-1"><span className="hatched h-2.5 w-2.5 rounded-sm" />Fermé</span>
        </div>
      </div>
    </div>
  );
}

export default function BookingModule({ role }) {
  const readOnly = role === 'VIE_SCOLAIRE'; // la CPE consulte le planning
  const [siteId, setSiteId] = useState('TMV');
  const [type, setType] = useState('ALL');
  const [date, setDate] = useState('2026-10-15');
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [form, setForm] = useState({ resourceId: 'tmv-vp1', start: '10:30', end: '11:30', cls: '1re STMG', purpose: 'Management — présentation orale' });
  const [confirmation, setConfirmation] = useState(null);
  const [link, setLink] = useState({ mode: 'SEANCE', sessionId: 'se4' }); // séance de cours ou date / heure particulière
  const linkSession = (id) => {
    const se = MY_SESSIONS.find((x) => x.id === id);
    setLink({ mode: 'SEANCE', sessionId: id });
    setDate(se.date);
    set({ start: se.start, end: se.end, cls: se.cls, purpose: se.subject });
  };

  const siteResources = RESOURCES.filter((r) => r.siteId === siteId);
  const visible = siteResources.filter((r) => type === 'ALL' || r.type === type);
  const req = { ...form, date };

  const slot = validateSlot(req);
  const conflicts = useMemo(() => findConflicts(bookings, req), [bookings, req.resourceId, req.date, req.start, req.end]);
  const alternatives = conflicts.length ? suggestAlternatives(RESOURCES, bookings, req) : null;
  const canBook = slot.ok && conflicts.length === 0 && form.resourceId;

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setConfirmation(null); };

  const changeSite = (id) => {
    setSiteId(id);
    set({ resourceId: RESOURCES.find((r) => r.siteId === id).id });
  };

  const pick = (resourceId, minute) => {
    const start = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const endMin = minute + 60;
    set({ resourceId, start, end: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}` });
    setLink({ mode: 'LIBRE', sessionId: null });
  };

  const book = () => {
    const resource = RESOURCES.find((r) => r.id === form.resourceId);
    setBookings((bs) => [...bs, { id: `n${bs.length + 1}`, ...req, who: 'Moi', mine: true, sessionId: link.mode === 'SEANCE' ? link.sessionId : null }]);
    setConfirmation(`${resource.label} réservé le ${DAYS.find((d) => d.date === date)?.label ?? date.split('-').reverse().join('/')} de ${h(form.start)} à ${h(form.end)}${link.mode === 'SEANCE' ? ' (lié à votre séance)' : ''}.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Ressources pédagogiques</p>
          <h1 className="text-2xl font-semibold text-navy-900">Réservation de matériel</h1>
          <p className="text-sm text-slate-500">Vidéoprojecteurs, enceintes, TV, salles spécialisées et matériel informatique — par site.</p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Site">
          {SITES.map((s) => (
            <button key={s.id} role="tab" aria-selected={siteId === s.id} onClick={() => changeSite(s.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${siteId === s.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
              <Icon name="pin" className="mr-1 inline h-3.5 w-3.5" />{s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card
          title="Calendrier d'occupation"
          subtitle={`${siteResources.length} ressources à ${SITES.find((s) => s.id === siteId).name} · cliquer sur un créneau libre pour pré-remplir`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d) => (
                <button key={d.date} onClick={() => { setDate(d.date); setConfirmation(null); }}
                  className={`rounded-md px-2.5 py-1 text-sm ${date === d.date ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {d.label}{weekdayOf(d.date) === 3 && <span className="ml-1 text-[10px] opacity-70">→12h</span>}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {RESOURCE_TYPES.filter((t) => t.id === 'ALL' || siteResources.some((r) => r.type === t.id)).map((t) => (
                <button key={t.id} onClick={() => setType(t.id)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${type === t.id ? 'bg-navy-50 text-navy-700 ring-navy-200' : 'text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Timeline resources={visible} bookings={bookings} date={date} onPick={pick} draft={req} />
        </Card>

        {readOnly ? <Card title="Consultation"><p className="text-sm text-slate-500">Le planning du matériel et des salles est consultable ; les réservations se font par les professeurs, le secrétariat ou la Direction.</p></Card> : <Card title="Nouvelle réservation" subtitle="Vérification des conflits en temps réel">
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Équipement</span>
              <select className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={form.resourceId} onChange={(e) => set({ resourceId: e.target.value })}>
                {RESOURCE_TYPES.filter((t) => t.id !== 'ALL').map((t) => {
                  const items = siteResources.filter((r) => r.type === t.id);
                  return items.length ? (
                    <optgroup key={t.id} label={t.label}>
                      {items.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </label>
            <fieldset>
              <legend className="text-xs font-medium text-slate-600">Quand ?</legend>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {[['SEANCE', 'Une de mes séances'], ['LIBRE', 'Date et heure au choix']].map(([m, l]) => (
                  <button key={m} type="button" aria-pressed={link.mode === m} onClick={() => (m === 'SEANCE' ? linkSession(link.sessionId ?? MY_SESSIONS[0].id) : setLink({ mode: 'LIBRE', sessionId: null }))}
                    className={`rounded-md py-1 text-xs font-medium ${link.mode === m ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
                ))}
              </div>
            </fieldset>
            {link.mode === 'SEANCE' && (
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Séance (emploi du temps)</span>
                <select className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={link.sessionId} onChange={(e) => linkSession(e.target.value)}>
                  {MY_SESSIONS.map((se) => <option key={se.id} value={se.id}>{DAYS.find((d) => d.date === se.date)?.label} · {h(se.start)}–{h(se.end)} · {se.cls} · {se.subject}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">Date, heures et classe sont reprises de la séance. Si la séance est déplacée, la réservation est signalée pour être ajustée.</span>
              </label>
            )}
            {link.mode === 'LIBRE' && (
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-3 block sm:col-span-1 xl:col-span-3">
                <span className="text-xs font-medium text-slate-600">Date</span>
                <input type="date" min="2026-10-13" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setConfirmation(null); } }} />
              </label>
              <label className="block xl:col-span-1">
                <span className="text-xs font-medium text-slate-600">Début</span>
                <input type="time" step="900" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={form.start} onChange={(e) => set({ start: e.target.value })} />
              </label>
              <label className="block xl:col-span-2">
                <span className="text-xs font-medium text-slate-600">Fin</span>
                <input type="time" step="900" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={form.end} onChange={(e) => set({ end: e.target.value })} />
              </label>
            </div>
            )}
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Classe</span>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={form.cls} onChange={(e) => set({ cls: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Motif</span>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} />
            </label>

            {/* Retour de validation */}
            <div aria-live="polite" className="space-y-2">
              {slot.errors.map((e) => (
                <p key={e} className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-800"><Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" />{e}</p>
              ))}
              {conflicts.map((c) => (
                <div key={c.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                  <p className="flex gap-2 font-medium"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />Conflit : déjà réservé {h(c.start)}–{h(c.end)}</p>
                  <p className="ml-6 text-xs">{c.who} · {c.cls} · {c.purpose}</p>
                </div>
              ))}
              {alternatives && (alternatives.sameTime.length > 0 || alternatives.sameResource.length > 0) && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                  <p className="text-xs font-semibold">Alternatives disponibles</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {alternatives.sameTime.map((r) => (
                      <Button key={r.id} variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => set({ resourceId: r.id })}>{r.label}</Button>
                    ))}
                    {alternatives.sameResource.map((s) => (
                      <Button key={s.start} variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => set(s)}>{h(s.start)}–{h(s.end)}</Button>
                    ))}
                  </div>
                </div>
              )}
              {slot.ok && conflicts.length === 0 && (
                <p className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />Créneau disponible.</p>
              )}
              {slot.notes.map((n) => <p key={n} className="text-xs text-slate-500">{n}</p>)}
            </div>

            <Button className="w-full" disabled={!canBook} onClick={book}>Réserver</Button>
            {confirmation && <p role="status" className="text-center text-xs text-emerald-700">{confirmation}</p>}
          </div>
        </Card>}
      </div>

      <Card title="Règles de gestion" subtitle="Appliquées dans l'interface et garanties par la base de données">
        <ul className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <li className="flex gap-2"><Badge tone="navy">Conflits</Badge>Deux réservations d'un même équipement ne peuvent pas se chevaucher (contrainte d'exclusion PostgreSQL).</li>
          <li className="flex gap-2"><Badge tone="navy">Horaires</Badge>Lundi, mardi, jeudi, vendredi 7h–17h ; mercredi 7h–12h.</li>
          <li className="flex gap-2"><Badge tone="navy">Sites</Badge>Le matériel est rattaché à un site : pas de réservation croisée Tana ↔ Tamatave.</li>
          <li className="flex gap-2"><Badge tone="navy">Arbitrage</Badge>La Vie scolaire et la Direction peuvent annuler ou réattribuer une réservation.</li>
        </ul>
      </Card>
    </div>
  );
}
