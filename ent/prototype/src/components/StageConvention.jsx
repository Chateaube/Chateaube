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
const fr = (iso) => (iso ? formatDateFr(iso) : '');
const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const KIND = {
  STAGE_3E: { cls: '3e', title: 'CLASSE DE 3e – DÉCOUVERTE DE L\'ENTREPRISE ET DES MÉTIERS', aim: 'Le stage correspond à une période temporaire d\'observation de la vie d\'une entreprise et de découverte du monde du travail.' },
  STAGE_2DE: { cls: '2de', title: 'CLASSE DE 2NDE – OBSERVATION D\'UN MÉTIER', aim: 'Le stage correspond à une période temporaire d\'observation de la vie d\'une entreprise et de découverte d\'un métier spécifique.' },
};

// Mise en page imprimée : un libellé, puis une ligne pointillée qui remplit exactement le reste de la
// largeur (la valeur, si elle est connue, s'écrit dessus). Plus de pointillés qui débordent à la ligne.
const BASE = { fontFamily: 'Arial, sans-serif', fontSize: '10pt', lineHeight: 1.4, color: '#000' };
const P = ({ children, style }) => <p style={{ margin: '1.2mm 0', textAlign: 'justify', ...style }}>{children}</p>;
const H = ({ children }) => <p style={{ fontWeight: 700, margin: '3mm 0 1mm' }}>{children}</p>;
/** Champ : libellé + ligne pointillée jusqu'au bout (ou jusqu'au champ voisin dans une rangée). */
function F({ label, value, grow = 1 }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: '1.5mm', flex: grow, minWidth: 0 }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ flex: 1, minWidth: '12mm', borderBottom: '1px dotted #000', minHeight: '4.2mm', paddingLeft: '1mm', fontWeight: 700 }}>{value}</span>
    </span>
  );
}
const Row = ({ children }) => <div style={{ display: 'flex', gap: '6mm', margin: '1.6mm 0' }}>{children}</div>;
/** Blanc dans une phrase (date, heure) : largeur fixe, ne coupe pas la ligne. */
const B = ({ w = '38mm', children }) => <span style={{ display: 'inline-block', minWidth: w, borderBottom: children ? 'none' : '1px dotted #000', fontWeight: children ? 700 : 400, textAlign: 'center' }}>{children}</span>;
const Sign = ({ rows }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2mm', fontSize: '9pt', pageBreakInside: 'avoid' }}>
    <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((w) => <td key={w} style={{ width: `${100 / row.length}%`, border: '1px solid #000', padding: '1.5mm', height: '24mm', verticalAlign: 'top', fontWeight: 700 }}>{w}</td>)}</tr>)}</tbody>
  </table>
);

