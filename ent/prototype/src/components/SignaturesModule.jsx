import React, { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import SignaturePad from './SignaturePad.jsx';
import { CertificateSheet, SIGNATORIES } from './Certificate.jsx';
import { loadSignatures, setOfficialSignature, setStamp, addSignatureRequest, updateSignatureRequest } from '../signatureStore.js';
import { loadProfiles, profileKey } from '../profilesStore.js';
import { DOCUMENT_KINDS, DELIVERY, verificationCode, decisionErrors, validEmail } from '../rules/signatures.js';
import { imageToDataUrl } from '../image.js';
import { printOnly } from '../print.js';

// Documents à signer : le secrétariat ou la vie scolaire demande, la Direction reçoit la demande
// (même absente, sur son téléphone) et signe numériquement, puis le document revient au secrétariat :
// imprimé et tamponné à la main, ou envoyé par e-mail avec le tampon numérique.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const STATUS = { DEMANDEE: ['amber', 'à signer'], SIGNEE: ['green', 'signé'], REFUSEE: ['red', 'refusé'] };
const signatoryOf = (id) => SIGNATORIES.find((s) => s.id === id) ?? SIGNATORIES[0];
const WHO = { BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', DIRECTION: 'Direction' };

/** Aperçu du document, signé ou non. */
function Sheet({ r, data, withStamp }) {
  const signed = r.status === 'SIGNEE';
  return (
    <div className="origin-top-left">
      {Array.from({ length: r.copies ?? 1 }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div className="cert-cut mx-[6mm] border-t-2 border-dashed border-slate-500" />}
          <CertificateSheet profile={r.profile} signatory={signatoryOf(r.signatory)} date={signed ? r.signedAt.slice(0, 10) : undefined}
            signatureUrl={signed ? r.signatureUrl : null} stampUrl={signed && withStamp ? data.stamp : null} code={signed ? r.code : null} />
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- Direction : ma signature et le tampon ---------- */
function SignatureSetup({ me, data, refresh }) {
  const [draft, setDraft] = useState(null);
  const [redo, setRedo] = useState(false);
  const stampRef = useRef(null);
  const sigRef = useRef(null);
  const mine = data.officials[me.id];
  return (
    <Card title="Ma signature et le tampon" subtitle="Déposés une fois ; utilisés seulement quand vous validez un document">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Signature — {me.title.replace(',', '')}</p>
          {mine && !redo ? (
            <>
              <img src={mine.dataUrl} alt="Ma signature" className="h-24 w-full rounded-xl border border-slate-200 bg-white object-contain" />
              <button type="button" className="mt-1 text-xs font-medium text-navy-700" onClick={() => setRedo(true)}>Changer ma signature</button>
            </>
          ) : (
            <>
              {/* Le plus simple : signer sur une feuille blanche et la photographier de près */}
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
                <p className="px-4 text-center text-xs text-slate-600">Signez sur une feuille blanche, prenez-la en photo de près (bien éclairée) et déposez-la.</p>
              </div>
              <Button className="mt-2" onClick={() => sigRef.current.click()}>Déposer la photo de ma signature</Button>
              <input ref={sigRef} type="file" accept="image/*" aria-label="Photo de ma signature" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setOfficialSignature(me.id, await imageToDataUrl(f, 800, 0.9)); setRedo(false); refresh(); } }} />
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-navy-700">Ou signer à l'écran</summary>
                <div className="mt-2">
                  <SignaturePad onChange={setDraft} label="Signez au doigt ou à la souris" />
                  <Button className="mt-2" disabled={!draft} onClick={() => { setOfficialSignature(me.id, draft); setRedo(false); refresh(); }}>Enregistrer ma signature</Button>
                </div>
              </details>
            </>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Tampon de l'établissement (pour les envois par e-mail)</p>
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
            {data.stamp ? <img src={data.stamp} alt="Tampon" className="h-20 object-contain" /> : <p className="px-4 text-center text-xs text-slate-500">Tamponnez une feuille blanche, prenez-la en photo de près et déposez-la ici.</p>}
          </div>
          <button type="button" className="mt-1 text-xs font-medium text-navy-500" onClick={() => stampRef.current.click()}>{data.stamp ? 'Changer le tampon' : 'Déposer le tampon'}</button>
          <input ref={stampRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setStamp(await imageToDataUrl(f, 600, 0.9)); refresh(); } }} />
        </div>
      </div>
    </Card>
  );
}

/* ---------- Bureau / vie scolaire : nouvelle demande ---------- */
function NewRequest({ role, onDone }) {
  const profiles = useMemo(() => loadProfiles(), []);
  const [studentId, setStudentId] = useState('');
  const [signatory, setSignatory] = useState(SIGNATORIES[0].id);
  const [copies, setCopies] = useState(1);
  const [delivery, setDelivery] = useState('PAPIER');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const p = profiles.find((x) => x.id === studentId);
  const missing = p ? [!p.birthDate && 'date de naissance', !p.sex && 'sexe', !p.birthPlace && 'lieu de naissance'].filter(Boolean) : [];
  const ok = p && !missing.length && (delivery === 'PAPIER' || validEmail(email));
  return (
    <Card title="Demander une signature" subtitle="La Direction est prévenue et signe depuis son téléphone">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-slate-600">Document<select className={`mt-1 w-full ${inputCls}`} disabled><option>{DOCUMENT_KINDS.CERTIFICAT_SCOLARITE}</option></select></label>
        <label className="text-xs text-slate-600">Élève
          <select value={studentId} onChange={(e) => { setStudentId(e.target.value); const s = profiles.find((x) => x.id === e.target.value); setEmail(s?.guardians?.find((g) => g.email)?.email ?? ''); }} className={`mt-1 w-full ${inputCls}`}>
            <option value="">Choisir…</option>{profiles.map((x) => <option key={x.id} value={x.id}>{profileKey(x)} · {x.cls}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Signataire
          <select value={signatory} onChange={(e) => setSignatory(e.target.value)} className={`mt-1 w-full ${inputCls}`}>{SIGNATORIES.map((s) => <option key={s.id} value={s.id}>{s.title.replace(',', '')}</option>)}</select>
        </label>
        <label className="text-xs text-slate-600">Remise
          <select value={delivery} onChange={(e) => setDelivery(e.target.value)} className={`mt-1 w-full ${inputCls}`}>{Object.entries(DELIVERY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        {delivery === 'EMAIL'
          ? <label className="text-xs text-slate-600">E-mail du destinataire<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 w-full ${inputCls}`} /></label>
          : <label className="text-xs text-slate-600">Exemplaires<select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className={`mt-1 w-full ${inputCls}`}><option value={1}>1</option><option value={2}>2</option></select></label>}
        <label className="text-xs text-slate-600">Motif (facultatif)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. dossier de visa" className={`mt-1 w-full ${inputCls}`} /></label>
      </div>
      {missing.length > 0 && <p className="mt-2 text-xs text-amber-700">À compléter d'abord dans la fiche élève : {missing.join(', ')}.</p>}
      <Button className="mt-3" disabled={!ok} onClick={() => { addSignatureRequest({ kind: 'CERTIFICAT_SCOLARITE', profile: p, signatory, copies: delivery === 'EMAIL' ? 1 : copies, delivery, email: delivery === 'EMAIL' ? email.trim() : '', reason, requestedBy: role }); setStudentId(''); setReason(''); onDone(); }}>Envoyer à la Direction</Button>
    </Card>
  );
}

/* ---------- Vérifier un document ---------- */
function Verify({ data }) {
  const [code, setCode] = useState('');
  const c = code.trim().toUpperCase();
  const found = c.length >= 9 ? data.requests.find((r) => r.code === c) : null;
  return (
    <Card title="Vérifier un document" subtitle="Une administration ou une ambassade demande si un certificat est authentique">
      <input value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code de vérification imprimé" placeholder="Code imprimé, ex. ABCD-2345" className={`w-full font-mono uppercase sm:w-64 ${inputCls}`} />
      {c.length >= 9 && (found
        ? <p className="mt-2 text-sm text-emerald-800">Authentique : {DOCUMENT_KINDS[found.kind]} de {profileKey(found.profile)} ({found.profile.cls}), signé le {fmt(found.signedAt)} par {signatoryOf(found.signatory).title.replace(',', '')}.</p>
        : <p className="mt-2 text-sm text-red-700">Aucun document signé avec ce code.</p>)}
    </Card>
  );
}

export default function SignaturesModule({ role, account }) {
  const [data, setData] = useState(loadSignatures);
  const refresh = () => setData(loadSignatures());
  const isDirection = role === 'DIRECTION';
  const me = signatoryOf(account?.id === 'u2' ? 'ADJOINTE' : 'CHEFFE');
  const [refusing, setRefusing] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const toSign = data.requests.filter((r) => r.status === 'DEMANDEE');
  const mine = isDirection ? toSign.filter((r) => r.signatory === me.id) : [];
  const others = isDirection ? toSign.filter((r) => r.signatory !== me.id) : [];
  const decide = (r, status) => {
    const signature = data.officials[me.id]?.dataUrl;
    const errs = decisionErrors({ role, status, signature, note });
    if (errs.length) { setError(errs.join(' ')); return; }
    setError('');
    updateSignatureRequest(r.id, status === 'SIGNEE'
      ? { status, signatory: me.id, signatureUrl: signature, signedAt: new Date().toISOString(), code: verificationCode(r.id), signedBy: me.title.replace(',', '') }
      : { status, refusal: note, signedAt: new Date().toISOString() });
    setRefusing(null); setNote(''); refresh();
  };
  const print = (r, withStamp) => {
    setData({ ...data, printing: { id: r.id, withStamp } });
    setTimeout(() => {
      printOnly('.sig-print', 'size: A4 portrait; margin: 0;');
      updateSignatureRequest(r.id, withStamp ? { sentAt: new Date().toISOString() } : { printedAt: new Date().toISOString() });
      refresh();
    }, 50);
  };
  const mailto = (r) => `mailto:${r.email}?subject=${encodeURIComponent(`Certificat de scolarité — ${profileKey(r.profile)}`)}&body=${encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint le certificat de scolarité de ${r.profile.firstName} ${r.profile.lastName}, signé et tamponné.\nCode de vérification : ${r.code}\n\nLe secrétariat — École Collège Lycée Chateaubriand, Tamatave`)}`;
  const printing = data.printing && data.requests.find((r) => r.id === data.printing.id);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Certificats et attestations</p>
        <h1 className="text-2xl font-semibold text-navy-900">Documents à signer</h1>
        <p className="text-sm text-slate-500">{isDirection ? 'Les demandes du secrétariat et de la vie scolaire arrivent ici ; vous êtes prévenue dès qu\'une demande arrive.' : 'Demandez la signature de la Direction, même absente ; le document signé revient ici pour être imprimé et tamponné, ou envoyé par e-mail.'}</p>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {!isDirection && <NewRequest role={role} onDone={refresh} />}

      {isDirection && (
        <Card title={`À signer (${mine.length})`} subtitle={others.length ? `${others.length} autre(s) demande(s) adressée(s) à l'autre signataire` : undefined}>
          {mine.length === 0 && <p className="text-sm text-slate-500">Rien à signer.</p>}
          <div className="space-y-5">
            {mine.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm"><strong>{DOCUMENT_KINDS[r.kind]}</strong> — {profileKey(r.profile)} ({r.profile.cls}) · demandé par {WHO[r.requestedBy] ?? r.requestedBy} le {fmt(r.requestedAt)}{r.reason ? ` · ${r.reason}` : ''} · {DELIVERY[r.delivery]}</p>
                <div className="overflow-x-auto rounded-lg bg-slate-100 p-2"><div className="w-[210mm] origin-top-left scale-[0.5] sm:scale-[0.75]" style={{ marginBottom: '-74mm' }}><Sheet r={r} data={data} /></div></div>
                {refusing === r.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif du refus" className={`min-w-[220px] flex-1 ${inputCls}`} />
                    <Button onClick={() => decide(r, 'REFUSEE')}>Refuser</Button><Button variant="secondary" onClick={() => setRefusing(null)}>Annuler</Button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => decide(r, 'SIGNEE')}>Signer</Button>
                    <Button variant="secondary" onClick={() => { setRefusing(r.id); setNote(''); }}>Refuser…</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* « À signer » en premier ; la signature et le tampon (déposés une fois) restent repliés */}
      {isDirection && (
        <details className="rounded-2xl bg-white/70 p-2 shadow-soft">
          <summary className="cursor-pointer px-2 py-1.5 text-sm font-semibold text-slate-800">Ma signature et le tampon</summary>
          <div className="mt-2"><SignatureSetup me={me} data={data} refresh={refresh} /></div>
        </details>
      )}
      <Card title="Suivi des demandes">
        <ul className="divide-y divide-slate-100">
          {data.requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{DOCUMENT_KINDS[r.kind]} — {profileKey(r.profile)}</span> <Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge>
                <span className="block text-xs text-slate-500">Demandé le {fmt(r.requestedAt)} par {WHO[r.requestedBy] ?? r.requestedBy} · {signatoryOf(r.signatory).title.replace(',', '')} · {DELIVERY[r.delivery]}{r.email ? ` (${r.email})` : ''}
                  {r.code ? ` · code ${r.code}` : ''}{r.printedAt ? ` · imprimé le ${fmt(r.printedAt)}` : ''}{r.sentAt ? ` · PDF préparé le ${fmt(r.sentAt)}` : ''}</span>
                {r.status === 'REFUSEE' && <span className="block text-xs text-red-700">Motif : {r.refusal}</span>}
              </span>
              {r.status === 'SIGNEE' && (
                <span className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="!py-1 text-xs" onClick={() => print(r, false)}>Imprimer (à tamponner)</Button>
                  {r.delivery === 'EMAIL' && <Button className="!py-1 text-xs" onClick={() => print(r, true)}>1. PDF avec tampon</Button>}
                  {r.delivery === 'EMAIL' && <a href={mailto(r)} className="rounded-lg bg-navy-500 px-3 py-1 text-xs font-medium text-white">2. Écrire l'e-mail</a>}
                </span>
              )}
            </li>
          ))}
          {data.requests.length === 0 && <li className="py-2 text-sm text-slate-500">Aucune demande pour l'instant.</li>}
        </ul>
        {data.requests.some((r) => r.delivery === 'EMAIL') && <p className="mt-2 text-xs text-slate-500">Démonstration : enregistrez le PDF (« Enregistrer au format PDF » dans la fenêtre d'impression), puis joignez-le à l'e-mail. Avec le serveur, le PDF signé et tamponné part tout seul à l'adresse indiquée.</p>}
      </Card>

      <Verify data={data} />

      <div className="hidden"><div className="sig-print">{printing && <div className="bg-white"><Sheet r={printing} data={data} withStamp={data.printing.withStamp} /></div>}</div></div>
    </div>
  );
}
