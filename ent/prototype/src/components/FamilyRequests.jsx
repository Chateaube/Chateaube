import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { PhotoInput, DocumentInput, DocumentThumb } from './PhotoInput.jsx';
import { addRequest, addOnlinePrereg, decideRequest, loadRequests, requestsFor, loadCampaign } from '../requestsStore.js';
import { profileKey } from '../profilesStore.js';
import { NATIONALITY_CHOICES, toggleNationality, hasOtherNationality, nationalityLabels, nextClass, REQUIRED_DOCUMENTS, documentsFor, campaignOpen, nextMatricule, SCHOOL_SYSTEMS, DNB_STATUS } from '../rules/enrollment.js';
import { PREREG_SOURCES, ENROLL_CLASSES } from '../data/enrollment.js';

// Démarches des familles sans passer au secrétariat :
//  - nouvelle famille : pré-inscription en ligne, avec les pièces en photo ;
//  - famille inscrite : réinscription, mise à jour des informations, dépôt des pièces.
// Le secrétariat valide (les données passent dans la fiche élève) ou refuse avec un motif.

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const DOC_LABEL = Object.fromEntries(REQUIRED_DOCUMENTS.map((d) => [d.id, d.label.replace(' (nouvel élève)', '')]));
export const KIND_LABEL = { REINSCRIPTION: 'Réinscription 2027-2028', MISE_A_JOUR: 'Mise à jour des informations', PIECE: 'Pièce déposée' };
const STATUS = { A_TRAITER: ['amber', 'en attente du secrétariat'], VALIDEE: ['green', 'validée'], REFUSEE: ['red', 'refusée'] };

function Field({ label, children }) {
  return <label className="block text-xs text-slate-600">{label}<div className="mt-1">{children}</div></label>;
}

