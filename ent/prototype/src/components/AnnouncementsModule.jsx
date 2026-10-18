import React, { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { ROLES, SCOPES, CYCLES, LEVELS, recipientCount, audienceLabel, announcementErrors, receives, whatsappText } from '../rules/announcements.js';
import { SITES, POPULATION } from '../data/announcements.js';
import { loadAnnouncements, publishAnnouncement, removeAnnouncement, acknowledge, acked } from '../announcementsStore.js';
import { imageToDataUrl } from '../image.js';

// Annonces : un message (texte et photos) à tous les parents, toute l'école, un cycle, des niveaux
// ou des classes, sur un site ou les deux. Direction, Bureau et Vie scolaire publient pour tout
// l'établissement ; un professeur, pour les parents et élèves de ses classes.

const MY_CLASSES = ['1re STMG', 'Terminale STMG'];
const MAX_PHOTOS = 6;
const fmt = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} à ${iso.slice(11, 16).replace(':', 'h')}`;
const AUTHOR = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'Mme Ranaivo' };

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
      <p className="text-[11px] text-slate-500">{a.pinned && <Badge tone="amber">épinglée</Badge>} {a.author} · {fmt(a.at)}</p>
      <h3 className="mt-0.5 font-display text-[15px] font-semibold text-slate-900">{a.title}</h3>
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

export default function AnnouncementsModule({ role }) {
  const isTeacher = role === 'ENSEIGNANT';
  const empty = () => ({ title: '', text: '', photos: [], pinned: false, ack: false, email: true,
    audience: isTeacher ? { roles: ['PARENT'], site: 'TMV', scope: 'CLASS', values: [MY_CLASSES[0]] } : { roles: ['PARENT'], site: 'TMV', scope: 'ALL', values: [] } });
  const [d, setD] = useState(empty);
  const [data, setData] = useState(loadAnnouncements);
  const [tried, setTried] = useState(false);
  const [copied, setCopied] = useState(null);
  const fileRef = useRef(null);
  const au = d.audience;
  const setAu = (patch) => setD({ ...d, audience: { ...au, ...patch } });
  const count = useMemo(() => recipientCount(au, POPULATION), [au]);
  const errors = announcementErrors(d, { role, myClasses: MY_CLASSES });
  const classes = Object.keys(POPULATION.TMV.classes);
  const visible = data.list.filter((a) => !isTeacher || a.author === AUTHOR.ENSEIGNANT || receives(a, { role: 'PROFESSEUR', site: 'TMV', classes: MY_CLASSES }));
  const total = count.students + count.families + count.teachers + count.staff;

  const addPhotos = async (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - d.photos.length);
    const urls = await Promise.all(imgs.map((f) => imageToDataUrl(f, 1200, 0.72)));
    setD((x) => ({ ...x, photos: [...x.photos, ...urls] }));
  };
  const publish = () => {
    setTried(true);
    if (errors.length) return;
    if (!publishAnnouncement({ ...d, author: AUTHOR[role] })) { window.alert('Le navigateur manque de place : retirez une photo.'); return; }
    setData(loadAnnouncements()); setD(empty()); setTried(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">{isTeacher ? 'Parents et élèves de mes classes' : 'Toute l\'école, un site, un cycle, des niveaux ou des classes'}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Annonces</h1>
        <p className="text-sm text-slate-500">Texte et photos ; reçues dans l'application (notification) et par e-mail. Pour une conversation avec une personne, utilisez Messages.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card title="Nouvelle annonce">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">1. Pour qui ?</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ROLES).filter(([r]) => !isTeacher || ['PARENT', 'ELEVE'].includes(r)).map(([r, l]) => <Chip key={r} on={au.roles.includes(r)} onClick={() => setAu({ roles: toggle(au.roles, r) })}>{l}</Chip>)}
              </div>
              {!isTeacher && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[['TMV', 'Tamatave'], ['TNR', 'Tana'], ['ALL', 'Les deux sites']].map(([k, l]) => <Chip key={k} on={au.site === k} onClick={() => setAu({ site: k, ...(k !== 'TMV' && au.scope === 'CLASS' ? { scope: 'ALL', values: [] } : {}) })}>{l}</Chip>)}
                </div>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">2. Quelle partie de l'école ?</p>
              {!isTeacher && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(SCOPES).filter(([k]) => k !== 'CLASS' || au.site === 'TMV').map(([k, l]) => <Chip key={k} on={au.scope === k} onClick={() => setAu({ scope: k, values: [] })}>{l}</Chip>)}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {au.scope === 'CYCLE' && Object.entries(CYCLES).map(([k, l]) => <Chip key={k} on={au.values.includes(k)} onClick={() => setAu({ values: toggle(au.values, k) })}>{l}</Chip>)}
                {au.scope === 'LEVEL' && LEVELS.map((l) => <Chip key={l} on={au.values.includes(l)} onClick={() => setAu({ values: toggle(au.values, l) })}>{l}</Chip>)}
                {au.scope === 'CLASS' && (isTeacher ? MY_CLASSES : classes).map((c) => <Chip key={c} on={au.values.includes(c)} onClick={() => setAu({ values: toggle(au.values, c) })}>{c}</Chip>)}
              </div>
              <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-900">
                {total ? <>Sera reçue par {[count.families && `les parents de ${count.families} élèves`, count.students && `${count.students} élèves`, count.teachers && `${count.teachers} professeurs`, count.staff && `${count.staff} membres du personnel`].filter(Boolean).join(', ')}.</> : 'Aucun destinataire avec ces filtres.'}
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
                {d.photos.length < MAX_PHOTOS && <button type="button" onClick={() => fileRef.current.click()} className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-[11px] text-slate-500">＋ Photo</button>}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" aria-label="Ajouter des photos" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.ack} onChange={(e) => setD({ ...d, ack: e.target.checked })} />Demander « J'ai lu »</label>
                {!isTeacher && <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} />Épingler en haut</label>}
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.email} onChange={(e) => setD({ ...d, email: e.target.checked })} />Envoyer aussi par e-mail</label>
              </div>
            </div>
            {tried && errors.length > 0 && <ul className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
            <Button onClick={publish} disabled={!total}>Publier</Button>
          </div>
        </Card>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">Aperçu sur le téléphone des destinataires</p>
          <AnnouncementCard a={{ ...d, title: d.title || 'Titre de l\'annonce', author: AUTHOR[role], at: new Date().toISOString() }} />
        </div>
      </div>

      <Card title={`Annonces publiées (${visible.length})`}>
        <ul className="divide-y divide-slate-100">
          {visible.map((a) => {
            const n = recipientCount(a.audience, POPULATION);
            const reach = n.families + n.students + n.teachers + n.staff;
            return (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{a.pinned && <Badge tone="amber">épinglée</Badge>} {a.title}</p>
                  <p className="text-xs text-slate-500">{a.author} · {fmt(a.at)} · {audienceLabel(a.audience, SITES)}{a.photos?.length ? ` · ${a.photos.length} photo(s)` : ''}</p>
                  {a.ack && <p className="text-xs text-navy-700">« J'ai lu » : {Math.min(a.reads ?? 0, reach)} / {reach}</p>}
                </div>
                <span className="flex gap-2">
                  <Button variant="secondary" className="!py-1 text-xs" onClick={() => { navigator.clipboard?.writeText(whatsappText(a)); setCopied(a.id); }}>{copied === a.id ? 'Copié' : 'Copier pour WhatsApp'}</Button>
                  {(!isTeacher || a.author === AUTHOR.ENSEIGNANT) && <Button variant="ghost" className="!py-1 text-xs text-red-700" onClick={() => { removeAnnouncement(a.id); setData(loadAnnouncements()); }}>Retirer</Button>}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
