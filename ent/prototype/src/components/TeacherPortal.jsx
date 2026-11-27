import { featureVisible } from '../features.js';
import { ONLINE } from '../online/client.js';
import React from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { TEACHER } from '../data/people.js';
import { WEEK_SESSIONS, NOW } from '../data/attendance.js';
import { sessionState } from '../rules/attendance.js';
import { loadRecords } from './AttendanceModule.jsx';
import { setIntent } from '../navIntent.js';
import QuickEntry from './QuickEntry.jsx';
import { me } from '../identity.js';
import { loadTimetable } from '../timetableStore.js';
import { mySlot } from './AgendaModule.jsx';
import { today as todayIso } from '../clock.js';
import { TERM } from '../data/grades.js';
import { loadAnnouncements } from '../announcementsStore.js';
import { receives } from '../rules/announcements.js';
import { NOUVEAU } from '../essai.js';
import { TERMS, termOfDate, carnetForTerm, termById } from '../rules/terms.js';
import { gradebookTodo } from '../rules/teacherTodo.js';
import { loadCarnet, myServices, saveCarnet } from '../gradebookStore.js';
import { sameSubject } from '../rules/timetableImport.js';
import { minEvaluationsFor } from '../rules/grading.js';

// « Ma journée » de l'enseignant : le cours en cours (appel), ce qu'il reste à faire, puis les cours du jour.
// L'appel se fait sur un seul écran (Appel), ouvert directement sur la bonne séance.
const h = (t) => t.replace(':', 'h');
const STATE_UI = { FAIT: ['green', 'Appel fait'], EN_COURS: ['red', 'Appel à faire'], OUBLIE: ['red', 'Appel oublié'], A_VENIR: ['slate', 'À venir'] };

