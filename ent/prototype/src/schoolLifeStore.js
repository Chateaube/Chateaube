// Vie de l'école : publications et propositions de photos (prototype : gardées dans ce navigateur).
import { SCHOOL_POSTS } from './data/schoolLife.js';

const KEY = 'ent-vie-ecole-v1';
export const loadPosts = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? SCHOOL_POSTS; } catch { return SCHOOL_POSTS; } };
export const savePosts = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch { return false; } };
