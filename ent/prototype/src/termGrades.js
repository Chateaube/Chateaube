// Notes du trimestre telles que le professeur les voit : ses évaluations, plus les épreuves d'examen
// blanc qu'il a choisi de compter. Le carnet, les grilles, le conseil et le bulletin partent des mêmes
// données : une moyenne est la même partout.
import { loadMockExams } from './mockExamStore.js';
import { EXAMS } from './rules/mockExam.js';
import { SERVICES, EVALUATIONS, GRADES } from './data/grades.js';
import { loadCarnet, carnetRaw } from './gradebookStore.js';
import { demoOr } from './demoData.js';

/** Épreuves d'examen blanc que le professeur a choisi de compter dans son carnet (avec son coefficient). */
export function withMockExams(evaluations, grades) {
  const ev = { ...evaluations }; const gr = { ...grades };
  loadMockExams().sessions.forEach((x) => EXAMS[x.kind].parts.forEach((p) => {
    const c = x.counts?.[p.id];
    const service = c && SERVICES.find((sv) => sv.cls === x.cls && sv.subject === p.subject);
    if (!service) return;
    const id = `mx-${x.id}-${p.id}`;
    ev[service.id] = [...(ev[service.id] ?? []), { id, type: 'Examen blanc', title: `${x.title} — ${p.label}`, date: x.date, publishOn: x.date, scale: 20, coef: c.coef, fromMockExam: true }];
    gr[service.id] = Object.fromEntries(service.students.map((st) => [st, { ...(gr[service.id]?.[st] ?? {}), ...(x.marks[st]?.[p.id] != null ? { [id]: String(x.marks[st][p.id]) } : {}) }]));
  }));
  return { ev, gr };
}

/** Évaluations et notes de chaque service (examens blancs comptés compris). */
// gardé en mémoire tant que les examens blancs ne changent pas (une grille de 150 élèves l'appelle souvent)
let cache = { raw: undefined, value: null };
export function termGrades() {
  // notes des professeurs (carnet enregistré) + examens blancs comptés
  let raw = null; try { raw = `${localStorage.getItem('ent-examens-blancs-v3')}|${carnetRaw()}|${demoOr('demo', 'real')}`; } catch { /* stockage indisponible */ }
  if (cache.value && cache.raw === raw) return cache.value;
  const carnet = loadCarnet();
  const { ev, gr } = withMockExams(carnet?.evaluations ?? demoOr(EVALUATIONS, {}), carnet?.grades ?? demoOr(GRADES, {}));
  SERVICES.forEach((s) => { ev[s.id] ??= []; gr[s.id] ??= {}; }); // un service sans devoir : liste vide
  cache = { raw, value: { EVALUATIONS: ev, GRADES: gr } };
  return cache.value;
}
