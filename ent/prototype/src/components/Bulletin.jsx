import React from 'react';
import logo from '../assets/logo-tamatave.png';
import { fmtAvg } from '../rules/grading.js';

// Bulletin trimestriel selon la matrice de l'établissement (fichier Excel « Exemple bulletin ») :
// MATIÈRES / PROFESSEURS · COMPÉTENCES · MOYENNE (ÉLÈVE, CLASSE) · APPRÉCIATIONS,
// puis absences et retards, signature de la Cheffe d'établissement et appréciation générale.
// Mise en page FIXE d'un trimestre à l'autre : même police, mêmes marges, mêmes colonnes ; seules les
// lignes s'adaptent à la longueur du texte.

const two = (v) => (v === null || v === undefined ? '' : Number(v).toFixed(2));

export function BulletinSheet({ b }) {
  return (
    <div className="bulletin mx-auto w-full max-w-[1000px] break-after-page bg-white p-8 text-[10.5px] leading-snug text-black shadow-soft print:text-[9px] print:leading-tight"
      style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="flex items-start justify-between gap-6">
        <img src={logo} alt="École Collège Lycée Chateaubriand Tamatave — 27 Rue Nationale, 501 Toamasina" className="w-[230px]" />
        <div className="text-right">
          <p className="text-[13px] font-bold">Bulletin du {b.term}</p>
          <p className="font-bold">Année Scolaire {b.year}</p>
          <p className="mt-3 text-[12px] font-bold">{b.student}</p>
          <p>{b.birthLine}</p>
          <p>{b.classLine}</p>
        </div>
      </div>
      <table className="mt-5 w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '17%' }} /><col style={{ width: '37%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '32%' }} /></colgroup>
        <thead>
          <tr className="text-[10px] font-bold">
            <th rowSpan={2} className="border border-black px-2 py-1 text-left">MATIÈRES<br /><span className="font-normal">PROFESSEURS</span></th>
            <th rowSpan={2} className="border border-black px-2">COMPÉTENCES</th>
            <th colSpan={2} className="border border-black">MOYENNE</th>
            <th rowSpan={2} className="border border-black px-2">APPRÉCIATIONS</th>
          </tr>
          <tr className="text-[9px] font-bold"><th className="border border-black">ÉLÈVE</th><th className="border border-black">CLASSE</th></tr>
        </thead>
        <tbody>
          {b.rows.map((r) => (
            <tr key={r.label} className="break-inside-avoid align-middle">
              <td className="break-words border border-black px-2 py-1.5 font-bold uppercase">{r.label}<span className="block font-normal">{r.teacher.toUpperCase()}</span></td>
              <td className="whitespace-pre-line break-words border border-black px-2 py-1">{r.competencies.join('\n') || ''}</td>
              <td className="border border-black text-center font-bold tabular-nums">{two(r.avg)}</td>
              <td className="border border-black text-center tabular-nums">{two(r.classAvg)}</td>
              <td className="break-words border border-black px-2 py-1">{r.appreciation}</td>
            </tr>
          ))}
          {b.showGeneral && (
            <tr className="font-bold">
              <td colSpan={2} className="border border-black px-2 py-1 text-right">MOYENNE GÉNÉRALE</td>
              <td className="border border-black text-center tabular-nums">{fmtAvg(b.general)}</td>
              <td className="border border-black text-center tabular-nums">{fmtAvg(b.classGeneral)}</td>
              <td className="border border-black" />
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-3 flex items-start justify-between">
        <div>
          <p>Absences (demi-journées) : justifiées {b.justified ?? 0} · non justifiées {b.unjustified ?? 0} &nbsp;|&nbsp; Retards : {b.late}</p>
          {b.engagements?.length > 0 && <p className="mt-0.5"><span className="font-bold">Engagement{b.engagements.length > 1 ? 's' : ''} :</span> {b.engagements.join(' · ')}</p>}
          {b.attestations?.length > 0 && <p className="mt-0.5"><span className="font-bold">Attestation{b.attestations.length > 1 ? 's' : ''} de l'établissement :</span> {b.attestations.join(' · ')}</p>}
        </div>
        <p className="w-[30%] text-center font-bold">La Cheffe d'Établissement</p>
      </div>
      <div className="mt-3 w-[62%] border border-black p-2 font-bold">
        <p>Appréciation Générale :</p>
        <p className="min-h-[36px]">{b.generalAppreciation}</p>
        {b.decision && <p className="mt-1 font-normal">Décision du conseil : {b.decision}</p>}
      </div>
      <p className="mt-6 text-[8px] text-slate-500">CE BULLETIN DOIT ÊTRE CONSERVÉ. AUCUN DUPLICATA NE SERA DÉLIVRÉ.</p>
    </div>
  );
}
