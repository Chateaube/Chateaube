import AmbianceSettings from './AmbianceSettings.jsx';
import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { CLASS_SUBJECTS } from '../data/grades.js';
import {
  dunningSchedule, pausesBetween, planMonths, dueDateOf, formatDateFr, monthName, madagascarHolidays,
} from '../rules/calendar.js';

const SCHOOL_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
const WEEKDAYS = [[1, 'Lun.'], [2, 'Mar.'], [3, 'Mer.'], [4, 'Jeu.'], [5, 'Ven.'], [6, 'Sam.'], [7, 'Dim.']];
const KIND_UI = {
  FERIE: { tone: 'navy', label: 'Férié' },
  VACANCES: { tone: 'green', label: 'Vacances' },
  FERMETURE: { tone: 'amber', label: 'Fermeture' },
};
// Pas de SMS (aucun budget prévu) : e-mail et notification de l'application
const CHANNELS = [['EMAIL', 'E-mail'], ['PUSH', 'Notification de l\'application']]; // ni SMS ni WhatsApp
const MONTH_ABBR = { 9: 'Sept.', 10: 'Oct.', 11: 'Nov.', 12: 'Déc.', 1: 'Janv.', 2: 'Févr.', 3: 'Mars', 4: 'Avr.', 5: 'Mai', 6: 'Juin', 7: 'Juil.', 8: 'Août' };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const yearOf = (month, settings) => Number((month >= 9 ? settings.schoolYear.start : settings.schoolYear.end).slice(0, 4));
const fmtShort = (iso) => iso.split('-').reverse().join('/');

function NumberField({ label, value, onChange, suffix, min = 1, max = 60 }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number" min={min} max={max} value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= min && n <= max) onChange(n);
          }}
          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
        />
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2 text-left text-sm">
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-navy-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-4.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

