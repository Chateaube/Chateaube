import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { loadTimetable } from '../timetableStore.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { weekLetter } from '../rules/teachingHours.js';
import { POPULATION } from '../data/announcements.js';
import { CHANGE_TYPES, changeErrors, changeNotice } from '../rules/timetableChanges.js';
import { publishAnnouncement } from '../announcementsStore.js';
import { formatDateFr } from '../rules/calendar.js';
import { me } from '../identity.js';

// Changements d'emploi du temps (Direction, secrétariat ; la CPE : annulation du jour seulement) :
// chaque changement apparaît dans les agendas ; l'avis aux élèves et aux parents de la classe est publié
// par la Direction (celui du secrétariat attend sa validation), SAUF l'annulation d'un cours le jour même,
// qui part tout de suite (secrétariat ou CPE) et dont la Direction est informée.

const KEY = 'ent-changements-edt-v1';
export const loadChanges = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } };
const saveChanges = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* stockage indisponible */ } };
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const dateLabel = (iso) => formatDateFr(iso).replace(/ \d{4}$/, '');
const CLASSES = Object.keys(POPULATION.TMV.classes);
const TONE = { ANNULE: 'red', DEPLACE: 'amber', AJOUT: 'green', DEFINITIF: 'navy' };
const DAYS = [[1, 'lundi'], [2, 'mardi'], [3, 'mercredi'], [4, 'jeudi'], [5, 'vendredi'], [6, 'samedi']];

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACTOR = { DIRECTION: { role: 'DIRECTION', name: 'Direction' }, BUREAU: { role: 'BUREAU', name: me('BUREAU') }, VIE_SCOLAIRE: { role: 'VIE_SCOLAIRE', name: me('VIE_SCOLAIRE') } };

