// Arborescence des menus : l'ordre et le regroupement des écrans, séparés du code d'affichage.
// Chaque écran a un identifiant unique (data-nav dans l'interface). Un écran n'apparaît qu'à un seul
// endroit. Les entrées « bientôt » (mobilité Tana, emploi du temps, Campus France) ne sont pas dans le menu.

// Direction : 5 rubriques (au lieu de 8). Les écrans à onglets internes restent des entrées de menu.
export const DIRECTION_TREE = [
  { group: 'Aujourd\'hui', ids: ['dashboard', 'messages', 'signatures'] },
  { group: 'Élèves et vie scolaire', ids: ['enrol', 'students-list', 'mandates', 'vs', 'followup', 'care', 'hours', 'tt-changes'] },
  { group: 'Pédagogie', ids: ['council', 'bulletins', 'mock-exams', 'oversight-grades', 'oversight-homework'] }, // grilles : onglet des conseils
  { group: 'Communication', ids: ['news', 'school-life', 'agenda', 'resources'] },
  { group: 'Administration', ids: ['accounting', 'staff', 'inventory', 'manuals', 'library', 'booking', 'settings', 'import', 'feedback'] },
];

/** Donne l'ordre de l'arborescence aux entrées existantes. Un identifiant inconnu est une erreur de développement. */
export function arrangeNav(tree, groups) {
  const byId = Object.fromEntries(groups.flatMap((g) => g.items).map((item) => [item.id, item]));
  return tree.map(({ group, ids }) => ({
    group,
    items: ids.map((id) => {
      if (!byId[id]) throw new Error(`Écran inconnu dans la navigation : ${id}`);
      return byId[id];
    }),
  }));
}

// Portail famille (parents et élèves) : « Autres » en 4 sections de 3 au plus.
// Format : [titre, [[identifiant, libellé, icône, audience?]]]. Audience PARENT : entrée réservée aux parents.
export const FAMILY_SECTIONS = [
  ['Échanges', [['messages', 'Messages', 'bell'], ['schoollife', 'Vie de l\'école', 'sparkles'], ['schooldocs', 'Règlement et chartes', 'pen']]],
  ['Scolarité', [['library', 'Bibliothèque', 'cap'], ['stages', 'Stages', 'cap'], ['orientation', 'Orientation', 'cap']]],
  ['Papiers', [['documents', 'Documents et autorisations', 'pen'], ['fiche', 'Fiche signalétique', 'pen', 'PARENT'], ['signature', 'Ma signature', 'pen', 'PARENT']]],
  ['Inscription et paiements', [['reenrol', 'Réinscription', 'calendar', 'PARENT'], ['update', 'Mettre à jour nos informations', 'users', 'PARENT'], ['payments', 'Paiements', 'wallet', 'PARENT']]],
];
