import React, { useState } from 'react';
import { Button } from './ui.jsx';
import logo from '../assets/logo-chateaubriand.png';
import { SIGNATORIES } from './Certificate.jsx';
import { frDate, schoolYearOf } from '../rules/documents.js';
import { printOnly } from '../print.js';
import { today } from '../clock.js';
import { serviceText, weeklyHours } from './AgentForm.jsx';

// Documents de l'agent, imprimés à la demande par la Direction seule (même présentation que le certificat
// de scolarité) : contrat de vacation d'enseignement, attestation de travail (en poste), certificat de
// travail (fin d'engagement). Un champ vide laisse une ligne pointillée à compléter à la main.
const SCHOOL = { name: 'ÉCOLE CHATEAUBRIAND – Site de Tamatave', phone: '+261 34 51 227 78', mail: 'chateaubetamatave@gmail.com' };
const blank = (v, w = '40mm') => (v ? v : <span style={{ display: 'inline-block', minWidth: w, borderBottom: '1px dotted #000' }}>&nbsp;</span>);
const ar = (n) => (n ? `${new Intl.NumberFormat('fr-FR').format(Number(n))} Ariary` : null);
const longDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null);
const isF = (a) => a.civility === 'Madame';
const fem = (a, m, f) => (isF(a) ? f : m);
const fullName = (a) => `${a.civility} ${a.first} ${String(a.last).toUpperCase()}`;

function Header({ date }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <img src={logo} alt="École Collège Lycée Chateaubriand" className="w-[42mm]" />
      <p className="text-right text-[10px] leading-tight">CHATEAUBRIAND TAMATAVE<br />27 Rue Nationale, 501 Toamasina<br />{SCHOOL.phone}<br />{SCHOOL.mail}<br /><br />Tamatave, le {frDate(date)}</p>
    </div>
  );
}
function Sign({ signatory, both = false }) {
  return both ? (
    <div className="mt-10 grid grid-cols-2 gap-10 text-center"><div><p>L'Employeur</p><p className="mt-1 text-[10px]">{signatory.title.replace(',', '')}</p><div className="h-[22mm]" /></div><div><p>{'Le / La Salarié(e)'}</p><p className="mt-1 text-[10px]">« Lu et approuvé »</p><div className="h-[22mm]" /></div></div>
  ) : (
    <div className="mt-12 self-end text-left"><p>{signatory.title}</p><div className="h-[18mm]" /><p><strong>{signatory.name || ' '}</strong></p></div>
  );
}
const Art = ({ n, title, children }) => (<section className="mt-3 break-inside-avoid"><h3 className="font-bold">ARTICLE {n} : {title}</h3><div className="mt-1 space-y-1 text-justify">{children}</div></section>);