function Chips({ value, onChange, other, onOther }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {NATIONALITY_CHOICES.map(([code, l]) => {
        const on = code === 'XX' ? hasOtherNationality(value) : value.includes(code);
        return <button key={code} type="button" aria-pressed={on} onClick={() => onChange(toggleNationality(value, code))}
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${on ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>;
      })}
      {hasOtherNationality(value) && <input value={other ?? ''} onChange={(e) => onOther(e.target.value)} placeholder="Laquelle ?" aria-label="Autre nationalité" className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-sm" />}
    </div>
  );
}

/** Liste des pièces avec dépôt par photo ou PDF. */
function DocumentsPicker({ docs, setDocs, kinds }) {
  return (
    <ul className="space-y-2">
      {kinds.map((d) => {
        const mine = docs.filter((x) => x.code === d.id);
        return (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0 text-slate-800">{d.label}{d.detail && <span className="block text-[11px] text-slate-500">{d.detail}</span>}</span>
            <span className="flex items-center gap-1.5">
              {mine.map((x, i) => <DocumentThumb key={i} doc={x} title={d.label} />)}
              <DocumentInput label={mine.length ? '＋ page' : 'Déposer'} onAdd={(file) => setDocs([...docs, { ...file, code: d.id, label: d.label }])} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Parent : réinscription et mise à jour ---------- */
export function FamilyRequestForm({ profile, kind, guardianName }) {
  const key = profileKey(profile);
  const next = nextClass(profile.cls);
  const [sent, setSent] = useState(() => requestsFor(key).filter((r) => r.kind === kind));
  const [decision, setDecision] = useState(next ? 'REINSCRIT' : 'DEPART');
  const [photo, setPhoto] = useState(profile.photo ?? null);
  const [nat, setNat] = useState(profile.nationalities ?? ['MG']);
  const [otherNat, setOtherNat] = useState(profile.otherNationality ?? '');
  const [guardians, setGuardians] = useState((profile.guardians ?? []).map((g) => ({ name: g.name, relation: g.relation, phone: g.phone ?? '', email: g.email ?? '', whatsapp: !!g.whatsapp })));
  const [health, setHealth] = useState({ allergies: profile.health?.allergies ?? '', emergency: profile.health?.emergency ?? '' });
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  const pending = sent.find((r) => r.status === 'A_TRAITER');
  const isReenrol = kind === 'REINSCRIPTION';
  const docKinds = documentsFor('REINSCRIPTION', isReenrol ? next ?? profile.cls : profile.cls, profile);
  const submit = () => {
    const ok = addRequest({ kind, studentKey: key, studentId: profile.id, from: guardianName, payload: { decision: isReenrol ? decision : undefined, cls: isReenrol && decision === 'REINSCRIT' ? next : undefined, photo, nationalities: nat, otherNationality: otherNat, guardians, health }, documents: docs });
    if (!ok) { setError('Le téléphone manque de place : retirez une page ou envoyez des photos plus légères.'); return; }
    setSent(requestsFor(key).filter((r) => r.kind === kind));
    setDocs([]);
  };
  return (
    <>
      {sent.map((r) => (
        <section key={r.id} className="rounded-2xl bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-slate-800">{KIND_LABEL[r.kind]} — envoyée le {fmt(r.submittedAt)}</p>
          <Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge>
          {r.status === 'REFUSEE' && <p className="mt-1 text-sm text-red-800">Motif : {r.note}</p>}
          {r.status === 'VALIDEE' && isReenrol && r.payload.decision === 'REINSCRIT' && <p className="mt-1 text-sm text-slate-600">Place confirmée au paiement des frais de réinscription, au secrétariat.</p>}
        </section>
      ))}
      {pending ? <p className="text-center text-xs text-slate-500">Le secrétariat traite votre demande ; vous serez prévenu ici.</p> : (
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">{isReenrol ? `Réinscription 2027-2028 — ${profile.firstName}` : `Nos informations — ${profile.firstName}`}</h2>
          {isReenrol && (
            <div className="space-y-2">
              {next && (
                <label className={`flex items-start gap-2 rounded-xl p-3 text-sm ring-1 ${decision === 'REINSCRIT' ? 'bg-navy-50 ring-navy-300' : 'ring-slate-200'}`}>
                  <input type="radio" name="decision" checked={decision === 'REINSCRIT'} onChange={() => setDecision('REINSCRIT')} className="mt-0.5" />
                  <span>Je réinscris {profile.firstName} en <strong>{next}</strong> à la rentrée 2027.</span>
                </label>
              )}
              <label className={`flex items-start gap-2 rounded-xl p-3 text-sm ring-1 ${decision === 'DEPART' ? 'bg-amber-50 ring-amber-300' : 'ring-slate-200'}`}>
                <input type="radio" name="decision" checked={decision === 'DEPART'} onChange={() => setDecision('DEPART')} className="mt-0.5" />
                <span>{profile.firstName} ne reviendra pas l'an prochain.</span>
              </label>
              {!next && <p className="text-xs text-slate-500">Terminale : dernière année dans l'établissement.</p>}
            </div>
          )}
          {(!isReenrol || decision === 'REINSCRIT') && (
            <>
              <PhotoInput value={photo} onChange={setPhoto} label={`Photo d'identité de ${profile.firstName}`} />
              <Field label="Nationalité(s)"><Chips value={nat} onChange={setNat} other={otherNat} onOther={setOtherNat} /></Field>
              {guardians.map((g, i) => (
                <div key={i} className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-800">{g.name} <span className="text-slate-500">({g.relation})</span></p>
                  <Field label="Téléphone"><input inputMode="tel" value={g.phone} onChange={(e) => setGuardians(guardians.map((x, k) => (k === i ? { ...x, phone: e.target.value } : x)))} className={inputCls} /></Field>
                  <Field label="E-mail"><input type="email" value={g.email} onChange={(e) => setGuardians(guardians.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))} className={inputCls} /></Field>
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={g.whatsapp} onChange={(e) => setGuardians(guardians.map((x, k) => (k === i ? { ...x, whatsapp: e.target.checked } : x)))} />Joignable sur WhatsApp</label>
                </div>
              ))}
              <Field label="Allergies, traitement"><input value={health.allergies} onChange={(e) => setHealth({ ...health, allergies: e.target.value })} className={inputCls} /></Field>
              <Field label="Contact d'urgence (nom et téléphone)"><input value={health.emergency} onChange={(e) => setHealth({ ...health, emergency: e.target.value })} className={inputCls} /></Field>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">Pièces du dossier (photo de chaque page ou PDF)</p>
                <p className="mb-2 text-[11px] text-slate-500">Envoyées en ligne pour un premier aperçu ; les originaux sont à déposer au secrétariat.</p>
                <DocumentsPicker docs={docs} setDocs={setDocs} kinds={docKinds} />
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button className="w-full" onClick={submit}>{isReenrol ? (decision === 'REINSCRIT' ? 'Envoyer la réinscription' : 'Prévenir l\'établissement') : 'Envoyer les modifications'}</Button>
          <p className="text-xs text-slate-500">{isReenrol ? 'Le secrétariat vérifie puis valide. La place est confirmée au paiement des frais de réinscription, au secrétariat.' : 'Le secrétariat vérifie avant de modifier la fiche.'}</p>
        </section>
      )}
    </>
  );
}

/* ---------- Parent : déposer une pièce demandée ---------- */
export function sendDocument(profile, guardianName, title, file) {
  return addRequest({ kind: 'PIECE', studentKey: profileKey(profile), studentId: profile.id, from: guardianName, payload: { title }, documents: [{ ...file, code: 'AUTRE', label: title }] });
}

/* ---------- Nouvelle famille : pré-inscription en ligne ---------- */
export function PublicPreregistration() {
  const campaign = loadCampaign();
  const today = new Date().toISOString().slice(0, 10);
  if (!campaignOpen(campaign, today)) {
    return (
      <div className="mx-auto max-w-[520px] rounded-2xl bg-white p-6 text-center shadow-soft">
        <p className="text-xs font-semibold text-navy-500">École Collège Lycée Chateaubriand · Tamatave</p>
        <h1 className="mt-1 font-display text-lg font-semibold text-navy-900">Pré-inscriptions {campaign.year}</h1>
        <p className="mt-2 text-sm text-slate-600">{today < campaign.opens ? `Ouverture le ${fmt(campaign.opens)}, jusqu'au ${fmt(campaign.closes)}.` : 'La campagne est terminée. Contactez le secrétariat.'}</p>
        <p className="mt-3 text-xs text-slate-400">Démonstration : la Direction règle ces dates dans Inscriptions → Pré-inscriptions.</p>
      </div>
    );
  }
  return <PublicForm />;
}

function PublicForm() {
  const empty = { child: '', birthDate: '', previousSchool: '', cls: '6e', contact: '', phone: '', email: '', source: PREREG_SOURCES[0], message: '' };
  const [f, setF] = useState(empty);
  const [docs, setDocs] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const input = (k, extra = {}) => <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inputCls} {...extra} />;
  const ready = f.child.trim() && f.contact.trim() && f.phone.trim();
  if (done) {
    return (
      <div className="mx-auto max-w-[520px] rounded-2xl bg-white p-6 text-center shadow-soft">
        <h1 className="font-display text-lg font-semibold text-navy-900">Demande envoyée</h1>
        <p className="mt-2 text-sm text-slate-600">Merci. Le secrétariat vous rappelle sur WhatsApp ou par téléphone pour la suite : dossier, entretien, inscription.</p>
        <Button variant="secondary" className="mt-4" onClick={() => { setF(empty); setDocs([]); setDone(false); }}>Nouvelle demande</Button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[520px] space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Démonstration : la demande reste dans ce navigateur et apparaît dans Secrétariat → Inscriptions. Rien n'est envoyé à l'école tant que le serveur n'est pas en place.</p>
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <div>
          <p className="text-xs font-semibold text-navy-500">École Collège Lycée Chateaubriand · Tamatave</p>
          <h1 className="font-display text-xl font-semibold text-navy-900">Pré-inscription en ligne</h1>
          <p className="text-sm text-slate-500">Quelques informations suffisent ; le dossier se complète ensuite.</p>
        </div>
        <Field label="Nom et prénom(s) de l'enfant">{input('child')}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date de naissance">{input('birthDate', { type: 'date' })}</Field>
          <Field label="Classe demandée"><select value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })} className={inputCls}>{ENROLL_CLASSES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Établissement actuel de l'enfant">{input('previousSchool')}</Field>
        <Field label="Programme suivi dans cet établissement"><select value={f.previousSystem ?? ''} onChange={(e) => setF({ ...f, previousSystem: e.target.value || undefined })} className={inputCls}><option value="">Je ne sais pas</option>{Object.entries(SCHOOL_SYSTEMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {f.cls.startsWith('2de') && <Field label="Brevet (DNB)"><select value={f.dnb ?? ''} onChange={(e) => setF({ ...f, dnb: e.target.value || undefined })} className={inputCls}><option value="">—</option>{Object.entries(DNB_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
        {/^(1re|Terminale)/.test(f.cls) && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!f.repeating} onChange={(e) => setF({ ...f, repeating: e.target.checked })} />L'enfant redouble cette classe</label>}
        <Field label="Responsable (nom et prénom)">{input('contact')}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Téléphone / WhatsApp">{input('phone', { inputMode: 'tel', placeholder: '+261 34 …' })}</Field>
          <Field label="E-mail (facultatif)">{input('email', { type: 'email' })}</Field>
        </div>
        <Field label="Comment nous avez-vous connus ?"><select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={inputCls}>{PREREG_SOURCES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Message (facultatif)"><textarea rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={inputCls} /></Field>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Pièces (facultatif)</p>
          <p className="mb-2 text-[11px] text-slate-500">Utile si vous n'êtes pas à Tamatave : nous les verrons tout de suite. Les originaux restent à déposer au secrétariat.</p>
          <DocumentsPicker docs={docs} setDocs={setDocs} kinds={documentsFor('INSCRIPTION', f.cls, f)} />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button className="w-full" disabled={!ready} onClick={() => {
          if (!addOnlinePrereg({ ...f, receivedOn: new Date().toISOString().slice(0, 10), documents: docs })) { setError('Le navigateur manque de place : envoyez moins de pages.'); return; }
          setDone(true);
        }}>Envoyer la demande</Button>
      </section>
    </div>
  );
}

/* ---------- Bureau : demandes des familles ---------- */
function diffLines(p, payload) {
  const out = [];
  if (payload.decision === 'DEPART') return ['Ne reviendra pas l\'an prochain'];
  if (payload.cls) out.push(`Classe à la rentrée : ${p.cls} → ${payload.cls}`);
  if (payload.photo && payload.photo !== p.photo) out.push('Nouvelle photo d\'identité');
  if (payload.nationalities && payload.nationalities.join() !== (p.nationalities ?? []).join()) out.push(`Nationalité(s) : ${nationalityLabels(payload.nationalities, payload.otherNationality).join(', ')}`);
  (payload.guardians ?? []).forEach((g) => {
    const old = (p.guardians ?? []).find((x) => x.name === g.name) ?? {};
    if (g.phone !== (old.phone ?? '')) out.push(`${g.name} — téléphone : ${old.phone || '—'} → ${g.phone || '—'}`);
    if (g.email !== (old.email ?? '')) out.push(`${g.name} — e-mail : ${old.email || '—'} → ${g.email || '—'}`);
  });
  if (payload.health && payload.health.allergies !== (p.health?.allergies ?? '')) out.push(`Allergies : ${payload.health.allergies || '—'}`);
  if (payload.health && payload.health.emergency !== (p.health?.emergency ?? '')) out.push(`Urgence : ${payload.health.emergency || '—'}`);
  return out;
}

/** Fiche élève après validation d'une demande. */
export function applyRequest(p, r, nextYearNumbers = []) {
  const x = r.payload ?? {};
  const docs = [...new Set([...(p.documents ?? []), ...(r.documents ?? []).map((d) => d.code).filter((c) => c !== 'AUTRE')])];
  if (r.kind === 'PIECE') return { ...p, documents: docs };
  // l'année en cours ne change pas : la classe de la rentrée est gardée à part
  if (x.decision === 'DEPART') return { ...p, nextYear: { status: 'DEPART' } };
  return {
    ...p,
    // matricule de l'année suivante, dans l'ordre des réinscriptions validées
    nextYear: x.cls ? { status: 'REINSCRIT', cls: x.cls, year: '2027-2028', number: p.nextYear?.number ?? nextMatricule(x.cls, nextYearNumbers) } : p.nextYear,
    photo: x.photo ?? p.photo,
    nationalities: x.nationalities ?? p.nationalities,
    otherNationality: x.otherNationality ?? p.otherNationality,
    guardians: (p.guardians ?? []).map((g) => { const n = (x.guardians ?? []).find((y) => y.name === g.name); return n ? { ...g, phone: n.phone, email: n.email, whatsapp: n.whatsapp } : g; }),
    health: x.health ? { ...p.health, ...x.health } : p.health,
    documents: docs,
  };
}

export function RequestsTab({ profiles, onApply }) {
  const [list, setList] = useState(() => loadRequests().requests);
  const [refusing, setRefusing] = useState(null);
  const [note, setNote] = useState('');
  const refresh = () => setList(loadRequests().requests);
  const open = list.filter((r) => r.status === 'A_TRAITER');
  const done = list.filter((r) => r.status !== 'A_TRAITER').slice(0, 10);
  const profileOf = (r) => profiles.find((p) => p.id === r.studentId) ?? profiles.find((p) => profileKey(p) === r.studentKey);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Réinscriptions, mises à jour et pièces envoyées par les parents depuis leur compte. Les pré-inscriptions des nouvelles familles arrivent dans « Pré-inscriptions », marquées « en ligne ».</p>
      {open.length === 0 && <Card><p className="text-sm text-slate-500">Aucune demande en attente.</p></Card>}
      {open.map((r) => {
        const p = profileOf(r);
        const lines = p ? diffLines(p, r.payload ?? {}) : [];
        return (
          <Card key={r.id} title={`${KIND_LABEL[r.kind]} — ${r.studentKey}`} subtitle={`Envoyée le ${fmt(r.submittedAt)} par ${r.from}${p ? ` · ${p.cls}` : ''}`}>
            {r.kind === 'PIECE' && <p className="text-sm text-slate-700">{r.payload?.title}</p>}
            {r.kind !== 'PIECE' && (lines.length ? <ul className="space-y-0.5 text-sm text-slate-700">{lines.map((l) => <li key={l}>· {l}</li>)}</ul> : <p className="text-sm text-slate-500">Aucune modification des informations.</p>)}
            {r.documents?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {r.documents.map((d, i) => <span key={i} className="flex flex-col items-center gap-0.5 text-[10px] text-slate-500"><DocumentThumb doc={d} title={d.label} />{DOC_LABEL[d.code] ?? d.label}</span>)}
              </div>
            )}
            {!p && <p className="mt-2 text-xs text-amber-700">Fiche élève introuvable dans ce navigateur : vérifier le nom.</p>}
            {refusing === r.id ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif du refus (vu par le parent)" className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <Button disabled={!note.trim()} onClick={() => { decideRequest(r.id, 'REFUSEE', 'Secrétariat', note); setRefusing(null); setNote(''); refresh(); }}>Refuser</Button>
                <Button variant="secondary" onClick={() => setRefusing(null)}>Annuler</Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={!p} onClick={() => { onApply(applyRequest(p, r, profiles.map((x) => x.nextYear?.number))); decideRequest(r.id, 'VALIDEE', 'Secrétariat'); refresh(); }}>Valider{r.kind !== 'PIECE' ? ' et mettre à jour la fiche' : ' la pièce'}</Button>
                <Button variant="secondary" onClick={() => { setRefusing(r.id); setNote(''); }}>Refuser…</Button>
                {r.kind === 'REINSCRIPTION' && r.payload?.decision === 'REINSCRIT' && <p className="self-center text-xs text-slate-500">Les frais de réinscription s'encaissent ensuite dans « Encaisser ».</p>}
              </div>
            )}
          </Card>
        );
      })}
      {done.length > 0 && (
        <Card title="Dernières demandes traitées">
          <ul className="divide-y divide-slate-100 text-sm">
            {done.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{KIND_LABEL[r.kind]} — {r.studentKey}</span><span><Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge> <span className="text-xs text-slate-500">{fmt(r.decidedAt)}</span></span></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