const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const frStop = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** En ligne : la semaine du professeur, tirée de l'emploi du temps de l'école et de ses classes (envoyées par la Direction). */
function MyWeek({ slots, go }) {
  const days = [1, 2, 3, 4, 5, 6].filter((d) => d <= 5 || slots.some((s) => s.weekday === d));
  // deux lectures : par jour (la semaine) ou par classe (chaque classe du professeur, ses heures dans la semaine)
  const [view, setView] = React.useState('JOUR');
  const classes = [...new Set(slots.map((s) => s.cls))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  const byTime = (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start);
  const hours = (list) => list.reduce((t, s) => t + (Number(s.end.slice(0, 2)) * 60 + Number(s.end.slice(3)) - Number(s.start.slice(0, 2)) * 60 - Number(s.start.slice(3))), 0) / 60;
  return (
    <Card title="Ma semaine" subtitle="Mon emploi du temps : seulement mes classes (le détail jour par jour, avec les changements, est dans l'Agenda)"
      action={slots.length > 0 && <span className="flex rounded-lg bg-slate-100 p-0.5 text-xs" role="tablist">{[['JOUR', 'Par jour'], ['CLASSE', 'Par classe']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-2.5 py-1 font-medium ${view === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>)}</span>}>
      {!slots.length ? <p className="text-sm text-slate-500">Votre emploi du temps apparaîtra ici dès que la Direction aura envoyé les classes et l'emploi du temps.</p> : view === 'CLASSE' ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const list = slots.filter((s) => s.cls === c).sort(byTime);
            return (
              <div key={c} className="rounded-xl bg-slate-50 p-2">
                <p className="mb-1 flex justify-between text-xs font-semibold text-navy-900"><span>{c}</span><span className="font-normal text-slate-500">{String(hours(list)).replace('.', ',')} h / semaine</span></p>
                <ul className="space-y-1">{list.map((s) => <li key={s.id ?? `${s.weekday}${s.start}`} className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm"><span className="font-semibold">{DAYS[s.weekday]}</span> · <span className="tabular-nums">{h(s.start)}–{h(s.end)}</span><span className="block text-slate-700">{s.subject}{s.room ? ` · ${s.room}` : ''}</span></li>)}</ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {days.map((d) => (
            <div key={d} className="rounded-xl bg-slate-50 p-2">
              <p className="mb-1 text-xs font-semibold text-navy-900">{DAYS[d]}</p>
              <ul className="space-y-1">
                {slots.filter((s) => s.weekday === d).sort((a, b) => a.start.localeCompare(b.start)).map((s) => (
                  <li key={s.id ?? `${d}${s.start}${s.cls}`} className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm"><span className="font-semibold tabular-nums">{h(s.start)}–{h(s.end)}</span><span className="block text-slate-700">{s.cls} · {s.subject}{s.room ? ` · ${s.room}` : ''}</span></li>
                ))}
                {!slots.some((s) => s.weekday === d) && <li className="text-xs text-slate-400">—</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Button variant="secondary" className="mt-3 !py-1 text-xs" onClick={() => go('agenda')}>Ouvrir l'agenda</Button>
    </Card>
  );
}

export default function TeacherPortal({ go, settings, as = null }) {
  // as : la Direction voit l'accueil d'un professeur (site d'essai, « Voir comme… »)
  const slotOf = as ? (x) => myServices().some((s) => s.cls === x.cls && (sameSubject(x.subject, s.subject) || sameSubject(s.subject, x.subject))) : mySlot;
  // en ligne : mes cours réels (emploi du temps de l'école × mes classes) ; démonstration : la semaine type
  const mine = ONLINE ? loadTimetable().filter((x) => slotOf(x)) : null;
  // pense-bête : gardé dans le carnet du professeur (le même sur l'ordinateur et le téléphone)
  const [memo, setMemo] = React.useState(() => (NOUVEAU && ONLINE ? loadCarnet()?.memo ?? '' : ''));
  const saveMemo = (v) => { setMemo(v); saveCarnet({ ...(loadCarnet() ?? {}), memo: v }); };
  // dates à retenir (éphéméride) : les 4 prochaines
  const dates = TERMS.flatMap((t) => [
    [t.stop, `Arrêt des notes du ${t.label}`],
    [t.closeAt?.slice(0, 10), `Fin de la saisie du ${t.label} (${t.closeText})`],
    [t.councilFrom, `Conseils de classe du ${t.label} : ${t.council}`],
  ]).filter(([d]) => d && d >= todayIso()).sort(([a], [b]) => a.localeCompare(b)).slice(0, 4);
  const wd = new Date(`${todayIso()}T12:00:00`).getDay();
  const todayOnline = mine ? mine.filter((s) => s.weekday === wd).sort((a, b) => a.start.localeCompare(b.start)).map((s, i) => ({ ...s, id: s.id ?? `t${i}`, date: todayIso() })) : null;
  const news = ONLINE ? (loadAnnouncements().list ?? []).filter((a) => receives(a, { role: 'PROFESSEUR', site: 'TMV', classes: [...new Set((mine ?? []).map((s) => s.cls))] })).slice(0, 5) : null;
  const records = loadRecords();
  const stateOf = (s) => sessionState(s, NOW, records[s.id]);
  const today = todayOnline ?? WEEK_SESSIONS.filter((s) => s.date === NOW.date);
  const current = today.find((s) => stateOf(s) === 'EN_COURS');
  const forgotten = WEEK_SESSIONS.filter((s) => stateOf(s) === 'OUBLIE');
  const booking = (s) => TEACHER.today.find((x) => x.start === s.start && x.cls === s.cls)?.booking;
  const call = (s) => { setIntent('appel', { session: s.id }); go('appel'); };
  const appel = featureVisible(settings, 'appel', 'ENSEIGNANT'); // appel en ligne : pas encore (papier)

  return (
    <div className="space-y-5 pb-16 sm:pb-0">
      <div>
        <p className="text-sm font-semibold text-navy-500">Ma journée</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bonjour {as?.name ?? me('ENSEIGNANT')}</h1>
        {!ONLINE && <p className="text-sm text-slate-600">{TEACHER.subjects}</p>}
      </div>

      {appel && current && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-900 p-5 text-white shadow-soft">
          <div><p className="text-xs uppercase tracking-wide text-navy-200">Cours en cours</p><p className="font-display text-lg font-semibold">{current.cls} · {current.subject}</p><p className="text-sm text-navy-100">{h(current.start)}–{h(current.end)} · {current.room}</p></div>
          <button type="button" onClick={() => call(current)} className="min-h-[44px] rounded-xl bg-white px-5 py-3 text-base font-semibold text-navy-900 shadow hover:bg-navy-50">Faire l'appel</button>
        </div>
      )}
      {appel && forgotten.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <span><strong>Appel oublié</strong> · {s.cls} · {s.subject}, {s.date === NOW.date ? 'aujourd\'hui' : `le ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`} {h(s.start)}–{h(s.end)}</span>
          <span className="text-xs">Appel fermé après 15 minutes : voyez la vie scolaire.</span>
        </div>
      ))}

      <Card title="À faire">
        <ul className="space-y-2">
          {ONLINE && <li className="text-sm text-slate-700">Notes, appréciations et compétences du {TERM.label} : à saisir dans <button type="button" className="font-medium text-navy-700 underline" onClick={() => go('grades')}>Notes et appréciations</button> — {NOUVEAU ? <>arrêt des notes le <strong>{TERMS[0].stopText}</strong>, saisie ouverte jusqu'au <strong>{TERMS[0].closeText}</strong></> : <>arrêt des notes le <strong>{frStop(TERM.stop)}</strong></>}. Besoin d'aide ? <button type="button" className="font-medium text-navy-700 underline" onClick={() => go('teacher-guide')}>Mode d'emploi</button>.</li>}
          {NOUVEAU && ONLINE && (() => {
            // trimestre à finir : le 1er tant que sa saisie est ouverte, sinon celui du jour
            const t = termById(todayIso() <= TERMS[0].closeAt.slice(0, 10) ? TERMS[0].id : termOfDate(todayIso()));
            const rows = gradebookTodo(myServices(), carnetForTerm(loadCarnet(), t.id), (sv) => minEvaluationsFor(sv, settings.grading.minEvaluations));
            const open = (r) => { setIntent('grades', { cls: r.cls, subject: r.subject }); go('grades'); };
            if (!rows.length) return <li className="text-sm text-emerald-800">✓ {t.label} : rien ne manque dans vos classes (ou tout est validé).</li>;
            return rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <button type="button" onClick={() => open(r)} className="text-left text-sm text-slate-800 hover:underline">
                  <strong>{r.cls} · {r.subject}</strong> ({t.label}) :{' '}
                  {[r.missingEvals && `${r.missingEvals} devoir${r.missingEvals > 1 ? 's' : ''} manquant${r.missingEvals > 1 ? 's' : ''} (${r.evals}/${r.min})`,
                    r.toWrite && `${r.toWrite} appréciation${r.toWrite > 1 ? 's' : ''} à écrire`,
                    r.toValidate && `${r.toValidate} à valider`, r.noComps && 'compétences du bulletin à renseigner'].filter(Boolean).join(' · ')}
                </button>
              </li>
            ));
          })()}
          {(ONLINE ? [] : TEACHER.todo).map((t) => (
            <li key={t.label} className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.tone === 'amber' ? 'bg-amber-500' : 'bg-navy-500'}`} />
              <div><p className="text-sm font-medium text-slate-800">{t.label}</p><p className="text-xs text-slate-600">{t.detail}</p></div>
            </li>
          ))}
        </ul>
      </Card>

      {NOUVEAU && ONLINE && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Pense-bête" subtitle="Votre aide-mémoire : une idée, un rappel, un devoir à préparer (la Direction peut le lire, comme votre carnet).">
            <textarea rows={4} value={memo} readOnly={Boolean(as)} onChange={(e) => saveMemo(e.target.value)} placeholder="ex. Rendre les copies de la 6e jeudi" className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-800" />
          </Card>
          <Card title="Dates à retenir">
            <ul className="space-y-2 text-sm">
              {dates.map(([d, label]) => (
                <li key={d + label} className="flex gap-3"><span className="w-24 shrink-0 font-semibold text-navy-700">{new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="text-slate-700">{label}</span></li>
              ))}
              {!dates.length && <li className="text-slate-500">Aucune date à venir.</li>}
            </ul>
          </Card>
        </div>
      )}

      {!ONLINE && <QuickEntry role="ENSEIGNANT" go={go} />}

      {ONLINE && <MyWeek slots={mine} go={go} />}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card title="Mes cours aujourd'hui">
          <ol className="space-y-2">
            {!today.length && <li className="text-sm text-slate-500">{ONLINE && !mine?.length ? 'Votre emploi du temps apparaîtra ici dès que la Direction aura envoyé les classes et l\'emploi du temps.' : 'Pas de cours aujourd\'hui.'}</li>}
            {today.map((s) => {
              const st = stateOf(s);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="w-28 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-navy-900">{h(s.start)}–{h(s.end)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{s.cls} · {s.subject}</p>
                    <p className="text-xs text-slate-600">{s.room}{booking(s) && ` · ${booking(s)} réservé`}</p>
                  </div>
                  {!ONLINE && <Badge tone={STATE_UI[st][0]}>{STATE_UI[st][1]}</Badge>}
                  {/* tout part du cours : appel, cahier de textes, notes de la classe */}
                  <span className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                    {appel && st !== 'A_VENIR' && <Button variant={st === 'FAIT' ? 'secondary' : 'primary'} className="!py-1 text-xs" onClick={() => call(s)}><Icon name="check" />{st === 'FAIT' ? 'Corriger l\'appel' : 'Appel'}</Button>}
                    {featureVisible(settings, 'cahier-textes', 'ENSEIGNANT') && <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setIntent('homework', { cls: s.cls, subject: s.subject }); go('homework'); }}><Icon name="calendar" />Cahier de textes</Button>}
                    <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setIntent('grades', { cls: s.cls, subject: s.subject }); go('grades'); }}><Icon name="pen" />Notes</Button>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card title="Annonces aux professeurs">
          <ul className="space-y-3">
            {ONLINE && !news.length && <li className="text-sm text-slate-500">Aucune annonce pour l'instant.</li>}
            {ONLINE && news.map((n) => <li key={n.id}><p className="text-xs text-slate-600">{String(n.publishedAt ?? n.at ?? '').slice(0, 10).split('-').reverse().join('/')}</p><p className="text-sm font-medium text-slate-800">{n.title}</p><p className="text-sm text-slate-600">{n.text}</p></li>)}
            {(ONLINE ? [] : TEACHER.news).map((n) => (
              <li key={n.title}><p className="text-xs text-slate-600">{n.date}</p><p className="text-sm font-medium text-slate-800">{n.title}</p><p className="text-sm text-slate-600">{n.body}</p></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
