// Vie scolaire d'un élève, telle qu'il la voit dans son portail (et ses parents à l'ouverture du leur) : absences,
// retards, oublis, punitions et sanctions, colles, objets confisqués. Seulement ce qui le concerne ; rien sur
// les autres élèves, ni les notes internes de l'équipe (soins, suivis).
import { MEASURES } from './discipline.js';

const MEASURE = Object.fromEntries(MEASURES.map((m) => [m.id, m]));
const isLate = (a) => /RETARD|LATE/i.test(a.kind ?? '');

/** data : { attendance, passport: { forgets, colles }, sanctions, objects } (listes brutes de l'équipe) */
export function lifeOf(name, { attendance = [], passport = {}, sanctions = [], objects = [] } = {}) {
  const mine = (x) => x?.student === name;
  const abs = attendance.filter(mine).map((a) => ({ date: a.date, slot: a.slot ?? '', late: isLate(a), justified: Boolean(a.justified), reason: a.justified ? a.reason ?? '' : '' }));
  return {
    absences: abs.filter((a) => !a.late).sort((a, b) => b.date.localeCompare(a.date)),
    retards: abs.filter((a) => a.late).sort((a, b) => b.date.localeCompare(a.date)),
    oublis: (passport.forgets ?? []).filter(mine).map((f) => ({ date: f.date, kind: f.kind, note: f.note ?? '' })).sort((a, b) => b.date.localeCompare(a.date)),
    mesures: sanctions.filter((m) => mine(m) && !m.cancelled).map((m) => ({ date: m.date, label: MEASURE[m.measure]?.label ?? m.measure, sanction: MEASURE[m.measure]?.kind === 'SANCTION', reason: m.reason ?? '', when: m.when ?? null })).sort((a, b) => b.date.localeCompare(a.date)),
    colles: (passport.colles ?? []).filter(mine).map((c) => ({ when: c.when ?? c.date, hours: c.hours ?? 1, tig: c.kind === 'TIG', reason: c.reason ?? '', status: c.status ?? 'A_FAIRE' })).sort((a, b) => String(b.when).localeCompare(String(a.when))),
    objets: objects.filter(mine).map((o) => ({ at: o.at, object: o.object ?? 'Téléphone', reason: o.reason ?? '', returned: Boolean(o.returned), warning: o.action === 'AVERTISSEMENT' })).sort((a, b) => String(b.at).localeCompare(String(a.at))),
  };
}

/** Résumé en une ligne (accueil du portail). */
export function lifeSummary(l) {
  if (!l) return '';
  const n = (k) => l[k]?.length ?? 0;
  const todo = (l.colles ?? []).filter((c) => c.status === 'A_FAIRE').length;
  return [n('absences') && `${n('absences')} absence${n('absences') > 1 ? 's' : ''}`, n('retards') && `${n('retards')} retard${n('retards') > 1 ? 's' : ''}`,
    n('oublis') && `${n('oublis')} oubli${n('oublis') > 1 ? 's' : ''}`, n('mesures') && `${n('mesures')} punition${n('mesures') > 1 ? 's' : ''} ou sanction${n('mesures') > 1 ? 's' : ''}`,
    todo && `${todo} colle${todo > 1 ? 's' : ''} à faire`].filter(Boolean).join(' · ');
}
