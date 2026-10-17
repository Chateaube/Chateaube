// Appréciations générales du conseil (démonstration : gardées dans ce navigateur, partagées entre
// le secrétariat et la Direction ; en production, table report_comment).
const KEY = 'ent-appgen-v1';
export const loadGA = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
export const saveGA = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage indisponible */ } };
