import React, { useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, Tel } from './ui.jsx';
import { loadProfiles } from '../profilesStore.js';
import { filterStudents, studentsCsv, accessSlips } from '../rules/studentList.js';
import { nationalityLabels, missingDocuments } from '../rules/enrollment.js';
import { usualFirstName } from '../rules/names.js';
import { saveFile } from '../download.js';
import { printOnly } from '../print.js';

// Liste des élèves (Direction, Bureau, Vie scolaire) : par classe, avec photo, exportable vers
// Excel (toutes les informations de la fiche) et imprimable : liste, trombinoscope, codes d'accès.

const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

export default function StudentList({ role, onOpen, embedded = false, rowAction }) {
  const [profiles] = useState(loadProfiles);
  const [cls, setCls] = useState('');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState(null); // aperçu à l'écran : 'trombi' | 'codes'
  const classes = useMemo(() => [...new Set(profiles.map((p) => p.cls))].sort(), [profiles]);
  const list = useMemo(() => filterStudents(profiles, { cls, query }), [profiles, cls, query]);
  const title = `Liste des élèves${cls ? ` — ${cls}` : ''} · 2026-2027 · Chateaubriand Tamatave`;
  // CPE : consultation seulement (appeler une famille), sans impression ni export
  const readOnly = role === 'VIE_SCOLAIRE';
  const canCodes = !readOnly;
  const slips = useMemo(() => accessSlips(list), [list]);
  const noPhoto = list.filter((p) => !p.photo).length;
  // colonnes de la liste imprimée, au choix (ex. une colonne vide « Signature » pour un émargement)
  const PRINT_COLS = {
    num: ['N°', (p, i) => i + 1], matricule: ['Matricule', (p) => p.number ?? ''], last: ['Nom', (p) => p.lastName], first: ['Prénom', (p) => usualFirstName(p)],
    cls: ['Classe', (p) => p.cls], birth: ['Né(e) le', (p) => fmt(p.birthDate)], nat: ['Nationalité(s)', (p) => nationalityLabels(p.nationalities ?? [], p.otherNationality).join(', ')],
    guardian: ['Responsable', (p) => p.guardians?.[0]?.name ?? ''], phone: ['Téléphone', (p) => p.guardians?.[0]?.phone ?? ''], email: ['E-mail', (p) => p.guardians?.find((g) => g.email)?.email ?? ''],
    sign: ['Signature', () => ''],
  };
  const [printCols, setPrintCols] = useState(['num', 'last', 'first', 'cls', 'birth', 'guardian', 'phone']);
  const cols = Object.keys(PRINT_COLS).filter((k) => printCols.includes(k));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!embedded && <><p className="text-sm font-semibold text-navy-500">Année 2026-2027 · Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Liste des élèves</h1></>}
          <p className="text-sm text-slate-500">{list.length} élève{list.length > 1 ? 's' : ''}{noPhoto ? ` · ${noPhoto} sans photo d'identité` : ''}</p>
        </div>
        {readOnly ? <p className="text-xs text-slate-500">Consultation seulement : impression et export réservés au secrétariat et à la Direction.</p> : <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveFile(`eleves${cls ? `-${cls.replace(/\s+/g, '-')}` : ''}.csv`, studentsCsv(list, title))}>Exporter (Excel)</Button>
          <Button variant="secondary" onClick={() => printOnly('.students-print', 'size: A4 landscape;', title)}>Imprimer la liste</Button>
          <Button variant="secondary" aria-pressed={preview === 'trombi'} onClick={() => setPreview(preview === 'trombi' ? null : 'trombi')}>Trombinoscope</Button>
          {canCodes && <Button variant="secondary" aria-pressed={preview === 'codes'} onClick={() => setPreview(preview === 'codes' ? null : 'codes')}>Codes d'accès des parents</Button>}
        </div>}
      </div>

      <Card>
        <div className="flex flex-wrap gap-2">
          <select value={cls} onChange={(e) => setCls(e.target.value)} className={inputCls} aria-label="Classe">
            <option value="">Toutes les classes</option>{classes.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, prénom ou n°…" className={`min-w-[200px] flex-1 ${inputCls}`} />
        </div>
        {!readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold">Colonnes à imprimer :</span>
            {Object.entries(PRINT_COLS).map(([k, [label]]) => (
              <button key={k} type="button" aria-pressed={printCols.includes(k)} onClick={() => setPrintCols(printCols.includes(k) ? printCols.filter((x) => x !== k) : [...printCols, k])}
                className={`rounded-full px-2.5 py-0.5 font-medium ring-1 ${printCols.includes(k) ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white ring-slate-300'}`}>{label}</button>
            ))}
          </div>
        )}
        <div className="-mx-5 mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Élève</th><th className="px-2 font-medium">Classe</th><th className="px-2 font-medium">Né(e) le</th>
                <th className="px-2 font-medium">Nationalité(s)</th><th className="px-2 font-medium">Responsables</th><th className="px-4 font-medium">Dossier</th>{rowAction && <th className="px-4 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const missing = missingDocuments(p, 'REINSCRIPTION');
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar name={`${p.firstName} ${p.lastName}`} photo={p.photo} className="h-8 w-8 text-[10px]" />
                      <span>{onOpen ? <button type="button" onClick={() => onOpen(p)} className="text-left font-medium text-navy-800 underline decoration-dotted underline-offset-2 hover:text-navy-500">{p.lastName} {usualFirstName(p)}</button> : <span className="font-medium text-slate-900">{p.lastName} {usualFirstName(p)}</span>}{p.firstName !== usualFirstName(p) && <span className="block text-xs text-slate-500">{p.firstName}</span>}</span></span></td>
                    <td className="px-2">{p.cls}</td>
                    <td className="px-2 tabular-nums">{fmt(p.birthDate)}</td>
                    <td className="px-2">{nationalityLabels(p.nationalities ?? [], p.otherNationality).join(', ') || '—'}</td>
                    <td className="px-2 text-xs">{(p.guardians ?? []).map((g) => <span key={g.name} className="block">{g.name} · <Tel n={g.phone} /></span>)}{!p.guardians?.length && <Badge tone="amber">à compléter</Badge>}</td>
                    <td className="px-4">{missing.length ? <Badge tone="amber">{missing.length} pièce{missing.length > 1 ? 's' : ''} manquante{missing.length > 1 ? 's' : ''}</Badge> : <Badge tone="green">complet</Badge>}</td>
                    {rowAction && <td className="px-4">{rowAction(p)}</td>}
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Aucun élève.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Aperçu à l'écran du trombinoscope ou des codes, avant impression */}
      {preview && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-navy-50 px-4 py-2 text-sm text-navy-900">
          <strong>{preview === 'trombi' ? 'Trombinoscope' : 'Codes d\'accès des parents'}</strong> — aperçu de la page imprimée
          <Button className="ml-auto" onClick={() => (preview === 'trombi' ? printOnly('.trombi-print', 'size: A4 portrait;', `Trombinoscope${cls ? ` — ${cls}` : ''}`) : printOnly('.codes-print', 'size: A4 portrait;', 'Codes d\'accès des parents'))}>Imprimer</Button>
          <Button variant="secondary" onClick={() => setPreview(null)}>Fermer l'aperçu</Button>
        </div>
      )}
      {/* Documents imprimés : uniquement les données (la liste est cachée à l'écran, le reste en aperçu) */}
      <div>
        <div className="hidden"><div className="students-print">
          <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '10px', color: '#000' }}>
            <p style={{ fontSize: '13px', fontWeight: 700 }}>{title}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
              <thead><tr>{cols.map((k) => <th key={k} style={{ border: '1px solid #000', padding: '3px', textAlign: 'left', minWidth: k === 'sign' ? '35mm' : undefined }}>{PRINT_COLS[k][0]}</th>)}</tr></thead>
              <tbody>
                {list.map((p, i) => (
                  <tr key={p.id} style={{ breakInside: 'avoid' }}>
                    {cols.map((k) => <td key={k} style={{ border: '1px solid #000', padding: k === 'sign' ? '7px 3px' : '3px' }}>{PRINT_COLS[k][1](p, i)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div></div>
        <div className={preview === 'trombi' ? 'rounded-2xl bg-white p-4 shadow-soft' : 'hidden'}><div className="trombi-print">
          <div style={{ fontFamily: 'Poppins, sans-serif', color: '#000' }}>
            <p style={{ fontSize: '13px', fontWeight: 700 }}>Trombinoscope{cls ? ` — ${cls}` : ''} · 2026-2027</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginTop: '8px' }}>
              {list.map((p) => (
                <div key={p.id} style={{ textAlign: 'center', fontSize: '10px', breakInside: 'avoid' }}>
                  {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', aspectRatio: '3 / 4', border: '1px dashed #999' }} />}
                  <div style={{ fontWeight: 700 }}>{usualFirstName(p)}</div><div>{p.lastName}</div>{!cls && <div>{p.cls}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
        {canCodes && (
          <div className={preview === 'codes' ? 'rounded-2xl bg-white p-4 shadow-soft' : 'hidden'}><div className="codes-print">
            <div style={{ fontFamily: 'Poppins, sans-serif', color: '#000', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {slips.map((s) => (
                <div key={s.code} style={{ border: '1px dashed #000', padding: '8px', fontSize: '10.5px', breakInside: 'avoid' }}>
                  <p style={{ fontWeight: 700 }}>ENT Chateaubriand — accès personnel</p>
                  <p>{s.name} ({s.relation})</p>
                  <p>Enfant(s) : {s.children.join(', ')}</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '2px', margin: '4px 0', fontFamily: 'monospace' }}>{s.code}</p>
                  <p>1. Ouvrez l'application de l'école sur votre téléphone. 2. « Première connexion » : saisissez ce code. 3. {s.login ? `Connectez ensuite votre compte Google (${s.login}).` : 'Choisissez votre mot de passe ; vous vous connecterez avec votre téléphone.'}</p>
                  <p style={{ fontStyle: 'italic' }}>Code personnel : ne le donnez à personne, chaque parent a le sien.</p>
                </div>
              ))}
            </div>
          </div></div>
        )}
      </div>
    </div>
  );
}
