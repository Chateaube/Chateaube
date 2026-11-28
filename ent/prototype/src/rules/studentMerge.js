// Fusion d'une fiche en double dans la bonne fiche : dans un carnet de professeur, ce qui a été saisi sous le nom
// en double passe sous le bon nom (notes, remarques, bonus, appréciation, remarques du conseil), sans jamais écraser
// ce qui existe déjà pour le bon nom.
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';

function mergeByStudent(map, dup, target) {
  if (!map) return map;
  let changed = false;
  const out = Object.fromEntries(Object.entries(map).map(([svc, byStudent]) => {
    if (!byStudent || !(dup in byStudent)) return [svc, byStudent];
    changed = true;
    const { [dup]: from, ...rest } = byStudent;
    const to = { ...(rest[target] ?? {}) };
    Object.entries(from ?? {}).forEach(([k, v]) => { if (!has(to[k])) to[k] = v; });
    return [svc, { ...rest, [target]: to }];
  }));
  return changed ? out : map;
}

function mergeByKey(map, dup, target) {
  if (!map) return map;
  let changed = false;
  const out = { ...map };
  Object.keys(map).forEach((k) => {
    const i = k.indexOf(':'); if (i < 0 || k.slice(i + 1) !== dup) return;
    const tk = `${k.slice(0, i)}:${target}`;
    changed = true;
    if (!has(out[tk]?.text) && !(out[tk]?.ids?.length)) out[tk] = map[k];
    delete out[k];
  });
  return changed ? out : map;
}

/** Carnet avec l'élève « dup » fusionné dans « target » ; renvoie le même objet si rien ne change. */
export function mergeStudentInCarnet(carnet, dup, target) {
  if (!carnet || !dup || !target || dup === target) return carnet;
  const next = {
    ...carnet,
    grades: mergeByStudent(carnet.grades, dup, target),
    remarks: mergeByStudent(carnet.remarks, dup, target),
    bonus: mergeByStudent(carnet.bonus, dup, target),
    comments: mergeByKey(carnet.comments, dup, target),
    flags: mergeByKey(carnet.flags, dup, target),
    ...(carnet.byTerm ? { byTerm: Object.fromEntries(Object.entries(carnet.byTerm).map(([t, v]) => [t, { ...v, comments: mergeByKey(v?.comments, dup, target), flags: mergeByKey(v?.flags, dup, target) }])) } : {}),
  };
  return JSON.stringify(next) === JSON.stringify(carnet) ? carnet : next;
}