/** Contrat de vacation d'enseignement (sur la base du contrat type de l'école). */
export function ContractSheet({ agent: a, headName, number, date = today() }) {
  const y = schoolYearOf(a.entry || date);
  const svc = (a.services ?? []).filter((s) => s.subject);
  const h = weeklyHours(svc);
  return (
    <div className="staff-doc w-full max-w-[210mm] bg-white px-[14mm] py-[10mm] text-[11px] leading-snug text-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <Header date={date} />
      <h2 className="mt-5 text-center text-[15px] font-bold tracking-wide">CONTRAT DE VACATION D'ENSEIGNEMENT</h2>
      <p className="text-center">Contrat n° {blank(number, '25mm')} · Conformément au Code du travail de la République de Madagascar</p>
      <p className="mt-4 font-bold">ENTRE LES SOUSSIGNÉS :</p>
      <p className="mt-1">{SCHOOL.name}, 27 Rue Nationale, 501 Tamatave, représentée par {blank(headName, '55mm')}, en sa qualité de Cheffe d'établissement, ci-après dénommée « L'Employeur »,</p>
      <p className="mt-2 font-bold">ET</p>
      <p className="mt-1">{fullName(a)}, demeurant à {blank(a.address, '70mm')}, {a.idType || 'pièce d\'identité'} n° {blank(a.idNumber, '35mm')}, délivré{a.idType === 'CIN' || a.idType === 'Carte de résident' ? 'e' : ''} le {blank(frDate(a.idIssued), '25mm')} à {blank(a.idPlace, '35mm')}, ci-après {fem(a, 'dénommé', 'dénommée')} « {fem(a, 'Le Vacataire', 'La Vacataire')} ».</p>
      <p className="mt-2">Il a été convenu ce qui suit :</p>

      <Art n={1} title="OBJET DU CONTRAT">
        <p>Le présent contrat régit les conditions d'engagement de {fullName(a)} en qualité de {fem(a, 'professeur vacataire', 'professeure vacataire')}{svc.length ? ` (${svc.map((s) => s.subject).join(', ')})` : ''}.</p>
      </Art>
      <Art n={2} title="NATURE ET DURÉE">
        <p>Le présent contrat est un contrat de vacation, prenant effet à compter du {blank(longDate(a.entry), '45mm')}{a.exit ? ` et prenant fin le ${longDate(a.exit)}` : `, pour l'année scolaire ${y}–${y + 1}`}.</p>
        <p>L'activité étant liée aux périodes d'enseignement, aucune vacation n'est due pendant les périodes sans cours selon le calendrier scolaire de l'établissement, notamment les vacances scolaires et les mois de juillet et août.</p>
      </Art>
      <Art n={3} title="LIEU DE TRAVAIL">
        <p>{fem(a, 'Le Vacataire', 'La Vacataire')} exerce ses fonctions sur le site de Tamatave de l'École Chateaubriand, 27 Rue Nationale, 501 Tamatave.</p>
      </Art>
      <Art n={4} title="MISSIONS ET SERVICE">
        {svc.length ? (
          <>
            <p>{fem(a, 'Le Vacataire', 'La Vacataire')} assure les enseignements suivants{h ? `, pour un volume prévisionnel de ${String(h).replace('.', ',')} heure${h > 1 ? 's' : ''} par semaine` : ''} :</p>
            <ul className="ml-4 list-disc">{svc.map((s, i) => <li key={i}>{s.subject} : {s.classes?.length ? s.classes.join(', ') : blank('', '40mm')}{s.hours ? ` — ${String(s.hours).replace('.', ',')} h / semaine` : ''}</li>)}</ul>
          </>
        ) : <p className="text-left">{fem(a, 'Le Vacataire', 'La Vacataire')} assure les enseignements suivants : {blank('', '110mm')}</p>}
        <p>Ses missions comprennent la préparation des cours, l'évaluation des élèves, la saisie des notes et des appréciations dans l'ENT, ainsi que la participation aux conseils de classe et réunions pédagogiques. Cette répartition peut évoluer selon les besoins du service, en accord avec la Direction.</p>
      </Art>
      <Art n={5} title="RÉMUNÉRATION">
        <p>{fem(a, 'Le Vacataire', 'La Vacataire')} est rémunéré{fem(a, '', 'e')} à l'heure d'enseignement effectivement dispensée et validée, au taux horaire de {blank(ar(a.rate), '35mm')}.</p>
        <p>Un décompte des heures réellement effectuées est établi en fin de mois. Les heures non effectuées ne sont pas rémunérées ; les heures supplémentaires validées par la Direction sont payées au même taux. Le paiement est mensuel, en espèces ou, à défaut, par chèque ou virement.</p>
      </Art>
      <Art n={6} title="ABSENCES ET RETARDS">
        <p>Toute absence ou tout retard doit être signalé au bureau dans les plus brefs délais. Au-delà de 15 minutes de retard, le cours est annulé et doit être rattrapé. Les absences ne donnent lieu à aucune rémunération.</p>
      </Art>
      <Art n={7} title="PROPRIÉTÉ INTELLECTUELLE ET CONFIDENTIALITÉ">
        <p>Les documents pédagogiques fournis par l'École restent sa propriété exclusive et sont restitués en fin de contrat. {fem(a, 'Le Vacataire', 'La Vacataire')} est tenu{fem(a, '', 'e')} à une stricte confidentialité, pendant et après le contrat, sur toutes les informations non publiques dont {fem(a, 'il', 'elle')} a connaissance (vie scolaire des élèves, données des familles, informations internes).</p>
      </Art>
      <Art n={8} title="FIN DU CONTRAT">
        <p>Le contrat prend fin à son terme ou d'un commun accord. Chaque partie peut y mettre fin moyennant un préavis raisonnable, de préférence à la fin d'un trimestre scolaire, dans l'intérêt de la continuité pédagogique. Une attestation ou un certificat de travail est remis sur demande.</p>
      </Art>
      <p className="mt-4">Fait à Tamatave, le {frDate(date)}, en deux exemplaires originaux.</p>
      <Sign signatory={SIGNATORIES[1]} both />
    </div>
  );
}

