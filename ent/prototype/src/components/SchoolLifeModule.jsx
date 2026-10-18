import React, { useRef, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { imageToDataUrl } from '../image.js';
import { loadPosts, savePosts } from '../schoolLifeStore.js';
import { loadProfiles } from '../profilesStore.js';
import { MAX_PHOTOS, postErrors, newPost, moderate, visiblePosts, withoutImageRights } from '../rules/schoolLife.js';
import { STATUS as PSTATUS, canPublish, signature, trail } from '../rules/publication.js';
import { formatDateFr } from '../rules/calendar.js';

// Vie de l'école : photos des actions de l'école (Octobre rose, sorties, fêtes…), visibles par tous.
// Seule la Direction publie ; secrétariat, CPE, professeurs et élèves proposent, la Direction valide après
// avoir vérifié le droit à l'image, ou renvoie avec une remarque. Liens Facebook et Instagram.

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm';
const TODAY = '2026-10-13';
const STATUS = PSTATUS;

export function SocialLinks({ social, compact = false }) {
  const links = [social?.facebook && ['Facebook de l\'école', social.facebook, '#1877f2'], social?.instagram && [`Instagram — ${social.instagramLabel || 'association des élèves'}`, social.instagram, '#d6249f']].filter(Boolean);
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-1'}`}>
      {links.map(([label, url, color]) => (
        <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: color }}>{label} ↗</a>
      ))}
    </div>
  );
}

