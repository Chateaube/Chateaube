import React, { useState } from 'react';
import { Button } from './ui.jsx';
import logo from '../assets/logo-chateaubriand.png';
import { SIGNATORIES } from './Certificate.jsx';
import { frDate, schoolYearOf } from '../rules/documents.js';
import { printOnly } from '../print.js';
import { today } from '../clock.js';
import { loadSignatures } from '../signatureStore.js';
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

/** Contrat de travail (vacation d'enseignement, CDI, CDD ou stage), sur la base du contrat type de l'école. */
export function ContractSheet({ agent: a, headName, number, date = today() }) {
  const y = schoolYearOf(a.entry || date);
  const svc = (a.services ?? []).filter((s) => s.subject);
  const h = weeklyHours(svc);
  const vac = (a.contract ?? 'Vacataire') === 'Vacataire';
  const teacher = svc.length > 0 || a.role === 'PROFESSEUR';
  const P = vac ? fem(a, 'Le Vacataire', 'La Vacataire') : fem(a, 'Le Salarié', 'La Salariée');
  const p = P.replace(/^L/, 'l');
  const job = String(a.title && !/^professeur$/i.test(a.title) ? a.title : teacher ? fem(a, 'professeur', 'professeure') : (a.title || '')).toLowerCase();
  const TITLE = { Vacataire: 'CONTRAT DE VACATION D\'ENSEIGNEMENT', CDI: 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE', CDD: 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE', Stagiaire: 'CONTRAT DE STAGE' };
  const mode = a.payMode ?? 'HORAIRE';
  return (
    <div className="staff-doc w-full max-w-[210mm] bg-white px-[14mm] py-[10mm] text-[11px] leading-snug text-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <Header date={date} />
      <h2 className="mt-5 text-center text-[15px] font-bold tracking-wide">{TITLE[a.contract ?? 'Vacataire'] ?? 'CONTRAT DE TRAVAIL'}</h2>
      <p className="text-center">Contrat n° {blank(number, '25mm')} · Conformément au Code du travail de la République de Madagascar</p>
      <p className="mt-4 font-bold">ENTRE LES SOUSSIGNÉS :</p>
      <p className="mt-1">{SCHOOL.name}, 27 Rue Nationale, 501 Tamatave, représentée par {headName ? `Madame ${headName}` : blank('', '55mm')}, en sa qualité de Cheffe d'établissement, ci-après dénommée « L'Employeur »,</p>
      <p className="mt-2 font-bold">ET</p>
      <p className="mt-1">{fullName(a)}, demeurant à {blank(a.address, '70mm')}, {a.idType || 'pièce d\'identité'} n° {blank(a.idNumber, '35mm')}, délivré{a.idType === 'CIN' || a.idType === 'Carte de résident' ? 'e' : ''} le {blank(frDate(a.idIssued), '25mm')} à {blank(a.idPlace, '35mm')}, ci-après {fem(a, 'dénommé', 'dénommée')} « {P} ».</p>
      <p className="mt-2">Il a été convenu ce qui suit :</p>

      <Art n={1} title="OBJET DU CONTRAT">
        <p>Le présent contrat régit les conditions d'engagement de {fullName(a)} en qualité de {blank(job, '45mm')}{vac ? ` vacataire` : ''}{teacher && svc.length ? ` (${svc.map((s) => s.subject).join(', ')})` : ''}.</p>
      </Art>
      <Art n={2} title="NATURE ET DURÉE">
        {vac && <p>Le présent contrat est un contrat de vacation, prenant effet à compter du {blank(longDate(a.entry), '45mm')}{a.exit ? ` et prenant fin le ${longDate(a.exit)}` : `, pour l'année scolaire ${y}–${y + 1}`}.</p>}
        {a.contract === 'CDI' && <p>Le présent contrat est conclu pour une durée indéterminée, à compter du {blank(longDate(a.entry), '45mm')}. Une période d'essai de trois (3) mois est prévue à compter de l'entrée en fonction.</p>}
        {a.contract === 'CDD' && <p>Le présent contrat est conclu pour une durée déterminée, du {blank(longDate(a.entry), '40mm')} au {blank(longDate(a.exit), '40mm')}.</p>}
        {a.contract === 'Stagiaire' && <p>Le présent contrat de stage court du {blank(longDate(a.entry), '40mm')} au {blank(longDate(a.exit), '40mm')}.</p>}
        {teacher && <p>L'activité d'enseignement étant liée au calendrier scolaire, aucune heure de cours n'est due pendant les vacances scolaires ni en juillet et août.</p>}
      </Art>
      <Art n={3} title="LIEU DE TRAVAIL">
        <p>{P} exerce ses fonctions sur le site de Tamatave de l'École Chateaubriand, 27 Rue Nationale, 501 Tamatave.</p>
      </Art>
      <Art n={4} title="MISSIONS">
        {teacher ? (svc.length ? (
          <>
            <p>{P} assure les enseignements suivants{h ? `, pour un volume prévisionnel de ${String(h).replace('.', ',')} heure${h > 1 ? 's' : ''} par semaine` : ''} :</p>
            <ul className="ml-4 list-disc">{svc.map((s, i) => <li key={i}>{s.subject} : {s.classes?.length ? s.classes.join(', ') : blank('', '40mm')}{s.hours ? ` — ${String(s.hours).replace('.', ',')} h / semaine` : ''}</li>)}</ul>
            <p>Ses missions comprennent la préparation des cours, l'évaluation des élèves, la saisie des notes et des appréciations dans l'ENT, ainsi que la participation aux conseils de classe et réunions pédagogiques. Cette répartition peut évoluer selon les besoins du service, en accord avec la Direction.</p>
          </>
        ) : <p className="text-left">{P} assure les enseignements suivants : {blank('', '110mm')}</p>)
          : <p className="text-left">{P} exerce les fonctions de {blank(job, '45mm')}, selon les consignes de la Direction : {blank('', '80mm')}</p>}
      </Art>
      <Art n={5} title="RÉMUNÉRATION">
        {mode === 'HORAIRE' && <><p>{P} est {fem(a, 'rémunéré', 'rémunérée')} à l'heure effectivement effectuée et validée, au taux horaire de {blank(ar(a.rate), '35mm')}.</p><p>Un décompte des heures réellement effectuées est établi en fin de mois. Les heures non effectuées ne sont pas rémunérées ; les heures supplémentaires validées par la Direction sont payées au même taux.</p></>}
        {mode === 'FIXE' && <p>{P} perçoit une rémunération mensuelle fixe de {blank(ar(a.monthly), '35mm')}.</p>}
        {mode === 'PRORATA' && <p>{P} perçoit une rémunération mensuelle de {blank(ar(a.monthly), '35mm')}, calculée au prorata {a.prorataBase === 'SEMAINES' ? 'des semaines de travail effectif du mois' : 'des jours du mois à compter de la date d\'entrée (et jusqu\'à la date de sortie le cas échéant)'}.</p>}
        <p>Le paiement est mensuel, en espèces ou, à défaut, par chèque ou virement.</p>
      </Art>
      <Art n={6} title="ABSENCES ET RETARDS">
        <p>Toute absence ou tout retard doit être signalé au bureau dans les plus brefs délais.{teacher ? ' Au-delà de 15 minutes de retard, le cours est annulé et doit être rattrapé.' : ''}{mode === 'HORAIRE' ? ' Les absences ne donnent lieu à aucune rémunération.' : ' Les absences non justifiées peuvent donner lieu à une retenue sur salaire.'}</p>
      </Art>
      <Art n={7} title="CONFIDENTIALITÉ">
        <p>{teacher ? 'Les documents pédagogiques fournis par l\'École restent sa propriété exclusive et sont restitués en fin de contrat. ' : ''}{P} est {fem(a, 'tenu', 'tenue')} à une stricte confidentialité, pendant et après le contrat, sur toutes les informations non publiques dont {fem(a, 'il', 'elle')} a connaissance (vie scolaire des élèves, données des familles, informations internes).</p>
      </Art>
      <Art n={8} title="FIN DU CONTRAT">
        <p>La rupture du contrat est soumise aux dispositions du Code du travail malgache. Chaque partie respecte un préavis, de préférence à la fin d'un trimestre scolaire dans l'intérêt de la continuité du service. Un certificat de travail est remis à {p} à la fin de son engagement.</p>
      </Art>
      <p className="mt-4">Fait à Tamatave, le {frDate(date)}, en deux exemplaires originaux.</p>
      <Sign signatory={SIGNATORIES[1]} both />
    </div>
  );
}

const LONG = { SVT: 'Sciences de la Vie et de la Terre (SVT)', 'Spécialité SVT': 'Sciences de la Vie et de la Terre (SVT, spécialité)', SES: 'Sciences Économiques et Sociales (SES)', SNT: 'Sciences Numériques et Technologie (SNT)', EMC: 'Enseignement Moral et Civique (EMC)', EPS: 'Éducation Physique et Sportive (EPS)' };
const de = (w) => (/^[aeiouyhàâéèêîôû]/i.test(w) ? `d'${w}` : `de ${w}`);
const monthDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1er ') : null);

/** Attestation de travail (en poste) ou certificat de travail (fin d'engagement), sur le modèle de l'école. */
export function WorkSheet({ agent: a, kind, signatory, appreciation = true, signatureUrl, stampUrl, date = today() }) {
  const cert = kind === 'CERTIFICAT';
  const subjects = [...new Set((a.services ?? []).map((s) => s.subject).filter(Boolean))].map((s) => LONG[s] ?? s);
  const job = String((a.title && !/^professeur$/i.test(a.title) ? a.title : (subjects.length || a.role === 'PROFESSEUR' ? fem(a, 'enseignant', 'enseignante') : a.title)) ?? '').toLowerCase();
  const civ = isF(a) ? 'Mme' : 'M.';
  const head = signatory.id === 'CHEFFE' ? 'Cheffe de l\'établissement' : 'Directrice adjointe de l\'établissement';
  return (
    <div className="staff-doc flex min-h-[270mm] w-full max-w-[210mm] flex-col bg-white px-[18mm] py-[12mm] text-[12.5px] leading-relaxed text-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <Header date={date} />
      <h2 className="mt-12 text-center text-[17px] font-bold tracking-wide">{cert ? 'CERTIFICAT DE TRAVAIL' : 'ATTESTATION DE TRAVAIL'}</h2>
      <p className="mt-10">Je soussignée, {blank(signatory.name, '50mm')}, {head} Chateaubriand Tamatave,<br />situé au 27 rue Nationale, 501 Tamatave, Madagascar,</p>
      <p className="mt-5">{cert ? 'certifie que :' : 'atteste que :'}</p>
      <p className="mt-5"><strong>{civ} {String(a.last).toUpperCase()} {a.first}</strong>, {fem(a, 'né', 'née')} le {blank(monthDate(a.birthDate), '35mm')}, à {blank(a.birthPlace, '35mm')},<br />
        {cert
          ? <>a exercé les fonctions {de(job || '…')} au sein de notre établissement<br />du {blank(monthDate(a.entry), '35mm')} au {blank(monthDate(a.exit), '35mm')}</>
          : <>exerce les fonctions {de(job || '…')} au sein de notre établissement<br />depuis le {blank(monthDate(a.entry), '35mm')} à ce jour</>}
        {subjects.length ? <>,<br />{subjects.length > 1 ? 'dans les disciplines suivantes' : 'dans la discipline suivante'} : {subjects.join(', ')}.</> : '.'}</p>
      {appreciation && <p className="mt-5">{fem(a, 'Il', 'Elle')} {cert ? 'a exercé' : 'exerce'} ses fonctions avec sérieux, professionnalisme et engagement.</p>}
      {cert && <p className="mt-3">{fem(a, 'Il', 'Elle')} nous quitte libre de tout engagement.</p>}
      <p className="mt-5">{cert ? 'Le présent certificat est délivré' : 'La présente attestation est délivrée'} pour servir et valoir ce que de droit.</p>
      <div className="relative mt-16 self-end pr-6 text-left">
        {stampUrl && <img src={stampUrl} alt="Tampon" className="absolute -left-[32mm] -top-[4mm] h-[30mm] w-[30mm] object-contain opacity-90" style={{ mixBlendMode: 'multiply' }} />}
        <p>{signatory.title.replace(',', '')}</p>
        {signatureUrl ? <img src={signatureUrl} alt="Signature" className="h-[16mm] max-w-[48mm] object-contain" style={{ mixBlendMode: 'multiply' }} /> : <div className="h-[18mm]" />}
        <p><strong>{signatory.name || ' '}</strong></p>
      </div>
    </div>
  );
}

/** Boutons de la fiche : aperçu puis impression (Direction). */
export function StaffDocumentsButtons({ agent, headName, number }) {
  const [open, setOpen] = useState(null);
  const [sig, setSig] = useState(SIGNATORIES[1].id);
  const base = SIGNATORIES.find((s) => s.id === sig);
  const signatory = base.id === 'CHEFFE' ? { ...base, name: headName || base.name } : { ...base, name: base.name };
  const [appr, setAppr] = useState(true); const [elec, setElec] = useState(false);
  const sigs = loadSignatures();
  const signatureUrl = elec ? sigs.officials?.[sig]?.dataUrl : null; const stampUrl = elec ? sigs.stamp : null;
  const titles = { CONTRAT: 'Contrat de travail', ATTESTATION: 'Attestation de travail', CERTIFICAT: 'Certificat de travail' };
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
              {open !== 'CONTRAT' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={appr} onChange={(e) => setAppr(e.target.checked)} />Phrase « sérieux, professionnalisme et engagement »</label>}
              {open !== 'CONTRAT' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={elec} onChange={(e) => setElec(e.target.checked)} />Signature et tampon électroniques{elec && !sigs.officials?.[sig]?.dataUrl ? ' (signature non déposée : Documents à signer)' : ''}</label>}
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
              {open === 'CONTRAT' ? <ContractSheet agent={agent} headName={headName} number={number} /> : <WorkSheet agent={agent} kind={open} signatory={signatory} appreciation={appr} signatureUrl={signatureUrl} stampUrl={stampUrl} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
