import React, { useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { PREREGISTRATIONS, PREREG_SOURCES, ENROLL_CLASSES, LANGUAGES, RELATIONS } from '../data/enrollment.js';
import {
  PREREG_STEPS, PREREG_OTHER, nextPreregStep, nextClass, validateProfile, accountsFor, missingDocuments, documentsFor, nextMatricule,
  SCHOOL_SYSTEMS, DNB_STATUS, schoolDirectory, knownSchool,
} from '../rules/enrollment.js';
import { loadProfiles, saveProfiles, profileKey } from '../profilesStore.js';
import { loadRequests, updateOnlinePrereg, loadCampaign, saveCampaign } from '../requestsStore.js';
import { campaignOpen } from '../rules/enrollment.js';
import { NATIONALITY_CHOICES, nationalityLabels, toggleNationality, hasOtherNationality } from '../rules/enrollment.js';
import { PhotoInput, DocumentThumb } from './PhotoInput.jsx';
import { firstNames, usualFirstName } from '../rules/names.js';
import { RequestsTab } from './FamilyRequests.jsx';
import { seniority } from '../rules/documents.js';
import { SPECIALTIES, SPECIALTY_COUNT } from '../rules/bulletin.js';
import { CertificateButton } from './Certificate.jsx';
import ScreenTabs from './ScreenTabs.jsx';
import StudentList from './StudentList.jsx';
import StudentTimeline from './StudentTimeline.jsx';
import FollowUpsModule from './FollowUpsModule.jsx';
import { takeIntent } from '../navIntent.js';
import { FicheView, SignatureCompare, FICHE_YEAR } from './FicheSignaletique.jsx';
import { ficheOf, saveFiche } from '../ficheStore.js';

// Inscriptions (Bureau et Direction) : pré-inscriptions, inscription ou réinscription avec
// création de la fiche élève, puis création des comptes de l'ENT.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const ALL_STEPS = [...PREREG_STEPS, ...PREREG_OTHER];
const stepLabel = (id) => ALL_STEPS.find((s) => s.id === id)?.label ?? id;
const TONE = { DEMANDE: 'slate', DOSSIER: 'navy', ENTRETIEN: 'violet', ACCEPTEE: 'green', INSCRITE: 'green', ATTENTE: 'amber', REFUSEE: 'red' };

const emptyGuardian = () => ({ name: '', relation: 'Mère', phone: '', email: '', whatsapp: true, payer: false });
const emptyProfile = () => ({
  lastName: '', firstName: '', sex: 'F', birthDate: '', birthPlace: '', nationalities: ['MG'], cls: '6e', lv1: 'Anglais', lv2: 'Espagnol',
  enteredOn: '2026-10-13', previousSchool: '', guardians: [{ ...emptyGuardian(), payer: true }], health: { allergies: '', emergency: '' },
  authorizations: { image: true, exit: 'Fin de journée uniquement' }, documents: [],
});

/* ---------- Pré-inscriptions ---------- */
/** Dates de la campagne de pré-inscription en ligne (modifiables par la Direction). */
function CampaignCard({ canEdit }) {
  const [c, setC] = useState(loadCampaign);
  const today = new Date().toISOString().slice(0, 10);
  const set = (patch) => { const next = { ...c, ...patch }; setC(next); saveCampaign(next); };
  const open = campaignOpen(c, today);
  return (
    <Card title={`Pré-inscriptions en ligne ${c.year}`} subtitle="Formulaire public (site de l'école, Facebook, communauté WhatsApp)"
      action={<Badge tone={open ? 'green' : 'slate'}>{open ? 'ouvertes' : 'fermées'}</Badge>}>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs text-slate-600">Ouverture<input type="date" disabled={!canEdit} value={c.opens} onChange={(e) => set({ opens: e.target.value })} className={`mt-1 block ${inputCls}`} /></label>
        <label className="text-xs text-slate-600">Fermeture<input type="date" disabled={!canEdit} value={c.closes} onChange={(e) => set({ closes: e.target.value })} className={`mt-1 block ${inputCls}`} /></label>
        {canEdit && !open && <Button variant="secondary" onClick={() => set({ opens: today, closes: c.closes > today ? c.closes : `${Number(today.slice(0, 4)) + 1}-07-16` })}>Ouvrir dès aujourd'hui</Button>}
        {canEdit && open && <Button variant="secondary" onClick={() => set({ closes: new Date(Date.now() - 864e5).toISOString().slice(0, 10) })}>Fermer maintenant</Button>}
        {!canEdit && <p className="text-xs text-slate-500">Dates fixées par la Direction.</p>}
      </div>
    </Card>
  );
}

function PreregTab({ items, setItems, onConvert, canEdit }) {
  const [draft, setDraft] = useState(null);
  const set = (id, patch) => setItems(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const columns = [...PREREG_STEPS.filter((s) => s.id !== 'INSCRITE'), ...PREREG_OTHER];
  return (
    <div className="space-y-5">
      <CampaignCard canEdit={canEdit} />
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
  // écoles d'origine déjà rencontrées : proposées à la saisie, avec leur système
  const directory = useMemo(() => schoolDirectory([...loadProfiles(), ...PREREGISTRATIONS, ...loadRequests().prereg ?? []]), []);
  const known = knownSchool(directory, p.previousSchool);
  const setSchool = (name) => { const k = knownSchool(directory, name); set({ previousSchool: name, ...(k?.system && !p.previousSystem ? { previousSystem: k.system } : {}) }); };
  const isNew = kind === 'INSCRIPTION';
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
              {hasOtherNationality(p.nationalities) && <input value={p.otherNationality ?? ''} onChange={(e) => set({ otherNationality: e.target.value })} placeholder="Laquelle ? (ex. Comorienne)" aria-label="Autre nationalité" className={`w-48 ${inputCls}`} />}
            </div>
          </Field>
        </div>

        <h4 className="mb-2 mt-5 text-sm font-semibold text-slate-800">Scolarité</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={kind === 'REINSCRIPTION' ? 'Classe à la rentrée' : 'Classe'}>
            <select value={p.cls} onChange={(e) => set({ cls: e.target.value })} className={`w-full ${inputCls}`}>{ENROLL_CLASSES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Entrée dans l'établissement">{input('enteredOn', { type: 'date' })}
            <span className="mt-1 block text-[11px] text-slate-500">{seniority(p.enteredOn)?.label ?? 'Nouveau ou ancien : indiquer la date d\'entrée'}</span></Field>
          <Field label="Établissement d'origine">
            <input value={p.previousSchool} onChange={(e) => setSchool(e.target.value)} list="ecoles-origine" className={`w-full ${inputCls}`} />
            <datalist id="ecoles-origine">{directory.map((e) => <option key={e.name} value={e.name}>{e.system ? SCHOOL_SYSTEMS[e.system] : ''}</option>)}</datalist>
            {known && <span className="mt-1 block text-[11px] text-slate-600">Déjà connue : {known.count} élève{known.count > 1 ? 's' : ''} venu{known.count > 1 ? 's' : ''} de cette école{known.system ? ` · ${SCHOOL_SYSTEMS[known.system].toLowerCase()}` : ''}</span>}
          </Field>
          <Field label="Système de cette école">
            <select value={p.previousSystem ?? ''} onChange={(e) => set({ previousSystem: e.target.value || undefined })} className={`w-full ${inputCls}`}>
              <option value="">{isNew ? 'Choisir…' : 'Non renseigné'}</option>{Object.entries(SCHOOL_SYSTEMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          {p.cls.startsWith('2de') && isNew && (
            <Field label="Brevet (DNB)">
              <select value={p.dnb ?? ''} onChange={(e) => set({ dnb: e.target.value || undefined })} className={`w-full ${inputCls}`}>
                <option value="">Choisir…</option>{Object.entries(DNB_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          )}
          {/^(1re|Terminale)/.test(p.cls) && (
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={!!p.repeating} onChange={(e) => set({ repeating: e.target.checked })} />Redouble cette classe</label>
          )}
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
                <label className="flex items-center gap-1"><input type="radio" name="payer" checked={g.payer} onChange={() => setG(i, { payer: true })} />Responsable financier</label>
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
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Pièces déposées au secrétariat</h4>
            <ul className="space-y-1">
              {documentsFor(kind === 'INSCRIPTION' ? 'INSCRIPTION' : 'REINSCRIPTION', p.cls, p).map((d) => (
                <li key={d.id}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={p.documents.includes(d.id)} onChange={() => toggleDoc(d.id)} /><span>{d.label}{d.detail && <span className="block text-[11px] text-slate-500">{d.detail}</span>}</span></label></li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-slate-500">Cochez à la réception de l'original ; une copie envoyée en ligne ne suffit pas.</p>
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
    <Card title={`${p.lastName} ${p.firstName}`} subtitle={`${p.cls} · né.e le ${fmt(p.birthDate)} à ${p.birthPlace || '—'} · ${nationalityLabels(p.nationalities, p.otherNationality).join(', ') || 'nationalité à renseigner'}`}
      action={(
        <span className="flex flex-wrap gap-2">
          <CertificateButton profile={p} />
          {onComplete && <Button variant="secondary" className="!py-1 text-xs" onClick={() => onComplete(p)}>Compléter la fiche</Button>}
          {onReenrol && nextClass(p.cls) && <Button variant="secondary" className="!py-1 text-xs" onClick={() => onReenrol(p)}>Réinscrire en {nextClass(p.cls)}</Button>}
        </span>
      )}>
      {created && <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Fiche enregistrée. Les comptes ci-dessous sont prêts : invitations envoyées par e-mail et dans l'application.</p>}
      <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
        {p.photo ? <img src={p.photo} alt={`Photo de ${p.firstName}`} className="h-28 w-[84px] rounded-lg object-cover" />
          : <button type="button" onClick={() => onComplete?.(p)} className="flex h-28 w-[84px] items-center justify-center rounded-lg border border-dashed border-amber-400 bg-amber-50 text-center text-[11px] text-amber-800">Pas de photo<br />d'identité</button>}
        <div className="space-y-1 text-sm">
          {p.number && <p><span className="text-slate-500">N° :</span> {p.number}{p.exam ? ` · ${p.exam}` : ''}</p>}
          {(p.email || p.phones?.length > 0) && <p><span className="text-slate-500">Contact de l'élève :</span> {[p.email, ...(p.phones ?? [])].filter(Boolean).join(' · ')}</p>}
          <p><span className="text-slate-500">Entrée :</span> {fmt(p.enteredOn)} · {p.previousSchool || '—'}{' '}
            {seniority(p.enteredOn) ? <Badge tone={seniority(p.enteredOn).isNew ? 'green' : 'navy'}>{seniority(p.enteredOn).label}</Badge> : <Badge tone="amber">ancienneté à renseigner</Badge>}</p>
          {SPECIALTY_COUNT[p.cls] && <p><span className="text-slate-500">Spécialités :</span> {(p.specialties ?? []).map((k) => SPECIALTIES[k]).join(', ') || <Badge tone="amber">à choisir</Badge>}</p>}
          {p.nextYear && <p><span className="text-slate-500">Rentrée 2027 :</span> {p.nextYear.status === 'DEPART' ? <Badge tone="amber">ne revient pas</Badge> : <Badge tone="green">réinscrit.e en {p.nextYear.cls}{p.nextYear.number ? ` · ${p.nextYear.number}` : ''}</Badge>}</p>}
          {firstNames(p.firstName).length > 1 && <p><span className="text-slate-500">Prénom d'usage :</span> {usualFirstName(p)}</p>}
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
                  <span className="block text-xs text-slate-500">{g.phone}{g.email ? ` · ${g.email}` : ''}</span>
                  <span className="flex flex-wrap gap-1">{g.payer && <Badge tone="navy">responsable financier</Badge>}</span>
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

// Écran « Élèves » (Direction, secrétariat, CPE) : un seul endroit pour la liste par classe, l'inscription,
// les demandes des familles et les pré-inscriptions. Un clic sur un élève ouvre son dossier :
// Fiche (identité, responsables, certificat, réinscription) · Fil (ce qui s'est passé) · Suivi (confidentiel).
const initialProfiles = loadProfiles;
const fullNameOf = (p) => `${p.lastName} ${p.firstName}`;

export default function InscriptionsModule({ role }) {
  const [prereg, setPreregState] = useState(() => [...loadRequests().prereg, ...PREREGISTRATIONS]);
  // pré-inscriptions envoyées en ligne : leur avancement est gardé avec elles
  const setPrereg = (next) => { next.filter((x) => x.online).forEach((x) => updateOnlinePrereg(x.id, { status: x.status })); setPreregState(next); };
  const [pendingOnline] = useState(() => loadRequests().requests.filter((r) => r.status === 'A_TRAITER').length);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [form, setForm] = useState(null); // { initial, kind, preregId? }
  // ouvert depuis la recherche, le journal ou une alerte : directement sur le dossier de l'élève
  const [intent] = useState(() => takeIntent('eleves') ?? takeIntent('student-file') ?? takeIntent('enrol'));
  const fromIntent = intent?.student && initialProfiles().find((p) => fullNameOf(p) === intent.student || `${p.lastName} ${usualFirstName(p)}` === intent.student);
  const [selected, setSelected] = useState(fromIntent?.id ?? null);
  const [dossierTab, setDossierTab] = useState(intent?.view ?? (fromIntent ? 'fil' : 'fiche'));
  const [created, setCreated] = useState(null);
  // en dehors de la campagne de pré-inscription, on ouvre sur les demandes des familles s'il y en a, sinon sur la liste
  const [tab, setTab] = useState(intent?.tab ?? (pendingOnline > 0 ? 'online' : 'list'));
  const canFollow = ['DIRECTION', 'VIE_SCOLAIRE'].includes(role);
  const canEdit = role !== 'VIE_SCOLAIRE';
  const TABS = [['list', 'Élèves'], ['online', 'Demandes des familles'], ['prereg', 'Pré-inscriptions'], ...(canFollow ? [['suivis', 'Suivis individuels']] : [])];

  const startNew = (from) => {
    const base = emptyProfile();
    if (from) {
      const [last, ...first] = from.child.split(' ');
      base.lastName = last; base.firstName = first.join(' '); base.birthDate = from.birthDate ?? ''; base.cls = from.cls; base.previousSchool = from.previousSchool; base.previousSystem = from.previousSystem; base.dnb = from.dnb; base.repeating = from.repeating;
      base.guardians = [{ ...emptyGuardian(), name: from.contact, relation: /^M\.? /.test(from.contact) ? 'Père' : 'Mère', phone: from.phone, email: from.email ?? '', payer: true }];
    }
    setForm({ initial: base, kind: 'INSCRIPTION', preregId: from?.id });
  };
  const complete = (p) => setForm({ initial: { ...p, guardians: p.guardians.length ? p.guardians : [{ ...emptyGuardian(), payer: true }] }, kind: 'COMPLETER' });
  const reenrol = (p) => setForm({ initial: { ...p, cls: nextClass(p.cls) }, kind: 'REINSCRIPTION' });
  const save = (input) => {
    // inscription définitive d'un nouvel élève : matricule de l'année (TG-001…), jamais réattribué
    const p = form.kind === 'INSCRIPTION' && !input.number ? { ...input, number: nextMatricule(input.cls, profiles.map((x) => x.number)) } : input;
    const id = p.id ?? `f${Date.now()}`;
    const next = p.id ? profiles.map((x) => (x.id === p.id ? p : x)) : [...profiles, { ...p, id }];
    setProfiles(next);
    if (!saveProfiles(next)) window.alert('Le navigateur manque de place : la fiche est modifiée pour cette session seulement.');
    if (form.preregId) setPrereg(prereg.map((x) => (x.id === form.preregId ? { ...x, status: 'INSCRITE' } : x)));
    setSelected(id); setCreated(id); setForm(null); setTab('list'); setDossierTab('fiche');
  };
  const current = profiles.find((p) => p.id === selected);
  const openDossier = (p) => { setSelected(p.id); setCreated(null); setDossierTab('fiche'); };

  if (form) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={() => setForm(null)} className="text-sm font-medium text-navy-700">‹ Retour aux élèves</button>
        <ProfileForm key={form.initial.id ?? form.preregId ?? 'new'} initial={form.initial} kind={form.kind} onSave={save} onCancel={() => setForm(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Année 2026-2027 · réinscriptions 2027-2028 · Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Élèves</h1>
        </div>
        {canEdit && <Button onClick={() => startNew(null)}>＋ Inscrire un élève</Button>}
      </div>

      {current ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setSelected(null)} className="text-sm font-medium text-navy-700">‹ Retour à la liste</button>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={`${current.firstName} ${current.lastName}`} photo={current.photo} className="h-12 w-12 text-sm" />
            <div><p className="text-lg font-semibold text-navy-900">{current.lastName} {usualFirstName(current)}</p><p className="text-sm text-slate-600">{current.cls}{current.number ? ` · ${current.number}` : ''}</p></div>
          </div>
          <ScreenTabs label="Dossier de l'élève" value={dossierTab} onChange={setDossierTab} tabs={[
            ['fiche', 'Fiche', <ProfileCard key="fiche" p={current} onReenrol={canEdit ? reenrol : null} onComplete={canEdit ? complete : null} created={created === current.id} />],
            ['fil', 'Fil de l\'élève', <StudentTimeline key="fil" role={role} student={fullNameOf(current)} embedded />],
            ...(canFollow ? [['suivi', 'Suivi', <FollowUpsModule key="suivi" role={role} student={fullNameOf(current)} embedded />]] : []),
          ]} />
        </div>
      ) : (
        <ScreenTabs label="Élèves" value={tab} onChange={setTab} tabs={[
          ['list', 'Élèves', <StudentList key="list" role={role} embedded onOpen={openDossier} rowAction={canEdit ? (p) => <CertificateButton profile={p} /> : undefined} />],
          ['online', `Demandes des familles${pendingOnline ? ` (${pendingOnline})` : ''}`, <RequestsTab key="online" profiles={profiles} onApply={(p) => { const next = profiles.map((x) => (x.id === p.id ? p : x)); setProfiles(next); saveProfiles(next); }} />],
          ['prereg', 'Pré-inscriptions', <PreregTab key="prereg" items={prereg} setItems={setPrereg} onConvert={startNew} canEdit={role === 'DIRECTION'} />],
          ...(canFollow ? [['suivis', 'Suivis individuels', <FollowUpsModule key="suivis" role={role} embedded />]] : []),
        ].filter(([id]) => TABS.some(([t]) => t === id))} />
      )}
    </div>
  );
}
