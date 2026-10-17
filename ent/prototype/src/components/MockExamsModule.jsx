import React, { useState } from 'react';
import logo from '../assets/logo-tamatave.png';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { specialtiesOf } from '../data/mockExams.js';
import { loadMockExams, saveMockExams } from '../mockExamStore.js';
import { EXAMS, examsForClass, bacKindOf, examResult, bacProjection, mention, decision, validMark, EAF_PARTS } from '../rules/mockExam.js';
import { formatDateFr } from '../rules/calendar.js';
import { printOnly } from '../print.js';

// Examens blancs : saisie des notes par épreuve, relevés de notes « comme à l'examen » (3e, 1re, Terminale)
// et projection au bac des Terminales à partir des vraies notes des épreuves anticipées.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const YEAR = '2026-2027';
const f2 = (v) => (v == null || v === '' ? '' : v === 'ABS' ? 'Abs.' : Number(v).toFixed(2).replace('.', ','));
const parseMark = (t) => {
  const s = String(t).trim().replace(',', '.');
  if (!s) return '';
  if (/^abs/i.test(s)) return 'ABS';
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
const examClasses = () => Object.keys(CLASSES).filter((c) => examsForClass(c).length);
const partLabel = (p, kind, student) => {
  if (kind !== 'BAC_G' || !p.id.startsWith('SPE')) return p.label;
  const spe = specialtiesOf(student)[p.id === 'SPE1' ? 0 : 1];
  return spe ? `Spécialité — ${spe}` : p.label;
};

function Transcript({ session, student, extra }) {
  const exam = EXAMS[session.kind];
  const marks = session.marks[student] ?? {};
  const r = examResult(exam.parts, marks);
  return (
    <div className="mx-auto mb-6 w-full max-w-[760px] bg-white p-8 text-[11px] text-black shadow-soft print:mb-0 print:shadow-none" style={{ breakAfter: 'page', fontFamily: 'Poppins, sans-serif' }}>
      <div className="flex items-start justify-between gap-6">
        <img src={logo} alt="École Collège Lycée Chateaubriand Tamatave" className="w-[200px]" />
        <div className="text-right">
          <p className="text-[14px] font-bold">Relevé de notes — {session.title}</p>
          <p>{exam.official} · examen blanc</p>
          <p className="font-bold">Année scolaire {YEAR}</p>
          <p className="mt-3 text-[12px] font-bold">{student}</p>
          <p>{session.cls} · épreuves du {formatDateFr(session.date).replace(/^\S+ /, '')}</p>
        </div>
      </div>
      <table className="mt-5 w-full border-collapse">
        <thead><tr className="font-bold"><th className="border border-black px-2 py-1 text-left">ÉPREUVE</th><th className="w-[12%] border border-black">COEF.</th><th className="w-[14%] border border-black">NOTE /20</th><th className="w-[14%] border border-black">POINTS</th></tr></thead>
        <tbody>
          {exam.parts.map((p) => { const v = marks[p.id]; return (
            <tr key={p.id}><td className="border border-black px-2 py-1.5">{partLabel(p, session.kind, student)}</td><td className="border border-black text-center">{p.coef}</td>
              <td className={`border border-black text-center font-semibold ${typeof v === 'number' && v < 10 ? 'text-red-700' : ''}`}>{v == null ? '—' : f2(v)}</td>
              <td className="border border-black text-center">{v == null ? '' : f2((v === 'ABS' ? 0 : v) * p.coef)}</td></tr>); })}
          <tr className="font-bold"><td className="border border-black px-2 py-1.5 text-right">TOTAL</td><td className="border border-black text-center">{r.totalCoef}</td><td className="border border-black" /><td className="border border-black text-center">{f2(r.points)} / {r.totalCoef * 20}</td></tr>
        </tbody>
      </table>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="border border-black p-2"><p className="text-[9px] font-bold">MOYENNE</p><p className="text-[16px] font-bold">{r.average == null ? '—' : f2(r.average)}</p></div>
        <div className="border border-black p-2"><p className="text-[9px] font-bold">MENTION</p><p className="text-[12px] font-semibold">{r.complete ? mention(r.average) || '—' : '—'}</p></div>
        <div className="border border-black p-2"><p className="text-[9px] font-bold">RÉSULTAT INDICATIF</p><p className="text-[12px] font-semibold">{r.complete ? decision(r.average, session.kind) : 'Épreuve(s) manquante(s)'}</p></div>
      </div>
      {!r.complete && <p className="mt-2 text-[10px]">Sans note : {r.missing.join(', ')}.</p>}
      {extra}
      <p className="mt-4 text-[9.5px] italic">Examen blanc organisé par l'établissement dans les conditions de l'examen. Document interne, sans valeur officielle. « Abs. » : absent, compté 0.</p>
      <div className="mt-6 flex justify-end"><p className="w-56 border-t border-black pt-1 text-center text-[10px]">La Cheffe d'établissement</p></div>
    </div>
  );
}

function ProjectionBlock({ p }) {
  return (
    <div className="mt-4 border border-black p-3">
      <p className="mb-1 text-[11px] font-bold">Projection au baccalauréat (sur 100 coefficients)</p>
      <p>Épreuves anticipées officielles et contrôle continu : {f2(p.acquired / (p.total - p.remainingCoef || 1))} de moyenne sur {p.total - p.remainingCoef} coefficients.</p>
      <p>À obtenir en moyenne aux épreuves de Terminale : {[10, 12, 14].map((t) => `${t} → ${p.needed[t] == null ? 'hors d\'atteinte' : f2(p.needed[t])}`).join(' · ')}.</p>
      <p>Au bac blanc : {f2(p.blancAverage)} → moyenne projetée au bac {f2(p.projected)}{p.mention ? ` (${p.mention})` : ''}.</p>
    </div>
  );
}

function EntryTab({ data, setData }) {
  const [id, setId] = useState(data.sessions[0]?.id);
  const [draft, setDraft] = useState(null);
  const [text, setText] = useState({});
  const s = data.sessions.find((x) => x.id === id);
  const exam = s && EXAMS[s.kind];
  const students = s ? CLASSES[s.cls] ?? [] : [];
  const update = (next) => { setData(next); saveMockExams(next); };
  const setMark = (student, part, raw) => {
    setText({ ...text, [`${student}|${part}`]: raw });
    const v = parseMark(raw);
    if (v !== '' && !validMark(v)) return;
    const marks = { ...s.marks, [student]: { ...(s.marks[student] ?? {}) } };
    if (v === '') delete marks[student][part]; else marks[student][part] = v;
    update({ ...data, sessions: data.sessions.map((x) => (x.id === s.id ? { ...x, marks } : x)) });
  };
  const create = () => {
    const n = { id: `x${Date.now()}`, kind: draft.kind, cls: draft.cls, title: draft.title.trim(), date: draft.date, marks: {} };
    update({ ...data, sessions: [...data.sessions, n] }); setId(n.id); setDraft(null);
  };
  const results = students.map((st) => examResult(exam?.parts ?? [], s?.marks[st]));
  const done = results.filter((r) => r.complete);
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select value={id} onChange={(e) => { setId(e.target.value); setText({}); }} aria-label="Examen blanc" className={inputCls}>
            {data.sessions.map((x) => <option key={x.id} value={x.id}>{x.title} — {x.cls} ({formatDateFr(x.date).replace(/^\S+ /, '')})</option>)}
          </select>
          <Button variant="secondary" className="ml-auto" onClick={() => { const cls = examClasses()[0]; setDraft({ cls, kind: examsForClass(cls)[0], title: '', date: '2026-11-16' }); }}>＋ Examen blanc</Button>
        </div>
        {draft && (
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
            <select value={draft.cls} onChange={(e) => setDraft({ ...draft, cls: e.target.value, kind: examsForClass(e.target.value)[0] })} aria-label="Classe" className={inputCls}>{examClasses().map((c) => <option key={c}>{c}</option>)}</select>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={`ex. ${EXAMS[draft.kind].label} n°2`} className={inputCls} />
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Date" className={inputCls} />
            <span className="flex gap-2"><Button disabled={!draft.title.trim()} onClick={create}>Créer</Button><Button variant="secondary" onClick={() => setDraft(null)}>Annuler</Button></span>
            <p className="text-xs text-slate-500 sm:col-span-4">{EXAMS[draft.kind].official} : {EXAMS[draft.kind].parts.map((p) => `${p.label} (coef. ${p.coef})`).join(', ')}.</p>
          </div>
        )}
      </Card>
      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Élèves" value={students.length} />
            <Stat label="Relevés complets" value={done.length} />
            <Stat label="Moyenne de la classe" value={done.length ? f2(done.reduce((t, r) => t + r.average, 0) / done.length) : '—'} />
            <Stat label="Admis (indicatif)" value={done.filter((r) => r.average >= 10).length} tone="green" />
          </div>
          <Card title={`${s.title} — ${s.cls}`} subtitle={`${exam.official} · notes sur 20, « abs » pour un absent (compté 0)`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2 pr-2">Élève</th>{exam.parts.map((p) => <th key={p.id} className="px-1 text-center">{p.label}<span className="block font-normal">coef. {p.coef}</span></th>)}<th className="px-2 text-right">Moyenne</th><th className="px-2">Résultat</th></tr></thead>
                <tbody>{students.map((st, i) => (
                  <tr key={st} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 font-medium text-slate-900">{st}{s.kind === 'BAC_G' && <span className="block text-[11px] font-normal text-slate-500">{specialtiesOf(st).join(' · ')}</span>}</td>
                    {exam.parts.map((p) => {
                      const k = `${st}|${p.id}`; const raw = text[k] ?? f2(s.marks[st]?.[p.id]).replace('Abs.', 'abs');
                      const bad = raw && !validMark(parseMark(raw));
                      return <td key={p.id} className="px-1 text-center"><input value={raw} onChange={(e) => setMark(st, p.id, e.target.value)} aria-label={`${st} — ${p.label}`} className={`w-16 rounded border px-1 py-1 text-center text-sm tabular-nums ${bad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} /></td>;
                    })}
                    <td className="px-2 text-right font-semibold tabular-nums">{results[i].average == null ? '—' : f2(results[i].average)}</td>
                    <td className="px-2 text-xs">{results[i].complete ? <Badge tone={results[i].average >= 10 ? 'green' : results[i].average >= 8 && s.kind !== 'DNB' ? 'amber' : 'red'}>{decision(results[i].average, s.kind)}{mention(results[i].average) ? ` · ${mention(results[i].average)}` : ''}</Badge> : <span className="text-slate-400">incomplet</span>}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function TranscriptsTab({ data }) {
  const [id, setId] = useState(data.sessions[0]?.id);
  const [who, setWho] = useState('');
  const [withProj, setWithProj] = useState(true);
  const s = data.sessions.find((x) => x.id === id);
  const students = s ? (who ? [who] : CLASSES[s.cls] ?? []) : [];
  const isBac = s && s.kind.startsWith('BAC');
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select value={id} onChange={(e) => { setId(e.target.value); setWho(''); }} aria-label="Examen blanc" className={inputCls}>
            {data.sessions.map((x) => <option key={x.id} value={x.id}>{x.title} — {x.cls}</option>)}
          </select>
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Élève" className={inputCls}><option value="">Toute la classe</option>{(CLASSES[s?.cls] ?? []).map((n) => <option key={n}>{n}</option>)}</select>
          {isBac && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={withProj} onChange={(e) => setWithProj(e.target.checked)} />Ajouter la projection au bac</label>}
          <Button className="ml-auto" onClick={() => printOnly('.transcripts-print', 'size: A4 portrait; margin: 8mm;')}>Imprimer {students.length > 1 ? `les ${students.length} relevés` : 'le relevé'}</Button>
        </div>
      </Card>
      <div className="transcripts-print">
        {s && students.map((st) => <Transcript key={st} session={s} student={st}
          extra={isBac && withProj ? <ProjectionBlock p={bacProjection(s.kind, { eaf: data.eaf[st], cc: data.cc[st], blanc: s.marks[st] })} /> : null} />)}
      </div>
    </div>
  );
}

function ProjectionTab({ data, setData }) {
  const terminales = Object.keys(CLASSES).filter((c) => /^Terminale/.test(c));
  const [cls, setCls] = useState(terminales[0]);
  const kind = bacKindOf(cls);
  const last = [...data.sessions].filter((x) => x.cls === cls && x.kind === kind).sort((a, b) => b.date.localeCompare(a.date))[0];
  const [text, setText] = useState({});
  const set = (field, st, part, raw) => {
    setText({ ...text, [`${field}|${st}|${part}`]: raw });
    const v = parseMark(raw);
    if (v !== '' && (v === 'ABS' || !validMark(v))) return;
    const next = field === 'cc' ? { ...data, cc: { ...data.cc, [st]: v === '' ? null : v } } : { ...data, eaf: { ...data.eaf, [st]: { ...(data.eaf[st] ?? {}), [part]: v === '' ? undefined : v } } };
    setData(next); saveMockExams(next);
  };
  const cell = (field, st, part, value) => {
    const k = `${field}|${st}|${part}`; const raw = text[k] ?? f2(value);
    return <input value={raw} onChange={(e) => set(field, st, part, e.target.value)} aria-label={`${st} — ${part}`} className="w-14 rounded border border-slate-300 px-1 py-1 text-center text-sm tabular-nums" />;
  };
  const tone = (need, avg) => (need == null ? 'text-red-700' : avg == null ? '' : avg >= need ? 'text-emerald-700' : 'text-amber-700');
  return (
    <Card title="Projection au bac" subtitle="Notes officielles des épreuves anticipées (passées en 1re) + contrôle continu + dernier bac blanc : ce qui est acquis, ce qu'il reste à obtenir"
      action={<select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Classe" className={inputCls}>{terminales.map((c) => <option key={c}>{c}</option>)}</select>}>
      <p className="mb-3 text-xs text-slate-500">Bac sur 100 coefficients : épreuves anticipées 10 (officielles), contrôle continu 40, épreuves de Terminale 50 (estimées par {last ? `« ${last.title} » du ${formatDateFr(last.date).replace(/^\S+ /, '')}` : 'le bac blanc, pas encore passé'}). En vert : le niveau du bac blanc suffit ; en orange : il manque des points.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-2 pr-2">Élève</th><th className="px-1 text-center">Français écrit<span className="block font-normal">officiel</span></th><th className="px-1 text-center">Français oral<span className="block font-normal">officiel</span></th><th className="px-1 text-center">Contrôle continu</th>
            <th className="px-2 text-center">Bac blanc<span className="block font-normal">épreuves de Tle</span></th><th className="px-2 text-center">Pour 10</th><th className="px-2 text-center">Pour 12</th><th className="px-2 text-center">Pour 14</th><th className="px-2 text-center">Moyenne projetée</th></tr></thead>
          <tbody>{(CLASSES[cls] ?? []).map((st) => {
            const p = bacProjection(kind, { eaf: data.eaf[st], cc: data.cc[st], blanc: last?.marks[st] });
            return (
              <tr key={st} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-medium text-slate-900">{st}</td>
                {EAF_PARTS.map((part) => <td key={part.id} className="px-1 text-center">{cell('eaf', st, part.id, data.eaf[st]?.[part.id])}</td>)}
                <td className="px-1 text-center">{cell('cc', st, 'CC', data.cc[st])}</td>
                <td className="px-2 text-center font-semibold tabular-nums">{p.blancAverage == null ? '—' : f2(p.blancAverage)}</td>
                {[10, 12, 14].map((t) => <td key={t} className={`px-2 text-center tabular-nums ${tone(p.needed[t], p.blancAverage)}`}>{p.needed[t] == null ? (p.remainingCoef ? 'hors d\'atteinte' : '—') : f2(p.needed[t])}</td>)}
                <td className="px-2 text-center"><span className="font-semibold tabular-nums">{p.projected == null ? '—' : f2(p.projected)}</span>{p.complete && <span className="block text-[11px] text-slate-500">{p.decision}{p.mention ? ` · ${p.mention}` : ''}</span>}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">« Pour 12 » : moyenne à obtenir aux épreuves de Terminale (philosophie, spécialités, grand oral) pour finir à 12 au bac, compte tenu des notes déjà acquises.</p>
    </Card>
  );
}

const TABS = [['entry', 'Saisie des notes'], ['transcripts', 'Relevés de notes'], ['projection', 'Projection au bac']];
export default function MockExamsModule() {
  const [tab, setTab] = useState('entry');
  const [data, setData] = useState(loadMockExams);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Tamatave · classes d'examen</p>
        <h1 className="text-2xl font-semibold text-navy-900">Examens blancs</h1>
        <p className="text-sm text-slate-500">Brevet blanc (3e), épreuves anticipées blanches (1re), bac blanc (Terminale) : notes par épreuve avec les coefficients de l'examen, relevés imprimables et projection au bac.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>)}
      </div>
      {tab === 'entry' && <EntryTab data={data} setData={setData} />}
      {tab === 'transcripts' && <TranscriptsTab data={data} />}
      {tab === 'projection' && <ProjectionTab data={data} setData={setData} />}
    </div>
  );
}
