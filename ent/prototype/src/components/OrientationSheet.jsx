import React, { useState } from 'react';
import { Badge, Button } from './ui.jsx';
import { TRACKS_2DE, PROVISIONAL, STEPS_2DE, STEPS_TLE, sheetKind, currentStep, stepErrors, ranksLabel } from '../rules/orientationSheet.js';
import { printOnly } from '../print.js';
import { today } from '../clock.js';

// Fiche de dialogue d'orientation, en ligne (modèles de l'école) : 2de et Terminale (post-bac).
// Les représentants légaux remplissent leurs parties depuis le portail, l'élève de Terminale ses
// intentions, la Direction l'avis du conseil de classe. Chaque étape est datée et signée par le compte.
// Démonstration : gardé dans ce navigateur.
const KEY = 'ent-fiches-orientation-v1';
export const loadSheets = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const saveSheets = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage indisponible */ } };
const TODAY = today();
const dmy = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

const toggle = (list = [], v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
function Chips({ options, value = [], onChange, single = false, disabled = false, label }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => {
        const on = single ? value === o : value.includes(o);
        return <button key={o} type="button" disabled={disabled} aria-pressed={on} onClick={() => onChange(single ? o : toggle(value, o))}
          className={`min-h-[36px] rounded-full px-3 text-xs font-medium ring-1 ${on ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'} disabled:opacity-60`}>{o}</button>;
      })}
    </div>
  );
}
const Box = ({ title, done, children, active }) => (
  <section className={`rounded-xl p-3 ${active ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-white ring-1 ring-slate-200'}`}>
    <p className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">{title}{done && <Badge tone="green">✓ {done}</Badge>}</p>
    {children}
  </section>
);
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';