/** Attestation de travail (en poste) ou certificat de travail (fin d'engagement). */
export function WorkSheet({ agent: a, kind, signatory, date = today() }) {
  const svc = serviceText(a.services);
  const job = a.title || (svc ? fem(a, 'Professeur', 'Professeure') : '');
  const cert = kind === 'CERTIFICAT';
  return (
    <div className="staff-doc flex min-h-[148mm] w-full max-w-[210mm] flex-col bg-white px-[14mm] py-[10mm] text-[12px] leading-relaxed text-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <Header date={date} />
      <h2 className="mt-10 text-center text-[16px] font-bold tracking-wide">{cert ? 'CERTIFICAT DE TRAVAIL' : 'ATTESTATION DE TRAVAIL'}</h2>
      <p className="mt-8 text-justify">Je soussignée, {signatory.intro}, {cert ? 'certifie que' : 'atteste que'} :</p>
      <p className="mt-4 text-center font-bold">{fullName(a)}</p>
      <p className="mt-4 text-justify">
        {cert
          ? <>a été {fem(a, 'employé', 'employée')} au sein de notre établissement du {blank(frDate(a.entry), '25mm')} au {blank(frDate(a.exit), '25mm')}, en qualité de {blank(job, '45mm')}{svc ? ` (${svc})` : ''}.</>
          : <>est {fem(a, 'employé', 'employée')} au sein de notre établissement{a.entry ? ` depuis le ${frDate(a.entry)}` : ''}, en qualité de {blank(job, '45mm')}{a.contract ? ` (${a.contract.toLowerCase()})` : ''}{svc ? `, et y enseigne : ${svc}` : ''}.</>}
      </p>
      {cert && <p className="mt-3">{fem(a, 'Il', 'Elle')} nous quitte libre de tout engagement.</p>}
      <p className="mt-3">Pour servir et faire valoir ce que de droit.</p>
      <Sign signatory={signatory} />
    </div>
  );
}

/** Boutons de la fiche : aperçu puis impression (Direction). */
export function StaffDocumentsButtons({ agent, headName, number }) {
  const [open, setOpen] = useState(null);
  const [sig, setSig] = useState(SIGNATORIES[1].id);
  const base = SIGNATORIES.find((s) => s.id === sig);
  const signatory = base.id === 'CHEFFE' && headName ? { ...base, intro: `${headName}, fondatrice et Cheffe d'établissement de Chateaubriand`, name: headName } : base;
  const titles = { CONTRAT: 'Contrat de vacation', ATTESTATION: 'Attestation de travail', CERTIFICAT: 'Certificat de travail' };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {Object.entries(titles).map(([k, l]) => <Button key={k} variant="secondary" className="!py-1 text-xs" onClick={() => setOpen(k)}>{l}</Button>)}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-label={titles[open]} onClick={() => setOpen(null)}>
          <div className="mx-auto max-w-[820px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm">
              <strong>{titles[open]}</strong>
              {open !== 'CONTRAT' && (
                <label className="flex items-center gap-2">Signataire
                  <select value={sig} onChange={(e) => setSig(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1">{SIGNATORIES.map((s) => <option key={s.id} value={s.id}>{s.title.replace(',', '')}</option>)}</select>
                </label>
              )}
              <span className="flex gap-2">
                <Button onClick={() => printOnly('.staff-print', 'size: A4 portrait; margin: 0;', `${titles[open]} — ${agent.first} ${agent.last}`)}>Imprimer</Button>
                <Button variant="secondary" onClick={() => setOpen(null)}>Fermer</Button>
              </span>
              <p className="w-full text-xs text-slate-500">Les lignes pointillées correspondent aux informations non renseignées dans la fiche : complétez la fiche ou écrivez-les à la main.</p>
            </div>
            <div className="staff-print bg-white">
              {open === 'CONTRAT' ? <ContractSheet agent={agent} headName={headName} number={number} /> : <WorkSheet agent={agent} kind={open} signatory={signatory} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
