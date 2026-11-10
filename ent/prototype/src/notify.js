// Notifications à trois niveaux, calculées à partir des données de chaque écran :
//  - URGENT : un élève ne va pas bien, est au secrétariat ou sort ; bandeau rouge qui reste jusqu'à « J'ai vu » ;
//  - À FAIRE : décisions, validations, parents à prévenir… (orange, avec un nombre) ;
//  - INFO : annonces, publications (sans badge rouge).
// Le rouge est réservé à l'urgent.
import { CLASSES } from './data/schoollife.js';
import { loadObjects } from './objectsStore.js';
import { loadAttendance } from './attendanceStore.js';
import { coveringFor, LABELS } from './delegationStore.js';
import { justificationState } from './rules/attendance.js';
import { loadTasks } from './tasksStore.js';
import { loadEventProposals, loadCouncilFeedback } from './studentInitiativesStore.js';
import { loadVisits } from './careStore.js';
import { loadInventory } from './careStore.js';
import { pendingSignatures } from './signatureStore.js';
import { pendingCount } from './requestsStore.js';
import { loadPosts } from './schoolLifeStore.js';
import { loadAnnouncements } from './announcementsStore.js';
import { loadPassport, isNewStudent } from './components/PassportTab.jsx';
import { followUpAlerts } from './components/FollowUpsModule.jsx';
import { loadMovements, pendingWithdrawals } from './cashStore.js';
import { loadWatch, WATCHERS } from './colleWatchStore.js';
import { formatAr } from './rules/finance.js';
import { loadSuggestions } from './components/InternalResources.jsx';
import { passport, objectState, upcomingColleSessions, objectOf } from './rules/discipline.js';
import { formatDateFr } from './rules/calendar.js';
import { DEFAULT_SETTINGS } from './data/settings.js';
import { inventoryAlerts } from './rules/inventory.js';
import { CARE_OUTCOMES } from './rules/care.js';
import { today } from './clock.js';

export const TODAY = today();
const SEEN_KEY = 'ent-urgent-vus-v1';
export const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) ?? {}; } catch { return {}; } };
export const markSeen = (ids) => { const s = loadSeen(); ids.forEach((id) => { s[id] = new Date().toISOString(); }); try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ } };

const hm = (iso) => iso.slice(11, 16).replace(':', 'h');

/** Élèves passés au secrétariat aujourd'hui et qui n'en sont pas repartis en classe. */
function careUrgent(today) {
  return loadVisits().filter((v) => v.at.startsWith(today) && v.outcome !== 'CLASSE')
    .map((v) => ({ id: `care-${v.id}`, level: 'URGENT', to: 'care', text: `${v.student} au secrétariat depuis ${hm(v.at)} (${v.reason.toLowerCase()}) — ${v.outcome ? CARE_OUTCOMES[v.outcome].toLowerCase() : `envoyé·e par ${v.sentBy ?? v.by}, à prendre en charge`}` }));
}

export function notificationsFor(role, { account, covering = true } = {}) {
  const base = ownNotifications(role, { account });
  if (!covering) return base;
  // remplacement : la personne absente (CPE ou secrétariat) confie ses alertes du jour
  coveringFor(role, TODAY).forEach((from) => {
    const other = ownNotifications(from, { account });
    const ids = new Set([...base.urgent, ...base.todo].map((n) => n.id));
    base.urgent.push(...other.urgent.filter((n) => !ids.has(n.id)));
    base.todo.push(...other.todo.filter((n) => !ids.has(n.id)).map((n) => ({ ...n, id: `${from}-${n.id}`, text: `Pour ${LABELS[from]} (absente aujourd'hui) : ${n.text}` })));
  });
  return base;
}

