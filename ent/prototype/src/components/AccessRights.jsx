import { useNarrow } from '../useNarrow.js';
import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import ScreenTabs from './ScreenTabs.jsx';
import { STAFF } from '../data/people.js';
import { staffStatus } from './StaffModule.jsx';
import { LEVELS, STAFF_PROFILES, baseLevel, levelFor, setLevel, exceptionsOf } from '../rules/access.js';
import { FEATURES, MODES, featureMode } from '../features.js';

// Droits d'accès (Direction) : qui voit quoi et qui peut modifier, écran par écran.
// Par profil (Secrétariat, CPE, Enseignant), puis exceptions par personne (niveau d'accréditation).
// Rubriques de l'école : éteindre une rubrique pour tout le monde (ou la garder pour la Direction).
// Les écrans propres à un profil (accueil, appel, carnet de notes) et ceux de la Direction ne se règlent pas ici.

const PERSON_PROFILE = { PROFESSEUR: 'ENSEIGNANT', BUREAU: 'BUREAU', VIE_SCOLAIRE: 'VIE_SCOLAIRE' };
const TONE = { AUCUN: 'text-slate-500', LECTURE: 'text-amber-800', ECRITURE: 'text-emerald-800' };
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm';

export default function AccessRights({ settings, onChange, catalogue, baseNavs }) {
  const [tab, setTab] = useState('profiles');
  const narrow = useNarrow();
  const [one, setOne] = useState(Object.keys(STAFF_PROFILES)[0]); // téléphone : un profil à la fois
  const shown = narrow ? [one] : Object.keys(STAFF_PROFILES);
  const access = settings.access ?? {};
  const save = (a) => onChange({ ...settings, access: a });
  const groups = [...new Set(catalogue.map((c) => c.group))];
  const changed = Object.values(access.profiles ?? {}).reduce((n, p) => n + Object.keys(p).length, 0);

  const byProfile = (
    <Card title="Par profil" subtitle="Aucun accès : l'écran disparaît du menu · Consulter : lecture seule · Modifier : saisie possible"
      action={changed > 0 && <Button variant="secondary" onClick={() => { if (window.confirm('Revenir aux droits d\'origine pour tous les profils ? Les exceptions par personne sont gardées.')) save({ ...access, profiles: {} }); }}>Rétablir les droits d'origine</Button>}>
      {narrow && (
        <label className="mb-2 block text-xs font-medium text-slate-600">Profil
          <select value={one} onChange={(e) => setOne(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
            {Object.entries(STAFF_PROFILES).map(([p, l]) => <option key={p} value={p}>{l}</option>)}
          </select>
        </label>
      )}
      <div className="-mx-5 overflow-x-auto px-5">
        <table data-grid className={`w-full text-sm ${narrow ? '' : 'min-w-[560px]'}`}>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
              <th scope="col" className="py-2 pr-3 font-medium">Écran</th>
              {shown.map((p) => <th key={p} scope="col" className="px-2 py-2 font-medium">{STAFF_PROFILES[p]}</th>)}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr><th colSpan={shown.length + 1} scope="colgroup" className="pt-3 pb-1 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-700">{g}</th></tr>
              {catalogue.filter((c) => c.group === g).map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-800">{c.label}</th>
                  {shown.map((p) => {
                    const v = levelFor({ profile: p, id: c.id, baseNav: baseNavs[p], access: { profiles: access.profiles } });
                    const moved = v !== baseLevel(baseNavs[p], c.id);
                    return (
                      <td key={p} className="px-2 py-1.5">
                        <select value={v} aria-label={`${c.label} — ${STAFF_PROFILES[p]}`} onChange={(e) => save(setLevel(access, { profile: p, id: c.id, level: e.target.value }))}
                          className={`${field} ${TONE[v]} ${moved ? 'ring-2 ring-amber-300' : ''}`}>
                          {Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-600">Encadré orange : différent du réglage d'origine. Paramètres, gestion des agents, engagements et droits d'accès restent à la Direction.</p>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Administration · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Droits d'accès</h1>
        <p className="text-sm text-slate-600">Qui voit quoi, et qui peut modifier. Les changements s'appliquent dès la prochaine ouverture du menu.</p>
      </div>
      <ScreenTabs label="Droits d'accès" value={tab} onChange={setTab} tabs={[
        ['profiles', 'Par profil', byProfile],
        ['people', 'Par personne', <People key="people" access={access} save={save} catalogue={catalogue} groups={groups} baseNavs={baseNavs} />],
        ['features', 'Rubriques de l\'école', <Features key="features" settings={settings} onChange={onChange} />],
      ]} />
    </div>
  );
}

function People({ access, save, catalogue, groups, baseNavs }) {
  const staff = STAFF.filter((a) => a.access && PERSON_PROFILE[a.access] && staffStatus(a).active).sort((a, b) => a.name.localeCompare(b.name));
  const [id, setId] = useState(staff[0]?.id);
  const person = staff.find((a) => a.id === id);
  if (!person) return <Card><p className="text-sm text-slate-600">Aucun membre du personnel avec un compte.</p></Card>;
  const profile = PERSON_PROFILE[person.access];
  const own = access.people?.[id] ?? {};
  const fromProfile = (cid) => levelFor({ profile, id: cid, baseNav: baseNavs[profile], access: { profiles: access.profiles } });

  return (
    <Card title="Niveau d'accréditation par personne" subtitle="Par défaut, chacun a les droits de son profil. Une exception donne plus, ou moins, à une seule personne.">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">Personne
          <select value={id} onChange={(e) => setId(e.target.value)} className={`mt-1 block ${field}`}>
            {staff.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.poste}{exceptionsOf(access, a.id) ? ` (${exceptionsOf(access, a.id)} exception${exceptionsOf(access, a.id) > 1 ? 's' : ''})` : ''}</option>)}
          </select>
        </label>
        <span className="pb-1.5 text-sm text-slate-700">Profil : <Badge tone="navy">{STAFF_PROFILES[profile]}</Badge></span>
        {Object.keys(own).length > 0 && <Button variant="secondary" className="ml-auto" onClick={() => { const a = { ...access, people: { ...(access.people ?? {}) } }; delete a.people[id]; save(a); }}>Retirer toutes ses exceptions</Button>}
      </div>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
              <th scope="col" className="py-2 pr-3 font-medium">Écran</th>
              <th scope="col" className="px-2 py-2 font-medium">Son profil</th>
              <th scope="col" className="px-2 py-2 font-medium">Pour {person.name.split(' ').slice(1).join(' ') || person.name}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr><th colSpan={3} scope="colgroup" className="pt-3 pb-1 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-700">{g}</th></tr>
              {catalogue.filter((c) => c.group === g).map((c) => {
                const base = fromProfile(c.id);
                return (
                  <tr key={c.id} className="border-b border-slate-100">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-800">{c.label}</th>
                    <td className={`px-2 py-1.5 text-xs ${TONE[base]}`}>{LEVELS[base]}</td>
                    <td className="px-2 py-1.5">
                      <select value={own[c.id] ?? ''} aria-label={`${c.label} — ${person.name}`} onChange={(e) => save(setLevel(access, { person: id, id: c.id, level: e.target.value || null }))}
                        className={`${field} ${own[c.id] ? `${TONE[own[c.id]]} ring-2 ring-amber-300` : 'text-slate-600'}`}>
                        <option value="">Comme son profil</option>
                        {Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  );
}

/** Rubriques de l'école : éteindre une rubrique pour tout le monde, ou la réserver à la Direction. */
function Features({ settings, onChange }) {
  return (
    <Card title="Rubriques de l'école" subtitle="Pour éteindre une rubrique dont l'école ne se sert pas (ou la garder pour la Direction). Rien n'est effacé : on peut la rallumer à tout moment. Pour régler qui voit quoi, ce sont les onglets « Par profil » et « Par personne ».">
      <ul className="divide-y divide-slate-100">
        {FEATURES.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0"><span className="text-sm font-medium text-slate-900">{f.label}</span> <span className="text-xs text-slate-600">· {f.where}</span>
              {f.note && <span className="block text-xs text-slate-600">{f.note}</span>}</span>
            <span className="flex gap-1">
              {Object.entries(MODES).map(([m, l]) => (
                <button key={m} type="button" aria-pressed={featureMode(settings, f.id) === m} onClick={() => onChange({ ...settings, features: { ...(settings.features ?? {}), [f.id]: m } })}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${featureMode(settings, f.id) === m ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>{l}</button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
