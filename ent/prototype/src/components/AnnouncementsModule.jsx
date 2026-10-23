import React, { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { ROLES, SCOPES, CYCLES, LEVELS, recipientCount, audienceLabel, announcementErrors, receives } from '../rules/announcements.js';
import { SITES, POPULATION } from '../data/announcements.js';
import { loadAnnouncements, saveAnnouncement, removeAnnouncement, acknowledge, acked } from '../announcementsStore.js';
import { STATUS, canWrite, canPublish, create, edit, submit, approve, sendBack, withdraw, signature, trail, workView, forward, cpeSendBack, REVIEWER } from '../rules/publication.js';
import { imageToDataUrl } from '../image.js';

// Annonces : un message (texte et photos) à tous les parents, toute l'école, un cycle, des niveaux
// ou des classes, sur un site ou les deux.
// Droits : la Direction publie ; le secrétariat et la CPE rédigent et envoient pour validation (la Direction
// corrige si besoin, publie ou renvoie avec une remarque) ; les professeurs lisent seulement.
// Le public voit le service et la validation (« Secrétariat · validée par la Direction ») ; l'équipe voit
// toute la trace (qui a rédigé, corrigé, publié, quand).

const MY_CLASSES = ['1re STMG', 'Terminale STMG'];
const ACTOR_NAME = { DIRECTION: 'Cheffe d\'établissement', BUREAU: 'Mme Hanta', VIE_SCOLAIRE: 'M. Be' };
const now = () => new Date().toISOString().slice(0, 16);
const MAX_PHOTOS = 6;
const fmt = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} à ${iso.slice(11, 16).replace(':', 'h')}`;
const AUTHOR = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'Vie scolaire (CPE)' };

function Chip({ on, onClick, children }) {
  return <button type="button" aria-pressed={on} onClick={onClick}
    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${on ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{children}</button>;
}
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Une annonce telle que la voient les destinataires. */
export function AnnouncementCard({ a, who, compact = false }) {
  const [ok, setOk] = useState(() => (who ? acked(a.id, who) : false));
  return (
    <article className={`rounded-2xl bg-white p-4 shadow-soft ${a.pinned ? 'ring-1 ring-amber-300' : ''}`}>
      <p className="text-[11px] text-slate-500">{a.pinned && <Badge tone="amber">épinglée</Badge>} {signature(a)} · {fmt(a.publishedAt ?? a.at)}</p>
      <h2 className="mt-0.5 font-display text-[15px] font-semibold text-slate-900">{a.title}</h2>
      {a.text && <p className={`mt-1 whitespace-pre-line text-sm text-slate-700 ${compact ? 'line-clamp-4' : ''}`}>{a.text}</p>}
      {a.photos?.length > 0 && (
        <div className={`mt-2 grid gap-1.5 ${a.photos.length > 1 ? 'grid-cols-2' : ''}`}>
          {a.photos.map((p, i) => <img key={i} src={p} alt={`Photo ${i + 1}`} className="max-h-56 w-full rounded-lg object-cover" />)}
        </div>
      )}
      {a.ack && who && (ok ? <p className="mt-2 text-xs text-emerald-700">✓ Lu et compris</p>
        : <Button className="mt-2 !py-1 text-xs" onClick={() => { acknowledge(a.id, who); setOk(true); }}>Bien reçu</Button>)}
    </article>
  );
}

/** File de validation de la Direction : corriger, publier ou renvoyer avec une remarque. */
function ReviewItem({ a, onDone }) {
  const [title, setTitle] = useState(a.title);
  const [text, setText] = useState(a.text);
  const [pinned, setPinned] = useState(!!a.pinRequested);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const actor = { role: 'DIRECTION', name: ACTOR_NAME.DIRECTION, at: now() };
  const run = (fn, msg) => { try { saveAnnouncement(fn()); onDone(msg); } catch (e) { setErr(e.message); } };
  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <p className="text-xs text-slate-600">{trail(a)} · {audienceLabel(a.audience, SITES)}</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titre (correction possible)" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold" />
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Texte (correction possible)" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
      <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />Épingler en haut{a.pinRequested ? ' (demandé par l\'auteur)' : ''}</label>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button className="!py-1 text-xs" onClick={() => run(() => approve(a, actor, { patch: { title, text, pinned } }), `« ${title} » est publiée.`)}>{title !== a.title || text !== a.text ? 'Corriger et publier' : 'Publier'}</Button>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Remarque pour l'auteur" className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
        <Button variant="secondary" className="!py-1 text-xs" onClick={() => run(() => sendBack(a, actor, note), `Renvoyée à ${a.authorName} avec votre remarque.`)}>Renvoyer</Button>
      </div>
    </li>
  );
}

/** Relecture de la CPE : les annonces des délégués et du BDE passent par elle avant la Direction. */
function CpeReviewItem({ a, onDone }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const actor = { role: 'VIE_SCOLAIRE', name: ACTOR_NAME.VIE_SCOLAIRE, at: now() };
  const run = (fn, msg) => { try { saveAnnouncement(fn()); onDone(msg); } catch (e) { setErr(e.message); } };
  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <p className="text-xs text-slate-600">{trail(a)} · {audienceLabel(a.audience, SITES)}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{a.title}</p>
      <p className="whitespace-pre-line text-sm text-slate-700">{a.text}</p>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button className="!py-1 text-xs" onClick={() => run(() => forward(a, actor), `« ${a.title} » est transmise à la Direction.`)}>Transmettre à la Direction</Button>
        <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="Remarque pour l'élève" placeholder="Remarque pour l'élève" className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
        <Button variant="secondary" className="!py-1 text-xs" onClick={() => run(() => cpeSendBack(a, actor, note), `Renvoyée à ${a.authorName} avec votre remarque.`)}>Renvoyer à l'élève</Button>
      </div>
    </li>
  );
}

export default function AnnouncementsModule({ role, account }) {
  const writer = canWrite('ANNONCE', role);
  const publisher = canPublish(role);
  const actorOf = () => ({ role, name: role === 'DIRECTION' ? (account?.name ?? ACTOR_NAME.DIRECTION) : ACTOR_NAME[role], at: now() });
  const empty = () => ({ title: '', text: '', photos: [], pinned: false, pinRequested: false, ack: false, email: true,
    audience: { roles: ['PARENT'], site: 'TMV', scope: 'ALL', values: [] } });
  const [d, setD] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [data, setData] = useState(loadAnnouncements);
  const [tried, setTried] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const au = d.audience;
  const setAu = (patch) => setD({ ...d, audience: { ...au, ...patch } });
  const count = useMemo(() => recipientCount(au, POPULATION), [au]);
  const errors = announcementErrors(d, { role });
  const classes = Object.keys(POPULATION.TMV.classes);
  const refresh = (m) => { setData(loadAnnouncements()); if (m) setMsg(m); };
  const total = count.students + count.families + count.teachers + count.staff;

  // Professeurs : lecture seule des annonces qui les concernent, aucun accès à la rédaction
  if (!writer) {
    const received = data.list.filter((a) => receives(a, { role: 'PROFESSEUR', site: 'TMV', classes: MY_CLASSES }));
    return (
      <div className="space-y-5">
        <div><h1 className="text-2xl font-semibold text-navy-900">Annonces</h1><p className="text-sm text-slate-600">Les annonces de l'école qui vous concernent.</p></div>
        <div className="grid gap-3 lg:grid-cols-2">{received.map((a) => <AnnouncementCard key={a.id} a={a} who="mme-ranaivo" />)}</div>
        {!received.length && <p className="text-sm text-slate-600">Aucune annonce pour l'instant.</p>}
      </div>
    );
  }

  const mine = workView(data.list, { role, name: actorOf().name });
  const pending = publisher ? data.list.filter((a) => a.status === 'EN_ATTENTE') : [];
  const toReread = role === REVIEWER ? data.list.filter((a) => a.status === 'A_RELIRE') : [];
  const myOpen = mine.filter((a) => !publisher && ['BROUILLON', 'EN_ATTENTE', 'A_REVOIR'].includes(a.status) && a.authorName === actorOf().name);
  const published = mine.filter((a) => a.status === 'PUBLIEE');

  const addPhotos = async (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - d.photos.length);
    const urls = await Promise.all(imgs.map((f) => imageToDataUrl(f, 1200, 0.72)));
    setD((x) => ({ ...x, photos: [...x.photos, ...urls] }));
  };
  const save = (send) => {
    setTried(true);
    if (send && errors.length) return;
    const actor = actorOf();
    const content = { ...d, author: AUTHOR[role], pinned: publisher ? d.pinned : false };
    let item;
    if (editingId) {
      const current = data.list.find((x) => x.id === editingId);
      item = edit(current, content, actor);
      if (send) item = submit(item, actor);
    } else item = create('ANNONCE', content, actor, { send });
    if (!saveAnnouncement(item)) { window.alert('Le navigateur manque de place : retirez une photo.'); return; }
    refresh(item.status === 'PUBLIEE' ? 'Annonce publiée.' : item.status === 'EN_ATTENTE' ? 'Envoyée à la Direction : elle sera publiée après validation.' : 'Brouillon enregistré.');
    setD(empty()); setEditingId(null); setTried(false);
  };
  const resume = (a) => { setD({ ...empty(), ...a, audience: a.audience }); setEditingId(a.id); setMsg(''); window.scrollTo?.(0, 0); };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Toute l'école, un site, un cycle, des niveaux ou des classes</p>
        <h1 className="text-2xl font-semibold text-navy-900">Annonces</h1>
        <p className="text-sm text-slate-600">{publisher ? 'Vous publiez directement ; les annonces du secrétariat, de la CPE, des délégués et du BDE (relues d\'abord par la CPE) attendent votre validation. Seule l\'annulation d\'un cours le jour même part sans vous.' : 'Vos annonces sont publiées après validation par la Direction, qui peut les corriger.'}</p>
      </div>
      {msg && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {publisher && pending.length > 0 && (
        <Card title={`À valider (${pending.length})`} subtitle="Corrigez si besoin, puis publiez ; ou renvoyez avec une remarque">
          <ul className="space-y-3">{pending.map((a) => <ReviewItem key={a.id} a={a} onDone={refresh} />)}</ul>
        </Card>
      )}
      {toReread.length > 0 && (
        <Card title={`À relire — délégués et BDE (${toReread.length})`} subtitle="Première relecture avant la Direction : transmettez, ou renvoyez à l'élève avec une remarque">
          <ul className="space-y-3">{toReread.map((a) => <CpeReviewItem key={a.id} a={a} onDone={refresh} />)}</ul>
        </Card>
      )}
      {myOpen.length > 0 && (
        <Card title="Mes annonces en cours">
          <ul className="divide-y divide-slate-100">
            {myOpen.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{a.title || 'Sans titre'}</p>
                  {a.status === 'A_REVOIR' && <p className="text-xs text-red-700">Remarque de la Direction : {a.note}</p>}</div>
                <span className="flex items-center gap-2"><Badge tone={STATUS[a.status][0]}>{STATUS[a.status][1]}</Badge>
                  {['BROUILLON', 'A_REVOIR'].includes(a.status) && <Button variant="secondary" className="!py-1 text-xs" onClick={() => resume(a)}>Reprendre</Button>}
                  {a.status === 'BROUILLON' && <Button variant="ghost" className="!py-1 text-xs text-red-700" onClick={() => { removeAnnouncement(a.id); refresh('Brouillon supprimé.'); }}>Supprimer</Button>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card title={editingId ? 'Reprendre l\'annonce' : 'Nouvelle annonce'}>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">1. Pour qui ?</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ROLES).map(([r, l]) => <Chip key={r} on={au.roles.includes(r)} onClick={() => setAu({ roles: toggle(au.roles, r) })}>{l}</Chip>)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[['TMV', 'Tamatave'], ['TNR', 'Tana'], ['ALL', 'Les deux sites']].map(([k, l]) => <Chip key={k} on={au.site === k} onClick={() => setAu({ site: k, ...(k !== 'TMV' && au.scope === 'CLASS' ? { scope: 'ALL', values: [] } : {}) })}>{l}</Chip>)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">2. Quelle partie de l'école ?</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(SCOPES).filter(([k]) => k !== 'CLASS' || au.site === 'TMV').map(([k, l]) => <Chip key={k} on={au.scope === k} onClick={() => setAu({ scope: k, values: [] })}>{l}</Chip>)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {au.scope === 'CYCLE' && Object.entries(CYCLES).map(([k, l]) => <Chip key={k} on={au.values.includes(k)} onClick={() => setAu({ values: toggle(au.values, k) })}>{l}</Chip>)}
                {au.scope === 'LEVEL' && LEVELS.map((l) => <Chip key={l} on={au.values.includes(l)} onClick={() => setAu({ values: toggle(au.values, l) })}>{l}</Chip>)}
                {au.scope === 'CLASS' && classes.map((c) => <Chip key={c} on={au.values.includes(c)} onClick={() => setAu({ values: toggle(au.values, c) })}>{c}</Chip>)}
              </div>
              <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-900">
                {total ? <>Sera reçue par {[count.families && `les parents de ${count.families} élèves`, count.students && `${count.students} élèves`, count.teachers && `${count.teachers} professeurs`, count.staff && `${count.staff} membres du personnel`].filter(Boolean).join(', ')}.</> : 'Personne ne recevra cette annonce.'}
                {au.roles.includes('PERSONNEL') && au.scope !== 'ALL' && <span className="block text-xs">Le personnel ne reçoit que les annonces à toute l'école.</span>}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">3. Le message</p>
              <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Titre (ex. Sortie au port jeudi 22 octobre)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea rows={5} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder="Votre message…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                {d.photos.map((p, i) => (
                  <span key={i} className="relative">
                    <img src={p} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                    <button type="button" aria-label="Retirer la photo" onClick={() => setD({ ...d, photos: d.photos.filter((_, k) => k !== i) })} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-800 p-0.5 text-white"><Icon name="x" className="h-3 w-3" /></button>
                  </span>
                ))}
                {d.photos.length < MAX_PHOTOS && <button type="button" onClick={() => fileRef.current.click()} className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-[11px] text-slate-500">＋ Photos</button>}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" aria-label="Ajouter des photos" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.ack} onChange={(e) => setD({ ...d, ack: e.target.checked })} />Demander « Bien reçu »</label>
                {publisher ? <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} />Épingler en haut</label>
                  : <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.pinRequested} onChange={(e) => setD({ ...d, pinRequested: e.target.checked })} />Demander l'épinglage</label>}
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.email} onChange={(e) => setD({ ...d, email: e.target.checked })} />Envoyer aussi par e-mail</label>
              </div>
            </div>
            {tried && errors.length > 0 && <ul className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
            <div className="flex flex-wrap gap-2">
              {publisher ? <Button onClick={() => save(true)} disabled={!total}>Publier</Button> : <>
                <Button onClick={() => save(true)} disabled={!total}>Envoyer à la Direction</Button>
                <Button variant="secondary" onClick={() => save(false)}>Enregistrer le brouillon</Button>
              </>}
              {editingId && <Button variant="ghost" onClick={() => { setD(empty()); setEditingId(null); }}>Annuler</Button>}
            </div>
          </div>
        </Card>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">Aperçu sur le téléphone des destinataires (après validation)</p>
          <AnnouncementCard a={{ ...d, title: d.title || 'Titre de l\'annonce', authorRole: role, service: AUTHOR[role], at: new Date().toISOString() }} />
        </div>
      </div>

      <Card title={`Annonces publiées (${published.length})`}>
        <ul className="divide-y divide-slate-100">
          {published.map((a) => {
            const n = recipientCount(a.audience, POPULATION);
            const reach = n.families + n.students + n.teachers + n.staff;
            return (
              <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{a.pinned && <Badge tone="amber">épinglée</Badge>} {a.title}</p>
                  <p className="text-xs text-slate-600">{signature(a)} · {fmt(a.publishedAt ?? a.at)} · {audienceLabel(a.audience, SITES)}{a.photos?.length ? ` · ${a.photos.length} photo(s)` : ''}</p>
                  <p className="text-[11px] text-slate-500">{trail(a)}</p>
                  {a.ack && <p className="text-xs text-navy-700">« Bien reçu » : {Math.min(a.reads ?? 0, reach)} / {reach}</p>}
                </div>
                <span className="flex gap-2">
                  {publisher && <Button variant="ghost" className="!py-1 text-xs text-red-700" onClick={() => { saveAnnouncement(withdraw(a, actorOf())); refresh('Annonce retirée.'); }}>Retirer</Button>}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
