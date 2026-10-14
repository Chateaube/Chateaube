import React, { useState } from 'react';
import { Badge, Button } from './ui.jsx';
import SignaturePad from './SignaturePad.jsx';
import { referenceOf, setReference, ficheOf, saveFiche } from '../ficheStore.js';

// Fiche signalétique de l'établissement, remplie en ligne par le parent depuis son compte
// (plus de saisie à la main), puis signée au doigt. La signature de référence du compte sert
// ensuite au bureau pour comparer une signature en cas de doute (mot d'absence, autorisation…).

export const FICHE_YEAR = '2026-2027';
const LINKS = ['Mère', 'Père', 'Tuteur / tutrice'];
const ENGAGEMENTS = [
  'Nous déclarons avoir pris connaissance et acceptons sans réserve le projet éducatif, les normes pédagogiques, le règlement intérieur avec ses règles de discipline, ainsi que l\'ensemble des dispositions financières de l\'établissement.',
  'Nous nous engageons formellement à régler intégralement les frais de scolarité avant le 5 de chaque mois. Nous acceptons l\'application des pénalités de retard. Nous comprenons et admettons qu\'un défaut de paiement persistant pourra entraîner la suspension temporaire de la scolarité de notre enfant ainsi que des poursuites judiciaires pour recouvrement des sommes dues.',
];
const NOTE = 'Les autorisations sont révocables par écrit. L\'année scolaire constitue un ensemble indivisible et non remboursable.';

const emptyGuardian = (link = 'Mère') => ({ link, linkOther: '', lastName: '', firstName: '', address: '', phone: '', profession: '', workPhone: '', workAddress: '' });
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** Fiche pré-remplie avec ce que l'établissement sait déjà de l'élève (fiche élève). */
export function prefill(profile, account) {
  const [g1, g2] = profile?.guardians ?? [];
  const split = (name = '') => {
    const parts = name.replace(/^(M\.|Mme)\s+/, '').split(' ');
    return { lastName: parts[0] ?? '', firstName: parts.slice(1).join(' ') };
  };
  const guardian = (g) => (g ? { ...emptyGuardian(LINKS.includes(g.relation) ? g.relation : 'Tuteur / tutrice'), ...split(g.name), phone: g.phone ?? '' } : null);
  return {
    site: 'TMV', lastName: profile?.lastName ?? '', firstName: profile?.firstName ?? '', birthDate: profile?.birthDate ?? '', birthPlace: profile?.birthPlace ?? '',
    sex: profile?.sex ?? '', photo: null, cls: profile?.cls ?? '', enteredOn: profile?.enteredOn?.slice(0, 7) ?? '', previousSchool: profile?.previousSchool ?? '', why: '',
    siblings: [], guardians: [guardian(g1) ?? emptyGuardian(), guardian(g2) ?? emptyGuardian('Père')],
    allergies: profile?.health?.allergies ?? '', treatment: '', emergencyName: '', emergencyPhone: '',
    authImage: profile?.authorizations?.image ?? false, authHospital: false, accept: false, place: 'Tamatave', account,
  };
}

/** Champs obligatoires avant signature. */
export function ficheErrors(f) {
  const e = [];
  if (!f.lastName || !f.firstName) e.push('Nom et prénom(s) de l\'élève');
  if (!f.birthDate || !f.birthPlace) e.push('Date et lieu de naissance');
  if (!f.sex) e.push('Genre');
  const g = f.guardians[0];
  if (!g.lastName || !g.phone) e.push('Représentant légal : nom et téléphone');
  if (g.link === 'Tuteur / tutrice' && !g.linkOther) e.push('Représentant légal : préciser le lien');
  if (!f.emergencyName || !f.emergencyPhone) e.push('Contact d\'urgence et téléphone');
  if (!f.accept) e.push('Acceptation du règlement et des dispositions financières');
  return e;
}

function Field({ label, children, className = '' }) {
  return <label className={`block text-xs text-slate-600 ${className}`}>{label}<div className="mt-1">{children}</div></label>;
}
function Block({ title, children }) {
  return <section className="rounded-2xl bg-white p-4 shadow-soft"><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-700">{title}</h3><div className="space-y-2">{children}</div></section>;
}

