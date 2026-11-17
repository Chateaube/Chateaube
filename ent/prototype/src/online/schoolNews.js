// Vie de l'école et annonces pour les élèves : la Direction (seule à publier) dépose ce qui est PUBLIÉ dans
// « ecole-vie » (type ECOLE, lisible par tout compte connecté, règle de 40_eleves.sql : aucun script à lancer).
// Rien d'autre ne part : ni brouillons, ni propositions, ni réactions, ni annonces réservées au personnel ou aux parents.
import { supabase } from './client.js';
import { fetchDoc, fetchDocs } from './docs.js';
import { labelsFor, loadEngagements, loadCatalogue } from '../engagementsStore.js';
import { currentStudents } from '../importStore.js';
import { isPublic } from '../rules/publication.js';
import { receives } from '../rules/announcements.js';

const raw = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }; // jamais les données de démonstration

/** Ce que voient les élèves (posts : vie de l'école ; annonces : celles adressées aux élèves). */
export function buildNews(posts = raw('ent-vie-ecole-v2') ?? [], annonces = raw('ent-annonces-v2')?.list ?? []) {
  return {
    posts: posts.filter((p) => p && isPublic(p) && p.photos?.length)
      .map(({ id, title, text, date, photos, parent, authorDisplay, author }) => ({ id, title, text: text ?? '', date, photos, parent: parent ?? null, by: authorDisplay ?? author ?? '' }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    annonces: annonces.filter((a) => a && isPublic(a) && a.audience?.roles?.includes('ELEVE'))
      .map(({ id, title, text, at, publishedAt, pinned, audience, photos }) => ({ id, title, text: text ?? '', at: publishedAt ?? at ?? '', pinned: !!pinned, audience, ...(photos?.length ? { photos } : {}) })),
  };
}

/** Annonces qu'un élève reçoit (sa classe, son site), épinglées d'abord puis les plus récentes. */
export const newsFor = (news, cls, site = 'TMV') => (news?.annonces ?? [])
  .filter((a) => receives({ ...a, status: 'PUBLIEE' }, { role: 'ELEVE', site, classes: [cls] }))
  .sort((a, b) => (b.pinned - a.pinned) || String(b.at).localeCompare(String(a.at)));

let last = null;
/** Direction : dépose la version à jour si elle a changé (appelé au démarrage puis toutes les minutes). */
export async function publishNews() {
  const value = buildNews(); const sig = JSON.stringify(value);
  if (sig === last) return false;
  const { error } = await supabase.from('ent_doc').upsert({ key: 'ecole-vie', kind: 'ECOLE', owner: null, value: { ...value, sentAt: new Date().toISOString() } });
  if (error) throw new Error(error.message);
  last = sig; return true;
}
/** Engagements de chaque élève sur sa fiche « eleve:<id> » (lue par lui seul et le personnel), quand ils changent. */
let lastEng = null;
export async function publishEngagements() {
  const sig = JSON.stringify([loadEngagements(), loadCatalogue()]);
  if (sig === lastEng) return 0;
  const students = currentStudents() ?? [];
  const sexOf = (name) => students.find((s) => `${s.lastName} ${s.firstName}`.trim() === name)?.sex;
  let n = 0;
  for (const d of await fetchDocs('ELEVE')) {
    const v = d.value ?? {}; const name = `${v.lastName ?? ''} ${v.firstName ?? ''}`.trim();
    const l = labelsFor(name, sexOf(name));
    if (JSON.stringify(l) === JSON.stringify({ engagements: v.engagements ?? [], attestations: v.attestations ?? [] })) continue;
    const { error } = await supabase.from('ent_doc').upsert({ key: d.key, kind: 'ELEVE', owner: d.owner, value: { ...v, ...l } });
    if (error) throw new Error(error.message);
    n += 1;
  }
  lastEng = sig; return n;
}

let started = false;
export function startNews() {
  if (started) return; started = true;
  const run = () => { publishNews().catch(() => { /* hors ligne : nouvel essai à la minute suivante */ }); publishEngagements().catch(() => { /* idem */ }); };
  run(); setInterval(run, 60_000);
}

export const fetchNews = async () => (await fetchDoc('ecole-vie').catch(() => null))?.value ?? null;
