import React, { useState } from 'react';
import { Button } from './ui.jsx';
import logo from '../assets/logo-chateaubriand.png';
import { accord, schoolYearOf, classLongName, frDate } from '../rules/documents.js';
import { printOnly } from '../print.js';
import { addSignatureRequest } from '../signatureStore.js';

// Certificat de scolarité selon la matrice de l'établissement : une demi-page A4,
// imprimé en 1 ou 2 exemplaires selon la demande de l'élève (2 exemplaires = une page découpée).
const TODAY = '2026-10-13';

// Signataires possibles (Direction)
export const SIGNATORIES = [
  { id: 'ADJOINTE', intro: 'Sheena Lo Thion Kao, Directrice Adjointe de Chateaubriand', title: 'La Directrice Adjointe,', name: 'Sheena Lo' },
  { id: 'CHEFFE', intro: 'Cheffe d\'établissement de Chateaubriand', title: 'La Cheffe d\'Établissement,', name: '' },
];

const SITES = [
  ['CHATEAUBRIAND TAMATAVE', '27 Rue Nationale, 501 Toamasina', '+261 34 51 227 78', 'chateaubetamatave@gmail.com'],
  ['CHATEAUBRIAND TANANARIVE', 'Lot II R 5 Betongolo, 101 Antananarivo', '+261 34 16 982 87', 'chateaube@yahoo.fr'],
];

// Avec signatureUrl : document signé numériquement par la Direction ; stampUrl : tampon numérique
// (envoi par e-mail) ; sur papier, le secrétariat tamponne à la main. Le code permet de vérifier le document.
export function CertificateSheet({ profile: p, signatory = SIGNATORIES[0], signatureUrl, stampUrl, code, date = TODAY }) {
  const y = schoolYearOf(TODAY);
  return (
    <div className="certificate grid h-[148mm] w-full max-w-[210mm] grid-cols-[34%_1fr] gap-6 bg-white px-[10mm] py-[8mm] text-[11.5px] leading-snug text-black"
      style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="flex flex-col">
        <img src={logo} alt="École Collège Lycée Chateaubriand" className="w-[52mm]" />
        <p className="mt-8 text-[9.5px]">Une scolarité basée sur<br />les programmes français depuis 1994</p>
        {SITES.map(([n, a, t, m]) => (
          <p key={n} className="mt-6 text-[9.5px] leading-tight text-navy-700">{n}<br />{a}<br />{t}<br />{m}</p>
        ))}
      </div>
      <div className="flex flex-col">
        <p className="text-right">Tamatave, le {frDate(date)}</p>
        <h2 className="mt-12 text-center text-[15px] font-bold tracking-wide">CERTIFICAT DE SCOLARITÉ</h2>
        <p className="mt-6 text-justify">Je soussignée, {signatory.intro}, certifie que :</p>
        <p className="mt-4 text-center font-bold">{p.lastName}&nbsp;&nbsp;&nbsp;{p.firstName}</p>
        <p className="text-center font-bold">{accord(p.sex, 'Né', 'Née')} le {frDate(p.birthDate) || '…'}{p.birthPlace ? `, à ${p.birthPlace}` : ''}</p>
        <p className="mt-4 text-justify">
          est régulièrement {accord(p.sex, 'inscrit', 'inscrite')} au sein de notre établissement en classe de {classLongName(p.cls)} pour
          l'année scolaire {y} – {y + 1} et est {accord(p.sex, 'assidu', 'assidue')} aux cours.
        </p>
        <p className="mt-3">Pour servir et faire valoir ce que de droit.</p>
        <div className="relative mt-auto self-end pr-6 text-left">
          {stampUrl && <img src={stampUrl} alt="Tampon" className="absolute -left-[30mm] -top-[6mm] h-[30mm] w-[30mm] object-contain opacity-90" style={{ mixBlendMode: 'multiply' }} />}
          <p>{signatory.title}</p>
          {signatureUrl && <img src={signatureUrl} alt="Signature" className="h-[15mm] max-w-[45mm] object-contain" style={{ mixBlendMode: 'multiply' }} />}
          <p><strong>{signatory.name || ' '}</strong></p>
        </div>
        {code && <p className="mt-2 text-[8px] leading-tight text-slate-600">Signé numériquement le {frDate(date)} · code de vérification {code} · authenticité vérifiable auprès de l'établissement</p>}
      </div>
    </div>
  );
}

/** Bouton « Certificat de scolarité » : signataire, 1 ou 2 exemplaires, aperçu puis impression. */
export function CertificateButton({ profile, role = 'BUREAU' }) {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const [copies, setCopies] = useState(1);
  const [sig, setSig] = useState(SIGNATORIES[0].id);
  const signatory = SIGNATORIES.find((s) => s.id === sig);
  const missing = [!profile.birthDate && 'date de naissance', !profile.sex && 'sexe (né / née)', !profile.birthPlace && 'lieu de naissance'].filter(Boolean);
  return (
    <>
      <Button variant="secondary" className="!py-1 text-xs" onClick={() => setOpen(true)}>Certificat de scolarité</Button>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-label="Certificat de scolarité" onClick={() => setOpen(false)}>
          <div className="mx-auto max-w-[820px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm">
              <label className="flex items-center gap-2">Exemplaires
                <select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2 py-1"><option value={1}>1</option><option value={2}>2</option></select>
              </label>
              <label className="flex items-center gap-2">Signataire
                <select value={sig} onChange={(e) => setSig(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1">
                  {SIGNATORIES.map((s) => <option key={s.id} value={s.id}>{s.title.replace(',', '')}</option>)}
                </select>
              </label>
              <span className="flex gap-2">
                <Button onClick={() => printOnly('.cert-print', 'size: A4 portrait; margin: 0;')}>Imprimer</Button>
                {asked ? <span className="self-center text-xs text-emerald-700">Demande envoyée à la Direction (Documents à signer)</span>
                  : <Button variant="secondary" disabled={missing.length > 0} onClick={() => { addSignatureRequest({ kind: 'CERTIFICAT_SCOLARITE', profile, signatory: sig, copies, delivery: 'PAPIER', requestedBy: role }); setAsked(true); }}>Faire signer par la Direction</Button>}
                <Button variant="secondary" onClick={() => setOpen(false)}>Fermer</Button>
              </span>
              {missing.length > 0 && <p className="w-full text-xs text-amber-700">À compléter dans la fiche : {missing.join(', ')}.</p>}
            </div>
            <div className="cert-print bg-white">
              <CertificateSheet profile={profile} signatory={signatory} />
              {copies === 2 && (<><div className="cert-cut mx-[6mm] border-t-2 border-dashed border-slate-500" /><CertificateSheet profile={profile} signatory={signatory} /></>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