function GuardianFields({ g, onChange, title }) {
  const set = (patch) => onChange({ ...g, ...patch });
  const input = (k, extra = {}) => <input value={g[k]} onChange={(e) => set({ [k]: e.target.value })} className={inputCls} {...extra} />;
  return (
    <Block title={title}>
      <div className="flex flex-wrap gap-1.5">
        {LINKS.map((l) => (
          <button key={l} type="button" aria-pressed={g.link === l} onClick={() => set({ link: l })}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${g.link === l ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>
        ))}
      </div>
      {g.link === 'Tuteur / tutrice' && <Field label="Lien avec l'élève (précisez)">{input('linkOther')}</Field>}
      <div className="grid grid-cols-2 gap-2"><Field label="Nom">{input('lastName')}</Field><Field label="Prénom">{input('firstName')}</Field></div>
      <Field label="Adresse">{input('address')}</Field>
      <Field label="Téléphone">{input('phone', { inputMode: 'tel' })}</Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Profession">{input('profession')}</Field><Field label="Téléphone professionnel">{input('workPhone', { inputMode: 'tel' })}</Field></div>
      <Field label="Adresse professionnelle">{input('workAddress')}</Field>
    </Block>
  );
}

/** Formulaire du parent (portail famille). */
export function FicheForm({ studentKey, profile, account, accountName, onSigned }) {
  const [existing, setExisting] = useState(() => ficheOf(studentKey));
  const [f, setF] = useState(existing ?? prefill(profile, account));
  const [signature, setSignature] = useState(null);
  const [tried, setTried] = useState(false);
  const reference = referenceOf(account);
  const errors = ficheErrors(f);
  const set = (patch) => setF({ ...f, ...patch });
  const input = (k, extra = {}) => <input value={f[k]} onChange={(e) => set({ [k]: e.target.value })} className={inputCls} {...extra} />;
  const setSibling = (i, patch) => set({ siblings: f.siblings.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  if (existing?.signedAt) return <FicheView fiche={existing} />;

  const submit = () => {
    setTried(true);
    if (errors.length || !signature) return;
    if (!reference) setReference(account, signature); // première signature : devient la signature de référence du compte
    const fiche = { ...f, signatures: [{ account, name: accountName, dataUrl: signature }], signedAt: new Date().toISOString(), status: 'SIGNEE' };
    saveFiche(studentKey, fiche);
    setExisting(fiche);
    onSigned?.(fiche);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-navy-900 p-4 text-white">
        <p className="text-xs text-navy-200">Année scolaire {FICHE_YEAR}</p>
        <p className="font-display text-lg font-semibold">Fiche signalétique élève</p>
        <p className="mt-1 text-xs text-navy-100">Pré-remplie avec ce que l'école connaît déjà : vérifiez, complétez, puis signez. Plus de fiche papier à écrire à la main.</p>
      </div>

      <Block title="Élève">
        <div className="flex gap-1.5">
          {[['TNR', 'Tananarive 101'], ['TMV', 'Tamatave 501']].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={f.site === id} onClick={() => set({ site: id })}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${f.site === id ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Field label="Nom(s)">{input('lastName')}</Field>
            <Field label="Prénom(s)">{input('firstName')}</Field>
          </div>
          <label className="flex w-24 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-center text-[11px] text-slate-500">
            {f.photo ? <img src={f.photo} alt="Photo de l'élève" className="h-full w-full object-cover" /> : <>Photo<br />(appareil ou galerie)</>}
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const r = new FileReader();
              r.onload = () => set({ photo: r.result });
              r.readAsDataURL(file);
            }} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2"><Field label="Date de naissance">{input('birthDate', { type: 'date' })}</Field><Field label="Lieu de naissance">{input('birthPlace')}</Field></div>
        <div className="flex gap-1.5">
          {[['F', 'Féminin'], ['M', 'Masculin']].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={f.sex === id} onClick={() => set({ sex: id })}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${f.sex === id ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>
          ))}
        </div>
      </Block>

      <Block title="Informations scolaires">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Classe actuelle">{input('cls')}</Field>
          <Field label="Entrée à l'École Chateaubriand">{input('enteredOn', { type: 'month' })}</Field>
        </div>
        <Field label="Établissement précédent (nouveaux élèves)">{input('previousSchool')}</Field>
        <Field label="Pourquoi Chateaubriand ?"><textarea rows={2} value={f.why} onChange={(e) => set({ why: e.target.value })} className={inputCls} /></Field>
      </Block>

      <Block title="Fratrie scolaire">
        {f.siblings.map((s, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-slate-50 p-2">
            <Field label="Nom / Prénom"><input value={s.name} onChange={(e) => setSibling(i, { name: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Né(e) le"><input type="date" value={s.birthDate} onChange={(e) => setSibling(i, { birthDate: e.target.value })} className={inputCls} /></Field>
              <Field label="Classe"><input value={s.cls} onChange={(e) => setSibling(i, { cls: e.target.value })} className={inputCls} /></Field>
            </div>
            <Field label="Établissement ou profession"><input value={s.school} onChange={(e) => setSibling(i, { school: e.target.value })} className={inputCls} /></Field>
            <button type="button" onClick={() => set({ siblings: f.siblings.filter((_, k) => k !== i) })} className="text-xs text-red-700">Retirer</button>
          </div>
        ))}
        <button type="button" onClick={() => set({ siblings: [...f.siblings, { name: '', birthDate: '', cls: '', school: '' }] })} className="text-sm font-medium text-navy-500">＋ Ajouter un frère ou une sœur</button>
      </Block>

      <GuardianFields title="Représentant légal" g={f.guardians[0]} onChange={(g) => set({ guardians: [g, f.guardians[1]] })} />
      <GuardianFields title="Autre personne responsable" g={f.guardians[1]} onChange={(g) => set({ guardians: [f.guardians[0], g] })} />

      <Block title="Informations médicales">
        <Field label="Allergies connues">{input('allergies')}</Field>
        <Field label="Traitement / maladie chronique">{input('treatment')}</Field>
        <div className="grid grid-cols-2 gap-2"><Field label="Contact d'urgence">{input('emergencyName')}</Field><Field label="Téléphone">{input('emergencyPhone', { inputMode: 'tel' })}</Field></div>
      </Block>

      <Block title="Autorisations et engagements">
        <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={f.authImage} onChange={(e) => set({ authImage: e.target.checked })} />Nous autorisons l'utilisation de l'image de notre enfant à des fins pédagogiques et institutionnelles.</label>
        <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={f.authHospital} onChange={(e) => set({ authHospital: e.target.checked })} />Nous autorisons en cas d'urgence médicale le transfert de notre enfant vers un établissement hospitalier.</label>
        {ENGAGEMENTS.map((t) => <p key={t} className="text-xs leading-relaxed text-slate-600">{t}</p>)}
        <p className="text-[11px] italic text-slate-500">({NOTE})</p>
        <label className="flex gap-2 rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-900"><input type="checkbox" className="mt-1" checked={f.accept} onChange={(e) => set({ accept: e.target.checked })} />Nous déclarons avoir pris connaissance et approuvé l'ensemble des informations mentionnées ci-dessus.</label>
      </Block>

      <Block title="Signature">
        <Field label="Fait à">{input('place')}</Field>
        <p className="text-xs text-slate-500">Le {fmt(new Date().toISOString().slice(0, 10))} · {accountName}</p>
        {reference
          ? <p className="text-xs text-slate-500">Signez comme d'habitude : votre signature sera comparée à celle déposée dans votre compte.</p>
          : <p className="rounded-lg bg-navy-50 p-2 text-xs text-navy-900">C'est votre première signature : elle devient la <strong>signature de référence</strong> de votre compte. Le bureau pourra la comparer avec vos mots et autorisations papier en cas de doute.</p>}
        <SignaturePad onChange={setSignature} label="Signez ici avec le doigt" />
        <p className="text-[11px] text-slate-500">L'autre responsable signe depuis son propre compte parent.</p>
      </Block>

      {tried && (errors.length > 0 || !signature) && (
        <ul className="list-disc rounded-2xl bg-red-50 p-3 pl-7 text-sm text-red-800">
          {errors.map((e) => <li key={e}>{e}</li>)}
          {!signature && <li>Signature</li>}
        </ul>
      )}
      <Button className="w-full" onClick={submit}>Signer et envoyer la fiche</Button>
    </div>
  );
}

/** Lecture de la fiche signée (parent et bureau). */
export function FicheView({ fiche: f, compact = false }) {
  const row = (label, value) => value ? <p className="text-sm"><span className="text-slate-500">{label} :</span> {value}</p> : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green">Fiche {FICHE_YEAR} signée le {fmt(f.signedAt.slice(0, 10))}</Badge>
        {f.validatedAt && <Badge tone="navy">Validée par le bureau</Badge>}
      </div>
      <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-2'}`}>
        <div className="space-y-1">
          {f.photo && <img src={f.photo} alt="Photo de l'élève" className="h-24 w-20 rounded-lg object-cover" />}
          {row('Élève', `${f.lastName} ${f.firstName}`)}
          {row('Né(e) le', `${fmt(f.birthDate)} à ${f.birthPlace}`)}
          {row('Genre', f.sex === 'F' ? 'Féminin' : 'Masculin')}
          {row('Site', f.site === 'TMV' ? 'Tamatave 501' : 'Tananarive 101')}
          {row('Classe', f.cls)}
          {row('Entrée', f.enteredOn)}
          {row('Établissement précédent', f.previousSchool)}
          {row('Pourquoi Chateaubriand', f.why)}
          {f.siblings.length > 0 && row('Fratrie', f.siblings.map((s) => `${s.name} (${s.cls || s.school})`).join(', '))}
        </div>
        <div className="space-y-1">
          {f.guardians.filter((g) => g.lastName).map((g, i) => (
            <p key={i} className="text-sm"><span className="text-slate-500">{i === 0 ? 'Représentant légal' : 'Autre responsable'} ({g.link === 'Tuteur / tutrice' ? g.linkOther || 'tuteur' : g.link.toLowerCase()}) :</span> {g.lastName} {g.firstName} · {g.phone}{g.profession ? ` · ${g.profession}` : ''}</p>
          ))}
          {row('Allergies', f.allergies)}
          {row('Traitement', f.treatment)}
          {row('Urgence', `${f.emergencyName} — ${f.emergencyPhone}`)}
          {row('Droit à l\'image', f.authImage ? 'autorisé' : 'refusé')}
          {row('Transfert hospitalier', f.authHospital ? 'autorisé' : 'non autorisé')}
          {row('Fait à', f.place)}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {f.signatures.map((s) => (
          <figure key={s.account} className="rounded-xl border border-slate-200 bg-white p-2">
            <img src={s.dataUrl} alt={`Signature de ${s.name}`} className="h-20" />
            <figcaption className="text-[11px] text-slate-500">{s.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Bureau : signature de référence du compte à côté d'un document papier photographié. */
export function SignatureCompare({ account, name }) {
  const ref = referenceOf(account);
  const [doc, setDoc] = useState(null);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <figure className="rounded-xl border border-slate-200 bg-white p-2">
        <figcaption className="mb-1 text-xs font-medium text-slate-600">Signature de référence — {name}</figcaption>
        {ref ? <><img src={ref.dataUrl} alt={`Signature de référence de ${name}`} className="h-28 w-full object-contain" /><p className="text-[11px] text-slate-500">Déposée le {fmt(ref.at.slice(0, 10))} depuis son compte</p></>
          : <p className="py-8 text-center text-xs text-slate-500">Pas encore de signature déposée dans ce compte.</p>}
      </figure>
      <figure className="rounded-xl border border-slate-200 bg-white p-2">
        <figcaption className="mb-1 text-xs font-medium text-slate-600">Document à vérifier (mot d'absence, autorisation…)</figcaption>
        {doc ? <img src={doc} alt="Document à comparer" className="h-28 w-full object-contain" /> : <p className="py-6 text-center text-xs text-slate-500">Photographiez ou choisissez le document.</p>}
        <input type="file" accept="image/*" capture="environment" aria-label="Document à comparer" className="mt-1 w-full text-xs" onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const r = new FileReader();
          r.onload = () => setDoc(r.result);
          r.readAsDataURL(file);
        }} />
      </figure>
    </div>
  );
}