export default function TimetableChanges({ role, settings = DEFAULT_SETTINGS }) {
  const sameDayOnly = role === 'VIE_SCOLAIRE'; // la CPE annonce seulement l'annulation d'un cours du jour
  const canEdit = ['DIRECTION', 'BUREAU'].includes(role) || sameDayOnly;
  const today = localToday();
  const [list, setList] = useState(loadChanges);
  const blank = { type: 'ANNULE', cls: '1re STMG', subject: '', date: sameDayOnly ? today : '2026-10-20', start: '', end: '', newDate: '', newStart: '', newEnd: '', newWeekday: 1, room: '', note: '' };
  const [c, setC] = useState(blank);
  const [tried, setTried] = useState(false);
  const wd = new Date(`${c.date}T12:00:00Z`).getUTCDay() || 7;
  // séances de la classe ce jour-là, d'après l'emploi du temps
  const TIMETABLE = loadTimetable();
  const letter = weekLetter(c.date, settings);
  const daySlots = TIMETABLE.filter((s) => s.cls === c.cls && s.weekday === wd && (!s.week || s.week === letter));
  const subjects = [...new Set(TIMETABLE.filter((s) => s.cls === c.cls).map((s) => s.subject))];
  const sameDay = c.type === 'ANNULE' && c.date === today;
  const errors = [...changeErrors(c), ...(sameDayOnly && !sameDay ? ['La CPE annonce seulement l\'annulation d\'un cours aujourd\'hui.'] : [])];
  const save = () => {
    setTried(true);
    if (errors.length) return;
    const item = { ...c, id: `c${Date.now()}`, oldWeekday: wd, at: new Date().toISOString().slice(0, 10) };
    const next = [item, ...list]; setList(next); saveChanges(next);
    const n = changeNotice(item, dateLabel);
    // annulation du jour : publiée tout de suite ; sinon l'avis du secrétariat attend la validation de la Direction
    publishAnnouncement({ ...n, author: { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'Vie scolaire (CPE)' }[role], ...(sameDay ? { urgent: 'ANNULATION_JOUR', date: item.date } : {}), photos: [], pinned: item.type === 'DEFINITIF', ack: item.type === 'DEFINITIF', email: true, audience: { roles: ['PARENT', 'ELEVE', 'PROFESSEUR'], site: 'TMV', scope: 'CLASS', values: [item.cls] } },
      ACTOR[role]);
    setC({ ...blank, cls: c.cls }); setTried(false);
  };
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Emploi du temps · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Changements d'emploi du temps</h1>
        <p className="text-sm text-slate-500">Cours annulé, déplacé, ajouté, ou nouvel horaire définitif : les élèves, les parents et les professeurs de la classe sont prévenus, et les agendas sont mis à jour. L'absence d'un professeur, elle, n'est pas annoncée : les élèves viennent, en étude surveillée.</p>
      </div>
      {canEdit && (
        <Card title="Nouveau changement">
          {sameDayOnly && <p className="mb-2 text-sm text-slate-700">Annulation d'un cours <strong>aujourd'hui</strong> : l'avis part tout de suite aux élèves, aux parents et aux professeurs de la classe ; la Direction en est informée.</p>}
          <div className={`flex flex-wrap gap-1.5 ${sameDayOnly ? 'hidden' : ''}`}>
            {Object.entries(CHANGE_TYPES).map(([k, l]) => <button key={k} type="button" aria-pressed={c.type === k} onClick={() => setC({ ...c, type: k })}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${c.type === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-600">Classe<select value={c.cls} onChange={(e) => setC({ ...c, cls: e.target.value, subject: '', start: '', end: '' })} className={`mt-1 w-full ${inputCls}`}>{CLASSES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="text-xs text-slate-600">{c.type === 'DEFINITIF' ? 'À partir du' : c.type === 'AJOUT' ? 'Date du cours ajouté' : 'Date du cours'}<input type="date" value={c.date} readOnly={sameDayOnly} onChange={(e) => setC({ ...c, date: e.target.value, start: '', end: '' })} className={`mt-1 w-full ${inputCls}`} /></label>
            {c.type === 'AJOUT' ? (
              <>
                <label className="text-xs text-slate-600">Matière<select value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="">Choisir…</option>{subjects.map((x) => <option key={x}>{x}</option>)}</select></label>
                <span className="flex gap-2"><label className="text-xs text-slate-600">De<input type="time" value={c.start} onChange={(e) => setC({ ...c, start: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label><label className="text-xs text-slate-600">À<input type="time" value={c.end} onChange={(e) => setC({ ...c, end: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label></span>
              </>
            ) : (
              <label className="text-xs text-slate-600 lg:col-span-2">Cours concerné (emploi du temps)
                <select value={c.start ? `${c.start}|${c.subject}` : ''} onChange={(e) => { const sl = daySlots.find((x) => `${x.start}|${x.subject}` === e.target.value); setC({ ...c, start: sl?.start ?? '', end: sl?.end ?? '', subject: sl?.subject ?? '' }); }} className={`mt-1 w-full ${inputCls}`}>
                  <option value="">{daySlots.length ? 'Choisir…' : 'Pas de cours ce jour-là'}</option>
                  {daySlots.map((x) => <option key={x.id} value={`${x.start}|${x.subject}`}>{x.start.replace(':', 'h')}–{x.end.replace(':', 'h')} · {x.subject}</option>)}
                </select>
              </label>
            )}
            {c.type === 'DEPLACE' && (
              <>
                <label className="text-xs text-slate-600">Nouvelle date<input type="date" value={c.newDate} onChange={(e) => setC({ ...c, newDate: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
                <span className="flex gap-2"><label className="text-xs text-slate-600">De<input type="time" value={c.newStart} onChange={(e) => setC({ ...c, newStart: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label><label className="text-xs text-slate-600">À<input type="time" value={c.newEnd} onChange={(e) => setC({ ...c, newEnd: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label></span>
              </>
            )}
            {c.type === 'DEFINITIF' && (
              <>
                <label className="text-xs text-slate-600">Nouveau jour<select value={c.newWeekday} onChange={(e) => setC({ ...c, newWeekday: Number(e.target.value) })} className={`mt-1 w-full ${inputCls}`}>{DAYS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select></label>
                <span className="flex gap-2"><label className="text-xs text-slate-600">De<input type="time" value={c.newStart} onChange={(e) => setC({ ...c, newStart: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label><label className="text-xs text-slate-600">À<input type="time" value={c.newEnd} onChange={(e) => setC({ ...c, newEnd: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label></span>
              </>
            )}
            {c.type !== 'ANNULE' && <label className="text-xs text-slate-600">Salle (facultatif)<input value={c.room} onChange={(e) => setC({ ...c, room: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>}
            <label className="text-xs text-slate-600 lg:col-span-2">Précision (facultatif)<input value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} placeholder="ex. rattrapage de l'heure du 12 octobre" className={`mt-1 w-full ${inputCls}`} /></label>
          </div>
          {c.type && c.cls && (c.subject || c.type === 'AJOUT') && !errors.length && <p className="mt-3 rounded-lg bg-navy-50 p-2 text-sm text-navy-900">Message envoyé : {changeNotice({ ...c, oldWeekday: wd }, dateLabel).text}</p>}
          {tried && errors.length > 0 && <ul className="mt-2 text-sm text-red-700">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
          <Button className="mt-3" onClick={save}>{role === 'DIRECTION' || sameDay ? 'Enregistrer et prévenir la classe' : 'Enregistrer et envoyer l\'avis à la Direction'}</Button>
          {role !== 'DIRECTION' && <p className="mt-1 text-xs text-slate-600">{sameDay ? 'Cours annulé aujourd\'hui : l\'avis part tout de suite, sans attendre la Direction (elle en est informée).' : 'L\'agenda est mis à jour tout de suite ; l\'avis aux familles part dès que la Direction l\'a validé (Annonces → À valider).'}</p>}
        </Card>
      )}
      <Card title={`Changements (${list.length})`}>
        {list.length === 0 && <p className="text-sm text-slate-500">Aucun changement pour l'instant.</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {list.map((x) => (
            <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <span className="min-w-0"><span className="font-medium">{changeNotice(x, dateLabel).title}</span><span className="block text-xs text-slate-500">{changeNotice(x, dateLabel).text}</span></span>
              <Badge tone={TONE[x.type]}>{CHANGE_TYPES[x.type]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