function Simulation({ settings }) {
  const [planIdx, setPlanIdx] = useState(0);
  const plan = settings.tuition.plans[planIdx];
  const months = planMonths(plan);
  const [month, setMonth] = useState(12);
  const due = dueDateOf(yearOf(month, settings), month, settings);
  const lastMonth = month === plan.last && settings.dunning.lastMonth?.enabled;
  const delays = lastMonth ? settings.dunning.lastMonth : settings.dunning;
  let result;
  try {
    const sch = dunningSchedule(due, settings, { lastMonth });
    result = { sch, pauses: pausesBetween(due, sch.suspension, settings) };
  } catch (e) {
    result = { error: e.message };
  }
  const rows = result.sch && [
    ['Échéance', result.sch.due, 'slate'],
    [`Relance (J+${delays.relanceAfter}${settings.dunning.countFrom === 'ETAPE_PRECEDENTE' ? ' après l\'échéance' : ''})`, result.sch.relance, 'navy'],
    [`Avertissement (J+${delays.warningAfter}${settings.dunning.countFrom === 'ETAPE_PRECEDENTE' ? ' après relance' : ''})`, result.sch.warning, 'amber'],
    [`Mise à pied (J+${delays.suspensionAfter}${settings.dunning.countFrom === 'ETAPE_PRECEDENTE' ? ' après avertissement' : ''})`, result.sch.suspension, 'red'],
  ];

  return (
    <Card title="Simulation" subtitle="Dates calculées avec les paramètres en cours" className="xl:sticky xl:top-6">
      <label className="mb-3 block">
        <span className="text-xs font-medium text-slate-600">Niveaux</span>
        <select value={planIdx} onChange={(e) => { setPlanIdx(Number(e.target.value)); setMonth(9); }} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {settings.tuition.plans.map((p, i) => <option key={p.levels} value={i}>{p.levels}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Échéance impayée de</span>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {months.map((m) => <option key={m} value={m}>{cap(monthName(m))} {yearOf(m, settings)}{m === plan.last ? ' — dernier mois' : ''}</option>)}
        </select>
      </label>
      {lastMonth && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Dernier mois du plan : délais raccourcis.</p>}
      {result.error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{result.error}</p>
      ) : (
        <>
          <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">
            {rows.map(([label, date, tone]) => (
              <li key={label} className="relative">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${{ slate: 'bg-slate-400', navy: 'bg-navy-500', amber: 'bg-amber-500', red: 'bg-red-500' }[tone]}`} />
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-medium text-slate-900">{cap(formatDateFr(date))}</p>
              </li>
            ))}
          </ol>
          {result.pauses.length > 0 && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Périodes non comptées</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {result.pauses.map((p) => (
                  <li key={p.start}>· {p.reason} ({p.start === p.end ? fmtShort(p.start) : `${fmtShort(p.start)} → ${fmtShort(p.end)}`})</li>
                ))}
              </ul>
            </div>
          )}
          {settings.dunning.suspensionRequiresDirection && (
            <p className="mt-3 text-xs text-slate-500">La mise à pied n'est notifiée qu'après validation d'un compte Direction.</p>
          )}
        </>
      )}
    </Card>
  );
}

function CompetencyEditor({ settings, onChange }) {
  const refs = settings.competencies ?? {};
  const keys = Object.keys(refs).sort();
  const [key, setKey] = useState(keys[0] ?? '');
  const [newKey, setNewKey] = useState({ subject: '', level: '' });
  const [label, setLabel] = useState('');
  const list = refs[key] ?? [];
  const save = (next) => onChange({ ...settings, competencies: { ...refs, [key]: next } });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-600">Matière · niveau
          <select value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {keys.map((k) => <option key={k} value={k}>{k.replace('|', ' · ')}</option>)}
          </select>
        </label>
        <input value={newKey.subject} onChange={(e) => setNewKey({ ...newKey, subject: e.target.value })} placeholder="Nouvelle matière" className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <input value={newKey.level} onChange={(e) => setNewKey({ ...newKey, level: e.target.value })} placeholder="Niveau (ex. 3e)" className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <Button variant="secondary" disabled={!newKey.subject.trim() || !newKey.level.trim()} onClick={() => {
          const k = `${newKey.subject.trim()}|${newKey.level.trim()}`;
          onChange({ ...settings, competencies: { ...refs, [k]: refs[k] ?? [] } });
          setKey(k); setNewKey({ subject: '', level: '' });
        }}>Ajouter</Button>
      </div>
      <ol className="space-y-1.5">
        {list.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-6 text-right text-xs text-slate-400">C{i + 1}</span>
            <input value={c} onChange={(e) => save(list.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Compétence C${i + 1}`} className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <button type="button" aria-label={`Supprimer ${c}`} onClick={() => save(list.filter((_, k) => k !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Icon name="x" /></button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nouvelle compétence…" aria-label="Nouvelle compétence" className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <Button variant="secondary" disabled={!label.trim() || !key} onClick={() => { save([...list, label.trim()]); setLabel(''); }}>Ajouter la compétence</Button>
      </div>
    </div>
  );
}

// cinq onglets ; les ambiances, facultatives, en dernier
const SETTINGS_TABS = [['calendar', 'Calendrier'], ['fees', 'Frais et relances'], ['grades', 'Notes et conseil'], ['skills', 'Compétences'], ['ambiances', 'Ambiances et réseaux']];

export default function SettingsModule({ settings, onChange, onReset }) {
  const [tab, setTab] = useState('calendar');
  const [draft, setDraft] = useState({ kind: 'VACANCES', label: '', start: '', end: '' });
  const set = (path, value) => onChange({ ...settings, [path]: { ...settings[path], ...value } });
  const d = settings.dunning;
  const orderError = d.countFrom === 'ECHEANCE' && !(d.relanceAfter < d.warningAfter && d.warningAfter < d.suspensionAfter);
  const calendar = useMemo(() => [...settings.calendar].sort((a, b) => a.start.localeCompare(b.start)), [settings.calendar]);

  const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setPlan = (i, patch) => set('tuition', { plans: settings.tuition.plans.map((p, k) => (k === i ? { ...p, ...patch } : p)) });

  const addHolidays = () => {
    const existing = new Set(settings.calendar.filter((e) => e.kind === 'FERIE').map((e) => e.start));
    const added = madagascarHolidays(Number(settings.schoolYear.start.slice(0, 4)))
      .filter((h) => !existing.has(h.start))
      .map((h, i) => ({ ...h, id: `g${Date.now()}${i}` }));
    onChange({ ...settings, calendar: [...settings.calendar, ...added] });
  };
  const addEntry = () => {
    onChange({ ...settings, calendar: [...settings.calendar, { ...draft, id: `n${Date.now()}`, end: draft.end || draft.start }] });
    setDraft({ kind: 'VACANCES', label: '', start: '', end: '' });
  };
  const draftOk = draft.label.trim() && draft.start && (!draft.end || draft.end >= draft.start);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Administration</p>
          <h1 className="text-2xl font-semibold text-navy-900">Paramètres</h1>
          <p className="text-sm text-slate-500">Calendrier, frais, relances et notes : la Direction les modifie ici.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => { if (window.confirm('Remettre tous les paramètres (calendrier, frais, relances, notes) à leurs valeurs de départ ? Vos réglages seront perdus.')) onReset(); }}>Valeurs par défaut</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Paramètres">
        {SETTINGS_TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>

      <div className={`grid gap-5 xl:items-start ${['fees', 'calendar'].includes(tab) ? 'xl:grid-cols-[1fr_360px]' : ''}`}>
        <div className="min-w-0 space-y-5">
          {tab === 'ambiances' && <>
          {/* Ambiance saisonnière et réseaux de l'école */}
          <Card title="Ambiance saisonnière et réseaux de l'école" subtitle="Repères civiques, culturels, historiques et saisons (Octobre rose, Nouvel An lunaire, 26 juin…), avec une note explicative ; liens montrés aux familles">
            <div className="grid gap-4 md:grid-cols-2">
              <AmbianceSettings settings={settings} onChange={onChange} />
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Page Facebook de l'école
                  <input type="url" value={settings.social?.facebook ?? ''} onChange={(e) => onChange({ ...settings, social: { ...settings.social, facebook: e.target.value.trim() } })} placeholder="https://www.facebook.com/…" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="block text-xs font-medium text-slate-600">Instagram
                  <input type="url" value={settings.social?.instagram ?? ''} onChange={(e) => onChange({ ...settings, social: { ...settings.social, instagram: e.target.value.trim() } })} placeholder="https://www.instagram.com/…" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="block text-xs font-medium text-slate-600">Nom affiché pour l'Instagram
                  <input value={settings.social?.instagramLabel ?? ''} onChange={(e) => onChange({ ...settings, social: { ...settings.social, instagramLabel: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <p className="text-xs text-slate-600">Les liens apparaissent dans « Vie de l'école » et sur l'accueil des familles ; vides, rien ne s'affiche.</p>
              </div>
            </div>
          </Card>
          </>}

          {/* Rubriques affichées : déplacées dans Droits d'accès (onglet « Rubriques de l'école ») */}

          {tab === 'fees' && <>
          {/* Frais de scolarité */}
          <Card title="Échéancier de frais de scolarité" subtitle="Année 2026-2027 · Tamatave">
            <NumberField label="Jour d'échéance mensuelle" value={settings.tuition.dueDay} min={1} max={28} suffix="du mois"
              onChange={(v) => set('tuition', { dueDay: v })} />
            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2 font-medium">Niveaux</th>
                    <th className="px-2 py-2 font-medium">Premier mois</th>
                    <th className="px-2 py-2 font-medium">Dernier mois</th>
                    <th className="px-4 py-2 text-right font-medium">Échéances</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.tuition.plans.map((p, i) => (
                    <tr key={p.levels} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 font-medium text-slate-800">{p.levels}</td>
                      {['first', 'last'].map((k) => (
                        <td key={k} className="px-2 py-2">
                          <select value={p[k]} onChange={(e) => setPlan(i, { [k]: Number(e.target.value) })} aria-label={`${k === 'first' ? 'Premier' : 'Dernier'} mois — ${p.levels}`}
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                            {SCHOOL_ORDER.map((m) => <option key={m} value={m}>{cap(monthName(m))}</option>)}
                          </select>
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right"><Badge tone="navy">{planMonths(p).length} mois</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">1re et Terminale : la dernière échéance précède le départ à Tana pour les épreuves.</p>
          </Card>

          {/* Relances */}
          <Card title="Relances d'impayés" subtitle="Délais en jours comptés : jours retenus ci-dessous, hors jours fériés, vacances et mois gelés">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="1. Relance automatique" value={d.relanceAfter} suffix="jours" onChange={(v) => set('dunning', { relanceAfter: v })} />
              <NumberField label="2. Avertissement" value={d.warningAfter} suffix="jours" onChange={(v) => set('dunning', { warningAfter: v })} />
              <NumberField label="3. Mise à pied" value={d.suspensionAfter} suffix="jours" onChange={(v) => set('dunning', { suspensionAfter: v })} />
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <Toggle checked={Boolean(d.lastMonth?.enabled)} onChange={(v) => set('dunning', { lastMonth: { ...d.lastMonth, enabled: v } })}
                label="Délais différents pour le dernier mois (juin, ou mai pour les 1re et Tle)" />
              {d.lastMonth?.enabled && (
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <NumberField label="1. Relance automatique" value={d.lastMonth.relanceAfter} suffix="jours" onChange={(v) => set('dunning', { lastMonth: { ...d.lastMonth, relanceAfter: v } })} />
                  <NumberField label="2. Avertissement" value={d.lastMonth.warningAfter} suffix="jours" onChange={(v) => set('dunning', { lastMonth: { ...d.lastMonth, warningAfter: v } })} />
                  <NumberField label="3. Mise à pied" value={d.lastMonth.suspensionAfter} suffix="jours" onChange={(v) => set('dunning', { lastMonth: { ...d.lastMonth, suspensionAfter: v } })} />
                </div>
              )}
            </div>
            {orderError && <p className="mt-2 text-sm text-red-700">Comptés depuis l'échéance, les délais doivent être croissants (relance &lt; avertissement &lt; mise à pied).</p>}

            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-slate-600">Délais comptés à partir de</legend>
              <div className="mt-1.5 flex flex-wrap gap-4 text-sm">
                {[['ETAPE_PRECEDENTE', 'l\'étape précédente (relance après l\'échéance)'], ['ECHEANCE', 'la date d\'échéance']].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5">
                    <input type="radio" name="countFrom" checked={d.countFrom === v} onChange={() => set('dunning', { countFrom: v })} />{l}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-slate-600">Jours de la semaine comptés</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {WEEKDAYS.map(([n, l]) => {
                  const on = d.countedWeekdays.includes(n);
                  return (
                    <button key={n} type="button" aria-pressed={on}
                      onClick={() => (on && d.countedWeekdays.length === 1) || set('dunning', { countedWeekdays: toggleIn(d.countedWeekdays, n).sort() })}
                      className={`rounded-md px-2.5 py-1 text-sm font-medium ring-1 ring-inset ${on ? 'bg-navy-500 text-white ring-navy-500' : 'text-slate-600 ring-slate-300'}`}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-slate-600">Mois avec relances (mois décoché = décompte gelé)</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SCHOOL_ORDER.map((m) => {
                  const on = d.activeMonths.includes(m);
                  return (
                    <button key={m} type="button" aria-pressed={on} onClick={() => set('dunning', { activeMonths: toggleIn(d.activeMonths, m) })}
                      className={`rounded-md px-2.5 py-1 text-sm ring-1 ring-inset ${on ? 'bg-navy-50 font-medium text-navy-900 ring-navy-200' : 'hatched text-amber-800 ring-amber-300 line-through'}`}>
                      {MONTH_ABBR[m]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">Octobre est gelé par défaut (encaissement des droits d'examen).</p>
            </fieldset>

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <Toggle checked={d.suspensionRequiresDirection} onChange={(v) => set('dunning', { suspensionRequiresDirection: v })}
                label="La mise à pied doit être validée par la Direction avant notification" />
              <div>
                <p className="text-xs font-medium text-slate-600">Canaux d'envoi</p>
                <div className="mt-1.5 flex flex-wrap gap-4 text-sm">
                  {CHANNELS.map(([v, l]) => (
                    <label key={v} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={d.channels.includes(v)}
                        onChange={() => (d.channels.includes(v) && d.channels.length === 1) || set('dunning', { channels: toggleIn(d.channels, v) })} />{l}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          </>}

          {tab === 'grades' && <>
          {/* Notes */}
          <Card title="Notes & conseil de classe" subtitle="Règles communes à toutes les classes de Tamatave">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Notes minimum par trimestre (pour valider)" value={settings.grading.minEvaluations} min={1} max={10} suffix="évaluations"
                onChange={(v) => set('grading', { minEvaluations: v })} />
              <NumberField label="Espace Parents : publication aux parents" value={settings.grading.parentDelayDays} min={0} max={7} suffix="jour(s) après les élèves"
                onChange={(v) => set('grading', { parentDelayDays: v })} />
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-800">
              <input type="checkbox" className="mt-0.5 h-5 w-5" checked={!!settings.grading.allowTutoiement} onChange={(e) => set('grading', { allowTutoiement: e.target.checked })} />
              <span>Autoriser le tutoiement dans les appréciations<span className="block text-xs text-slate-600">Aucune règle nationale ne l'interdit, mais le bulletin est un document officiel lu par la famille : la plupart des établissements demandent la 3e personne. Décoché : le contrôleur signale « tu, ton, ta… ».</span></span>
            </label>
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-600">Types d'évaluation proposés aux enseignants</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {settings.grading.evaluationTypes.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-900">
                    {t}
                    <button type="button" aria-label={`Retirer ${t}`} onClick={() => set('grading', { evaluationTypes: settings.grading.evaluationTypes.filter((x) => x !== t) })} className="text-navy-500 hover:text-red-600">×</button>
                  </span>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); const v = e.target.elements.t.value.trim(); if (v && !settings.grading.evaluationTypes.includes(v)) set('grading', { evaluationTypes: [...settings.grading.evaluationTypes, v] }); e.target.reset(); }}>
                  <input name="t" placeholder="+ Ajouter" className="w-28 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs" />
                </form>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-600">Matières comptées dans la moyenne générale (grille du conseil)</p>
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {CLASS_SUBJECTS.map((s) => {
                  const included = !settings.grading.excludedSubjects.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={included} onChange={() => set('grading', { excludedSubjects: toggleIn(settings.grading.excludedSubjects, s.id) })} />
                      <span className={included ? 'text-slate-800' : 'text-slate-400 line-through'}>{s.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">Par défaut : Arts plastiques, Musique et Vie de classe sont hors moyenne.</p>
            </div>
          </Card>
          </>}

          {tab === 'skills' && <>
          {/* Référentiels de compétences */}
          <Card title="Base de compétences proposée aux enseignants" subtitle="Par matière et par niveau ; chaque enseignant la reprend en tout ou partie et ajoute ses propres compétences">
            <CompetencyEditor settings={settings} onChange={onChange} />
          </Card>
          </>}

          {tab === 'calendar' && <>
          {/* Calendrier */}
          <Card
            title="Calendrier scolaire"
            subtitle="Jours fériés, vacances et fermetures : non comptés dans les délais"
            action={<Button variant="secondary" onClick={addHolidays}>Ajouter les fériés de Madagascar</Button>}
          >
            <ul className="divide-y divide-slate-100">
              {calendar.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <Badge tone={KIND_UI[e.kind].tone} className="w-20 justify-center">{KIND_UI[e.kind].label}</Badge>
                  <span className="min-w-0 flex-1 text-slate-800">{e.label}</span>
                  <span className="tabular-nums text-slate-500">{e.start === e.end ? fmtShort(e.start) : `${fmtShort(e.start)} → ${fmtShort(e.end)}`}</span>
                  <button type="button" aria-label={`Supprimer ${e.label}`} onClick={() => onChange({ ...settings, calendar: settings.calendar.filter((x) => x.id !== e.id) })}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[110px_1fr_140px_140px_auto] sm:items-end">
              <label className="block text-xs text-slate-600">Type
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                  {Object.entries(KIND_UI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="block text-xs text-slate-600">Libellé
                <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="ex. Vacances de Pâques"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs text-slate-600">Du
                <input type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs text-slate-600">Au (inclus)
                <input type="date" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
              </label>
              <Button disabled={!draftOk} onClick={addEntry}>Ajouter</Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Les vacances fournies sont des exemples : à remplacer par le calendrier officiel de l'établissement.</p>
          </Card>
          </>}
        </div>

        {['fees', 'calendar'].includes(tab) && <Simulation settings={settings} />}
      </div>

    </div>
  );
}
