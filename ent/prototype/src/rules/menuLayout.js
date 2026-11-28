// Menu court (validé par la Direction, novembre 2026) : les écrans restent les mêmes (mêmes identifiants, mêmes
// droits, même recherche) ; le menu les regroupe en rubriques, et une rubrique à plusieurs écrans les présente en
// onglets en haut de l'écran. Rien n'est supprimé : un écran non prévu ici reste dans « Autres ».
// Entrée : 'identifiant' (écran seul) ou { hub, label, icon, tabs: [identifiant | [identifiant, libellé d'onglet]] }.

const hub = (id, label, icon, tabs) => ({ hub: id, label, icon, tabs });

export const MENU_LAYOUT = {
  DIRECTION: [
    { group: 'Aujourd\'hui', items: [hub('accueil', 'Accueil', 'home', [['dashboard', 'Mes décisions'], 'signatures']), 'messages'] },
    { group: 'Élèves', items: [
      hub('eleves', 'Élèves', 'users', [['eleves', 'Liste et fiches'], ['eleves-portail', 'Comptes du portail'], 'mandates', 'followup']),
      hub('vie-scolaire', 'Vie scolaire', 'alert', ['vs', ['care', 'Soins']]),
    ] },
    { group: 'Pédagogie', items: [
      hub('notes', 'Notes et bulletins', 'pen', ['notes-recues', ['relecture', 'Relecture'], 'council', 'bulletins', ['my-grades', 'Mes notes']]),
      'mock-exams',
      hub('professeurs', 'Professeurs', 'clock', ['timetable', ['hours', 'Heures et absences'], 'oversight-grades', 'programs', 'new-programs', 'teacher-guide']),
    ] },
    { group: 'École', items: [hub('communication', 'Communication', 'megaphone', ['news', 'school-life', 'agenda', ['resources', 'Ressources'], 'feedback'])] },
    { group: 'Gestion', items: [
      'accounting',
      hub('materiel', 'Matériel', 'box', [['manuals', 'Manuels'], ['inventory', 'Inventaire'], 'library', ['booking', 'Réservations']]),
      'staff',
      hub('reglages', 'Réglages', 'settings', ['settings', 'access', 'import']),
    ] },
  ],
  BUREAU: [
    { group: 'Aujourd\'hui', items: [hub('accueil', 'Accueil', 'home', ['bureau', 'signatures'])] },
    { group: 'Accueil et caisse', items: ['accounting', hub('eleves', 'Élèves', 'users', [['eleves', 'Liste et certificats'], 'followup'])] },
    { group: 'Élèves et notes', items: [
      hub('vie-scolaire', 'Vie scolaire', 'alert', ['vs', ['care', 'Soins']]),
      hub('notes', 'Notes et conseils', 'pen', ['absents-devoirs', 'council', 'mock-exams', 'oversight-grades']),
      hub('professeurs', 'Professeurs', 'clock', ['timetable', ['hours', 'Heures et absences']]),
    ] },
    { group: 'École', items: ['messages', hub('communication', 'Communication', 'megaphone', ['news', 'school-life', 'agenda', ['resources', 'Ressources']])] },
    { group: 'Matériel', items: [hub('materiel', 'Matériel', 'box', [['manuals', 'Manuels'], 'library', ['booking', 'Réservations'], ['inventory', 'Inventaire']]), 'import'] },
  ],
  VIE_SCOLAIRE: [
    { group: 'Aujourd\'hui', items: ['cpe-home', hub('vie-scolaire', 'Vie scolaire', 'alert', [['vs', 'Absences, retards et punitions'], 'cpe-colles', 'cpe-objets', ['care', 'Soins']])] },
    { group: 'Élèves et professeurs', items: ['eleves', hub('professeurs', 'Professeurs', 'clock', ['tt-changes', ['hours', 'Heures et absences'], 'timetable'])] },
    { group: 'École', items: ['messages', hub('communication', 'Communication', 'megaphone', ['news', 'school-life', 'agenda']),
      hub('ressources', 'Ressources', 'book', [['resources', 'Documents et idées'], ['booking', 'Réservations'], 'books-cpe', 'oversight-homework'])] },
  ],
  ENSEIGNANT: [
    { group: 'Ma journée', items: [hub('journee', 'Ma journée', 'home', [['teacher', 'Mes cours'], 'appel', 'homework', 'agenda', ['booking', 'Réservations'], ['hours', 'Mes heures']])] },
    { group: 'Évaluations', items: [hub('notes', 'Notes et appréciations', 'pen', [['grades', 'Notes et appréciations'], 'grade-sheets', 'bulletin-changes']), 'mock-exams'] },
    { group: 'Mes élèves', items: [hub('eleves', 'Mes élèves', 'alert', [['discipline', 'Vie de classe'], 'student-file'])] },
    { group: 'École', items: ['messages', 'school-life', 'news', 'books', 'resources', 'new-programs', 'teacher-guide'] },
  ],
};

/**
 * Menu affiché : layout appliqué aux écrans visibles (groupes [{ group, items }] d'écrans { id, label, icon, … }).
 * Une rubrique avec un seul écran visible devient cet écran ; sans écran visible, elle disparaît.
 * Renvoie [{ group, items: [écran | { id: 'hub:…', hub, label, icon, tabs: [{ id, label, item }] }] }].
 */
export function buildMenu(layout, shown) {
  if (!layout) return shown;
  const leaves = new Map(shown.flatMap((g) => g.items).map((it) => [it.id, it]));
  const used = new Set();
  const groups = layout.map(({ group, items }) => ({
    group,
    items: items.flatMap((e) => {
      if (typeof e === 'string') { const it = leaves.get(e); if (!it) return []; used.add(e); return [it]; }
      const tabs = e.tabs.map((t) => (Array.isArray(t) ? t : [t])).map(([id, label]) => ({ id, label, item: leaves.get(id) })).filter((t) => t.item)
        .map((t) => ({ ...t, label: t.label ?? t.item.label }));
      tabs.forEach((t) => used.add(t.id));
      if (!tabs.length) return [];
      if (tabs.length === 1) return [tabs[0].item];
      return [{ id: `hub:${e.hub}`, hub: e.hub, label: e.label, icon: e.icon, screen: tabs[0].item.screen, tabs }];
    }),
  })).filter((g) => g.items.length);
  // écrans visibles non prévus (ex. accordés par « Droits d'accès ») : jamais perdus
  const rest = [...leaves.values()].filter((it) => !used.has(it.id));
  return rest.length ? [...groups, { group: 'Autres', items: rest }] : groups;
}

/** Rubrique à onglets qui contient cet écran (ou null). */
export const hubOf = (menu, screenId) => menu.flatMap((g) => g.items).find((it) => it.tabs?.some((t) => t.id === screenId)) ?? null;
