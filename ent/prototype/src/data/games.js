// Jeux de société de la salle d'étude (démonstration) : pour que les élèves posent leur téléphone,
// interdit dans l'établissement (sauf en sortant, après les cours).
export const GAMES = [
  { id: 'g1', name: 'Échecs', pieces: '32 pièces, 1 plateau', copies: 3, state: 'BON' },
  { id: 'g2', name: 'Uno', pieces: '108 cartes', copies: 2, state: 'BON' },
  { id: 'g3', name: 'Scrabble', pieces: '102 lettres, 4 chevalets, 1 plateau, 1 sac', copies: 1, state: 'USE' },
  { id: 'g4', name: 'Dames', pieces: '40 pions, 1 plateau', copies: 2, state: 'BON' },
  { id: 'g5', name: 'Fanorona', pieces: '44 pions, 1 plateau', copies: 2, state: 'BON' },
  { id: 'g6', name: 'Jenga', pieces: '54 blocs', copies: 1, state: 'BON' },
  { id: 'g7', name: 'Monopoly', pieces: 'Plateau, billets, cartes, 2 dés, 8 pions, maisons et hôtels', copies: 1, state: 'USE' },
];
// Cahier des jeux : qui prend quel jeu, quand, et s'il revient complet
export const GAME_LOG = [
  { id: 'j1', gameId: 'g1', cls: 'Terminale STMG', who: 'Tojo, Nathan', out: '2026-10-12T12:05', back: '2026-10-12T12:55', complete: true },
  { id: 'j2', gameId: 'g2', cls: '1re STMG', who: 'Mialy, Fanja, Tsiry', out: '2026-10-12T12:10', back: '2026-10-12T12:50', complete: true },
  { id: 'j3', gameId: 'g3', cls: '5e', who: 'Lova, Tiavina', out: '2026-10-12T12:15', back: '2026-10-12T12:55', complete: false, note: 'Il manque la lettre W' },
  { id: 'j4', gameId: 'g1', cls: '3e', who: 'Hasina, Miora', out: '2026-10-13T10:05', back: '2026-10-13T10:20', complete: true },
  { id: 'j5', gameId: 'g5', cls: '4e', who: 'Fy, Toavina', out: '2026-10-13T12:05', back: null, complete: null },
  { id: 'j6', gameId: 'g2', cls: 'Terminale Générale', who: 'Mamy, Andry', out: '2026-10-09T12:10', back: '2026-10-09T12:50', complete: true },
  { id: 'j7', gameId: 'g1', cls: '1re STMG', who: 'Hery, Kanto', out: '2026-10-09T12:05', back: '2026-10-09T12:50', complete: true },
];
