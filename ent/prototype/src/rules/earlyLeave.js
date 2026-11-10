// Sortie anticipée d'un élève (malade, rendez-vous…) : registre de la vie scolaire.
// Règle de l'établissement : un élève mineur ne quitte pas l'école avant la fin de son emploi du temps
// tant qu'un adulte autorisé ne vient pas le chercher, même s'il a son propre véhicule (moto…).
// Un élève majeur peut partir seul, ses parents étant prévenus. Les parents sont toujours appelés.
export function isMinor(birthDate, today) {
  if (!birthDate) return true; // date inconnue : on applique la règle des mineurs
  const [y, m, d] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return age < 18;
}

export function leaveErrors({ minor, reason, parentCalled, pickedUpBy, relation, pickedUpIsGuardian, guardianConfirmed }) {
  const e = [];
  if (!reason?.trim()) e.push('Indiquer le motif (malaise, rendez-vous…).');
  if (!parentCalled) e.push('Appeler un parent avant toute sortie.');
  if (minor) {
    if (!pickedUpBy?.trim()) e.push('Élève mineur : il reste à l\'école jusqu\'à ce qu\'un adulte vienne le chercher, même avec son propre véhicule.');
    else if (!relation?.trim()) e.push('Indiquer le lien de la personne avec l\'élève.');
    else if (!pickedUpIsGuardian && !guardianConfirmed) e.push('La personne n\'est pas un responsable légal : le parent doit confirmer au téléphone qu\'elle peut repartir avec l\'élève.');
  }
  return e;
}
