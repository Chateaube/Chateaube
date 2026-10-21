// Emploi du temps en vigueur : celui importé (Importer et sauvegarder, gardé dans ce navigateur comme les
// élèves), sinon celui de la démonstration.
import { TIMETABLE } from './data/timetable.js';
import { loadImport } from './importStore.js';

export const importedTimetable = () => loadImport()?.timetable ?? null;
export const loadTimetable = () => importedTimetable() ?? TIMETABLE;