function Photos({ photos, onOpen }) {
  return (
    <div className="grid max-w-xl grid-cols-3 gap-1.5">
      {photos.map((src, i) => (
        <button key={i} type="button" onClick={() => onOpen(src)} className="overflow-hidden rounded-lg bg-slate-100" aria-label={`Agrandir la photo ${i + 1}`}>
          <img src={src} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

function Proposer({ role, author, cls, onSubmit, parents }) {
  const file = useRef(null);
  const [d, setD] = useState({ title: '', text: '', photos: [], parent: '' });
  const [err, setErr] = useState([]);
  const publishes = canPublish(role);
  const add = async (files) => {
    const list = [...d.photos];
    for (const f of files) { if (list.length >= MAX_PHOTOS) break; try { list.push(await imageToDataUrl(f, 900, 0.7)); } catch (e) { setErr([e.message]); } }
    setD({ ...d, photos: list });
  };
  const submit = () => {
    const e = postErrors(d); setErr(e); if (e.length) return;
    onSubmit(newPost({ title: d.title.trim(), text: d.text.trim(), photos: d.photos, parent: d.parent || undefined, cls }, { role, author, at: TODAY }));
    setD({ title: '', text: '', photos: [], parent: '' });
  };
  return (
    <Card title={publishes ? 'Publier des photos' : 'Proposer mes photos'} subtitle={publishes ? 'Publiées tout de suite pour toute l\'école' : 'Elles paraîtront après validation par la Direction'}>
      <div className="space-y-2 text-sm">
        <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Titre (ex. Octobre rose — la 2de en rose)" className={inputCls} />
        <textarea value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} rows={2} placeholder="Quelques mots (facultatif)" className={inputCls} />
        {parents.length > 0 && (
          <select value={d.parent} onChange={(e) => setD({ ...d, parent: e.target.value })} aria-label="Ajouter à un album" className={inputCls}>
            <option value="">Nouvel album</option>{parents.map((p) => <option key={p.id} value={p.id}>Ajouter à « {p.title} »</option>)}
          </select>
        )}
        <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add([...e.target.files]); e.target.value = ''; }} />
        <div className="flex flex-wrap items-center gap-2">
          {d.photos.map((src, i) => <img key={i} src={src} alt="" className="h-14 w-16 rounded object-cover" />)}
          {d.photos.length < MAX_PHOTOS && <Button variant="secondary" className="!py-1 text-xs" onClick={() => file.current.click()}>＋ Photos</Button>}
        </div>
        {!publishes && <p className="text-xs text-slate-600">Pas de photo gênante pour un camarade : chacun doit être d'accord pour apparaître.</p>}
        {err.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-xs text-red-800">{err.map((x) => <li key={x}>· {x}</li>)}</ul>}
        <Button className="w-full" onClick={submit}>{publishes ? 'Publier' : 'Envoyer pour validation'}</Button>
      </div>
    </Card>
  );
}

export default function SchoolLifeModule({ role = 'DIRECTION', settings, compact = false, author: authorProp, cls }) {
  const author = authorProp ?? { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'Mme Ranaivo' }[role] ?? 'Aina (1re STMG)';
  const [posts, setPosts] = useState(loadPosts);
  const [open, setOpen] = useState(null);
  const [decide, setDecide] = useState({}); // id → { checked, reason, err }
  const [msg, setMsg] = useState('');
  const canPropose = role !== 'PARENT';
  const isModerator = canPublish(role);
  const update = (l) => { setPosts(l); savePosts(l); };
  const list = visiblePosts(posts, { role, author });
  const pending = list.filter((p) => p.status === 'EN_ATTENTE' && isModerator);
  const albums = posts.filter((p) => p.status === 'PUBLIEE' && !p.parent);

  const act = (p, approve) => {
    const d = decide[p.id] ?? {};
    try {
      update(posts.map((x) => (x.id === p.id ? moderate(x, { role, by: author, approve, reason: d.reason, imageRightsChecked: d.checked }) : x)));
      setMsg(approve ? `« ${p.title} » est publiée.` : `Renvoyée à ${p.author} avec votre remarque.`);
    } catch (e) { setDecide({ ...decide, [p.id]: { ...d, err: e.message } }); }
  };

  const feed = list.filter((p) => !(isModerator && p.status === 'EN_ATTENTE'));
  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      <div className={compact ? 'px-1' : ''}>
        {!compact && <p className="text-sm font-semibold text-navy-500">Actualités en photos</p>}
        <h1 className={compact ? 'font-display text-lg font-semibold text-navy-900' : 'text-2xl font-semibold text-navy-900'}>Vie de l'école</h1>
        <SocialLinks social={settings?.social} />
      </div>
      {msg && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}
      <div className={compact ? 'space-y-3' : 'grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start'}>
        <div className="space-y-3">
          {pending.length > 0 && (
            <Card title={`À valider (${pending.length})`} subtitle="Vérifiez que chaque élève reconnaissable a l'autorisation de droit à l'image, puis publiez">
              <ul className="space-y-4">
                {pending.map((p) => {
                  const d = decide[p.id] ?? {};
                  const missing = p.cls ? withoutImageRights(loadProfiles(), p.cls) : [];
                  return (
                    <li key={p.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                      <p className="font-medium text-slate-900">{p.title}</p>
                      <p className="mb-2 text-xs text-slate-600">{trail(p)}</p>
                      <Photos photos={p.photos} onOpen={setOpen} />
                      {missing.length > 0 && <p className="mt-2 text-xs text-amber-900">Sans autorisation de droit à l'image en {p.cls} : {missing.join(', ')}.</p>}
                      <label className="mt-2 flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5" checked={!!d.checked} onChange={(e) => setDecide({ ...decide, [p.id]: { ...d, checked: e.target.checked, err: '' } })} />Les élèves reconnaissables ont l'autorisation de droit à l'image</label>
                      <input value={d.reason ?? ''} onChange={(e) => setDecide({ ...decide, [p.id]: { ...d, reason: e.target.value, err: '' } })} placeholder="Remarque si vous renvoyez (visible par l'auteur)" className={`mt-2 ${inputCls}`} />
                      {d.err && <p className="mt-1 text-xs text-red-700">{d.err}</p>}
                      <div className="mt-2 flex gap-2"><Button className="!py-1 text-xs" onClick={() => act(p, true)}>Publier</Button><Button variant="secondary" className="!py-1 text-xs" onClick={() => act(p, false)}>Renvoyer</Button></div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {feed.map((p) => (
            <article key={p.id} className="rounded-2xl bg-white p-4 shadow-soft">
              <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="font-display text-[15px] font-semibold text-slate-900">{p.title}</h2><p className="text-xs text-slate-600">{formatDateFr(p.date).replace(/ \d{4}$/, '')} · {signature(p)}{p.parent ? ` · album « ${posts.find((x) => x.id === p.parent)?.title ?? ''} »` : ''}</p></div>
                {p.status !== 'PUBLIEE' && <Badge tone={STATUS[p.status][0]}>{STATUS[p.status][1]}</Badge>}
              </div>
              {p.text && <p className="mb-2 text-sm text-slate-700">{p.text}</p>}
              <Photos photos={p.photos} onOpen={setOpen} />
              {p.status === 'A_REVOIR' && p.note && <p className="mt-2 text-xs text-red-700">Remarque de la Direction : {p.note}</p>}
            </article>
          ))}
          {!feed.length && <p className="text-sm text-slate-600">Pas encore de photos.</p>}
        </div>
        {canPropose && <Proposer role={role} author={author} cls={cls ?? (role === 'ELEVE' ? '1re STMG' : undefined)} parents={albums} onSubmit={(p) => { update([p, ...posts]); setMsg(p.status === 'PUBLIEE' ? 'Publié pour toute l\'école.' : 'Merci ! Vos photos paraîtront après validation par la Direction.'); }} />}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4" role="dialog" aria-label="Photo" onClick={() => setOpen(null)}>
          <img src={open} alt="Photo en grand" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
