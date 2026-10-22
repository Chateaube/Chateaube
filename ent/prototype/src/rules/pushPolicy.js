// Notifications sur le téléphone (application installée), sans SMS :
//  - URGENT (élève à l'infirmerie, absence non signalée, incident) : envoyé tout de suite, jour et nuit ;
//  - IMPORTANT (nouvelle note, sanction, absence à justifier) et INFO (annonces) : jamais pendant les
//    heures calmes (20h–7h), gardés pour 7h ;
//  - regroupement : plusieurs notifications du même genre pour le même enfant n'en font qu'une
//    (« 5 nouvelles notes pour Aina ») ;
//  - e-mail de secours : une notification URGENTE ou IMPORTANTE non ouverte au bout de 2 h part aussi par e-mail.
export const QUIET = { from: '20:00', to: '07:00' };
export const EMAIL_AFTER_HOURS = 2;
const LABEL = { NOTE: ['nouvelle note', 'nouvelles notes'], ABSENCE: ['absence à justifier', 'absences à justifier'], MESURE: ['punition ou sanction', 'punitions ou sanctions'], ANNONCE: ['annonce', 'annonces'] };

export const isQuiet = (hm) => hm >= QUIET.from || hm < QUIET.to;

/** Ce qui part maintenant (regroupé) et ce qui attend la fin des heures calmes. items : { id, level, kind, child, text, at } */
export function pushPlan(items, nowHm) {
  const urgent = items.filter((i) => i.level === 'URGENT');
  const rest = items.filter((i) => i.level !== 'URGENT');
  const held = isQuiet(nowHm) ? rest : [];
  const groups = {};
  (isQuiet(nowHm) ? [] : rest).forEach((i) => { (groups[`${i.kind}|${i.child ?? ''}`] ??= []).push(i); });
  const grouped = Object.values(groups).map((g) => (g.length === 1 ? { ...g[0], ids: [g[0].id] } : {
    id: `grp-${g[0].kind}-${g[0].child ?? 'tous'}`, level: g.some((i) => i.level === 'IMPORTANT') ? 'IMPORTANT' : 'INFO', kind: g[0].kind, child: g[0].child,
    text: `${g.length} ${(LABEL[g[0].kind] ?? ['notification', 'notifications'])[1]}${g[0].child ? ` pour ${g[0].child}` : ''}`, ids: g.map((i) => i.id),
  }));
  return { send: [...urgent.map((i) => ({ ...i, ids: [i.id] })), ...grouped], held };
}

/** L'e-mail de secours doit-il partir ? (urgent ou important, pas ouvert, envoyé depuis 2 h ou plus) */
export function needsEmail(n, nowIso) {
  if (n.level === 'INFO' || n.openedAt) return false;
  return (new Date(`${nowIso}:00Z`) - new Date(`${n.sentAt}:00Z`)) / 3_600_000 >= EMAIL_AFTER_HOURS;
}
