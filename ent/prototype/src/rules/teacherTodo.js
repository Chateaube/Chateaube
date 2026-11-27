// « À faire » du professeur : pour chaque classe × matière du trimestre en cours, ce qui manque encore
// (devoirs pour atteindre le minimum, appréciations à écrire ou à valider). carnet : déjà réduit au trimestre.
export function gradebookTodo(services, carnet, minFor) {
  return (services ?? []).map((s) => {
    const evals = (carnet?.evaluations?.[s.id] ?? []).filter((e) => !e.fromMockExam).length + (s.common ? (s.otherCount ?? 0) : 0);
    const min = minFor(s);
    const comments = carnet?.comments ?? {};
    const app = s.noAppreciation ? [] : s.students.map((st) => comments[`${s.id}:${st}`]);
    return {
      id: s.id, cls: s.cls, subject: s.subject, evals, min,
      missingEvals: Math.max(0, min - evals),
      toWrite: app.filter((c) => !(c?.text ?? '').trim()).length,
      toValidate: app.filter((c) => (c?.text ?? '').trim() && !c.validated).length,
      validated: Boolean(carnet?.validated?.[s.id]),
    };
  }).filter((r) => !r.validated && (r.missingEvals || r.toWrite || r.toValidate));
}