/** Convention de stage (3e, 2de) : le texte des conventions de l'école. */
function Convention({ kind, school, student }) {
  const k = KIND[kind];
  const ref = school.stageReferent ?? {};
  const dates = school.stageDates?.[kind] ?? {};
  return (
    <section style={{ ...BASE, pageBreakAfter: 'always' }}>
      <p style={{ textAlign: 'right', fontSize: '8pt', margin: 0 }}>CDS {k.cls} / {school.year ?? '2026-2027'}</p>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '14pt', margin: '1mm 0 0' }}>CONVENTION DE STAGE</p>
      <p style={{ textAlign: 'center', fontWeight: 700, margin: '0 0 2mm' }}>{k.title}</p>
      <H>Article 1 – Objet de la Convention</H>
      <P>La présente convention règle les rapports de l'Organisme d'Accueil avec l'Établissement et le/la Stagiaire. Cette convention est portée à la connaissance de l'élève mineur et de ses représentants légaux. Ils s'engagent par leurs signatures à en accepter les clauses.</P>
      <P>ENTRE les soussignés,</P>
      <P style={{ fontWeight: 700, marginTop: '2mm' }}>1. L'Établissement</P>
      <P style={{ margin: 0 }}>Lycée Chateaubriand Tamatave, sis {school.address},</P>
      <Row><F label="Représenté par" value={school.headName} grow={3} /><span>, Cheffe d'Établissement</span></Row>
      <P style={{ fontWeight: 700, marginTop: '2mm' }}>2. L'Organisme d'Accueil <span style={{ fontWeight: 400 }}>(écrire en lettres majuscules)</span></P>
      <Row><F label="Nom de l'entreprise :" /></Row>
      <Row><F label="Date de création (mois/année) :" grow={2} /><F label="Effectif :" /></Row>
      <Row><F label="Représentée par :" grow={2} /><F label="Fonction :" /></Row>
      <Row><F label="Adresse du siège de l'entreprise :" /></Row>
      <Row><F label="Adresse du lieu du stage (si différente du siège) :" /></Row>
      <P style={{ fontWeight: 700, marginTop: '2mm' }}>3. Le/la Stagiaire</P>
      <Row><F label="Nom et prénom(s) :" value={student ? profileKey(student) : ''} grow={3} /><F label="Né·e le :" value={student ? dmy(student.birthDate) : ''} /></Row>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2mm', fontSize: '9.5pt' }}>
        <tbody><tr>
          {[['Encadrement au sein de CHATEAUBRIAND', 'Référent·e de l\'Établissement', ref], ['Encadrement au sein de l\'Organisme d\'Accueil', 'Maître de Stage', {}]].map(([t, w, v]) => (
            <td key={t} style={{ width: '50%', border: '1px solid #000', padding: '2mm', verticalAlign: 'top' }}>
              <p style={{ fontWeight: 700, margin: 0 }}>{t}</p><p style={{ margin: '0 0 1mm', fontStyle: 'italic' }}>{w}</p>
              {[['Civilité :', v.civility], ['Prénom et NOM :', v.name], ['Fonction :', v.role], ['Tél. :', v.phone], ['Mail :', v.mail]].map(([l, x]) => <div key={l} style={{ display: 'flex', margin: '1mm 0' }}><F label={l} value={x} /></div>)}
            </td>
          ))}
        </tr></tbody>
      </table>
      <H>Article 2 – Objectifs du Stage</H>
      <P>{k.aim} Les élèves pourront exécuter des tâches légères mais pas de travaux importants de production ni utiliser des machines ou matériels dangereux.</P>
      <H>Article 3 – Période de stage et durée hebdomadaire</H>
      <P>La durée du stage est fixée à 5 jours. La présente convention est conclue à partir du <B>{fr(dates.from)}</B> et prendra fin le <B>{fr(dates.to)}</B>, et se répartit selon l'horaire journalier suivant :</P>
      <Row><span style={{ width: '25mm' }}>Matinée :</span><F label="de" /><F label="à" /></Row>
      <Row><span style={{ width: '25mm' }}>Après-midi :</span><F label="de" /><F label="à" /></Row>
      <P>La durée de présence du/de la Stagiaire ne peut excéder 7 heures par jour et 30 heures hebdomadaires s'il a moins de 15 ans. Les horaires journaliers ne peuvent prévoir sa présence sur le lieu de stage avant 6h00 ni après 20h00. Au-delà de 4h30 d'activité, une pause d'au moins 30 minutes doit être prévue, si possible en continu.</P>
      <H>Article 4 – Accueil et Encadrement</H>
      <P>Le stage fait l'objet d'un double encadrement : d'une part au sein de l'Entreprise par le Maître de Stage, chargé d'accueillir, d'aider, d'informer, d'encadrer et de guider le/la Stagiaire ; d'autre part au sein de l'Établissement, par le/la référent·e désigné·e dans la présente convention. Toute difficulté qui surviendrait dans la réalisation et le déroulement du stage, qu'elle soit constatée par le/la Stagiaire ou par le Maître de Stage, doit être portée à la connaissance du/de la référent·e et de l'Établissement.</P>
      <H>Article 5 – Suivi pédagogique</H>
      <P>1 – Attestation de stage : à l'issue du stage, l'Entreprise délivre une attestation au/à la Stagiaire ;<br />
        2 – Qualité du stage : à l'issue du stage, le/la Stagiaire transmet un document dans lequel il évalue la qualité de l'accueil dont il a bénéficié au sein de l'Entreprise. Ce document n'est pas pris en compte dans son évaluation ;<br />
        3 – Évaluation de l'activité du/de la Stagiaire : à l'issue du stage, l'Entreprise renseigne une fiche d'évaluation de l'activité du/de la Stagiaire qu'elle retourne au/à la référent·e au sein de Chateaubriand.</P>
      <H>Article 6 – Gratification</H>
      <P>La durée du stage (5 jours) ne donne pas lieu à une rémunération. Toutefois, l'Entreprise peut, si elle le souhaite, accorder une gratification au/à la Stagiaire (par exemple : goodies, cadeaux, etc.).</P>
      <H>Article 7 – Discipline</H>
      <P>Le/la Stagiaire est tenu de se conformer aux règles internes de l'Entreprise. Il est soumis à la discipline de l'Entreprise, notamment en ce qui concerne le règlement intérieur, les règles de sécurité et d'hygiène. Toute sanction disciplinaire ne peut être décidée que par Chateaubriand. Dans ce cas, l'Entreprise informe le/la référent·e et l'Établissement des manquements et fournit éventuellement les éléments constitutifs.</P>
      <H>Article 8 – Confidentialité</H>
      <P>Le/la Stagiaire prend l'engagement d'utiliser avec prudence les informations recueillies ou obtenues par lui-même durant son stage dans les travaux professionnels (rapport de stage notamment). Il revient au/à la Stagiaire de demander à son Maître de Stage l'autorisation de les utiliser.</P>
      <Row><F label="Fait à" grow={2} /><F label=", le" /><span>, en trois exemplaires.</span></Row>
      <Sign rows={[['Signature du Chef ou Représentant de l\'Entreprise et cachet (obligatoire)', 'La Cheffe d\'Établissement'], ['Le Maître de Stage', 'Le/La Référent·e'], ['Le Représentant Légal', 'Le/La Stagiaire']]} />
    </section>
  );
}

