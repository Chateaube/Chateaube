import React, { useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { PREREGISTRATIONS, PREREG_SOURCES, ENROLL_CLASSES, LANGUAGES, RELATIONS } from '../data/enrollment.js';
import {
  PREREG_STEPS, PREREG_OTHER, nextPreregStep, nextClass, validateProfile, accountsFor, missingDocuments, REQUIRED_DOCUMENTS,
} from '../rules/enrollment.js';
import { loadProfiles, saveProfiles, profileKey } from '../profilesStore.js';
import { loadRequests, updateOnlinePrereg } from '../requestsStore.js';
import { NATIONALITY_CHOICES, nationalityLabels, toggleNationality, hasOtherNationality } from '../rules/enrollment.js';
import { PhotoInput, DocumentThumb } from './PhotoInput.jsx';
import { firstNames, usualFirstName } from '../rules/names.js';
import { RequestsTab } from './FamilyRequests.jsx';
import { seniority } from '../rules/documents.js';
import { SPECIALTIES, SPECIALTY_COUNT } from '../rules/bulletin.js';
import { CertificateButton } from './Certificate.jsx';
import { FicheView, SignatureCompare, FICHE_YEAR } from './FicheSignaletique.jsx';
import { ficheOf, saveFiche } from '../ficheStore.js';

// Inscriptions (Bureau et Direction) : pré-inscriptions, inscription ou réinscription avec
// création de la fiche élève, puis création des comptes de l'ENT.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const ALL_STEPS = [...PREREG_STEPS, ...PREREG_OTHER];
const stepLabel = (id) => ALL_STEPS.find((s) => s.id === id)?.label ?? id;
const TONE = { DEMANDE: 'slate', DOSSIER: 'navy', ENTRETIEN: 'violet', ACCEPTEE: 'green', INSCRITE: 'green', ATTENTE: 'amber', REFUSEE: 'red' };

const emptyGuardian = () => ({ name: '', relation: 'Mère', phone: '', email: '', whatsapp: true, payer: false, pickup: true });
const emptyProfile = () => ({
  lastName: '', firstName: '', sex: 'F', birthDate: '', birthPlace: '', nationalities: ['MG'], cls: '6e', lv1: 'Anglais', lv2: 'Espagnol',
  enteredOn: '2026-10-13', previousSchool: '', guardians: [{ ...emptyGuardian(), payer: true }], health: { allergies: '', emergency: '' },
  authorizations: { image: true, exit: 'Fin de journée uniquement' }, documents: [],
});

/* ---------- Pré-inscriptions ---------- */
function PreregTab({ items, setItems, onConvert }) {
  const [draft, setDraft] = useState(null);
  const set = (id, patch) => setItems(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const columns = [...PREREG_STEPS.filter((s) => s.id !== 'INSCRITE'), ...PREREG_OTHER];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Demandes en cours" value={items.filter((p) => !['INSCRITE', 'REFUSEE'].includes(p.status)).length} />
        <Stat label="Entretiens à faire" value={items.filter((p) => p.status === 'ENTRETIEN').length} tone="amber" />
        <Stat label="Acceptées, à inscrire" value={items.filter((p) => p.status === 'ACCEPTEE').length} tone="green" />
        <Stat label="Liste d'attente" value={items.filter((p) => p.status === 'ATTENTE').length} tone="red" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setDraft({ child: '', cls: '6e', previousSchool: '', contact: '', phone: '', source: 'Bouche-à-oreille' })}>＋ Nouvelle pré-inscription</Button>
      </div>
      {draft && (
        <Card title="Nouvelle pré-inscription" subtitle="Premier contact d'une famille : une fiche légère, complétée à l'inscription">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[['child', 'Nom et prénom de l\'enfant'], ['previousSchool', 'Établissement actuel de l\'enfant'], ['contact', 'Responsable'], ['phone', 'Téléphone / WhatsApp', 'tel']].map(([k, l, type]) => (
              <label key={k} className="text-xs text-slate-600">{l}
                <input type={type ?? 'text'} inputMode={type === 'tel' ? 'tel' : undefined} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
              </label>
            ))}
            <label className="text-xs text-slate-600">Connu par
              <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                {PREREG_SOURCES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Classe demandée
              <select value={draft.cls} onChange={(e) => setDraft({ ...draft, cls: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                {ENROLL_CLASSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">Le reste (date de naissance, e-mail, pièces, santé…) se complète à l'inscription.</p>
          <div className="mt-3 flex gap-2">
            <Button disabled={!draft.child.trim() || !draft.contact.trim() || !draft.phone.trim()}
              onClick={() => { setItems([{ ...draft, id: `p${Date.now()}`, receivedOn: '2026-10-13', status: 'DEMANDE' }, ...items]); setDraft(null); }}>Enregistrer</Button>
            <Button variant="secondary" onClick={() => setDraft(null)}>Annuler</Button>
          </div>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {columns.map((col) => {
          const list = items.filter((p) => p.status === col.id);
          return (
            <section key={col.id} className="min-w-0 rounded-2xl bg-slate-100/70 p-3">
              <p className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">{col.label}<Badge tone={TONE[col.id]}>{list.length}</Badge></p>
              <ul className="space-y-2">
                {list.map((p) => {
                  const next = nextPreregStep(p.status);
                  return (
                    <li key={p.id} className="rounded-xl bg-white p-3 text-sm shadow-soft">
                      <p className="font-semibold text-slate-900">{p.child} {p.online && <Badge tone="violet">en ligne</Badge>}</p>
                      <p className="text-xs text-slate-500">{p.cls} demandée · reçue le {fmt(p.receivedOn)}{p.previousSchool ? ` · vient de ${p.previousSchool}` : ''}</p>
                      <p className="mt-1 text-xs text-slate-600">{p.contact} · {p.phone || p.email}{p.source ? ` · connu par : ${p.source.toLowerCase()}` : ''}</p>
                      {p.message && <p className="mt-1 text-xs italic text-slate-600">« {p.message} »</p>}
                      {p.documents?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{p.documents.map((d, k) => <DocumentThumb key={k} doc={d} title={d.label} />)}</div>}
                      {p.interview && <p className="mt-1 text-xs text-violet-700">{p.interview}</p>}
                      {p.note && <p className="mt-1 text-xs text-amber-700">{p.note}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {next && <Button variant="secondary" className="!px-2.5 !py-0.5 text-xs" onClick={() => set(p.id, { status: next })}>→ {stepLabel(next)}</Button>}
                        {p.status === 'ACCEPTEE' && <Button className="!px-2.5 !py-0.5 text-xs" onClick={() => onConvert(p)}>Inscrire</Button>}
                        {!['ATTENTE', 'REFUSEE'].includes(p.status) && <Button variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => set(p.id, { status: 'ATTENTE' })}>Attente</Button>}
                        {p.status !== 'REFUSEE' && <Button variant="ghost" className="!px-2 !py-0.5 text-xs text-red-700" onClick={() => set(p.id, { status: 'REFUSEE' })}>Refuser</Button>}
                        {['ATTENTE', 'REFUSEE'].includes(p.status) && <Button variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => set(p.id, { status: 'DOSSIER' })}>Rouvrir</Button>}
                      </div>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="px-1 text-xs text-slate-400">Aucune</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Formulaire : fiche élève ---------- */
function Field({ label, children, className = '' }) {
  return <label className={`block text-xs text-slate-600 ${className}`}>{label}<div className="mt-1">{children}</div></label>;
}

function ProfileForm({ initial, kind, onSave, onCancel }) {
  const [p, setP] = useState(initial);
  const [tried, setTried] = useState(false);
  const errors = validateProfile(p, { kind: kind === 'INSCRIPTION' ? 'INSCRIPTION' : 'REINSCRIPTION' });
  const set = (patch) => setP({ ...p, ...patch });
  const setG = (i, patch) => set({ guardians: p.guardians.map((g, k) => (k === i ? { ...g, ...patch } : patch.payer ? { ...g, payer: false } : g)) });
  const toggleDoc = (id) => set({ documents: p.documents.includes(id) ? p.documents.filter((d) => d !== id) : [...p.documents, id] });
  const input = (k, extra = {}) => <input value={p[k]} onChange={(e) => set({ [k]: e.target.value })} className={`w-full ${inputCls}`} {...extra} />;
  return (
    <div className="space-y-5">
      <Card title={kind === 'REINSCRIPTION' ? `Réinscription 2027-2028 — ${p.firstName} ${p.lastName}` : kind === 'COMPLETER' ? `Compléter la fiche — ${p.firstName} ${p.lastName}` : 'Inscription — nouvelle fiche élève'}
        subtitle={kind === 'INSCRIPTION' ? 'Toutes les informations de l\'élève, réutilisées partout dans l\'ENT' : 'La fiche existante est reprise : vérifier et compléter avec la famille'}>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Identité</h4>
        <div className="mb-3"><PhotoInput value={p.photo} onChange={(photo) => set({ photo })} /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nom">{input('lastName')}</Field>
          <Field label="Prénom(s)">{input('firstName')}
            {firstNames(p.firstName).length > 1 && (
              <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">Prénom d'usage :
                {firstNames(p.firstName).map((n) => <button key={n} type="button" aria-pressed={usualFirstName(p) === n} onClick={() => set({ usualName: n })}
                  className={`rounded-full px-2 py-0.5 font-medium ring-1 ${usualFirstName(p) === n ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{n}</button>)}
              </span>
            )}
          </Field>
          <Field label="Sexe">
            <select value={p.sex} onChange={(e) => set({ sex: e.target.value })} className={`w-full ${inputCls}`}><option value="F">Fille</option><option value="M">Garçon</option></select>
          </Field>
          <Field label="Date de naissance">{input('birthDate', { type: 'date' })}</Field>
          <Field label="Lieu de naissance">{input('birthPlace')}</Field>
          <Field label="Nationalité(s)" className="lg:col-span-3">
            <div className="flex flex-wrap gap-1.5">
              {NATIONALITY_CHOICES.map(([code, l]) => {
                const on = code === 'XX' ? hasOtherNationality(p.nationalities) : p.nationalities.includes(code);
                return (
                  <button key={code} type="button" aria-pressed={on} onClick={() => set({ nationalities: toggleNationality(p.nationalities, code) })}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${on ? 'bg-navy-500 text-white ring-navy-500' : 'text-slate-600 ring-slate-300'}`}>{l}</button>
                );
              })}
            </div>
          </Field>
        </div>

        <h4 className="mb-2 mt-5 text-sm font-semibold text-slate-800">Scolarité</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={kind === 'REINSCRIPTION' ? 'Classe à la rentrée' : 'Classe'}>
            <select value={p.cls} onChange={(e) => set({ cls: e.target.value })} className={`w-full ${inputCls}`}>{ENROLL_CLASSES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="LV1"><select value={p.lv1} onChange={(e) => set({ lv1: e.target.value })} className={`w-full ${inputCls}`}>{LANGUAGES.lv1.map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="LV2"><select value={p.lv2} onChange={(e) => set({ lv2: e.target.value })} className={`w-full ${inputCls}`}>{LANGUAGES.lv2.map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Entrée dans l'établissement">{input('enteredOn', { type: 'date' })}
            <span className="mt-1 block text-[11px] text-slate-500">{seniority(p.enteredOn)?.label ?? 'Nouveau ou ancien : indiquer la date d\'entrée'}</span></Field>
          <Field label="Établissement d'origine">{input('previousSchool')}</Field>
        </div>
        {SPECIALTY_COUNT[p.cls] && (
          <Field label={`Spécialités (${SPECIALTY_COUNT[p.cls]} à choisir)`} className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SPECIALTIES).map(([code, label]) => {
                const on = (p.specialties ?? []).includes(code);
                return <button key={code} type="button" aria-pressed={on} onClick={() => set({ specialties: on ? p.specialties.filter((x) => x !== code) : [...(p.specialties ?? []), code] })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${on ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{label}</button>;
              })}
            </div>
          </Field>
        )}

        <div className="mb-2 mt-5 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Responsables légaux</h4>
          <Button variant="ghost" className="!py-0.5 text-xs" onClick={() => set({ guardians: [...p.guardians, emptyGuardian()] })}>＋ Ajouter un responsable</Button>
        </div>
        <div className="space-y-3">
          {p.guardians.map((g, i) => (
            <div key={i} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr_auto]">
              <Field label={`Responsable ${i + 1} — nom`}><input value={g.name} onChange={(e) => setG(i, { name: e.target.value })} className={`w-full ${inputCls}`} /></Field>
              <Field label="Lien"><select value={g.relation} onChange={(e) => setG(i, { relation: e.target.value })} className={`w-full ${inputCls}`}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
              <Field label="Téléphone"><input value={g.phone} onChange={(e) => setG(i, { phone: e.target.value })} placeholder="+261 34 …" className={`w-full ${inputCls}`} /></Field>
              <Field label="E-mail (compte Google)"><input value={g.email} onChange={(e) => setG(i, { email: e.target.value })} className={`w-full ${inputCls}`} /></Field>
              <div className="flex flex-wrap items-end gap-3 pb-1.5 text-xs text-slate-600">
                <label className="flex items-center gap-1"><input type="radio" name="payer" checked={g.payer} onChange={() => setG(i, { payer: true })} />Règle les frais</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={g.whatsapp} onChange={(e) => setG(i, { whatsapp: e.target.checked })} />WhatsApp</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={g.pickup} onChange={(e) => setG(i, { pickup: e.target.checked })} />Peut récupérer l'élève</label>
                {p.guardians.length > 1 && <button type="button" aria-label="Retirer ce responsable" onClick={() => set({ guardians: p.guardians.filter((_, k) => k !== i) })} className="rounded p-1 text-slate-400 hover:text-red-600"><Icon name="x" /></button>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Santé</h4>
            <Field label="Allergies, traitement"><input value={p.health.allergies} onChange={(e) => set({ health: { ...p.health, allergies: e.target.value } })} className={`w-full ${inputCls}`} /></Field>
            <Field label="Contact d'urgence" className="mt-2"><input value={p.health.emergency} onChange={(e) => set({ health: { ...p.health, emergency: e.target.value } })} className={`w-full ${inputCls}`} /></Field>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Autorisations</h4>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.authorizations.image} onChange={(e) => set({ authorizations: { ...p.authorizations, image: e.target.checked } })} />Droit à l'image</label>
            <Field label="Sortie de l'établissement" className="mt-2">
              <select value={p.authorizations.exit} onChange={(e) => set({ authorizations: { ...p.authorizations, exit: e.target.value } })} className={`w-full ${inputCls}`}>
                {['Sortie libre aux heures sans cours', 'Fin de journée uniquement', 'Aucune sortie sans un responsable'].map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Pièces du dossier</h4>
            <ul className="space-y-1">
              {REQUIRED_DOCUMENTS.filter((d) => !(d.newOnly && kind !== 'INSCRIPTION')).map((d) => (
                <li key={d.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.documents.includes(d.id)} onChange={() => toggleDoc(d.id)} />{d.label}</label></li>
              ))}
            </ul>
          </div>
        </div>

        {tried && errors.length > 0 && (
          <ul className="mt-4 space-y-0.5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => { setTried(true); if (!errors.length) onSave(p); }}>{{ REINSCRIPTION: 'Valider la réinscription', COMPLETER: 'Enregistrer la fiche' }[kind] ?? 'Créer la fiche et inscrire'}</Button>
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
          <p className="self-center text-xs text-slate-500">Les frais d'inscription ou de réinscription s'ajoutent ensuite au compte de l'élève, dans « Encaisser ».</p>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Fiche signalétique en ligne et signatures ---------- */
function FicheSection({ p }) {
  const key = `${p.lastName} ${p.firstName}`;
  const [fiche, setFiche] = useState(() => ficheOf(key));
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm"><span className="font-semibold text-slate-800">Fiche signalétique {FICHE_YEAR}</span>{' '}
          {fiche?.signedAt ? <Badge tone="green">signée en ligne le {fmt(fiche.signedAt.slice(0, 10))}</Badge> : <Badge tone="amber">en attente du parent</Badge>}
          {fiche?.validatedAt && <> <Badge tone="navy">validée</Badge></>}</p>
        <Button variant="secondary" className="!py-1 text-xs" onClick={() => setOpen(!open)}>{open ? 'Fermer' : fiche?.signedAt ? 'Voir la fiche et les signatures' : 'Comparer une signature'}</Button>
      </div>
      {!fiche?.signedAt && !open && <p className="mt-1 text-xs text-slate-500">Le parent la remplit et la signe depuis son compte (Plus → Fiche signalétique). Plus de saisie à la main.</p>}
      {open && (
        <div className="mt-3 space-y-4">
          {fiche?.signedAt && <FicheView fiche={fiche} />}
          {fiche?.signedAt && !fiche.validatedAt && (
            <Button className="!py-1 text-xs" onClick={() => { const v = { ...fiche, validatedAt: new Date().toISOString() }; saveFiche(key, v); setFiche(v); }}>Valider la fiche</Button>
          )}
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">Comparer une signature en cas de doute</p>
            {p.guardians.filter((g) => g.email || g.name).map((g) => <div key={g.name} className="mb-3"><SignatureCompare account={g.email || g.name} name={g.name} /></div>)}
            {p.guardians.length === 0 && <p className="text-xs text-slate-500">Aucun responsable enregistré.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Fiches élèves ---------- */
function ProfileCard({ p, onReenrol, onComplete, created }) {
  const missing = missingDocuments(p, 'REINSCRIPTION');
  const accounts = accountsFor(p);
  return (
    <Card title={`${p.lastName} ${p.firstName}`} subtitle={`${p.cls} · né.e le ${fmt(p.birthDate)} à ${p.birthPlace || '—'} · ${nationalityLabels(p.nationalities).join(', ') || 'nationalité à renseigner'}`}
      action={(
        <span className="flex flex-wrap gap-2">
          <CertificateButton profile={p} />
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => onComplete(p)}>Compléter la fiche</Button>
          {nextClass(p.cls) && <Button variant="secondary" className="!py-1 text-xs" onClick={() => onReenrol(p)}>Réinscrire en {nextClass(p.cls)}</Button>}
        </span>
      )}>
      {created && <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Fiche enregistrée. Les comptes ci-dessous sont prêts : invitations envoyées par e-mail et dans l'application.</p>}
      <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
        {p.photo ? <img src={p.photo} alt={`Photo de ${p.firstName}`} className="h-28 w-[84px] rounded-lg object-cover" />
          : <button type="button" onClick={() => onComplete(p)} className="flex h-28 w-[84px] items-center justify-center rounded-lg border border-dashed border-amber-400 bg-amber-50 text-center text-[11px] text-amber-800">Pas de photo<br />d'identité</button>}
        <div className="space-y-1 text-sm">
          {p.number && <p><span className="text-slate-500">N° :</span> {p.number}{p.exam ? ` · ${p.exam}` : ''}</p>}
          {(p.email || p.phones?.length > 0) && <p><span className="text-slate-500">Contact de l'élève :</span> {[p.email, ...(p.phones ?? [])].filter(Boolean).join(' · ')}</p>}
          <p><span className="text-slate-500">Entrée :</span> {fmt(p.enteredOn)} · {p.previousSchool || '—'}{' '}
            {seniority(p.enteredOn) ? <Badge tone={seniority(p.enteredOn).isNew ? 'green' : 'navy'}>{seniority(p.enteredOn).label}</Badge> : <Badge tone="amber">ancienneté à renseigner</Badge>}</p>
          {SPECIALTY_COUNT[p.cls] && <p><span className="text-slate-500">Spécialités :</span> {(p.specialties ?? []).map((k) => SPECIALTIES[k]).join(', ') || <Badge tone="amber">à choisir</Badge>}</p>}
          {p.nextYear && <p><span className="text-slate-500">Rentrée 2027 :</span> {p.nextYear.status === 'DEPART' ? <Badge tone="amber">ne revient pas</Badge> : <Badge tone="green">réinscrit.e en {p.nextYear.cls}</Badge>}</p>}
          {firstNames(p.firstName).length > 1 && <p><span className="text-slate-500">Prénom d'usage :</span> {usualFirstName(p)}</p>}
          <p><span className="text-slate-500">Langues :</span> {[p.lv1, p.lv2].filter(Boolean).join(', ') || '—'}</p>
          <p><span className="text-slate-500">Santé :</span> {p.health.allergies || '—'}</p>
          <p><span className="text-slate-500">Urgence :</span> {p.health.emergency || '—'}</p>
          <p><span className="text-slate-500">Autorisations :</span> image {p.authorizations.image ? 'oui' : 'non'} · {p.authorizations.exit}</p>
          {missing.length > 0 ? <p className="text-amber-700">Pièces manquantes : {missing.map((d) => d.label).join(', ')}</p> : <p className="text-emerald-700">Dossier complet</p>}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Responsables</p>
          {p.guardians.length === 0 && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Aucun responsable légal : à compléter avant de créer les comptes parents.</p>}
          <ul className="space-y-1.5 text-sm">
            {p.guardians.map((g) => (
              <li key={g.name} className="flex items-start gap-2">
                <Avatar name={g.name} className="h-7 w-7 text-[10px]" />
                <span className="min-w-0">{g.name} <span className="text-slate-500">({g.relation})</span>
                  <span className="block text-xs text-slate-500">{g.phone}{g.whatsapp ? ' · WhatsApp' : ''}{g.email ? ` · ${g.email}` : ''}</span>
                  <span className="flex flex-wrap gap-1">{g.payer && <Badge tone="navy">règle les frais</Badge>}{g.pickup && <Badge>peut récupérer l'élève</Badge>}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <FicheSection p={p} />
      <p className="mb-1 mt-4 text-xs font-semibold text-slate-500">Comptes de l'ENT · un accès par responsable (deux parents = deux accès, chacun son code)</p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {accounts.map((a) => (
          <li key={a.name + a.role} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>{a.name} <Badge tone={a.role === 'ELEVE' ? 'violet' : 'navy'}>{a.role === 'ELEVE' ? 'Élève' : 'Parent'}</Badge></span>
            <span className="text-xs text-slate-500">{a.code && <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">{a.code}</span>}{a.login ?? a.phone ?? ''} · {a.method}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const TABS = [['prereg', 'Pré-inscriptions'], ['online', 'Demandes des familles'], ['new', 'Inscrire'], ['profiles', 'Fiches élèves']];

const initialProfiles = loadProfiles;

export default function InscriptionsModule() {
  const [tab, setTab] = useState('prereg');
  const [prereg, setPreregState] = useState(() => [...loadRequests().prereg, ...PREREGISTRATIONS]);
  // pré-inscriptions envoyées en ligne : leur avancement est gardé avec elles
  const setPrereg = (next) => { next.filter((x) => x.online).forEach((x) => updateOnlinePrereg(x.id, { status: x.status })); setPreregState(next); };
  const [pendingOnline] = useState(() => loadRequests().requests.filter((r) => r.status === 'A_TRAITER').length);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [form, setForm] = useState(null); // { initial, kind, preregId? }
  const [selected, setSelected] = useState(() => initialProfiles()[0]?.id);
  const [created, setCreated] = useState(null);
  const [query, setQuery] = useState('');

  const startNew = (from) => {
    const base = emptyProfile();
    if (from) {
      const [last, ...first] = from.child.split(' ');
      base.lastName = last; base.firstName = first.join(' '); base.birthDate = from.birthDate ?? ''; base.cls = from.cls; base.previousSchool = from.previousSchool;
      base.guardians = [{ ...emptyGuardian(), name: from.contact, relation: /^M\.? /.test(from.contact) ? 'Père' : 'Mère', phone: from.phone, email: from.email ?? '', whatsapp: true, payer: true }];
    }
    setForm({ initial: base, kind: 'INSCRIPTION', preregId: from?.id });
    setTab('new');
  };
  const complete = (p) => { setForm({ initial: { ...p, guardians: p.guardians.length ? p.guardians : [{ ...emptyGuardian(), payer: true }] }, kind: 'COMPLETER' }); setTab('new'); };
  const reenrol = (p) => { setForm({ initial: { ...p, cls: nextClass(p.cls) }, kind: 'REINSCRIPTION' }); setTab('new'); };
  const save = (p) => {
    const id = p.id ?? `f${Date.now()}`;
    const next = p.id ? profiles.map((x) => (x.id === p.id ? p : x)) : [...profiles, { ...p, id }];
    setProfiles(next);
    if (!saveProfiles(next)) window.alert('Le navigateur manque de place : la fiche est modifiée pour cette session seulement.');
    if (form.preregId) setPrereg(prereg.map((x) => (x.id === form.preregId ? { ...x, status: 'INSCRITE' } : x)));
    setSelected(id); setCreated(id); setForm(null); setTab('profiles');
  };
  const list = useMemo(() => profiles.filter((p) => `${p.lastName} ${p.firstName} ${p.cls}`.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  const current = profiles.find((p) => p.id === selected);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Année 2026-2027 · réinscriptions 2027-2028 · Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Inscriptions</h1>
          <p className="text-sm text-slate-500">Chaque inscription ou réinscription crée la fiche élève, d'où sont créés les comptes de l'élève et des parents.</p>
        </div>
        <Button onClick={() => startNew(null)}>＋ Inscrire un élève</Button>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id === 'new' && !form) startNew(null); }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}{id === 'online' && pendingOnline > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{pendingOnline}</span>}</button>
        ))}
      </div>

      {tab === 'prereg' && <PreregTab items={prereg} setItems={setPrereg} onConvert={startNew} />}
      {tab === 'online' && <RequestsTab profiles={profiles} onApply={(p) => { const next = profiles.map((x) => (x.id === p.id ? p : x)); setProfiles(next); saveProfiles(next); }} />}
      {tab === 'new' && form && <ProfileForm key={form.initial.id ?? form.preregId ?? 'new'} initial={form.initial} kind={form.kind} onSave={save} onCancel={() => { setForm(null); setTab('profiles'); }} />}
      {tab === 'profiles' && (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr] xl:items-start">
          <Card title={`Fiches élèves (${profiles.length})`}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className={`w-full ${inputCls}`} />
            <ul className="-mx-2 mt-2 space-y-0.5">
              {list.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { setSelected(p.id); setCreated(null); }} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${p.id === selected ? 'bg-navy-50 font-medium text-navy-900' : 'hover:bg-slate-50'}`}>
                    <Avatar name={`${p.firstName} ${p.lastName}`} photo={p.photo} className="h-7 w-7 text-[10px]" />
                    <span>{p.lastName} {p.firstName}<span className="block text-xs font-normal text-slate-500">{p.cls}{seniority(p.enteredOn) ? ` · ${seniority(p.enteredOn).isNew ? 'nouveau' : `ancien, ${seniority(p.enteredOn).years} an${seniority(p.enteredOn).years > 1 ? 's' : ''}`}` : ''}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {current && <ProfileCard p={current} onReenrol={reenrol} onComplete={complete} created={created === current.id} />}
        </div>
      )}
    </div>
  );
}
