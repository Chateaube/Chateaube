import React, { useState } from 'react';
import { Button } from './ui.jsx';
import logo from '../assets/logo-tamatave.png';
import { seniority, accord, certificateNumber, schoolYearLabel } from '../rules/documents.js';
import { formatDateFr } from '../rules/calendar.js';
import { printOnly } from '../print.js';

// Certificat de scolarité (A4) : modèle standard en attendant la matrice de l'établissement.
const TODAY = '2026-10-13';
let seq = 41; // dernier n° délivré (démonstration)

const longDate = (iso) => (iso ? formatDateFr(iso).replace(/^\S+ /, '') : '…');
const levelLabel = (cls) => cls.replace(/^Terminale/, 'Terminale').replace(/^(\d)e$/, '$1e');

export function CertificateSheet({ profile: p, number }) {
  const s = seniority(p.enteredOn);
  const born = accord(p.sex, 'né', 'née');
  const enrolled = accord(p.sex, 'inscrit', 'inscrite');
  return (
    <div style={{ fontFamily: 'Alice, Georgia, serif' }} className="certificate mx-auto flex min-h-[1000px] w-full max-w-[720px] flex-col bg-white p-12 text-[15px] leading-relaxed text-slate-900 shadow-soft">
      <img src={logo} alt="École Collège Lycée Chateaubriand Tamatave — 27 Rue Nationale, 501 Toamasina · +261 34 51 227 78 · chateaubetamatave@gmail.com" className="w-full max-w-[520px]" />
      <p className="mt-2 text-right text-xs text-slate-500">N° {number}</p>
      <h2 className="mt-10 text-center font-display text-2xl font-bold tracking-[0.2em] text-navy-900">CERTIFICAT DE SCOLARITÉ</h2>
      <p className="mt-1 text-center text-sm text-slate-600">Année scolaire {schoolYearLabel(TODAY)}</p>
      <div className="mt-12 space-y-5">
        <p>Je soussignée, Cheffe d'établissement de l'École Collège Lycée Chateaubriand de Tamatave, certifie que l'élève :</p>
        <p className="text-center text-lg font-bold">{p.lastName} {p.firstName}</p>
        <p>{born} le <strong>{longDate(p.birthDate)}</strong>{p.birthPlace ? <> à <strong>{p.birthPlace}</strong></> : null},</p>
        <p>est régulièrement {enrolled} en classe de <strong>{levelLabel(p.cls)}</strong> au titre de l'année scolaire {schoolYearLabel(TODAY)}
          {s && !s.isNew ? <>, et fréquente l'établissement depuis le <strong>{longDate(p.enteredOn)}</strong> ({s.years} an{s.years > 1 ? 's' : ''})</> : null}
          {s?.isNew ? <>, depuis le <strong>{longDate(p.enteredOn)}</strong></> : null}.</p>
        <p>Le présent certificat est délivré à l'intéressé{p.sex === 'F' ? 'e' : p.sex === 'M' ? '' : '(e)'} pour servir et valoir ce que de droit.</p>
      </div>
      <div className="mt-16 ml-auto w-72 text-center">
        <p>Fait à Toamasina, le {longDate(TODAY)}</p>
        <p className="mt-2 font-semibold">La Cheffe d'établissement</p>
        <div className="mt-3 h-28 rounded-lg border border-dashed border-slate-300 text-xs leading-[7rem] text-slate-400 print:border-0">signature et cachet</div>
      </div>
      <p className="mt-auto pt-10 text-center text-[11px] text-slate-500">Programme français · Candidats rattachés à l'Académie de La Réunion</p>
    </div>
  );
}

/** Bouton « Certificat de scolarité » : aperçu puis impression A4. */
export function CertificateButton({ profile }) {
  const [number, setNumber] = useState(null);
  const missing = [!profile.birthDate && 'date de naissance', !profile.cls && 'classe'].filter(Boolean);
  return (
    <>
      <Button variant="secondary" className="!py-1 text-xs" onClick={() => setNumber(certificateNumber(++seq))}
        title={missing.length ? `À compléter : ${missing.join(', ')}` : undefined}>Certificat de scolarité</Button>
      {number && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-label="Certificat de scolarité" onClick={() => setNumber(null)}>
          <div className="mx-auto max-w-[760px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3">
              <p className="text-sm text-slate-700">{missing.length ? <span className="text-amber-700">À compléter dans la fiche : {missing.join(', ')}.</span> : 'Aperçu avant impression (A4).'}</p>
              <span className="flex gap-2">
                <Button onClick={() => printOnly('.cert-print', 'size: A4 portrait; margin: 12mm;')}>Imprimer</Button>
                <Button variant="secondary" onClick={() => setNumber(null)}>Fermer</Button>
              </span>
            </div>
            <div className="cert-print"><CertificateSheet profile={profile} number={number} /></div>
          </div>
        </div>
      )}
    </>
  );
}
