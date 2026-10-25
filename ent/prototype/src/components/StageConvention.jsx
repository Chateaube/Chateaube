import React, { useMemo, useState } from 'react';
import { Button, Card } from './ui.jsx';
import { STAGE_TYPES } from '../data/family.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { loadProfiles, profileKey } from '../profilesStore.js';
import { formatDateFr } from '../rules/calendar.js';
import { printOnly } from '../print.js';

// Conventions de stage imprimables, d'après les modèles de l'école (3e : découverte de l'entreprise et des
// métiers ; 2de : observation d'un métier ; 1re STMG : étude de terrain, même trame). Une convention par
// élève, ou toute la classe d'un coup (une convention par page). L'établissement, la cheffe d'établissement,
// la référente et les dates viennent de Paramètres › Établissement ; ce qui manque s'écrit à la main.
const DOTS = '………………………………………';
const fr = (iso) => (iso ? formatDateFr(iso) : DOTS);
const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '…… / …… / ……');

const KIND = {
  STAGE_3E: { cls: '3e', title: 'CLASSE DE 3e – DÉCOUVERTE DE L\'ENTREPRISE ET DES MÉTIERS', aim: 'Le stage correspond à une période temporaire d\'observation de la vie d\'une entreprise et de découverte du monde du travail.' },
  STAGE_2DE: { cls: '2de', title: 'CLASSE DE 2NDE – OBSERVATION D\'UN MÉTIER', aim: 'Le stage correspond à une période temporaire d\'observation de la vie d\'une entreprise et de découverte d\'un métier spécifique.' },
  TERRAIN_1STMG: { cls: '1re STMG', title: 'CLASSE DE 1re STMG – ÉTUDE DE TERRAIN (ÉTUDE DE GESTION)', aim: 'L\'étude de terrain permet à l\'élève d\'observer le fonctionnement d\'une organisation et d\'y mener des entretiens, dans le cadre de l\'étude de gestion de 1re STMG.', terrain: true },
};

const P = ({ children, style }) => <p style={{ margin: '1.2mm 0', ...style }}>{children}</p>;
const H = ({ children }) => <p style={{ fontWeight: 700, marginTop: '3mm' }}>{children}</p>;

