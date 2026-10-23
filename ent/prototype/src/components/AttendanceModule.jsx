import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, Icon } from './ui.jsx';
import { WEEK_SESSIONS, ROSTERS, NOW } from '../data/attendance.js';
import { sessionState, tally, nextToDo, lateOutcome, LATE_LIMIT } from '../rules/attendance.js';
import { formatDateFr } from '../rules/calendar.js';
import { useOnline } from '../online.js';
import { takeIntent } from '../navIntent.js';

// Appel (enseignant) : toutes les séances de la semaine, toutes classes confondues, dans l'ordre ;
// la séance en cours est proposée d'office. Grande liste à toucher, pensée pour le téléphone.
// Sans réseau, l'appel est gardé sur le téléphone et envoyé au retour de la connexion.

const KEY = 'ent-appel-v1';
const h = (t) => t.replace(':', 'h');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const dayLabel = (iso) => cap(formatDateFr(iso).replace(/ \d{4}$/, ''));
const STATE_UI = {
  FAIT: ['green', 'Appel fait'], EN_COURS: ['red', 'À faire maintenant'], OUBLIE: ['red', 'Appel oublié'], A_VENIR: ['slate', 'À venir'],
};
const CLASS_TONES = ['bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800', 'bg-emerald-100 text-emerald-800', 'bg-rose-100 text-rose-800'];
const LATE = [5, 10, 15, 20, 30];

export const loadRecords = () => {
  const demo = Object.fromEntries(WEEK_SESSIONS.filter((s) => s.done).map((s) => [s.id, { ...s.done, synced: true }]));
  try { return { ...demo, ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) }; } catch { return demo; }
};

function ClassChip({ cls, classes }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASS_TONES[classes.indexOf(cls) % CLASS_TONES.length]}`}>{cls}</span>;
}

/** Feuille d'appel d'une séance. */
function Roll({ session, record, classes, online, onSave, onBack }) {
  const roster = ROSTERS[session.cls] ?? [];
  const [marks, setMarks] = useState(record?.marks ?? {});
  const [notify, setNotify] = useState(true);
  const [query, setQuery] = useState('');
  const t = tally(roster, marks);
  const set = (n, v) => setMarks((m) => { const x = { ...m }; if (v) x[n] = v; else delete x[n]; return x; });
  const shown = roster.filter((n) => n.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="nav-control text-sm font-medium text-navy-500">‹ Toutes mes séances</button>
      <div className="sticky top-0 z-10 rounded-2xl bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <ClassChip cls={session.cls} classes={classes} />
          <span className="font-semibold text-slate-900">{session.subject}</span>
          <span className="text-sm text-slate-500">{dayLabel(session.date)} · {h(session.start)}–{h(session.end)} · {session.room}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 py-2"><p className="text-xl font-bold text-emerald-700">{t.present}</p><p className="text-[11px] text-emerald-800">présents</p></div>
          <div className="rounded-xl bg-red-50 py-2"><p className="text-xl font-bold text-red-700">{t.absent.length}</p><p className="text-[11px] text-red-800">absents</p></div>
          <div className="rounded-xl bg-amber-50 py-2"><p className="text-xl font-bold text-amber-700">{t.late.length}</p><p className="text-[11px] text-amber-800">retards</p></div>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un élève" aria-label="Chercher un élève" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => setMarks({})}>Tous présents</Button>
        </div>
      </div>

      <ul className="space-y-2">
        {shown.map((n) => {
          const m = marks[n];
          return (
            <li key={n} className={`rounded-2xl bg-white p-3 shadow-soft ring-1 ${m?.status === 'A' ? 'ring-red-200' : m?.status === 'R' ? 'ring-amber-200' : 'ring-transparent'}`}>
              <div className="flex items-center gap-3">
                <Avatar name={n} className="h-9 w-9 text-xs" />
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{n}</span>
                <div className="flex gap-1" role="radiogroup" aria-label={n}>
                  {[['', 'Présent', 'P', 'bg-emerald-600'], ['R', 'Retard', 'R', 'bg-amber-500'], ['A', 'Absent', 'A', 'bg-red-600']].map(([k, label, short, on]) => {
                    const active = (m?.status ?? '') === k;
                    return (
                      <button key={short} type="button" role="radio" aria-checked={active} aria-label={`${label} — ${n}`} title={label}
                        onClick={() => set(n, k ? { status: k, ...(k === 'R' ? { minutes: m?.minutes ?? 10 } : {}) } : null)}
                        className={`h-11 w-11 rounded-xl text-sm font-bold transition ${active ? `${on} text-white shadow` : 'bg-slate-100 text-slate-500'}`}>{short}</button>
                    );
                  })}
                </div>
              </div>
              {m?.status === 'R' && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12 text-xs text-slate-600">
                  Retard de
                  {LATE.map((mn) => (
                    <button key={mn} type="button" onClick={() => set(n, { status: 'R', minutes: mn })}
                      className={`rounded-full px-2.5 py-1 font-medium ${m.minutes === mn ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800'}`}>{mn === 30 ? '30 min et +' : `${mn} min`}</button>
                  ))}
                  {(() => {
                    const o = lateOutcome(session, m.minutes);
                    return o.kind === 'ABSENCE' && <p className="w-full rounded-md bg-red-50 px-2 py-1 text-red-800">Plus de {LATE_LIMIT} min : compté absent {o.nextCourse ? `pour ce cours (${h(o.from)}–${h(o.to)}) ; il rejoint le cours suivant` : `de ${h(o.from)} à ${h(o.to)} ; il entre en cours à ${h(o.enterAt)}`}.</p>;
                  })()}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 space-y-2 rounded-2xl bg-white p-4 shadow-soft">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Prévenir les parents des absents et retardataires ({t.absent.length + t.late.length})
        </label>
        {!online && <p className="text-xs text-amber-800">Hors connexion : l'appel est gardé sur le téléphone et envoyé au retour du réseau.</p>}
        <Button className="w-full !py-3 text-base" onClick={() => onSave({ marks, notify })}>{record ? 'Enregistrer la correction' : 'Valider l\'appel'}</Button>
        <p className="text-[11px] text-slate-500">L'appel validé compte comme heure de cours effectuée (paie des vacataires). Il reste modifiable jusqu'au soir ; ensuite, la vie scolaire corrige.</p>
      </div>
    </div>
  );
}

