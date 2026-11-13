// Portail des élèves en ligne : ce que la Direction publie pour eux (« ecole ») et la fiche de chaque élève
// (« eleve:<id> »). Rien d'autre n'est lisible par un élève : ni les notes (17 décembre), ni les autres élèves.
import { fetchDoc } from './docs.js';
import { setRemoteImport } from '../importStore.js';
import { writeStored } from '../persist.js';
import { setSheetOwner } from '../components/OrientationSheet.jsx';

/** Ce qui part pour les élèves : emploi du temps, changements, calendrier, événements (sauf ceux de l'équipe). */
export function buildSchool({ timetable = [], changes = [], calendar = null, events = [] }) {
  return {
    timetable: timetable.map(({ id, weekday, start, end, cls, subject, part, teacherId, room, week }) => ({ id, weekday, start, end, cls, subject, ...(part ? { part } : {}), teacherId, room: room ?? '', ...(week ? { week } : {}) })),
    changes,
    calendar,
    events: events.filter((e) => e.agenda !== 'EQUIPE'),
    sentAt: new Date().toISOString(),
  };
}

let me = null; let school = null;
export const currentStudent = () => me;
export const currentSchool = () => school;

/** Au démarrage d'un compte élève : sa fiche, puis l'emploi du temps et le calendrier de l'école. */
export async function loadStudentContext(accountId) {
  const [mine, ecole, orient] = await Promise.all([fetchDoc(`eleve:${accountId}`), fetchDoc('ecole'), fetchDoc(`orientation:${accountId}`)]);
  me = mine?.value ? { id: accountId, ...mine.value } : null;
  school = ecole?.value ?? null;
  if (me) setRemoteImport({ students: [{ cls: me.cls, lastName: me.lastName, firstName: me.firstName, specialties: me.specialties ?? [] }], timetable: school?.timetable ?? [], importedAt: school?.sentAt ?? 'x' });
  if (me) setSheetOwner(`${me.lastName} ${me.firstName}`.trim(), accountId, orient?.value?.sheet ?? null);
  // agenda : événements et changements de cours publiés (cet appareil seulement)
  if (school) {
    writeStored('ent-s-evenements', school.events ?? []);
    try { localStorage.setItem('ent-changements-edt-v1', JSON.stringify(school.changes ?? [])); } catch { /* rien */ }
  }
  return { me, school };
}

/** Personnel (hors Direction) : emploi du temps, changements et événements publiés, pour l'agenda. */
export async function loadSchoolForStaff(students = []) {
  const ecole = await fetchDoc('ecole').catch(() => null);
  school = ecole?.value ?? null;
  if (!school) return null;
  setRemoteImport({ students, timetable: school.timetable ?? [], importedAt: school.sentAt ?? 'x' });
  writeStored('ent-s-evenements', school.events ?? []);
  try { localStorage.setItem('ent-changements-edt-v1', JSON.stringify(school.changes ?? [])); } catch { /* rien */ }
  return school;
}