/** 1re STMG — étude de gestion : lettre de demande d'entretien à une organisation (modèle de l'école). */
function GestionLetter({ school, student, date }) {
  const name = student ? profileKey(student) : '';
  const first = student ? (student.usualName || student.firstName) : '';
  const f = student?.sex === 'F'; const m = student?.sex === 'M';
  const e = f ? 'e' : m ? '' : '(e)'; const il = f ? 'elle' : m ? 'il' : 'il/elle';
  const who = first || <B w="30mm" />;
  return (
    <section style={{ ...BASE, fontSize: '10.5pt', lineHeight: 1.5, pageBreakAfter: 'always' }}>
      <p style={{ textAlign: 'right' }}>À Toamasina, le {formatDateFr(date).replace(/^\S+ /, '')}</p>
      <p style={{ marginTop: '6mm' }}>À l'attention des responsables de l'organisation,</p>
      <p style={{ marginTop: '4mm' }}><strong>Objet : Demande d'entretien dans le cadre de l'épreuve anticipée d'Étude de gestion – Bac STMG</strong></p>
      <p style={{ marginTop: '4mm' }}>Madame, Monsieur,</p>
      <P>La direction du Lycée Chateaubriand a l'honneur de vous solliciter au nom de notre élève, {name ? <strong>{name}</strong> : <B w="60mm" />}, scolarisé{e} en classe de première Sciences et Technologies du Management et de la Gestion (STMG).</P>
      <P>Dans le cadre de sa formation au baccalauréat technologique, {who} doit réaliser une Étude de gestion, une épreuve anticipée qui constitue une part importante de son examen. Ce travail individuel vise à appliquer des concepts de gestion (tels que la création de valeur, la performance, le rôle de l'individu ou l'impact du numérique) à l'analyse concrète du fonctionnement d'une organisation (entreprise, organisation publique ou association) sélectionnée par l'élève.</P>
      <P>Pour mener à bien son étude, {who} a besoin de recueillir des informations auprès d'un professionnel. C'est pourquoi {il} sollicite la possibilité d'un bref entretien (20 à 30 minutes) avec l'un de vos collaborateurs.</P>
      <P>Nous tenons à vous garantir le caractère strictement scolaire et confidentiel de cette démarche :</P>
      <ul style={{ margin: '1mm 0 1mm 6mm', paddingLeft: '5mm', listStyle: 'disc' }}>
        <li>L'étude est encadrée par un enseignant de notre établissement{school.sgnTeacher ? ` (${school.sgnTeacher})` : ''}.</li>
        <li>Les informations communiquées seront utilisées uniquement pour la rédaction du dossier scolaire et sa soutenance orale.</li>
        <li>L'élève s'engage à respecter une totale confidentialité et peut, à votre demande, vous transmettre une synthèse de ses travaux.</li>
      </ul>
      <P>Votre collaboration est une aide précieuse pour concrétiser cet apprentissage et permet à nos élèves de faire un premier lien essentiel entre les enseignements théoriques et la réalité du monde professionnel. Nous vous remercions par avance de l'accueil que vous voudrez bien lui réserver.</P>
      <P>Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</P>
      <table style={{ width: '100%', marginTop: '8mm', fontSize: '10pt' }}><tbody><tr>
        {['L\'Élève', 'L\'enseignant référent en Sciences de Gestion', 'La Direction'].map((w) => <td key={w} style={{ width: '33%', verticalAlign: 'top', height: '28mm', textAlign: 'center', fontWeight: 700 }}>{w}</td>)}
      </tr></tbody></table>
    </section>
  );
}

