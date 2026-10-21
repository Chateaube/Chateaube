// Tâches de l'équipe : la Direction se note ce qu'elle a à faire et peut confier une tâche à un membre du
// personnel administratif (secrétariat, CPE), avec une priorité et, si besoin, une échéance. Pas de tâches confiées aux
// enseignants : leur accueil reste centré sur leurs cours.

export const PRIORITIES = { HAUTE: ['red', 'Priorité haute'], NORMALE: ['amber', 'Normale'], BASSE: ['slate', 'Basse'] };
const RANK = { HAUTE: 0, NORMALE: 1, BASSE: 2 };

/** Personnes à qui confier une tâche (démonstration ; en production : les comptes du personnel). */
export const ASSIGNEES = [
  { id: 'DIRECTION', role: 'DIRECTION', label: 'Moi (Direction)' },
  { id: 'BUREAU', role: 'BUREAU', label: 'Mme Hanta — secrétariat' },
  { id: 'VIE_SCOLAIRE', role: 'VIE_SCOLAIRE', label: 'M. Be — CPE' },
];
export const assigneeLabel = (id) => ASSIGNEES.find((a) => a.id === id)?.label ?? id;

export function taskErrors(t) {
  const e = [];
  if (!t.title?.trim()) e.push('Écrire la tâche.');
  if (!ASSIGNEES.some((a) => a.id === t.assignee)) e.push('Choisir à qui la confier.');
  if (!PRIORITIES[t.priority]) e.push('Choisir une priorité.');
  if (t.due && !/^\d{4}-\d{2}-\d{2}$/.test(t.due)) e.push('Échéance invalide.');
  return e;
}

export const isOverdue = (t, today) => !t.done && !!t.due && t.due < today;
export const isDueToday = (t, today) => !t.done && t.due === today;

/** Ordre d'affichage : à faire avant fait ; en retard, puis priorité, puis échéance (sans échéance en dernier). */
export function sortTasks(list, today) {
  return [...list].sort((a, b) => (a.done - b.done)
    || (isOverdue(b, today) - isOverdue(a, today))
    || (RANK[a.priority] - RANK[b.priority])
    || ((a.due ?? '9999') .localeCompare(b.due ?? '9999'))
    || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

/** Tâches d'une personne ; la Direction voit aussi celles qu'elle a confiées. */
export const tasksFor = (list, who) => list.filter((t) => t.assignee === who || (who === 'DIRECTION' && t.createdBy === 'DIRECTION'));