/** Une convention (une page A4 recto-verso). */
function Convention({ kind, school, student }) {
  const k = KIND[kind];
  const ref = school.stageReferent ?? {};
  const dates = school.stageDates?.[kind] ?? {};
  const days = STAGE_TYPES.find((t) => t.id === kind)?.schoolDays ?? 5;
  const party = k.terrain ? 'l\'Organisation d\'accueil' : 'l\'Entreprise';
  return (
    <section style={{ pageBreakAfter: 'always', fontFamily: 'Arial, sans-serif', fontSize: '10pt', lineHeight: 1.4, color: '#000' }}>
      <p style={{ textAlign: 'right', fontSize: '8pt' }}>Convention {k.cls} · {school.year ?? '2026-2027'}</p>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '14pt' }}>CONVENTION DE STAGE</p>
      <p style={{ textAlign: 'center', fontWeight: 700 }}>{k.title}</p>
      <H>Article 1 – Objet de la Convention</H>
      <P>La présente convention règle les rapports de l'Organisme d'Accueil avec l'Établissement et le/la Stagiaire. Cette convention est portée à la connaissance de l'élève mineur et de ses représentants légaux. Ils s'engagent par leurs signatures à en accepter les clauses.</P>
      <P>ENTRE les soussignés,</P>
      <P><strong>1. L'Établissement</strong> — Lycée Chateaubriand Tamatave, sis {school.address}, représenté par {school.headName ? <strong>{school.headName}</strong> : DOTS}, Cheffe d'Établissement.</P>
      <P><strong>2. L'Organisme d'Accueil</strong> (écrire en lettres majuscules)</P>
      <P>Nom de l'entreprise : {DOTS}{DOTS} · Date de création (mois/année) : ……/…… · Effectif : ……</P>
      <P>Représentée par : {DOTS}{DOTS} · Fonction : {DOTS}</P>
      <P>Adresse du siège : {DOTS}{DOTS}{DOTS}</P>
      <P>Adresse du lieu du stage (si différente du siège) : {DOTS}{DOTS}</P>
      <P><strong>3. Le/la Stagiaire</strong> — {student ? <><strong>{profileKey(student)}</strong> · classe de {student.cls} · né·e le {dmy(student.birthDate)}</> : <>{DOTS}{DOTS} · classe de {k.cls} · né·e le …… / …… / ……</>}</P>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2mm', fontSize: '9.5pt' }}>
        <tbody><tr>
          <td style={{ width: '50%', border: '1px solid #000', padding: '2mm', verticalAlign: 'top' }}>
            <strong>Encadrement au sein de CHATEAUBRIAND — Référent·e de l'Établissement</strong>
            <br />Civilité : {ref.civility || DOTS}<br />Prénom et NOM : {ref.name || DOTS}<br />Fonction : {ref.role || DOTS}<br />Tél. : {ref.phone || DOTS}<br />Mail : {ref.mail || DOTS}
          </td>
          <td style={{ width: '50%', border: '1px solid #000', padding: '2mm', verticalAlign: 'top' }}>
            <strong>Encadrement au sein de l'Organisme d'Accueil — Maître de Stage</strong>
            <br />Civilité : {DOTS}<br />Prénom et NOM : {DOTS}<br />Fonction : {DOTS}<br />Tél. : {DOTS}<br />Mail : {DOTS}
          </td>
        </tr></tbody>
      </table>
      <H>Article 2 – Objectifs du Stage</H>
      <P>{k.aim} Les élèves pourront exécuter des tâches légères mais pas de travaux importants de production ni utiliser des machines ou matériels dangereux.</P>
      <H>Article 3 – Période de stage et durée hebdomadaire</H>
      <P>La durée du stage est fixée à {days} jours. La présente convention est conclue à partir du {fr(dates.from)} et prendra fin le {fr(dates.to)}, et se répartit selon l'horaire journalier suivant : matinée de ……h…… à ……h…… ; après-midi de ……h…… à ……h……</P>
      <P>La durée de présence du/de la Stagiaire ne peut excéder 7 heures par jour et 30 heures hebdomadaires s'il a moins de 15 ans. Les horaires journaliers ne peuvent prévoir sa présence sur le lieu de stage avant 6h00 ni après 20h00. Au-delà de 4h30 d'activité, une pause d'au moins 30 minutes doit être prévue, si possible en continu.</P>
      <H>Article 4 – Accueil et Encadrement</H>
      <P>Le stage fait l'objet d'un double encadrement : d'une part au sein de {party} par le Maître de Stage, chargé d'accueillir, d'aider, d'informer, d'encadrer et de guider le/la Stagiaire ; d'autre part au sein de l'Établissement, par le/la référent·e désigné·e dans la présente convention. Toute difficulté qui surviendrait dans la réalisation et le déroulement du stage, qu'elle soit constatée par le/la Stagiaire ou par le Maître de Stage, doit être portée à la connaissance du/de la référent·e et de l'Établissement.</P>
      <H>Article 5 – Suivi pédagogique</H>
      <P>1 – Attestation de stage : à l'issue du stage, {party} délivre une attestation au/à la Stagiaire ;<br />
        2 – Qualité du stage : à l'issue du stage, le/la Stagiaire transmet un document dans lequel il évalue la qualité de l'accueil dont il a bénéficié. Ce document n'est pas pris en compte dans son évaluation ;<br />
        3 – Évaluation de l'activité du/de la Stagiaire : à l'issue du stage, {party} renseigne une fiche d'évaluation de l'activité du/de la Stagiaire qu'il retourne au/à la référent·e au sein de Chateaubriand.</P>
      <H>Article 6 – Gratification</H>
      <P>La durée du stage ({days} jours) ne donne pas lieu à une rémunération. Toutefois, {party} peut, si elle le souhaite, accorder une gratification au/à la Stagiaire (par exemple : goodies, cadeaux, etc.).</P>
      <H>Article 7 – Discipline</H>
      <P>Le/la Stagiaire est tenu de se conformer aux règles internes de {party}. Il est soumis à sa discipline, notamment en ce qui concerne le règlement intérieur et les règles de sécurité et d'hygiène. Toute sanction disciplinaire ne peut être décidée que par Chateaubriand. Dans ce cas, {party} informe le/la référent·e et l'Établissement des manquements et fournit éventuellement les éléments constitutifs.</P>
      <H>Article 8 – Confidentialité</H>
      <P>Le/la Stagiaire prend l'engagement d'utiliser avec prudence les informations recueillies ou obtenues par lui-même durant son stage dans les travaux professionnels (rapport de stage notamment). Il revient au/à la Stagiaire de demander à son Maître de Stage l'autorisation de les utiliser.</P>
      <P style={{ marginTop: '4mm' }}>Fait à {DOTS}, le …… / …… / …………, en trois exemplaires.</P>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2mm', fontSize: '9pt' }}>
        <tbody>
          {[[`Le Chef ou Représentant de ${k.terrain ? 'l\'Organisation' : 'l\'Entreprise'} et cachet (obligatoire)`, 'La Cheffe d\'Établissement'], ['Le Maître de Stage', 'Le/La Référent·e'], ['Le Représentant Légal', 'Le/La Stagiaire']].map((row) => (
            <tr key={row[0]}>{row.map((w) => <td key={w} style={{ width: '50%', border: '1px solid #000', padding: '1.5mm', height: '22mm', verticalAlign: 'top', fontWeight: 700 }}>{w}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function StageConvention({ settings = DEFAULT_SETTINGS }) {
  const school = { ...DEFAULT_SETTINGS.school, ...settings.school };
  const profiles = useMemo(() => loadProfiles(), []);
  const [kind, setKind] = useState('STAGE_3E');
  const [who, setWho] = useState('ALL'); // 'ALL' : toute la classe ; 'BLANK' : une convention vierge ; sinon un élève
  const k = KIND[kind];
  const classStudents = profiles.filter((p) => (k.cls === '1re STMG' ? p.cls === '1re STMG' : p.cls === k.cls || p.cls?.startsWith(`${k.cls} `)));
  const list = who === 'BLANK' ? [null] : who === 'ALL' ? (classStudents.length ? classStudents : [null]) : [profiles.find((p) => p.id === who) ?? null];
  const field = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const missing = [!school.headName && 'le nom de la cheffe d\'établissement', !school.stageDates?.[kind]?.from && 'les dates du stage'].filter(Boolean);
  return (
    <Card title="Conventions à imprimer" subtitle="D'après les modèles de l'école : stage de 3e, stage de 2de, étude de terrain de 1re STMG. Une convention par élève, une par page.">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-600">Convention<select value={kind} onChange={(e) => { setKind(e.target.value); setWho('ALL'); }} className={field}>{STAGE_TYPES.map((x) => <option key={x.id} value={x.id}>{x.level} — {x.label}</option>)}</select></label>
        <label className="text-xs text-slate-600">Pour<select value={who} onChange={(e) => setWho(e.target.value)} className={field}>
          <option value="ALL">Toute la classe ({classStudents.length})</option>
          <option value="BLANK">Une convention vierge</option>
          {classStudents.map((p) => <option key={p.id} value={p.id}>{profileKey(p)}</option>)}
        </select></label>
        <div className="flex items-end"><Button className="w-full" onClick={() => printOnly('.convention-print', 'size: A4 portrait; margin: 12mm;', `Conventions ${k.cls}`, { footer: false })}>Imprimer {list.length > 1 ? `les ${list.length} conventions` : 'la convention'}</Button></div>
      </div>
      {missing.length > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">À compléter dans Paramètres › Établissement : {missing.join(' et ')} (sinon, des pointillés à remplir à la main).</p>}
      <div className="convention-print hidden" aria-hidden="true">{list.map((s, i) => <Convention key={s?.id ?? i} kind={kind} school={school} student={s} />)}</div>
    </Card>
  );
}