/* ---------------- 2de ---------------- */
const FILIERES = [
  ['1re GÉNÉRALE (scientifique)', 'Aime les sciences et les mathématiques ; logique forte, aime analyser ; curieux·se face à un problème complexe ; apprécie la rigueur.', 'Spécialités : Mathématiques, Physique-Chimie, Sciences de la Vie et de la Terre (en 1re, 2 des 3 sont gardées en Terminale).', 'Études courtes (2 à 3 ans) : licences de sciences, BUT (génie civil, informatique…). Études longues (5 ans et +) : médecine, écoles d\'ingénieurs.'],
  ['1re TECHNOLOGIQUE STMG', 'S\'intéresse au commerce, à la gestion, à la communication ; préfère les exemples concrets et le travail en équipe ; aime s\'exprimer à l\'écrit et à l\'oral ; organisé·e.', 'Spécialités : Sciences de gestion et numérique, Management, Droit-Économie (en Terminale : mercatique / marketing).', 'Études courtes (2 à 3 ans) : BTS commerce, vente, communication ; BUT, licences gestion, marketing. Études longues : écoles de commerce.'],
];
function Ranks({ value = [], onChange, disabled }) {
  return (
    <div className="space-y-1.5">
      {value.map((t, i) => (
        <p key={t} className="flex items-center justify-between gap-2 rounded-lg bg-navy-50 px-3 py-2 text-sm"><span><strong>{i + 1}.</strong> {TRACKS_2DE[t]}</span>
          {!disabled && <span className="flex gap-1">{i > 0 && <button type="button" aria-label="Monter" onClick={() => onChange([t, ...value.filter((x) => x !== t)])} className="rounded px-2 text-navy-700">↑</button>}<button type="button" aria-label="Retirer" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded px-2 text-red-700">✕</button></span>}</p>
      ))}
      {!disabled && Object.keys(TRACKS_2DE).filter((t) => !value.includes(t)).map((t) => (
        <button key={t} type="button" onClick={() => onChange([...value, t])} className="block min-h-[40px] w-full rounded-lg border border-dashed border-slate-300 px-3 text-left text-sm text-slate-700">＋ {TRACKS_2DE[t]}</button>
      ))}
    </div>
  );
}

function Seconde({ sheet, set, role, by }) {
  const step = currentStep('2DE', sheet);
  const isFamily = role === 'PARENT';
  const isDirection = ['DIRECTION', 'BUREAU'].includes(role);
  const [draft, setDraft] = useState({});
  const [err, setErr] = useState([]);
  const d = (k) => draft[k] ?? {};
  const save = (k, value) => { const e = stepErrors(k, value); setErr(e); if (!e.length) { set({ [k]: { ...value, at: TODAY, by } }); setDraft({ ...draft, [k]: undefined }); } };
  const can = (k, who) => step?.key === k && (who === 'PARENT' ? isFamily : isDirection);
  const asked = (k) => sheet[k]?.ranks ?? [];
  const R = sheet.reflection ?? {};
  const setR = (patch) => set({ reflection: { ...R, ...patch } });
  return (
    <div className="space-y-3">
      <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Les deux voies proposées par l'établissement</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{FILIERES.map(([t, profil, ens, apres]) => <div key={t} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700"><p className="font-semibold text-navy-900">{t}</p><p className="mt-1"><strong>Profil :</strong> {profil}</p><p className="mt-1">{ens}</p><p className="mt-1"><strong>Après le bac :</strong> {apres}</p></div>)}</div>
      </details>

      <Box title="2e trimestre — demande des représentants légaux" done={sheet.t2Request && `${ranksLabel(sheet.t2Request.ranks)} · ${dmy(sheet.t2Request.at)}`} active={can('t2Request', 'PARENT')}>
        {can('t2Request', 'PARENT') ? <>
          <p className="mb-2 text-xs text-slate-600">Nous souhaitons pour la rentrée prochaine le passage en classe de 1re (par ordre de préférence) :</p>
          <Ranks value={d('t2Request').ranks} onChange={(ranks) => setDraft({ ...draft, t2Request: { ...d('t2Request'), ranks } })} />
          <details className="mt-2 text-xs text-slate-700"><summary className="cursor-pointer font-medium">Changement d'établissement envisagé ?</summary>
            <label className="mt-1 block">Établissement(s) pressenti(s)<input value={d('t2Request').school ?? ''} onChange={(e) => setDraft({ ...draft, t2Request: { ...d('t2Request'), school: e.target.value } })} className={field} /></label>
            <label className="mt-1 block">Filière et spécialités recherchées<input value={d('t2Request').track ?? ''} onChange={(e) => setDraft({ ...draft, t2Request: { ...d('t2Request'), track: e.target.value } })} className={field} /></label>
          </details>
          <Button className="mt-2 w-full" onClick={() => save('t2Request', d('t2Request'))}>Envoyer et signer</Button>
        </> : !sheet.t2Request && <p className="text-xs text-slate-600">En attente des représentants légaux.</p>}
        {sheet.t2Request?.school && <p className="mt-1 text-xs text-slate-600">Changement envisagé : {sheet.t2Request.school}{sheet.t2Request.track ? ` · ${sheet.t2Request.track}` : ''}</p>}
      </Box>

      {sheet.t2Request && (
        <Box title="2e trimestre — avis provisoire du conseil de classe" done={sheet.t2Council && dmy(sheet.t2Council.at)} active={can('t2Council', 'DIRECTION')}>
          {asked('t2Request').map((t) => (
            <div key={t} className="mb-2"><p className="text-xs font-medium text-slate-700">Le passage en {t === 'G' ? '1re Générale – S' : '1re Technologique – STMG'}</p>
              {sheet.t2Council ? <p className="text-sm font-semibold">{PROVISIONAL[sheet.t2Council[t]]}</p>
                : <Chips single disabled={!can('t2Council', 'DIRECTION')} label={`Avis provisoire — ${t === 'G' ? '1re Générale' : '1re STMG'}`} options={Object.values(PROVISIONAL)} value={PROVISIONAL[d('t2Council')[t]]} onChange={(v) => setDraft({ ...draft, t2Council: { ...d('t2Council'), [t]: Object.keys(PROVISIONAL).find((k) => PROVISIONAL[k] === v) } })} />}
            </div>
          ))}
          {sheet.t2Council ? sheet.t2Council.note && <p className="text-sm text-slate-700">« {sheet.t2Council.note} »</p>
            : can('t2Council', 'DIRECTION') ? <>
              <label className="block text-xs text-slate-600">Motivations du conseil et recommandations<textarea rows={2} value={d('t2Council').note ?? ''} onChange={(e) => setDraft({ ...draft, t2Council: { ...d('t2Council'), note: e.target.value } })} className={field} /></label>
              <Button className="mt-2 w-full" onClick={() => save('t2Council', { ...d('t2Council'), asked: asked('t2Request') })}>Enregistrer l'avis (la cheffe d'établissement)</Button>
            </> : <p className="text-xs text-slate-600">Après le conseil du 2e trimestre.</p>}
        </Box>
      )}

      {sheet.t2Council && (
        <Box title="Retour des représentants légaux sur l'avis provisoire" done={sheet.t2Ack && dmy(sheet.t2Ack.at)} active={can('t2Ack', 'PARENT')}>
          {can('t2Ack', 'PARENT') ? <Button className="w-full" onClick={() => save('t2Ack', { seen: true })}>J'ai bien pris connaissance de l'avis provisoire</Button>
            : !sheet.t2Ack && <p className="text-xs text-slate-600">En attente des représentants légaux.</p>}
        </Box>
      )}

      {sheet.t2Ack && (
        <Box title="3e trimestre — choix définitif des représentants légaux" done={sheet.t3Request && `${ranksLabel(sheet.t3Request.ranks)} · ${dmy(sheet.t3Request.at)}`} active={can('t3Request', 'PARENT')}>
          {can('t3Request', 'PARENT') ? <>
            <Ranks value={d('t3Request').ranks} onChange={(ranks) => setDraft({ ...draft, t3Request: { ranks } })} />
            <Button className="mt-2 w-full" onClick={() => save('t3Request', d('t3Request'))}>Envoyer et signer</Button>
          </> : !sheet.t3Request && <p className="text-xs text-slate-600">En attente des représentants légaux.</p>}
        </Box>
      )}

      {sheet.t3Request && (
        <Box title="3e trimestre — proposition du conseil de classe" done={sheet.t3Council && dmy(sheet.t3Council.at)} active={can('t3Council', 'DIRECTION')}>
          {asked('t3Request').map((t) => (
            <div key={t} className="mb-2"><p className="text-xs font-medium text-slate-700">Le passage en {t === 'G' ? '1re Générale – S' : '1re Technologique – STMG'}</p>
              {sheet.t3Council ? <p className="text-sm font-semibold">{sheet.t3Council[t] === 'OUI' ? 'Oui' : 'Non'}</p>
                : <Chips single disabled={!can('t3Council', 'DIRECTION')} label={`Proposition — ${t === 'G' ? '1re Générale' : '1re STMG'}`} options={['Oui', 'Non']} value={{ OUI: 'Oui', NON: 'Non' }[d('t3Council')[t]]} onChange={(v) => setDraft({ ...draft, t3Council: { ...d('t3Council'), [t]: v === 'Oui' ? 'OUI' : 'NON' } })} />}
            </div>
          ))}
          {sheet.t3Council ? sheet.t3Council.note && <p className="text-sm text-slate-700">« {sheet.t3Council.note} »</p>
            : can('t3Council', 'DIRECTION') && <>
              <label className="block text-xs text-slate-600">Motivations et propositions<textarea rows={2} value={d('t3Council').note ?? ''} onChange={(e) => setDraft({ ...draft, t3Council: { ...d('t3Council'), note: e.target.value } })} className={field} /></label>
              <Button className="mt-2 w-full" onClick={() => save('t3Council', { ...d('t3Council'), asked: asked('t3Request') })}>Enregistrer la proposition</Button>
            </>}
        </Box>
      )}

      {sheet.t3Council && (
        <Box title="Réponse des représentants légaux" done={sheet.answer && `${sheet.answer.accept ? 'Proposition acceptée' : 'Refusée : entretien demandé'} · ${dmy(sheet.answer.at)}`} active={can('answer', 'PARENT')}>
          {can('answer', 'PARENT') ? <>
            <Button className="w-full" onClick={() => save('answer', { accept: true })}>Nous acceptons : la proposition devient la décision d'orientation</Button>
            <label className="mt-2 block text-xs text-slate-600">Ou : nous refusons et demandons un entretien avec la cheffe d'établissement — comment vous joindre ?<input value={d('answer').contact ?? ''} onChange={(e) => setDraft({ ...draft, answer: { contact: e.target.value } })} className={field} /></label>
            <Button variant="secondary" className="mt-1 w-full" onClick={() => save('answer', { accept: false, contact: d('answer').contact })}>Nous refusons et demandons un entretien</Button>
          </> : !sheet.answer && <p className="text-xs text-slate-600">En attente des représentants légaux.</p>}
          {sheet.answer?.accept === false && <p className="mt-1 text-sm text-slate-700">Contact : {sheet.answer.contact}</p>}
        </Box>
      )}
      {err.length > 0 && <ul className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{err.map((e) => <li key={e}>· {e}</li>)}</ul>}

      <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Fiche de réflexion personnelle (élève)</summary>
        <div className="mt-2 space-y-2 text-xs text-slate-700">
          {[
            ['ease', 'Je me sens à l\'aise dans ces matières', ['Maths', 'PC', 'SVT', 'Français', 'Anglais', 'Espagnol', 'Histoire-Géo', 'SES', 'SNT']],
            ['strengths', 'Mes atouts personnels', ['Logique et analyse', 'Créativité', 'Expression orale', 'Rigueur', 'Curiosité intellectuelle', 'Persévérance', 'Sens de l\'organisation']],
            ['hard', 'Les matières qui me demandent de l\'attention', ['Maths', 'PC', 'SVT', 'Français', 'Anglais', 'Espagnol', 'Histoire-Géo', 'SES', 'SNT']],
            ['difficulties', 'Ce qui me pose difficulté', ['Compréhension des consignes', 'Gestion du temps', 'Prise de notes', 'Mémorisation', 'Concentration en cours', 'Méthodologie']],
            ['interests', 'Ce qui m\'intéresse particulièrement', ['Les raisonnements scientifiques', 'Les langues et cultures', 'Les questions de société', 'Les phénomènes naturels', 'Le monde de l\'entreprise', 'Les technologies']],
            ['sectors', 'Métiers ou secteurs qui pourraient me plaire', ['Santé', 'Ingénierie', 'Commerce', 'Enseignement', 'Technologie', 'Autre']],
            ['questions', 'Ce que je me demande pour la suite', ['Je me verrais bien en voie générale', 'La voie technologique m\'attire', 'J\'aimerais rencontrer des 1res', 'J\'ai besoin de découvrir les deux voies', 'Je souhaite en parler avec mes professeurs']],
          ].map(([k, l, opts]) => <div key={k}><p className="mb-1 font-medium">{l}</p><Chips label={l} options={opts} value={R[k]} disabled={role !== 'ELEVE'} onChange={(v) => setR({ [k]: v })} /></div>)}
          {[['stageDomain', 'Mon stage d\'avril : domaine souhaité'], ['stageJob', 'Le métier que j\'aimerais découvrir'], ['dream', 'Métier 1 — ton « rêve »'], ['realistic', 'Métier 2 — un métier réaliste'], ['discovery', 'Métier 3 — un métier de découverte']].map(([k, l]) => (
            <label key={k} className="block">{l}<input disabled={role !== 'ELEVE'} value={R[k] ?? ''} onChange={(e) => setR({ [k]: e.target.value })} className={field} /></label>
          ))}
          {role !== 'ELEVE' && <p className="text-slate-600">Remplie par l'élève depuis son compte.</p>}
        </div>
      </details>
    </div>
  );
}

/* ---------------- Terminale : post-bac ---------------- */
const RESOURCES = [
  ['Découverte des métiers', [['LinkedIn', 'https://www.linkedin.com'], ['Welcome to the Jungle', 'https://www.welcometothejungle.com'], ['Glassdoor', 'https://www.glassdoor.fr']]],
  ['Formations et orientation', [['Horizons21', 'https://www.horizons21.fr'], ['MonProjetSup', 'https://monprojetsup.fr'], ['Onisep', 'https://www.onisep.fr'], ['CIDJ', 'https://www.cidj.com']]],
  ['Thématiques', [['Alternance', 'https://www.alternance.emploi.gouv.fr'], ['Europe', 'https://www.euroguidance-france.org'], ['Enseignement à distance (CNED)', 'https://www.cned.fr'], ['Questions d\'orientation', 'https://www.monorientationenligne.fr']]],
];
const VOIES = { CPGE: ['Scientifique', 'Économique', 'Littéraire'], BTS: [], BUT: [], Licence: ['Sciences', 'Santé', 'Droit/Économie', 'Autre'], 'École spécialisée': ['Ingénieur', 'Commerce', 'Santé', 'Arts', 'Sport', 'Autre'] };

function PostBac({ sheet, set, role, by }) {
  const step = currentStep('TLE', sheet);
  const [d, setD] = useState(sheet.intentions ?? { countries: [], voies: {}, wishes: ['', '', ''] });
  const [council, setCouncil] = useState('');
  const [err, setErr] = useState([]);
  const editable = role === 'ELEVE' && !sheet.intentions;
  const i = sheet.intentions ?? d;
  const send = () => { const e = stepErrors('intentions', d); setErr(e); if (!e.length) set({ intentions: { ...d, at: TODAY, by } }); };
  const voie = (k, patch) => setD({ ...d, voies: { ...d.voies, [k]: { ...(d.voies?.[k] ?? {}), ...patch } } });
  return (
    <div className="space-y-3">
      <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Ressources numériques pour ton projet</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">{RESOURCES.map(([t, links]) => <div key={t} className="text-xs"><p className="font-semibold text-navy-900">{t}</p>{links.map(([l, u]) => <a key={l} href={u} target="_blank" rel="noopener noreferrer" className="block py-1 text-navy-700 underline">{l}</a>)}</div>)}</div>
      </details>
      <Box title="1er trimestre — mes intentions d'orientation" done={sheet.intentions && dmy(sheet.intentions.at)} active={step?.key === 'intentions' && role === 'ELEVE'}>
        <div className="space-y-2 text-xs text-slate-700">
          <div><p className="mb-1 font-medium">Pays envisagé(s)</p><Chips label="Pays" disabled={!editable} options={['Canada', 'France', 'La Réunion', 'Maurice', 'Afrique du Sud', 'Autre']} value={i.countries} onChange={(countries) => setD({ ...d, countries })} />
            {i.countries?.includes('Autre') && <input disabled={!editable} placeholder="Lequel ?" value={i.countryOther ?? ''} onChange={(e) => setD({ ...d, countryOther: e.target.value })} className={field} />}</div>
          <div><p className="mb-1 font-medium">Durée d'études envisagée</p><Chips single label="Durée" disabled={!editable} options={['Moins de 3 ans', '3 à 5 ans', 'Plus de 5 ans', 'Je ne sais pas encore']} value={i.duration} onChange={(duration) => setD({ ...d, duration })} /></div>
          <div><p className="mb-1 font-medium">Voies envisagées</p>
            {Object.entries(VOIES).map(([k, subs]) => {
              const on = Boolean(i.voies?.[k]);
              return (
                <div key={k} className="mb-1.5 rounded-lg bg-slate-50 p-2">
                  <label className="flex items-center gap-2 font-medium"><input type="checkbox" disabled={!editable} checked={on} onChange={() => setD({ ...d, voies: on ? Object.fromEntries(Object.entries(d.voies).filter(([x]) => x !== k)) : { ...d.voies, [k]: {} } })} />{k}</label>
                  {on && subs.length > 0 && <div className="mt-1"><Chips label={k} disabled={!editable} options={subs} value={i.voies[k].types} onChange={(types) => voie(k, { types })} /></div>}
                  {on && ['BTS', 'BUT'].includes(k) && <div className="mt-1 grid gap-1 sm:grid-cols-2"><input disabled={!editable} placeholder="Spécialité" value={i.voies[k].spec ?? ''} onChange={(e) => voie(k, { spec: e.target.value })} className={field} /><Chips single label={`${k} : rythme`} disabled={!editable} options={['Temps plein', 'Apprentissage']} value={i.voies[k].mode} onChange={(mode) => voie(k, { mode })} /></div>}
                </div>
              );
            })}
          </div>
          <div><p className="mb-1 font-medium">Autres projets (sans inscription dans le supérieur)</p><Chips label="Autres projets" disabled={!editable} options={['Séjour linguistique', 'Service civique', 'Insertion professionnelle', 'Année de césure']} value={i.otherProjects} onChange={(otherProjects) => setD({ ...d, otherProjects })} /></div>
          <div><p className="mb-1 font-medium">Démarches déjà entreprises</p><Chips label="Démarches" disabled={!editable} options={['Recherche d\'universités/écoles', 'Équivalences de diplôme', 'Tests de langue (TOEFL, IELTS…)', 'Contact relations internationales', 'Délais d\'inscription consultés']} value={i.steps} onChange={(steps) => setD({ ...d, steps })} /></div>
          <p className="rounded-lg bg-amber-50 p-2 text-amber-900">À anticiper : délais du visa étudiant ; hébergement garanti avant le départ ; justificatifs de ressources ; frais de scolarité ; coût de la vie ; bourses Campus France ; adaptation climatique et culturelle.</p>
          <div><p className="mb-1 font-medium">Mes 3 premiers vœux prioritaires</p>{[0, 1, 2].map((n) => <input key={n} disabled={!editable} placeholder={n === 0 ? 'ex. Licence de sciences de la vie — Université de …' : ''} value={i.wishes?.[n] ?? ''} onChange={(e) => setD({ ...d, wishes: [0, 1, 2].map((m) => (m === n ? e.target.value : d.wishes?.[m] ?? '')) })} className={field} />)}</div>
          <label className="block font-medium">Vie professionnelle imaginée (secteurs, métiers, environnement)<textarea disabled={!editable} rows={2} value={i.career ?? ''} onChange={(e) => setD({ ...d, career: e.target.value })} className={field} /></label>
          {editable && <Button className="w-full" onClick={send}>Je certifie avoir réfléchi à mon orientation et m'engage à poursuivre mes démarches</Button>}
          {!sheet.intentions && role !== 'ELEVE' && <p className="text-slate-600">Remplie par l'élève depuis son compte.</p>}
        </div>
      </Box>
      {sheet.intentions && (
        <Box title="Le représentant légal" done={sheet.parentSeen && dmy(sheet.parentSeen.at)} active={step?.key === 'parentSeen' && role === 'PARENT'}>
          {step?.key === 'parentSeen' && role === 'PARENT'
            ? <Button className="w-full" onClick={() => set({ parentSeen: { at: TODAY, by } })}>Je prends connaissance du projet et m'engage à accompagner mon enfant dans ses choix</Button>
            : !sheet.parentSeen && <p className="text-xs text-slate-600">En attente du représentant légal.</p>}
        </Box>
      )}
      {sheet.intentions && (
        <Box title="1er trimestre — avis du conseil de classe" done={sheet.council && dmy(sheet.council.at)} active={step?.key === 'council' && ['DIRECTION', 'BUREAU'].includes(role)}>
          {sheet.council ? <p className="text-sm text-slate-700">« {sheet.council.text} »<span className="block text-xs text-slate-600">La cheffe d'établissement</span></p>
            : ['DIRECTION', 'BUREAU'].includes(role) ? <>
              <textarea rows={3} value={council} onChange={(e) => setCouncil(e.target.value)} aria-label="Avis du conseil de classe" className={field} />
              <Button className="mt-2 w-full" onClick={() => { const e = stepErrors('council', { text: council }); setErr(e); if (!e.length) set({ council: { text: council.trim(), at: TODAY, by } }); }}>Enregistrer l'avis</Button>
            </> : <p className="text-xs text-slate-600">Après le conseil du 1er trimestre.</p>}
        </Box>
      )}
      {err.length > 0 && <ul className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{err.map((e) => <li key={e}>· {e}</li>)}</ul>}
    </div>
  );
}

/** La fiche d'un élève ; role : PARENT, ELEVE, DIRECTION, BUREAU (consultation pour les autres). */
export default function OrientationSheet({ student, cls, role, by }) {
  const kind = sheetKind(cls);
  const [all, setAll] = useState(loadSheets);
  if (!kind) return null;
  const sheet = all[student] ?? {};
  const set = (patch) => { const next = { ...all, [student]: { ...sheet, kind, ...patch } }; setAll(next); saveSheets(next); };
  const step = currentStep(kind, sheet);
  const steps = kind === '2DE' ? STEPS_2DE : STEPS_TLE;
  const printClass = `orient-print-${student.replace(/\W+/g, '-')}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy-900">{kind === '2DE' ? 'Fiche de dialogue pour l\'orientation à l\'issue de la seconde' : 'Fiche de dialogue post-bac'}</p>
          <p className="text-xs text-slate-600">{student} · {cls} · {step ? `en cours : ${step.label}` : 'fiche terminée'}</p>
        </div>
        <Button variant="secondary" className="!py-1 text-xs" onClick={() => printOnly(`.${printClass}`, 'size: A4 portrait;', `Fiche d'orientation — ${student}`)}>Imprimer</Button>
      </div>
      <ol className="flex flex-wrap gap-1" aria-label="Étapes">{steps.map(([k, , l], n) => <li key={k} title={l} className={`rounded-full px-2 py-0.5 text-[11px] ${sheet[k] ? 'bg-emerald-100 text-emerald-800' : step?.key === k ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>{n + 1}{sheet[k] ? ' ✓' : ''}</li>)}</ol>
      <div className={printClass}>
        {kind === '2DE' ? <Seconde sheet={sheet} set={set} role={role} by={by} /> : <PostBac sheet={sheet} set={set} role={role} by={by} />}
      </div>
    </div>
  );
}
