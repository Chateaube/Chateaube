import React, { useState } from 'react';
import { Button, Card } from './ui.jsx';
import { STAGE_TYPES } from '../data/family.js';
import { printOnly } from '../print.js';

// Conventions imprimables : 3e (observation), 2de (stage de seconde), 1re STMG (étude de terrain).
// Le modèle est pré-rempli avec ce qui est connu ; le reste s'écrit à la main. À faire relire par la
// Direction avant la première utilisation (texte de base, pas un modèle officiel).
const blank = (n = 1) => Array.from({ length: n }, () => '……………………………………………………');
const fr = (iso) => (iso ? iso.split('-').reverse().join('/') : '…… / …… / ……');

export default function StageConvention({ students = [] }) {
  const [type, setType] = useState(STAGE_TYPES[0].id);
  const [d, setD] = useState({ student: '', cls: '', company: '', from: '', to: '' });
  const t = STAGE_TYPES.find((x) => x.id === type);
  const terrain = type === 'TERRAIN_1STMG';
  const inputCls = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const article = (n, title, text) => <div style={{ marginTop: '3mm' }}><p style={{ fontWeight: 700 }}>Article {n} — {title}</p><p>{text}</p></div>;
  return (
    <Card title="Conventions à imprimer" subtitle="Un modèle par type : stage de 3e, stage de 2de, étude de terrain de 1re STMG. Ce qui n'est pas rempli s'écrit à la main.">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-600">Type<select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>{STAGE_TYPES.map((x) => <option key={x.id} value={x.id}>{x.level} — {x.label}</option>)}</select></label>
        <label className="text-xs text-slate-600">Élève (facultatif)<input list="conv-eleves" value={d.student} onChange={(e) => setD({ ...d, student: e.target.value })} className={inputCls} /></label>
        <label className="text-xs text-slate-600">{terrain ? 'Organisation étudiée' : 'Entreprise ou organisme'} (facultatif)<input value={d.company} onChange={(e) => setD({ ...d, company: e.target.value })} className={inputCls} /></label>
        <label className="text-xs text-slate-600">Du<input type="date" value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })} className={inputCls} /></label>
        <label className="text-xs text-slate-600">Au<input type="date" value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} className={inputCls} /></label>
        <div className="flex items-end"><Button className="w-full" onClick={() => printOnly('.convention-print', 'size: A4 portrait; margin: 15mm;', `Convention — ${t.label}`, { footer: false })}>Imprimer la convention</Button></div>
        <datalist id="conv-eleves">{students.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      <p className="mt-2 text-xs text-slate-600">Texte de base à faire relire par la Direction avant le premier usage.</p>

      {/* page imprimée (cachée à l'écran) */}
      <div className="convention-print hidden print:block" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt', lineHeight: 1.45, color: '#000' }}>
        <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt' }}>ÉCOLE CHATEAUBRIAND — TAMATAVE</p>
        <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '14pt', marginTop: '2mm' }}>CONVENTION {terrain ? 'D\'ÉTUDE DE TERRAIN' : 'DE STAGE'}</p>
        <p style={{ textAlign: 'center' }}>{t.label} · classe de {t.level} · {t.duration}</p>
        <p style={{ marginTop: '4mm' }}>Entre <strong>l'École Chateaubriand</strong>, représentée par sa cheffe d'établissement,</p>
        <p>et {terrain ? 'l\'organisation' : 'l\'entreprise ou l\'organisme'} : <strong>{d.company || blank()[0]}</strong>, représenté(e) par {blank()[0]},</p>
        <p>adresse : {blank()[0]} · téléphone : {blank()[0]},</p>
        <p>concernant l'élève <strong>{d.student || blank()[0]}</strong>, classe de {t.level}, et son représentant légal {blank()[0]}.</p>
        {article(1, 'Objet', terrain
          ? 'La présente convention permet à l\'élève, seul ou en petit groupe, d\'observer l\'organisation et d\'y mener des entretiens dans le cadre de l\'étude de gestion de 1re STMG. Aucune tâche productive n\'est confiée à l\'élève.'
          : 'La présente convention organise une période d\'observation en milieu professionnel. L\'élève découvre les métiers et le fonctionnement de la structure ; aucune tâche dangereuse ni production ne lui est confiée.')}
        {article(2, 'Dates et horaires', `Du ${fr(d.from)} au ${fr(d.to)}. Horaires : ${blank()[0]}. L'élève reste sous statut scolaire pendant toute la période.`)}
        {article(3, 'Encadrement', `Tuteur ou tutrice dans la structure : ${blank()[0]}. Professeur référent à l'école : ${blank()[0]}. Ils se tiennent informés de toute difficulté.`)}
        {article(4, 'Absences et incidents', 'Toute absence est signalée le jour même à l\'école et à la famille. Tout incident ou accident est déclaré sans délai à l\'école.')}
        {article(5, 'Responsabilité et assurance', 'La structure d\'accueil et l\'école vérifient leurs assurances respectives pour la période. La famille fournit l\'attestation de responsabilité civile de l\'élève.')}
        {article(6, 'Confidentialité et comportement', 'L\'élève respecte le règlement de la structure, le secret professionnel et la discrétion sur ce qu\'il observe. Le règlement intérieur de l\'école continue de s\'appliquer.')}
        {article(7, terrain ? 'Restitution' : 'Rapport', terrain ? 'L\'élève rend compte de son étude en classe ; une copie peut être remise à l\'organisation si elle le souhaite.' : 'L\'élève rédige un rapport de stage remis à son professeur référent.')}
        <table style={{ width: '100%', marginTop: '8mm', borderCollapse: 'collapse' }}>
          <tbody><tr>
            {['Pour l\'école', terrain ? 'Pour l\'organisation' : 'Pour l\'entreprise', 'Le représentant légal', 'L\'élève'].map((who) => (
              <td key={who} style={{ width: '25%', border: '1px solid #000', padding: '2mm', verticalAlign: 'top', height: '32mm' }}><p style={{ fontWeight: 700, fontSize: '9.5pt' }}>{who}</p><p style={{ fontSize: '8.5pt' }}>Date et signature</p></td>
            ))}
          </tr></tbody>
        </table>
      </div>
    </Card>
  );
}
