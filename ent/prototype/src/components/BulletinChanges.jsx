import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { fetchDoc } from '../online/docs.js';
import { fetchRoster, servicesFor } from '../online/roster.js';
import { carnetKey } from '../gradebookStore.js';
import { loadMe } from '../identity.js';
import { compCorrectionKey } from '../rules/onlineBulletins.js';
import { isRealChange } from '../rules/textChange.js';
import { studentLabel as sn } from '../studentNames.js';

// Professeur : ce que la Direction a modifié sur le bulletin (relecture des appréciations et des compétences).
// Les simples corrections de forme (ponctuation, accents, fautes de frappe) ne sont pas détaillées : seulement comptées.
// Votre carnet n'est jamais modifié : le bulletin prend la version corrigée.
export function bulletinChanges({ me, carnet, roster, corrections }) {
  const services = servicesFor(roster, me);
  const real = []; let form = 0;
  services.forEach((sv) => {
    const ck = corrections[compCorrectionKey(me, sv.id)];
    const mine = carnet?.myComps?.[sv.id] ?? [];
    if (ck && JSON.stringify(ck.original ?? []) === JSON.stringify(mine)) {
      const a = mine.join(' / '); const b = (ck.text ?? []).join(' / ');
      if (mine.length !== (ck.text ?? []).length || isRealChange(a, b)) real.push({ id: `c-${sv.id}`, cls: sv.cls, subject: sv.subject, what: 'Compétences', before: mine, after: ck.text ?? [], at: ck.at });
      else if (a !== b) form += 1;
    }
    sv.students.forEach((st) => {
      const c = corrections[`${me}|${sv.id}:${st}`];
      const text = carnet?.comments?.[`${sv.id}:${st}`]?.text ?? '';
      if (!c || (c.original ?? '') !== text) return; // vous avez réécrit depuis : votre nouveau texte compte
      if (isRealChange(text, c.text)) real.push({ id: `a-${sv.id}-${st}`, cls: sv.cls, subject: sv.subject, what: sn(st), before: text, after: c.text, at: c.at });
      else if (text !== c.text) form += 1;
    });
  });
  return { real: real.sort((x, y) => String(y.at).localeCompare(String(x.at))), form };
}

export default function BulletinChanges() {
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const load = async () => {
    setErr('');
    try {
      const me = loadMe()?.id;
      const [corr, roster, carnet] = await Promise.all([fetchDoc('corrections'), fetchRoster(), fetchDoc(carnetKey(me))]);
      setData(bulletinChanges({ me, carnet: carnet?.value, roster: roster?.value, corrections: corr?.value ?? {} }));
    } catch (e) { setErr(`Lecture impossible (${e.message}).`); }
  };
  useEffect(() => { load(); }, []);
  const show = (v) => (Array.isArray(v) ? <ul className="list-disc pl-4">{v.map((x) => <li key={x}>{x}</li>)}</ul> : v || <em className="text-slate-400">(vide)</em>);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Évaluations</p>
        <h1 className="text-2xl font-semibold text-navy-900">Modifications du bulletin</h1>
        <p className="text-sm text-slate-600">Ce que la Direction a modifié à la relecture de vos appréciations et compétences. Votre carnet n'est pas changé : le bulletin prend la version ci-dessous. Si vous réécrivez une appréciation, c'est votre nouveau texte qui compte.</p>
      </div>
      {err && <Card><p className="text-sm text-red-800">{err}</p><Button className="mt-3" onClick={load}>Réessayer</Button></Card>}
      {!data && !err && <Card><p className="text-sm text-slate-600">Chargement…</p></Card>}
      {data && (
        <Card title={`${data.real.length} modification${data.real.length > 1 ? 's' : ''}`} subtitle={data.form ? `Et ${data.form} correction${data.form > 1 ? 's' : ''} de forme (ponctuation, accents, fautes de frappe), non détaillée${data.form > 1 ? 's' : ''}.` : 'Corrections de forme (ponctuation, fautes de frappe) : aucune.'}>
          {!data.real.length ? <p className="text-sm text-slate-600">Aucune modification de fond sur vos textes.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.real.map((x) => (
                <li key={x.id} className="py-3 text-sm">
                  <p className="font-medium text-slate-900">{x.what} <span className="font-normal text-slate-500">· {x.cls} · {x.subject}</span>{x.at && <Badge tone="slate">{String(x.at).slice(0, 10).split('-').reverse().join('/')}</Badge>}</p>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-semibold text-slate-500">Votre texte</p><div className="text-slate-700">{show(x.before)}</div></div>
                    <div className="rounded-lg bg-violet-50 p-2"><p className="text-xs font-semibold text-violet-700">Sur le bulletin</p><div className="text-slate-900">{show(x.after)}</div></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