export default function AttendanceModule() {
  const online = useOnline();
  const [records, setRecords] = useState(loadRecords);
  const [open, setOpen] = useState(() => takeIntent('appel')?.session ?? null); // ouvert depuis « Ma journée »
  const [toast, setToast] = useState('');
  const days = [...new Set(WEEK_SESSIONS.map((s) => s.date))];
  const [day, setDay] = useState(NOW.date);
  const classes = useMemo(() => [...new Set(WEEK_SESSIONS.map((s) => s.cls))], []);
  const [cls, setCls] = useState('');
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(records)); } catch { /* stockage indisponible */ } }, [records]);
  // retour du réseau : les appels gardés sur le téléphone partent
  useEffect(() => {
    if (!online) return;
    const pending = Object.entries(records).filter(([, r]) => !r.synced);
    if (pending.length) {
      setRecords((rs) => Object.fromEntries(Object.entries(rs).map(([k, r]) => [k, { ...r, synced: true }])));
      setToast(`${pending.length} appel${pending.length > 1 ? 's' : ''} envoyé${pending.length > 1 ? 's' : ''} au retour du réseau.`);
    }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateOf = (s) => sessionState(s, NOW, records[s.id]);
  const todo = nextToDo(WEEK_SESSIONS, NOW, records);
  const forgotten = WEEK_SESSIONS.filter((s) => stateOf(s) === 'OUBLIE');
  const shown = WEEK_SESSIONS.filter((s) => (cls ? s.cls === cls : s.date === day));
  const session = WEEK_SESSIONS.find((s) => s.id === open);

  const save = (s, { marks, notify }) => {
    const t = tally(ROSTERS[s.cls] ?? [], marks);
    setRecords({ ...records, [s.id]: { at: NOW.time, marks, synced: online, notified: notify } });
    setToast(`Appel ${records[s.id] ? 'corrigé' : 'enregistré'} — ${s.cls} : ${t.absent.length} absent${t.absent.length > 1 ? 's' : ''}, ${t.late.length} retard${t.late.length > 1 ? 's' : ''}${notify && t.absent.length + t.late.length ? ' · parents prévenus' : ''}${online ? '' : ' · gardé sur le téléphone'}.`);
    setOpen(null);
  };

  if (session) {
    return (
      <div className="mx-auto max-w-2xl">
        <Roll key={session.id} session={session} record={records[session.id]} classes={classes} online={online} onSave={(r) => save(session, r)} onBack={() => setOpen(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-sm font-semibold text-navy-500">{dayLabel(NOW.date)} · {h(NOW.time)}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Appel</h1>
        <p className="text-sm text-slate-500">Toutes vos séances, toutes classes confondues. Présent par défaut : on ne touche que les absents et les retards.</p>
      </div>
      {toast && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{toast}</p>}

      {todo && (
        <button type="button" onClick={() => setOpen(todo.id)}
          className="nav-control flex w-full items-center gap-3 rounded-2xl bg-navy-900 p-4 text-left text-white shadow-soft">
          <Icon name="clock" className="h-6 w-6 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-navy-200">{stateOf(todo) === 'OUBLIE' ? 'Appel oublié, à régulariser' : 'Appel à faire maintenant'}</span>
            <span className="block text-lg font-semibold">{todo.cls} · {todo.subject}</span>
            <span className="block text-sm text-navy-100">{dayLabel(todo.date)} · {h(todo.start)}–{h(todo.end)} · {todo.room}</span>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy-900">Faire l'appel</span>
        </button>
      )}
      {forgotten.length > 0 && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <strong>{forgotten.length} appel{forgotten.length > 1 ? 's' : ''} oublié{forgotten.length > 1 ? 's' : ''} :</strong>{' '}
          {forgotten.map((s) => `${dayLabel(s.date)} ${h(s.start)} (${s.cls})`).join(', ')}. Sans appel, l'heure n'est pas comptée comme effectuée.
        </p>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button type="button" onClick={() => setCls('')} className={`nav-control whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${!cls ? 'bg-navy-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>Par jour</button>
        {classes.map((c) => (
          <button key={c} type="button" onClick={() => setCls(c)} className={`nav-control whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${cls === c ? 'bg-navy-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{c}</button>
        ))}
      </div>
      {!cls && (
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1">
          {days.map((d) => {
            const late = WEEK_SESSIONS.some((s) => s.date === d && ['OUBLIE', 'EN_COURS'].includes(stateOf(s)));
            return (
              <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={day === d}
                className={`nav-control relative rounded-lg py-2 text-xs font-medium ${day === d ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
                {dayLabel(d).split(' ')[0].slice(0, 3)}<span className="block text-base font-semibold">{d.slice(8)}</span>
                {late && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
              </button>
            );
          })}
        </div>
      )}

      <ul className="space-y-2">
        {shown.length === 0 && <li className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-soft">Pas de cours ce jour-là.</li>}
        {shown.map((s) => {
          const st = stateOf(s);
          const r = records[s.id];
          const t = r && tally(ROSTERS[s.cls] ?? [], r.marks);
          return (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(s.id)} disabled={st === 'A_VENIR'}
                className={`nav-control flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ${st === 'EN_COURS' || st === 'OUBLIE' ? 'ring-red-200' : 'ring-transparent'} disabled:opacity-60`}>
                <span className="w-14 shrink-0 text-center"><span className="block text-base font-semibold text-navy-900">{h(s.start)}</span><span className="block text-[11px] text-slate-500">{h(s.end)}</span></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><ClassChip cls={s.cls} classes={classes} /><span className="text-sm font-medium text-slate-800">{s.subject}</span></span>
                  <span className="mt-0.5 block text-xs text-slate-500">{cls ? `${dayLabel(s.date)} · ` : ''}{s.room}{t ? ` · ${t.present} présents, ${t.absent.length} absent${t.absent.length > 1 ? 's' : ''}, ${t.late.length} retard${t.late.length > 1 ? 's' : ''}` : ''}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={STATE_UI[st][0]}>{STATE_UI[st][1]}</Badge>
                  {r && !r.synced && <span className="text-[10px] text-amber-700">en attente d'envoi</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