function ownNotifications(role, { account } = {}) {
  const today = TODAY;
  const urgent = []; const todo = []; const info = [];
  const add = (cond, item) => { if (cond) todo.push({ level: 'TODO', ...item }); };
  if (['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(role)) urgent.push(...careUrgent(today));
  const ATTENDANCE = loadAttendance();
  const notInformed = ATTENDANCE.filter((a) => a.date === today && !a.notified).length;
  const pendingPosts = loadPosts().filter((p) => p.status === 'EN_ATTENTE').length;
  const collesToGive = Object.values(CLASSES).flat().reduce((t, st) => t + passport(st, { attendance: ATTENDANCE, ...loadPassport() }, { isNew: isNewStudent(st) }).toGive.length, 0);
  const news = loadAnnouncements().list;
  // tâches confiées (ou notées) : celles du jour et en retard
  const HOME = { DIRECTION: 'dashboard', BUREAU: 'bureau', VIE_SCOLAIRE: 'cpe-home', ENSEIGNANT: 'teacher' };
  if (HOME[role]) {
    const now = new Date(); const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const due = loadTasks().filter((t) => t.assignee === role && !t.done && t.due && t.due <= day).length;
    add(due, { id: 'tasks', to: HOME[role], count: due, text: `${due} tâche${due > 1 ? 's' : ''} pour aujourd'hui ou en retard`, action: 'Voir' });
  }
  if (role === 'DIRECTION' && account?.name) {
    pendingWithdrawals(loadMovements(), account.name).forEach((m) => add(true, { id: `withdraw-${m.id}`, to: 'accounting', count: 1, text: `Prélèvement de ${formatAr(m.amount)} à confirmer (saisi par ${m.agent} : ${m.label})`, action: 'Confirmer' }));
  }
  if (role === 'DIRECTION') {
    const toValidate = news.filter((a) => a.status === 'EN_ATTENTE').length;
    add(toValidate, { id: 'news', to: 'news', count: toValidate, text: `${toValidate} annonce${toValidate > 1 ? 's' : ''} à valider (secrétariat, CPE, délégués, BDE)`, action: 'Valider' });
    const events = loadEventProposals().filter((e) => e.status === 'EN_ATTENTE').length;
    add(events, { id: 'events', to: 'agenda', count: events, text: `${events} événement${events > 1 ? 's' : ''} proposé${events > 1 ? 's' : ''} par le BDE à valider`, action: 'Valider' });
    const toSign = pendingSignatures().filter((r) => r.signatory === (account?.id === 'u2' ? 'ADJOINTE' : 'CHEFFE')).length;
    add(toSign, { id: 'sign', to: 'signatures', count: toSign, text: `${toSign} document${toSign > 1 ? 's' : ''} à signer`, action: 'Signer' });
    add(pendingPosts, { id: 'posts', to: 'school-life', count: pendingPosts, text: `${pendingPosts} publication${pendingPosts > 1 ? 's' : ''} proposée${pendingPosts > 1 ? 's' : ''} à valider (droit à l'image)`, action: 'Valider' });
    const ideas = loadSuggestions().filter((x) => x.status === 'NOUVELLE').length;
    add(ideas, { id: 'ideas', to: 'resources', count: ideas, text: `${ideas} idée${ideas > 1 ? 's' : ''} de l'équipe sans réponse`, action: 'Répondre' });
    const req = pendingCount();
    add(req, { id: 'req', to: 'eleves', intent: { tab: 'online' }, count: req, text: `${req} démarche${req > 1 ? 's' : ''} en ligne des familles chez le secrétariat`, action: 'Voir' });
  }
  if (role === 'BUREAU') {
    const req = pendingCount();
    add(req, { id: 'req', to: 'eleves', intent: { tab: 'online' }, count: req, text: `${req} démarche${req > 1 ? 's' : ''} en ligne des familles à traiter`, action: 'Traiter' });
    const stock = inventoryAlerts(loadInventory(), today).filter((a) => a.kind !== 'CASSE').length;
    add(stock, { id: 'stock', to: 'inventory', count: stock, text: `${stock} article${stock > 1 ? 's' : ''} à recommander ou bientôt périmé${stock > 1 ? 's' : ''}`, action: 'Voir' });
  }
  if (['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(role)) {
    // colles de la semaine : quelqu'un doit être là pour les surveiller (mercredi après-midi, samedi matin)
    // la personne désignée (CPE ou secrétariat) est prévenue ; tant que personne n'est désigné, les deux le sont
    const watch = loadWatch();
    upcomingColleSessions(loadPassport().colles, today).forEach((x) => {
      const who = watch[x.day];
      const when = `${formatDateFr(x.day).replace(/ \d{4}$/, '')}, ${x.from.replace(':', 'h')}–${x.to.replace(':', 'h')}`;
      const n = `${x.students} élève${x.students > 1 ? 's' : ''} en colle (${x.hours} h)`;
      if (!who) add(role !== 'DIRECTION', { id: `colles-${x.day}`, to: 'vs', count: 1, text: `${when} : ${n} — qui surveille ? (CPE ou secrétariat)`, action: 'Choisir' });
      else if (who === role) add(true, { id: `colles-${x.day}`, to: 'vs', count: 1, text: `${when} : vous surveillez la colle — ${n}`, action: 'Voir' });
      else if (role === 'DIRECTION') info.push({ id: `colles-${x.day}`, level: 'INFO', to: 'vs', text: `${when} : ${n}, surveillance ${WATCHERS[who]}` });
    });
    // objets confisqués dont la restitution tombe aujourd'hui (ou est dépassée)
    const back = loadObjects().filter((p) => objectState(p, `${today}T23:59`, DEFAULT_SETTINGS) === 'A_RENDRE');
    add(back.length, { id: 'objects-back', to: 'vs', count: back.length, text: `${back.length} objet${back.length > 1 ? 's' : ''} confisqué${back.length > 1 ? 's' : ''} à rendre aujourd'hui : ${back.map((p) => `${objectOf(p).toLowerCase()} de ${p.student}`).join(', ')}`, action: 'Rendre' });
  }
  if (['DIRECTION', 'VIE_SCOLAIRE'].includes(role)) {
    const alerts = followUpAlerts();
    add(alerts.length, { id: 'followups', to: 'eleves', intent: { tab: 'suivis' }, count: alerts.length, text: `${alerts.length} suivi${alerts.length > 1 ? 's' : ''} individuel${alerts.length > 1 ? 's' : ''} en alerte : ${alerts.map((f) => f.student).join(', ')}`, action: 'Voir' });
  }
  if (['DIRECTION', 'BUREAU'].includes(role)) {
    const toDecide = loadObjects().filter((p) => objectState(p, `${today}T11:00`, DEFAULT_SETTINGS) === 'A_DECIDER').length;
    add(toDecide, { id: 'objects', to: 'vs', count: toDecide, text: `${toDecide} objet${toDecide > 1 ? 's' : ''} confisqué${toDecide > 1 ? 's' : ''} : durée à décider`, action: 'Décider' });
  }
  if (['BUREAU', 'VIE_SCOLAIRE'].includes(role)) {
    add(notInformed, { id: 'parents', to: 'vs', count: notInformed, text: `${notInformed} famille${notInformed > 1 ? 's' : ''} pas encore prévenue${notInformed > 1 ? 's' : ''} d'une absence ou d'un retard`, action: 'Prévenir' });
  }
  if (['BUREAU', 'VIE_SCOLAIRE'].includes(role)) {
    const asked = ATTENDANCE.filter((a) => justificationState(a, `${today}T11:00`).status === 'EN_ATTENTE').length;
    add(asked, { id: 'justif-requests', to: 'vs', count: asked, text: `${asked} justification${asked > 1 ? 's' : ''} d'absence envoyée${asked > 1 ? 's' : ''} par les familles à accepter ou refuser`, action: 'Traiter' });
  }
  if (role === 'VIE_SCOLAIRE') {
    add(collesToGive, { id: 'colles', to: 'vs', count: collesToGive, text: `${collesToGive} colle${collesToGive > 1 ? 's' : ''} à donner (oublis, retards)`, action: 'Donner' });
  }
  if (role === 'VIE_SCOLAIRE') {
    const reread = news.filter((a) => a.status === 'A_RELIRE').length;
    add(reread, { id: 'news-reread', to: 'news', count: reread, text: `${reread} annonce${reread > 1 ? 's' : ''} de délégués ou du BDE à relire`, action: 'Relire' });
    const evReread = loadEventProposals().filter((e) => e.status === 'A_RELIRE').length;
    add(evReread, { id: 'events-reread', to: 'agenda', count: evReread, text: `${evReread} événement${evReread > 1 ? 's' : ''} du BDE à relire`, action: 'Relire' });
  }
  if (role === 'BUREAU') {
    const fb = loadCouncilFeedback().length;
    if (fb) info.push({ id: 'council-feedback', level: 'INFO', to: 'council', text: `${fb} remarque${fb > 1 ? 's' : ''} des délégués pour le conseil` });
  }
  if (role === 'DIRECTION') {
    // annulations du jour parties sans validation : la Direction en est informée
    news.filter((a) => a.direct && a.publishedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10))
      .forEach((a) => info.push({ id: `direct-${a.id}`, level: 'INFO', to: 'news', text: `Annulation du jour envoyée par ${a.service ?? a.author} : ${a.title}` }));
  }
  if (['BUREAU', 'VIE_SCOLAIRE'].includes(role)) {
    const back = news.filter((a) => a.status === 'A_REVOIR' && a.authorRole === role).length;
    add(back, { id: 'news-back', to: 'news', count: back, text: `${back} annonce${back > 1 ? 's' : ''} renvoyée${back > 1 ? 's' : ''} par la Direction à revoir`, action: 'Revoir' });
  }
  const published = loadPosts().filter((p) => p.status === 'PUBLIEE').slice(0, 1);
  published.forEach((p) => info.push({ id: `post-${p.id}`, level: 'INFO', to: 'school-life', text: `Vie de l'école : ${p.title}` }));
  const seen = loadSeen();
  return { urgent: urgent.filter((u) => !seen[u.id]), todo, info };
}

/** Nombre « à faire » par écran, pour le menu latéral. */
export const countsByScreen = (todo) => todo.reduce((m, t) => ({ ...m, [t.to]: (m[t.to] ?? 0) + (t.count ?? 1) }), {});
