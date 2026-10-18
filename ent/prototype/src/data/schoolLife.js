// « Vie de l'école » : albums et photos des actions de l'école (démonstration ; illustrations, pas de vraies photos).
const pic = (bg, fg, emoji, text) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bg}"/><circle cx="330" cy="60" r="90" fill="${fg}" opacity=".25"/><circle cx="60" cy="260" r="70" fill="${fg}" opacity=".2"/><text x="200" y="150" font-size="84" text-anchor="middle">${emoji}</text><text x="200" y="240" font-size="22" font-family="Poppins, sans-serif" fill="#3b0a2a" text-anchor="middle">${text}</text></svg>`)}`;

export const SCHOOL_POSTS = [
  { id: 'p1', title: 'Octobre rose : toute l\'école en rose', text: 'Élèves, professeurs et personnel se sont habillés en rose pour soutenir la lutte contre le cancer du sein. Merci à tous !',
    date: '2026-10-09', author: 'Direction', authorRole: 'DIRECTION', authorName: 'Direction', status: 'PUBLIEE', publishedAt: '2026-10-09T17:00',
    photos: [pic('#fbcfe8', '#db2777', '🎀', 'Photo de groupe'), pic('#fce7f3', '#be185d', '👚', 'La 1re STMG en rose'), pic('#fdf2f8', '#ec4899', '💗', 'Le ruban géant')] },
  { id: 'p2', title: 'Octobre rose — photos de la 1re STMG', text: 'Nos photos de la journée en rose !', date: '2026-10-10', author: 'Aina (1re STMG)', authorDisplay: 'Aina (1re STMG)', authorName: 'Aina (1re STMG)', authorRole: 'ELEVE', cls: '1re STMG', kind: 'VIE_ECOLE',
    status: 'EN_ATTENTE', parent: 'p1', photos: [pic('#fbcfe8', '#9d174d', '📸', 'Selfie de la classe')] },
  { id: 'p3', title: 'Sortie au port de Tamatave', text: 'Les 1re STMG ont découvert la logistique portuaire.', date: '2026-10-22', author: 'Mme Ranaivo', authorDisplay: 'Mme Ranaivo', authorName: 'Mme Ranaivo', authorRole: 'ENSEIGNANT', kind: 'VIE_ECOLE',
    status: 'EN_ATTENTE', photos: [pic('#dbeafe', '#1d4ed8', '⚓', 'Visite du port')] },
];
