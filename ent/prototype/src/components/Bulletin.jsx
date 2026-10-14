import React from 'react';
import logo from '../assets/logo-tamatave.png';
import { fmtAvg } from '../rules/grading.js';

// Bulletin trimestriel, sur le modèle de l'établissement :
// Matières / Professeurs · Compétences · Moyenne (élève, classe) · Appréciations.

export function BulletinSheet({ b }) {
  return (
    <div className="bulletin mx-auto w-full max-w-[1000px] break-after-page bg-white p-8 text-[11px] leading-snug print:text-[9.5px] print:leading-tight text-slate-900 shadow-soft">
      <div className="flex items-start justify-between gap-6">
        <img src={logo} alt="École Collège Lycée Chateaubriand Tamatave" className="w-[340px]" />
        <div className="text-right">
          <p className="font-display text-lg font-bold text-navy-900">BULLETIN DU {b.term.toUpperCase()}</p>
          <p>Année scolaire {b.year}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-0.5 rounded-lg bg-slate-50 px-4 py-2.5 text-[12px] print:bg-slate-100">
        <p><span className="text-slate-500">Élève :</span> <strong>{b.student}</strong></p>
        <p><span className="text-slate-500">Classe :</span> <strong>{b.cls}</strong> · effectif {b.size}</p>
        <p><span className="text-slate-500">Né(e) le :</span> {b.birth || '—'}</p>
        <p><span className="text-slate-500">Professeur.e principal.e :</span> {b.head}</p>
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-navy-900 text-white">
            <th rowSpan={2} className="w-[17%] border border-slate-300 px-2 py-1.5 text-left">Matières<br /><span className="font-normal">Professeurs</span></th>
            <th rowSpan={2} className="w-[33%] border border-slate-300 px-2 text-left">Compétences</th>
            <th colSpan={2} className="border border-slate-300 px-2">Moyenne</th>
            <th rowSpan={2} className="border border-slate-300 px-2 text-left">Appréciations</th>
          </tr>
          <tr className="bg-navy-900 text-white"><th className="w-[7%] border border-slate-300">Élève</th><th className="w-[7%] border border-slate-300">Classe</th></tr>
        </thead>
        <tbody>
          {b.rows.map((r) => (
            <tr key={r.label} className="break-inside-avoid align-top">
              <td className="border border-slate-300 px-2 py-1.5"><p className="font-bold uppercase">{r.label}</p><p>{r.teacher}</p>{!r.inAverage && <p className="text-[9px] italic text-slate-500">hors moyenne générale</p>}</td>
              <td className="border border-slate-300 px-2 py-1 print:py-0.5">{r.competencies.length ? r.competencies.join('. ') + '.' : '—'}</td>
              <td className="border border-slate-300 px-1 text-center font-bold tabular-nums">{fmtAvg(r.avg)}</td>
              <td className="border border-slate-300 px-1 text-center tabular-nums">{fmtAvg(r.classAvg)}</td>
              <td className="border border-slate-300 px-2 py-1.5">{r.appreciation}</td>
            </tr>
          ))}
          <tr className="bg-navy-50 font-bold print:bg-slate-100">
            <td colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right">MOYENNE GÉNÉRALE</td>
            <td className="border border-slate-300 text-center tabular-nums">{fmtAvg(b.general)}</td>
            <td className="border border-slate-300 text-center tabular-nums">{fmtAvg(b.classGeneral)}</td>
            <td className="border border-slate-300 px-2 font-normal">Absences : {b.abs} demi-journée(s) · retards : {b.late}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 grid grid-cols-[1fr_220px] gap-4">
        <div className="rounded-lg border border-slate-300 p-3">
          <p className="font-bold">Appréciation générale</p>
          <p className="mt-1 min-h-[42px]">{b.generalAppreciation || <span className="text-slate-400">Rédigée par la Cheffe d'établissement après le conseil de classe.</span>}</p>
          {b.decision && <p className="mt-2"><span className="font-bold">Décision du conseil :</span> {b.decision}</p>}
        </div>
        <div className="rounded-lg border border-slate-300 p-3 text-center">
          <p>La Cheffe d'établissement</p>
          <div className="mt-2 h-16 text-[10px] leading-[4rem] text-slate-400">signature et cachet</div>
        </div>
      </div>
      <p className="mt-3 text-center text-[9px] text-slate-500">Bulletin à conserver précieusement : aucun duplicata n'est délivré.</p>
    </div>
  );
}