export default function StageConvention({ settings = DEFAULT_SETTINGS }) {
  const school = { ...DEFAULT_SETTINGS.school, ...settings.school };
  const profiles = useMemo(() => loadProfiles(), []);
  const [kind, setKind] = useState('STAGE_3E');
  const [who, setWho] = useState('ALL'); // 'ALL' : toute la classe ; 'BLANK' : une convention vierge ; sinon un élève
  const letter = kind === 'TERRAIN_1STMG';
  const k = KIND[kind] ?? { cls: '1re STMG' };
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const classStudents = profiles.filter((p) => (k.cls === '1re STMG' ? p.cls === '1re STMG' : p.cls === k.cls || p.cls?.startsWith(`${k.cls} `)));
  const list = who === 'BLANK' ? [null] : who === 'ALL' ? (classStudents.length ? classStudents : [null]) : [profiles.find((p) => p.id === who) ?? null];
  const field = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const missing = letter ? [] : [!school.headName && 'le nom de la cheffe d\'établissement', !school.stageDates?.[kind]?.from && 'les dates du stage'].filter(Boolean);
  return (
    <Card title="Conventions et lettres à imprimer" subtitle="D'après les modèles de l'école : conventions de stage de 3e et de 2de, lettre de demande d'entretien pour l'étude de gestion de 1re STMG. Un document par élève, un par page.">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-600">Document<select value={kind} onChange={(e) => { setKind(e.target.value); setWho('ALL'); }} className={field}>{STAGE_TYPES.map((x) => <option key={x.id} value={x.id}>{x.level} — {x.id === 'TERRAIN_1STMG' ? 'Étude de gestion : lettre de demande d\'entretien' : `Convention : ${x.label}`}</option>)}</select></label>
        <label className="text-xs text-slate-600">Pour<select value={who} onChange={(e) => setWho(e.target.value)} className={field}>
          <option value="ALL">Toute la classe ({classStudents.length})</option>
          <option value="BLANK">{letter ? 'Une lettre vierge' : 'Une convention vierge'}</option>
          {classStudents.map((p) => <option key={p.id} value={p.id}>{profileKey(p)}</option>)}
        </select></label>
        <div className="flex items-end"><Button className="w-full" onClick={() => printOnly('.convention-print', 'size: A4 portrait; margin: 14mm 15mm;', letter ? `Lettres étude de gestion ${k.cls}` : `Conventions ${k.cls}`, { footer: false })}>Imprimer {list.length > 1 ? `les ${list.length} ${letter ? 'lettres' : 'conventions'}` : letter ? 'la lettre' : 'la convention'}</Button></div>
        {letter && <label className="text-xs text-slate-600">Date de la lettre<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>}
      </div>
      {missing.length > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">À compléter dans Paramètres › Établissement : {missing.join(' et ')} (sinon, des pointillés à remplir à la main).</p>}
      <div className="convention-print hidden" aria-hidden="true">{list.map((s, i) => (letter ? <GestionLetter key={s?.id ?? i} school={school} student={s} date={date} /> : <Convention key={s?.id ?? i} kind={kind} school={school} student={s} />))}</div>
    </Card>
  );
}
