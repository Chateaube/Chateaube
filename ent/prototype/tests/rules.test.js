import { test } from 'node:test';
import { buildXlsx } from '../src/xlsx.js';
import assert from 'node:assert/strict';
import { normalizeGrade } from '../src/rules/gradeInput.js';
import { checkAppreciation, autoFix, decisionText } from '../src/rules/appreciation.js';
import { validateSlot, findConflicts, suggestAlternatives } from '../src/rules/booking.js';
import { splitExamFee, dunningStages } from '../src/rules/finance.js';
import { dayStatus, dunningSchedule, stageOn, pausesBetween, planMonths, madagascarHolidays, easterSunday } from '../src/rules/calendar.js';
import { DEFAULT_SETTINGS } from '../src/data/settings.js';
import { generateDraft } from '../src/rules/assistant.js';

const rules = (r) => r.errors.map((e) => e.rule);

// --- Saisie des notes --------------------------------------------------------
test('lettre o / O à la place du 0 → suggestion', () => {
  for (const [raw, expected] of [['1O', '10'], ['o', '0'], ['O8', '8'], ['1o,5', '10,5'], ['l2', '12']]) {
    const r = normalizeGrade(raw);
    assert.equal(r.state, 'suggest', raw);
    assert.equal(r.suggestion, expected, raw);
  }
});

test('point décimal → virgule, note valide', () => {
  const r = normalizeGrade('12.5');
  assert.equal(r.state, 'valid');
  assert.equal(r.value, 12.5);
  assert.equal(r.display, '12,5');
  assert.equal(r.messages[0].level, 'info');
});

test('virgule oubliée et dépassement du barème', () => {
  assert.equal(normalizeGrade('125').suggestion, '12,5');
  assert.equal(normalizeGrade('21').state, 'error');
  assert.equal(normalizeGrade('8', { max: 10 }).state, 'valid');
  assert.equal(normalizeGrade('12', { max: 10 }).state, 'error');
});

test('codes spéciaux et saisies invalides', () => {
  assert.equal(normalizeGrade('abs').status, 'ABSENT');
  assert.equal(normalizeGrade('Disp').status, 'DISPENSE');
  assert.equal(normalizeGrade('').state, 'empty');
  assert.equal(normalizeGrade('douze').state, 'error');
  assert.equal(normalizeGrade('12,5,3').state, 'error');
});

// --- Appréciations -----------------------------------------------------------
const GOOD = 'Aina fournit un travail sérieux et régulier. Il convient de poursuivre ainsi au prochain trimestre.';

test('appréciation conforme', () => {
  const r = checkAppreciation(GOOD);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.stats.complete, 2);
});

test('au moins deux phrases complètes', () => {
  assert.deepEqual(rules(checkAppreciation('Bon trimestre.')), ['MIN_SENTENCES']);
  assert.deepEqual(rules(checkAppreciation('Bien. Continuez.')), ['MIN_SENTENCES']); // phrases trop courtes
});

test('tutoiement détecté, sans faux positifs sur les mots accentués', () => {
  assert.ok(rules(checkAppreciation('Tu es sérieux en classe. Tu dois continuer ainsi.')).includes('TUTOIEMENT'));
  assert.ok(rules(checkAppreciation('Les efforts sont réels en classe. Il faut que t\'apprennes tes leçons.')).includes('TUTOIEMENT'));
  assert.ok(rules(checkAppreciation('Les résultats sont bons cette fois. Garde ton sérieux toute l\'année.')).includes('TUTOIEMENT'));
  // « exprimées », « été », « étoile », « le ton de ses écrits » ne sont PAS du tutoiement
  const ok = checkAppreciation('Les idées exprimées ont été pertinentes ce trimestre. Le ton de ses écrits est juste et nuancé.');
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
});

test('impératif de 2e personne → avertissement', () => {
  const r = checkAppreciation('Les résultats sont solides en classe. Continue ainsi jusqu\'à la fin.');
  assert.ok(r.warnings.some((w) => w.rule === 'TUTOIEMENT'));
});

test('formules décourageantes', () => {
  const r = checkAppreciation('Les résultats sont fragiles en classe. Il devra faire ses preuves au prochain trimestre.');
  assert.deepEqual(rules(r), ['DECOURAGEANT']); // signalé une seule fois malgré deux motifs
  assert.ok(rules(checkAppreciation('Un travail médiocre ce trimestre. Les leçons ne sont pas apprises.')).includes('DECOURAGEANT'));
  assert.ok(checkAppreciation('Les notes sont en baisse ce trimestre. Elle peut mieux faire en classe.').warnings.length > 0);
});

test('formulation inclusive officielle des décisions', () => {
  for (const bad of ['Admis en classe de 1re', 'Admise en classe de 1re', 'Admis(e) en classe de 1re', 'Retenue en classe de 2de']) {
    const r = checkAppreciation(`Le trimestre est réussi dans l'ensemble. ${bad}.`);
    assert.deepEqual(rules(r), ['INCLUSIF'], bad);
  }
  assert.equal(checkAppreciation('Le trimestre est réussi dans l\'ensemble. Admis.e en classe de 1re.').ok, true);
  assert.equal(autoFix('admise en classe de Terminale'), 'Admis.e en classe de Terminale.');
  assert.equal(decisionText('RETENU', '3e'), 'Retenu.e en classe de 3e');
});

test('parcours d\'ouverture : pas de note chiffrée', () => {
  const r = checkAppreciation('Très bonne implication dans les ateliers. Travail noté 15/20 sur le projet.', { mode: 'APPRECIATION_SEULE' });
  assert.ok(rules(r).includes('SANS_NOTE'));
});

test('les brouillons de l\'assistant sont toujours conformes', () => {
  for (let seed = 0; seed < 4; seed++) {
    for (const average of [6, 11, 16]) {
      for (const trend of ['hausse', 'stable', 'baisse']) {
        const t = generateDraft({ firstName: 'Fanja', subject: 'Mathématiques', average, trend, seed });
        assert.equal(checkAppreciation(t).ok, true, t);
      }
    }
  }
  for (const strand of ['NUMERIQUE', 'ORIENTATION', 'ART']) {
    const t = generateDraft({ firstName: 'Fanja', subject: 'Parcours', mode: 'APPRECIATION_SEULE', strand });
    assert.equal(checkAppreciation(t, { mode: 'APPRECIATION_SEULE' }).ok, true, t);
  }
});

// --- Réservations ------------------------------------------------------------
const resources = [
  { id: 'vp1', type: 'VIDEOPROJECTEUR', siteId: 'TMV' },
  { id: 'vp2', type: 'VIDEOPROJECTEUR', siteId: 'TMV' },
  { id: 'vp3', type: 'VIDEOPROJECTEUR', siteId: 'TANA' },
];
const bookings = [
  { resourceId: 'vp1', date: '2026-10-14', start: '10:00', end: '11:00' },
  { resourceId: 'vp2', date: '2026-10-14', start: '10:30', end: '11:30', status: 'ANNULEE' },
];

test('horaires : mercredi fermeture à 12h, week-end fermé', () => {
  assert.equal(validateSlot({ date: '2026-10-14', start: '11:00', end: '12:00' }).ok, true); // mercredi
  assert.equal(validateSlot({ date: '2026-10-14', start: '11:30', end: '12:30' }).ok, false);
  assert.equal(validateSlot({ date: '2026-10-15', start: '15:00', end: '17:00' }).ok, true); // jeudi
  assert.equal(validateSlot({ date: '2026-10-17', start: '08:00', end: '09:00' }).ok, false); // samedi
  assert.equal(validateSlot({ date: '2026-10-15', start: '09:00', end: '10:00' }).notes.length, 1); // récré
});

test('conflits : chevauchement détecté, contigu et annulé ignorés', () => {
  assert.equal(findConflicts(bookings, { resourceId: 'vp1', date: '2026-10-14', start: '10:30', end: '11:30' }).length, 1);
  assert.equal(findConflicts(bookings, { resourceId: 'vp1', date: '2026-10-14', start: '11:00', end: '12:00' }).length, 0);
  assert.equal(findConflicts(bookings, { resourceId: 'vp2', date: '2026-10-14', start: '10:30', end: '11:30' }).length, 0);
});

test('alternatives : même site uniquement, créneaux libres', () => {
  const alt = suggestAlternatives(resources, bookings, { resourceId: 'vp1', date: '2026-10-14', start: '10:00', end: '11:00' });
  assert.deepEqual(alt.sameTime.map((r) => r.id), ['vp2']);
  assert.ok(alt.sameResource.length > 0);
  assert.ok(alt.sameResource.every((s) => findConflicts(bookings, { resourceId: 'vp1', date: '2026-10-14', ...s }).length === 0));
});

// --- Finances ----------------------------------------------------------------
const S = DEFAULT_SETTINGS;
const withDunning = (patch) => ({ ...S, dunning: { ...S.dunning, ...patch } });
// Politique précédente (J+5 / J+10 / J+25 depuis l'échéance) : mêmes cas que db/tests.sql T9-T11
const OLD = withDunning({ relanceAfter: 5, warningAfter: 10, suspensionAfter: 25, countFrom: 'ECHEANCE', lastMonth: { enabled: false } });
const withOld = (patch) => ({ ...OLD, dunning: { ...OLD.dunning, ...patch } });

test('jours comptés : week-end, férié, vacances, octobre gelé', () => {
  assert.equal(dayStatus('2026-11-12', S).counted, true);           // jeudi ordinaire
  assert.equal(dayStatus('2026-11-14', S).kind, 'WEEKEND');         // samedi
  assert.equal(dayStatus('2027-03-08', S).kind, 'FERIE');
  assert.equal(dayStatus('2026-12-25', S).kind, 'VACANCES');        // Noël pendant les vacances
  assert.equal(dayStatus('2026-10-13', S).kind, 'GEL');             // octobre
  assert.equal(dayStatus('2027-01-12', S).counted, true);           // janvier relancé désormais
});

// Mêmes cas que db/tests.sql (T9, T10) : l'interface et la base calculent les mêmes dates
test('échéance du 5 décembre : les vacances de Noël suspendent le décompte', () => {
  const sch = dunningSchedule('2026-12-05', OLD);
  assert.deepEqual(sch, { due: '2026-12-05', relance: '2026-12-11', warning: '2026-12-18', suspension: '2027-01-22' });
  assert.deepEqual(pausesBetween(sch.due, sch.suspension, OLD).map((p) => p.kind), ['VACANCES']);
});

test('échéance de septembre et d\'octobre : octobre gelé', () => {
  const sept = dunningSchedule('2026-09-05', OLD);
  assert.equal(sept.relance, '2026-09-11');
  assert.equal(sept.suspension, '2026-11-10');
  const oct = dunningSchedule('2026-10-05', OLD);
  assert.equal(oct.relance, '2026-11-06');
  assert.equal(oct.suspension, '2026-12-04');
});

test('paramètres : décompte depuis l\'étape précédente, samedi compté', () => {
  assert.deepEqual(dunningSchedule('2026-12-05', withOld({ countFrom: 'ETAPE_PRECEDENTE' })),
    { due: '2026-12-05', relance: '2026-12-11', warning: '2027-01-08', suspension: '2027-02-12' });
  assert.equal(dunningSchedule('2026-11-05', OLD).relance, '2026-11-12');
  assert.equal(dunningSchedule('2026-11-05', withOld({ countedWeekdays: [1, 2, 3, 4, 5, 6] })).relance, '2026-11-11');
});

test('étape d\'un dossier à une date donnée', () => {
  const sch = dunningSchedule('2026-12-05', OLD);
  assert.equal(stageOn('2026-12-08', sch, OLD), 'DANS_LES_DELAIS');
  assert.equal(stageOn('2026-12-11', sch, OLD), 'RELANCE');
  assert.equal(stageOn('2027-01-05', sch, OLD), 'AVERTISSEMENT');
  assert.equal(stageOn('2027-01-22', sch, OLD), 'A_VALIDER');
  assert.equal(stageOn('2027-01-22', sch, withOld({ suspensionRequiresDirection: false })), 'MISE_A_PIED');
  assert.match(dunningStages(OLD)[2].delay, /25 jours comptés après l'échéance — validation Direction/);
});

test('jours fériés de Madagascar générés automatiquement', () => {
  assert.equal(easterSunday(2027), '2027-03-28');
  const h = madagascarHolidays(2026);
  assert.ok(h.some((d) => d.start === '2027-05-06' && d.label === 'Ascension'));
  assert.ok(h.some((d) => d.start === '2027-03-29' && d.label.includes('Lundi de Pâques'))); // fusionné avec le 29 mars
  assert.equal(new Set(h.map((d) => d.start)).size, h.length);
});

test('droits d\'examen : 40 000 Ar conservés', () => {
  assert.deepEqual(splitExamFee(600_000), { retained: 40_000, toRemit: 560_000 });
  assert.deepEqual(splitExamFee(30_000), { retained: 30_000, toRemit: 0 });
});

test('plans de frais de scolarité Tamatave : 9 mois pour 1re/Tle, 10 mois sinon', () => {
  const [college, , premiere, terminale] = S.tuition.plans;
  assert.equal(planMonths(premiere).length, 9);
  assert.equal(planMonths(terminale).at(-1), 5);
  assert.equal(planMonths(college).length, 10);
});

// --- Comptabilité -------------------------------------------------------------
import { accountStatement, annualCost, cashBalance } from '../src/rules/accounting.js';
import { FAMILIES, CLASS_FEES, CASH_MOVEMENTS, CASH_OPENING, CASH_HISTORY, CASH_YEAR_OPENING } from '../src/data/accounting.js';

test('état de compte : soldes séparés par journal', () => {
  const { byJournal, totals, rows } = accountStatement(FAMILIES[0].lines);
  assert.equal(byJournal.ECOLAGE.balance, 760_000);          // frais de scolarité d'octobre impayé
  assert.equal(byJournal.FRAIS_ANNEXES.balance, 30_000);     // natation
  assert.equal(byJournal.DROITS_EXAMEN.balance, 0);
  assert.equal(totals.balance, 790_000);
  assert.equal(rows.find((r) => r.label.startsWith('Frais de scolarité octobre — Toky')).journalBalance, 760_000);
  assert.ok(rows.every((r) => r.journalBalance >= 0), 'aucun solde de journal négatif dans la démo');
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].date <= r.date));
});

test('coût annuel : 9 mois de frais de scolarité pour la Terminale, 10 pour la 6e', () => {
  const plans = DEFAULT_SETTINGS.tuition.plans;
  const tle = CLASS_FEES.find((r) => r.cls === 'Terminale STMG');
  assert.equal(annualCost(tle, plans), 180_000 + 450_000 * 9 + 90_000 + 120_000);
  const six = CLASS_FEES.find((r) => r.cls === '6e');
  assert.equal(annualCost(six, plans, { newStudent: true }), 250_000 + 330_000 * 10 + 60_000 + 80_000);
});

test('caisse : entrées et sorties par journal', () => {
  const b = cashBalance({ ECOLAGE: 250_000, FRAIS_ANNEXES: 40_000, DROITS_EXAMEN: 0 }, CASH_MOVEMENTS);
  assert.equal(b.ECOLAGE, 250_000 + 420_000 - 85_000 - 400_000);
  assert.equal(b.DROITS_EXAMEN, 950_000);
  assert.equal(b.FRAIS_ANNEXES, 110_000);
  // ouverture du jour = clôture de la veille, d'après l'historique depuis la rentrée
  assert.deepEqual(CASH_OPENING, cashBalance(CASH_YEAR_OPENING, CASH_HISTORY));
});

// --- Encaissement ---------------------------------------------------------------
import { studentDues, defaultSelection, validateInstrument, buildReceipts } from '../src/rules/billing.js';
import { STUDENT_ACCOUNTS } from '../src/data/accounting.js';

const feesOf = (cls) => CLASS_FEES.find((r) => r.cls === cls);

test('encaissement : septembre payé, octobre proposé d\'office', () => {
  const toky = STUDENT_ACCOUNTS.find((s) => s.id === 'e2');
  const items = studentDues(toky, feesOf('5e'), DEFAULT_SETTINGS, '2026-10-13');
  assert.equal(items.find((i) => i.key === 'ECO-09').status, 'PAYE');
  assert.equal(items.find((i) => i.key === 'ECO-10').status, 'ECHU');
  assert.equal(items.find((i) => i.key === 'ECO-11').status, 'A_ECHOIR');
  assert.deepEqual(defaultSelection(items), ['ECO-10']);
  assert.equal(items.filter((i) => i.journal === 'ECOLAGE').length, 10);
});

test('nouvel élève en octobre : le compte commence en octobre', () => {
  const fy = STUDENT_ACCOUNTS.find((s) => s.id === 'e4');
  const items = studentDues(fy, feesOf('4e'), DEFAULT_SETTINGS, '2026-10-13');
  const months = items.filter((i) => i.journal === 'ECOLAGE');
  assert.equal(months[0].key, 'ECO-10');
  assert.equal(months.length, 9);                       // octobre → juin
  assert.ok(items.some((i) => i.key === 'INSCRIPTION')); // inscription, pas réinscription
  assert.equal(months[0].due, '2026-10-12');            // dû à la date d'arrivée, pas le 5
  assert.deepEqual(defaultSelection(items), ['INSCRIPTION', 'FASCICULE', 'LOCATION', 'ECO-10']);
});

test('Terminale : 9 mois, droits d\'examen dans un journal séparé', () => {
  const mamy = STUDENT_ACCOUNTS.find((s) => s.id === 'e3');
  const items = studentDues(mamy, feesOf('Terminale Générale'), DEFAULT_SETTINGS, '2026-10-13');
  assert.equal(items.filter((i) => i.journal === 'ECOLAGE').at(-1).key, 'ECO-05');
  assert.equal(items.find((i) => i.key === 'EXAMEN').status, 'PAYE');
});

test('moyens de paiement : espèces, chèque, virement uniquement', () => {
  assert.deepEqual(validateInstrument({ method: 'ESPECES' }), []);
  assert.equal(validateInstrument({ method: 'CHEQUE', ref: '', bank: '' }).length, 2);
  assert.ok(validateInstrument({ method: 'CHEQUE', ref: '12AB', bank: 'BNI Madagascar' })[0].includes('6 à 10 chiffres'));
  assert.deepEqual(validateInstrument({ method: 'VIREMENT', ref: 'BRD-55120', bank: 'BOA Madagascar' }), []);
  assert.equal(validateInstrument({ method: 'MVOLA' }).length, 1);
});

test('un reçu par journal', () => {
  const fy = STUDENT_ACCOUNTS.find((s) => s.id === 'e4');
  const items = studentDues(fy, feesOf('4e'), DEFAULT_SETTINGS, '2026-10-13');
  let n = 100;
  const receipts = buildReceipts(items, ['INSCRIPTION', 'FASCICULE', 'ECO-10', 'ECO-11'], { method: 'CHEQUE', ref: '4410275', bank: 'BNI Madagascar' }, () => n++);
  assert.deepEqual(receipts.map((r) => [r.journal, r.total]), [['FRAIS_ANNEXES', 315_000], ['ECOLAGE', 700_000]]);
  assert.ok(receipts.every((r) => r.ref === '4410275'));
});

// --- Notes et conseil de classe -------------------------------------------------
import { studentAverage, termValidation, generalAverage, classStats, notesCount } from '../src/rules/grading.js';
import { SERVICES, EVALUATIONS, GRADES, CLASS_SUBJECTS, competenciesFor, historyFor, levelOf } from '../src/data/grades.js';
import { mergeCompetencySets } from '../src/rules/grading.js';

test('moyenne pondérée ramenée sur 20 (barème /10, coefficient 2)', () => {
  // Aina : DS 16/20 ×2, interro 9/10 → 18/20, oral 17, exposé 16 → (32+18+17+16)/5 = 16,6
  assert.equal(studentAverage(EVALUATIONS.s1, GRADES.s1['RAKOTOARISOA Aina']), 16.6);
  // Tsiry : ABS non compté → (18+10+12)/4 = 10
  assert.equal(studentAverage(EVALUATIONS.s1, GRADES.s1['RAJAONARIVELO Tsiry']), 10);
  assert.equal(studentAverage([], {}), null);
});

test('trimestre : 4 évaluations minimum et aucune saisie à corriger', () => {
  const s1 = termValidation(EVALUATIONS.s1, SERVICES[0].students, GRADES.s1, 4);
  assert.equal(s1.missing, 0);
  assert.equal(s1.ok, false);                                   // « 1O » de Fanja à confirmer
  assert.deepEqual(s1.pending.map((p) => p.student), ['RAHARISON Fanja']);
  assert.deepEqual(s1.below, ['RAHARISON Fanja', 'RAJAONARIVELO Tsiry', 'RAMAROSON Fitia']);
  const fixed = { ...GRADES.s1, 'RAHARISON Fanja': { ...GRADES.s1['RAHARISON Fanja'], v3: '10' } };
  assert.equal(termValidation(EVALUATIONS.s1, SERVICES[0].students, fixed, 4).ok, true);
  const tle = termValidation(EVALUATIONS.s2, SERVICES[1].students, GRADES.s2, 4);
  assert.equal(tle.missing, 1);
  assert.deepEqual(tle.below, []);                              // pas de faux signalement « absences »
  const withEmpty = termValidation([...EVALUATIONS.s2, { id: 'w4', title: 'Exposé', scale: 20, coef: 1 }], SERVICES[1].students, GRADES.s2, 4);
  assert.equal(withEmpty.ok, false);                            // nouvelle note créée mais pas saisie
  assert.equal(withEmpty.empty.length, SERVICES[1].students.length);
  assert.equal(notesCount(EVALUATIONS.s1, fixed['RAHARISON Fanja']), 4);
});

test('moyenne générale : Arts plastiques, Musique et Vie de classe exclus', () => {
  const avgs = CLASS_SUBJECTS.map((s) => ({ ...s, avg: s.inAverage ? 12 : 20 }));
  assert.equal(generalAverage(avgs), 12);
  assert.equal(generalAverage([{ inAverage: true, avg: 10, coef: 1 }, { inAverage: true, avg: 16, coef: 2 }, { inAverage: true, avg: null }]), 14);
  assert.deepEqual(classStats([10, 12, null, 14]), { avg: 12, min: 10, max: 14 });
});

test('compétences : base proposée par niveau (collège) ou par série (lycée), issue des trimestres précédents', () => {
  assert.equal(levelOf('5e B'), '5e');
  assert.equal(levelOf('2de A'), '2de');
  assert.equal(levelOf('1re Générale'), '1re G');
  assert.equal(levelOf('1re STMG'), '1re STMG');
  assert.equal(levelOf('Terminale Générale'), 'Tle G');
  const emc1STMG = SERVICES.find((s) => s.id === 's3');
  const emc1G = SERVICES.find((s) => s.id === 's4');
  const base = competenciesFor(emc1STMG, DEFAULT_SETTINGS);
  assert.ok(base.length >= 3);
  assert.notDeepEqual(competenciesFor(emc1G, DEFAULT_SETTINGS), base);
  assert.equal(historyFor(emc1STMG).length, 3); // trois trimestres précédents
  assert.notDeepEqual(competenciesFor(SERVICES[0], DEFAULT_SETTINGS), competenciesFor(SERVICES[1], DEFAULT_SETTINGS)); // Management 1re ≠ Terminale
  // fusion sans doublon, sans tenir compte de la casse
  assert.deepEqual(mergeCompetencySets([{ items: ['Lire', 'Écrire'] }, { items: ['lire ', 'Compter'] }]), ['Lire', 'Écrire', 'Compter']);
});

import { councilProposal } from '../src/rules/grading.js';
test('conseil : proposition de mention ou d\'avertissement', () => {
  assert.equal(councilProposal(16.2, ['EXEMPLAIRE']), 'FELICITATIONS');
  assert.equal(councilProposal(14.5, []), 'COMPLIMENTS');
  assert.equal(councilProposal(11, ['ENCOURAGEMENTS']), 'ENCOURAGEMENTS');
  assert.equal(councilProposal(9.5, ['BAVARD', 'BAVARD', 'MANQUE_TRAVAIL']), 'AVERT_COMPORTEMENT');
  assert.equal(councilProposal(8, ['AVERT_TRAVAIL', 'MANQUE_TRAVAIL', 'BAVARD', 'AVERT_COMPORTEMENT']), 'AVERT_TRAVAIL_COMPORTEMENT');
  assert.equal(councilProposal(15, ['BAVARD']), 'COMPLIMENTS'); // un seul avis : pas d'avertissement
});

// --- Vie scolaire ------------------------------------------------------------------
import { validateMeasure, phoneReturnAt, isSchoolDay } from '../src/rules/discipline.js';

test('mesures : motif obligatoire, sanction réservée à la Direction', () => {
  assert.deepEqual(validateMeasure({ measureId: 'RETENUE', authorRole: 'PROFESSEUR', reason: 'Travail non fait', student: 'X' }), []);
  assert.ok(validateMeasure({ measureId: 'RETENUE', authorRole: 'PROFESSEUR', reason: ' ', student: 'X' })[0].includes('motif'));
  assert.ok(validateMeasure({ measureId: 'BLAME', authorRole: 'VIE_SCOLAIRE', reason: 'Insolence', student: 'X' })[0].includes('Direction'));
  for (const r of ['PROFESSEUR', 'VIE_SCOLAIRE', 'BUREAU']) assert.deepEqual(validateMeasure({ measureId: 'AVERTISSEMENT', authorRole: r, reason: 'Bavardages répétés', student: 'X' }), []);
  assert.deepEqual(validateMeasure({ measureId: 'BLAME', authorRole: 'DIRECTION', reason: 'Insolence', student: 'X' }), []);
});

// Calendrier d'exemple figé pour ces tests (indépendant du calendrier réel de l'école dans DEFAULT_SETTINGS)
const EXAMPLE_SETTINGS = { ...DEFAULT_SETTINGS, calendar: [...DEFAULT_SETTINGS.calendar.filter((c) => c.kind === 'FERIE'),
  { id: 'v1', kind: 'VACANCES', start: '2026-10-24', end: '2026-11-01' }, { id: 'v2', kind: 'VACANCES', start: '2026-12-19', end: '2027-01-03' }] };
test('téléphone : 24 h ou 5 jours ouvrés, vacances et week-ends exclus', () => {
  assert.equal(phoneReturnAt('2026-10-13T15:00', '24H', EXAMPLE_SETTINGS), '2026-10-14T15:00');
  assert.equal(phoneReturnAt('2026-10-13T15:00', '5J', EXAMPLE_SETTINGS), '2026-10-20T15:00');
  assert.equal(phoneReturnAt('2026-10-16T15:00', '48H', EXAMPLE_SETTINGS), '2026-10-20T15:00'); // vendredi → mardi
  assert.deepEqual([0, 1, 2].map((n) => phoneDurationFor('A', Array.from({ length: n }, () => ({ student: 'A' }))).duration), ['24H', '48H', '5J']);
  assert.equal(phoneReturnAt('2026-10-22T10:00', '5J', EXAMPLE_SETTINGS), '2026-11-05T10:00'); // vacances de la Toussaint
  assert.equal(phoneReturnAt('2026-12-18T09:00', '24H', EXAMPLE_SETTINGS), '2027-01-04T09:00'); // vacances de Noël
  assert.equal(phoneReturnAt('2026-12-17T10:00', '5J', EXAMPLE_SETTINGS), '2027-01-07T10:00');
  assert.equal(isSchoolDay('2026-10-14', EXAMPLE_SETTINGS), true); // octobre n'est pas gelé pour la vie scolaire
});

import { councilCsv } from '../src/rules/grading.js';
test('export de la grille : CSV pour Excel (point-virgule, virgule décimale)', () => {
  const csv = councilCsv({
    className: '1re STMG', term: '1er trimestre',
    subjects: [{ label: 'Français', inAverage: true }, { label: 'Musique', inAverage: false }],
    rows: [{ name: 'RAKOTOARISOA Aina', subjects: [{ avg: 15.5 }, { avg: 17 }], general: 15.5, abs: 0, late: 1, flags: 'Élève exemplaire', decision: 'Compliments', appreciation: 'Excellent trimestre; bravo.' }],
  });
  assert.ok(csv.startsWith('﻿Conseil de classe — 1re STMG'));
  const line = csv.split('\r\n')[2];
  assert.equal(line, 'RAKOTOARISOA Aina;15,5;17;15,5;0;1;Élève exemplaire;Compliments;"Excellent trimestre; bravo."');
  assert.ok(csv.split('\r\n')[1].includes('Musique (hors moy.)'));
});

import { studentNoteList, fmt2 } from '../src/rules/grading.js';
test('portail parent : notes chronologiques avec moyenne, max et min de la classe', () => {
  const list = studentNoteList(EVALUATIONS.s1, SERVICES[0].students, GRADES.s1, 'RAJAONARIVELO Tsiry');
  assert.deepEqual(list.map((n) => n.date), ['2026-09-24', '2026-10-01', '2026-10-06', '2026-10-08']);
  assert.equal(list[0].value, 9);
  assert.equal(fmt2(list[0].value), '9,00');
  assert.equal(list[0].max, 16);
  assert.equal(list[0].min, 7.5);
  assert.equal(list[1].status, 'ABSENT');                       // ABS : pas de note, mais l'évaluation apparaît
  assert.equal(list[2].avg, 12.67);                              // (15+10+17+9+13+12)/6 : « 1O » non confirmé et ABS exclus
});

import { phoneDurationFor, validateReturn, ackReminderDue } from '../src/rules/discipline.js';
test('téléphone : récidive → 5 jours ouvrés ; restitution à un parent pour 5 jours', () => {
  const phones = [{ student: 'A', duration: '24H' }];
  assert.deepEqual(phoneDurationFor('A', phones), { duration: '48H', previous: 1 });
  assert.deepEqual(phoneDurationFor('B', phones), { duration: '24H', previous: 0 });
  assert.deepEqual(validateReturn({ duration: '24H', toRole: 'ELEVE', toName: 'Lina' }), []);
  assert.equal(validateReturn({ duration: '5J', toRole: 'ELEVE', toName: 'Hery' }).length, 1);
  assert.deepEqual(validateReturn({ duration: '5J', toRole: 'PARENT', toName: 'M. Randriamampianina (père)' }), []);
});

test('« Je suis informé.e » : relance après 48 h sans réponse', () => {
  assert.equal(ackReminderDue('2026-10-11T08:00', null, '2026-10-13T09:00'), true);
  assert.equal(ackReminderDue('2026-10-12T12:00', null, '2026-10-13T09:00'), false);
  assert.equal(ackReminderDue('2026-10-08T08:00', '2026-10-08T19:00', '2026-10-13T09:00'), false);
});

import { isPublished, parentPublishOn } from '../src/rules/grading.js';
test('« Ramener sur 20 » : la note compte sur 20 ou en points dans son barème', () => {
  const g = { e1: '8', e2: '14' };
  const on = [{ id: 'e1', scale: 10, coef: 1 }, { id: 'e2', scale: 20, coef: 1 }];
  assert.equal(studentAverage(on, g), 15);                                  // (16 + 14) / 2
  const off = [{ id: 'e1', scale: 10, coef: 1, normalize: false }, { id: 'e2', scale: 20, coef: 1 }];
  assert.equal(studentAverage(off, g), 14.67);                              // 22 points / 30 → 14,67
});

test('publication : élèves à la date choisie, parents un jour après', () => {
  const ev = { date: '2026-10-13', publishOn: '2026-10-14' };
  assert.equal(parentPublishOn(ev, DEFAULT_SETTINGS), '2026-10-15');
  assert.equal(isPublished(ev, 'ELEVE', '2026-10-14', DEFAULT_SETTINGS), true);
  assert.equal(isPublished(ev, 'PARENT', '2026-10-14', DEFAULT_SETTINGS), false);
  assert.equal(isPublished(ev, 'PARENT', '2026-10-15', DEFAULT_SETTINGS), true);
});

// --- Terminale : Parcoursup et Campus France --------------------------------------
import { higherEdSteps, exportWindowOpen, campusFranceCsv } from '../src/rules/orientation.js';
test('Terminale : Parcoursup pour tous, puis Campus France et TLScontact si visa', () => {
  assert.deepEqual(higherEdSteps(['FR']), ['PARCOURSUP']);
  assert.deepEqual(higherEdSteps(['MG']), ['PARCOURSUP', 'CAMPUS_FRANCE', 'TLS']);
  assert.deepEqual(higherEdSteps(['MG', 'FR']), ['PARCOURSUP']);        // double nationalité : pas de visa
  assert.deepEqual(higherEdSteps(['KM']), ['PARCOURSUP', 'CAMPUS_FRANCE', 'TLS']);
});

test('export Campus France : après le Bac, jusqu\'à début septembre', () => {
  const w = { opensOn: '2027-07-05', closesOn: '2027-09-05' };
  assert.equal(exportWindowOpen('2026-10-13', w), false);
  assert.equal(exportWindowOpen('2027-08-01', w), true);
  const csv = campusFranceCsv([{ lastName: 'RANDRIA', firstName: 'Mamy', birthDate: '2008-04-02', nationalities: ['MG'], cls: 'Terminale Générale', bac: 'Admis', mention: 'Bien', email: 'm@ex.mg' }]);
  assert.equal(csv.split('\r\n')[1], 'RANDRIA;Mamy;02/04/2008;MG;Terminale Générale;Admis;Bien;Parcoursup + Campus France (Études en France) + TLScontact (visa);m@ex.mg');
});

import { formatDateFr } from '../src/rules/calendar.js';
test('dates en français : « 1er » pour le premier du mois', () => {
  assert.equal(formatDateFr('2026-10-01'), 'jeudi 1er octobre 2026');
  assert.equal(formatDateFr('2027-01-20'), 'mercredi 20 janvier 2027');
});

import { competencyProposals } from '../src/rules/grading.js';
test('compétences : base proposée + compétences écrites par l\'enseignant', () => {
  const base = ['Chercher', 'Modéliser', 'Raisonner'];
  assert.deepEqual(competencyProposals(base, []), base);
  assert.deepEqual(competencyProposals(base, ['modéliser ', 'Analyser un document']), ['Chercher', 'Raisonner']);
});

import { amountInWords } from '../src/rules/finance.js';
test('reçu : montant en toutes lettres', () => {
  assert.equal(amountInWords(360_000), 'trois cent soixante mille ariary');
  assert.equal(amountInWords(1_440_000), 'un million quatre cent quarante mille ariary');
  assert.equal(amountInWords(80_000), 'quatre-vingts mille ariary');
  assert.equal(amountInWords(71_500), 'soixante et onze mille cinq cents ariary');
  assert.equal(amountInWords(200_000), 'deux cent mille ariary');
  assert.equal(amountInWords(2_070_000), 'deux millions soixante-dix mille ariary');
  assert.equal(amountInWords(91_000), 'quatre-vingt-onze mille ariary');
});

import { isLastPlanMonth } from '../src/rules/calendar.js';
test('relances : 10 j, puis 15 j, puis 10 j après l\'étape précédente ; dernier mois 5 / 5 / 5', () => {
  // 5 novembre : relance le 19/11, avertissement le 10/12, mise à pied le 7/01 (vacances de Noël non comptées)
  assert.deepEqual(dunningSchedule('2026-11-05', S), { due: '2026-11-05', relance: '2026-11-19', warning: '2026-12-10', suspension: '2027-01-07' });
  // Mai = dernier mois des 1re/Tle (plan 3) : 5 jours à chaque étape, Ascension (6 mai) non comptée
  assert.equal(isLastPlanMonth('2027-05-05', 3, S), true);
  assert.equal(isLastPlanMonth('2027-05-05', 0, S), false); // collège : dernier mois = juin
  assert.deepEqual(dunningSchedule('2027-05-05', S, { lastMonth: true }), { due: '2027-05-05', relance: '2027-05-13', warning: '2027-05-21', suspension: '2027-05-28' });
  assert.match(dunningStages(S)[0].delay, /10 jours comptés après l'étape précédente \(dernier mois : 5\)/);
});

import { monthlyCashReport, cashMonthCsv, methodOf } from '../src/rules/accounting.js';
test('caisse : export mensuel (soldes d\'ouverture et de clôture, modes, journaux)', () => {
  const H = [
    { date: '2026-09-07', time: '08:00', dir: 'IN', journal: 'ECOLAGE', method: 'Espèces', amount: 400_000, label: 'Sept', nature: 'Encaissement famille', agent: 'A' },
    { date: '2026-10-02', time: '09:00', dir: 'IN', journal: 'ECOLAGE', method: 'Chèque n° 1234567', amount: 300_000, label: 'Oct', nature: 'Encaissement famille', agent: 'A' },
    { date: '2026-10-02', time: '10:00', dir: 'OUT', journal: 'ECOLAGE', method: 'Espèces', amount: 100_000, label: 'Dépôt', nature: 'Dépôt en banque', agent: 'A' },
    { date: '2026-10-05', time: '10:00', dir: 'IN', journal: 'DROITS_EXAMEN', method: 'Virement — bordereau 9', amount: 600_000, label: 'Bac', nature: 'Encaissement famille', agent: 'A' },
  ];
  const r = monthlyCashReport({ ECOLAGE: 50_000, FRAIS_ANNEXES: 0, DROITS_EXAMEN: 0 }, H, '2026-10', ['ECOLAGE', 'FRAIS_ANNEXES', 'DROITS_EXAMEN']);
  assert.equal(r.opening.ECOLAGE, 450_000);   // ouverture d'octobre = clôture de septembre
  assert.equal(r.closing.ECOLAGE, 650_000);
  assert.deepEqual(r.byMethod.Chèque, { in: 300_000, out: 0 });
  assert.deepEqual(r.totals, { in: 900_000, out: 100_000 });
  assert.equal(r.movements.length, 3);
  assert.equal(methodOf({ method: 'Virement — bordereau 9' }), 'Virement');
  const csv = cashMonthCsv(r, { site: 'Tamatave', journalLabels: { ECOLAGE: 'Frais de scolarité', FRAIS_ANNEXES: 'Frais annexes', DROITS_EXAMEN: 'Droits d\'examen' } });
  assert.match(csv, /^﻿Caisse Tamatave — 10\/2026/);
  assert.match(csv, /Frais de scolarité;450000;300000;100000;650000/);
  assert.match(csv, /02\/10\/2026;09:00;Entrée;Encaissement famille;Oct;Frais de scolarité;Chèque n° 1234567;A;300000;/);
});

import { nextPreregStep, nextClass, validateProfile, accountsFor, missingDocuments } from '../src/rules/enrollment.js';
test('inscriptions : pré-inscription, fiche élève, comptes', () => {
  assert.equal(nextPreregStep('DEMANDE'), 'DOSSIER');
  assert.equal(nextPreregStep('ENTRETIEN'), 'ACCEPTEE');
  assert.equal(nextPreregStep('ACCEPTEE'), null); // se convertit en inscription
  assert.equal(nextClass('3e'), '2de');
  assert.equal(nextClass('1re STMG'), 'Terminale STMG');
  assert.equal(nextClass('Terminale Générale'), null);
  const p = { lastName: 'RAKOTO', firstName: 'Éléa', birthDate: '2013-04-02', nationalities: ['MG'], cls: '6e', previousSchool: 'EPP Tamatave', previousSystem: 'MALGACHE',
    guardians: [{ name: 'Mme Rakoto Voahangy', relation: 'Mère', phone: '+261 34 12 345 67', email: 'voahangy@gmail.com', payer: true }, { name: 'M. Rakoto', relation: 'Père', phone: '+261 32 11 222 33' }] };
  assert.deepEqual(validateProfile(p), []);
  assert.ok(validateProfile({ ...p, guardians: [{ ...p.guardians[0], payer: false }] }).includes('Indiquer le responsable qui règle les frais.'));
  assert.ok(validateProfile({ ...p, previousSchool: '' }).length === 1);
  assert.deepEqual(validateProfile({ ...p, previousSchool: '' }, { kind: 'REINSCRIPTION' }), []);
  const acc = accountsFor(p);
  assert.equal(acc[0].login, 'elea.rakoto@chateaubriand-tamatave.mg');
  assert.equal(acc[1].login, 'voahangy@gmail.com');
  assert.equal(acc[2].login, null); // pas d'e-mail : code d'activation
  assert.equal(missingDocuments({ cls: '5e', documents: ['PHOTOS'] }, 'REINSCRIPTION').length, 1); // vaccins
  assert.deepEqual(missingDocuments({ cls: 'Terminale STMG', documents: ['PHOTOS'] }, 'REINSCRIPTION').map((d) => d.id), ['ACTE', 'VACCINS']);
  assert.deepEqual(missingDocuments({ cls: '6e', documents: [] }, 'INSCRIPTION').map((d) => d.id), ['ACTE', 'PHOTOS', 'BULLETINS', 'VACCINS']);
});

import { parseTable, normalizeClass, normalizePhones, analyzeStudents, parseAssignments, nationalityCode } from '../src/rules/importer.js';
test('import Excel : classes, téléphones, nationalités, contrôles', () => {
  assert.equal(normalizeClass('1e STMG'), '1re STMG');
  assert.equal(normalizeClass('1e Générale'), '1re Générale');
  assert.equal(normalizeClass('Tle Générale'), 'Terminale Générale');
  assert.equal(normalizeClass('Tle STMG'), 'Terminale STMG');
  assert.equal(normalizeClass('2nde'), '2de');
  assert.equal(normalizeClass('6e'), '6e');
  assert.deepEqual(normalizePhones('03 40 97 71 50').map((p) => p.value), ['+261 34 09 771 50']);
  assert.equal(normalizePhones('0389586083 / 0347450018').length, 2);
  assert.equal(nationalityCode('Canadienne'), 'CA');
  assert.equal(nationalityCode('Yemenite'), 'YE');
  // Données FICTIVES au format du fichier de l'établissement
  const text = [
    'N°\tClasse\tNom\tPrénom\tNée le\tLieu de naissance\tNationalité (en +)\tExamen FR\tAdresse @\tContact',
    '3E-001\t3e\tRAKOTO\tFanja\t12/03/2012\tToamasina, Madagascar\tMalgache\tDNB\tfanja@gmail.com\t03 40 00 00 00',
    '3E-003\t3e\tRABE\tLova\t01/02/2012\tAllemande\t\tDNB\t\t',
    '3E-004\t3e\t\t\t\t\t\t\t\t',
    '4E-001\t4e\tRASOA\t\t\t\t\t\t\t',
    '3E-003\t3e\tRAVO\tNoro\t\t\t\t\t\t',
  ].join('\n');
  const a = analyzeStudents(parseTable(text).rows);
  assert.equal(a.students.length, 4);
  const dup = a.students.find((s) => s.student.lastName === 'RAVO');
  assert.equal(dup.student.suggestedNumber, '3E-004');         // doublon : n° libre proposé
  assert.notEqual(dup.student.id, '3E-003');                   // identifiant unique malgré le doublon
  assert.deepEqual(a.ignored.map((i) => i.number), ['3E-004']);
  assert.deepEqual(a.gaps, ['3E-002']);
  const lova = a.students.find((s) => s.student.firstName === 'Lova');
  assert.equal(a.nationalityIsExtra, true);
  assert.deepEqual(lova.student.nationalities, ['MG', 'DE']);     // « en + » : malgache ET allemande (déplacée depuis « Lieu de naissance »)
  assert.deepEqual(a.students.find((s) => s.student.lastName === 'RASOA').student.nationalities, ['MG']); // vide = malgache
  assert.ok(lova.issues.some((i) => /déplacée/.test(i.text)));
  assert.ok(a.students.find((s) => s.student.lastName === 'RASOA').issues.some((i) => i.level === 'error' && /Prénom/.test(i.text)));
  assert.equal(a.students[0].student.birthDate, '2012-03-12');
  const p = parseAssignments(parseTable('NOM\tMatière\tClasse\nMme Rabe\tSES, Eco-Droit, Spé Mathématiques\t2nde - 1e STMG - Tle STMG').rows);
  // Économie et Droit : deux matières distinctes
  assert.deepEqual(p[0], { name: 'Mme Rabe', subjects: ['SES', 'Économie', 'Droit', 'Spécialité Mathématiques'], classes: ['2de', '1re STMG', 'Terminale STMG'] });
});

import { seniority, parseEntry, accord, certificateNumber, demoAppreciation, schoolYearLabel, classLongName, frDate } from '../src/rules/documents.js';
test('ancienneté, certificat, appréciations de démonstration', () => {
  assert.deepEqual(seniority('2026-09-01'), { isNew: true, years: 0, label: 'Nouvel élève' });
  assert.equal(seniority('2024-09-02').years, 2);
  assert.equal(seniority('2024-09-02').label, 'Ancien élève · 2 ans dans l\'établissement');
  assert.equal(seniority('2026-03-10').years, 1);              // entré en mars 2026 : année 2025-2026
  assert.equal(seniority(''), null);
  assert.equal(parseEntry('2024'), '2024-09-01');
  assert.equal(parseEntry('2 ans'), '2024-09-01');
  assert.equal(parseEntry('Nouveau'), '2026-09-01');
  assert.equal(parseEntry('03/09/2022'), '2022-09-03');
  assert.equal(parseEntry('2023-2024'), '2023-09-01');
  assert.equal(parseEntry('???'), null);
  assert.equal(accord('F', 'né', 'née'), 'née');
  assert.equal(accord('', 'inscrit', 'inscrite'), 'inscrit(e)');
  assert.equal(certificateNumber(42), 'CS-2026-0042');
  assert.equal(schoolYearLabel('2026-10-13'), '2026-2027');
  assert.equal(classLongName('2de'), 'Seconde Générale');
  assert.equal(classLongName('Terminale Générale'), 'Terminale Générale');
  assert.equal(classLongName('1re STMG'), 'Première STMG');
  assert.equal(frDate('2011-07-05'), '05/07/2011');
  for (const a of [18, 15, 13, 11, 7, null]) assert.ok(checkAppreciation(demoAppreciation(a)).ok, `appréciation conforme (${a})`);
});

import { subjectsOf, specialtyErrors, subjectClassAverage, classLine } from '../src/rules/bulletin.js';
import { TLE_G_SUBJECTS, TLE_G_STUDENTS } from '../src/data/bulletins.js';
test('bulletin de Terminale : 2 spécialités sur 3 selon l\'élève', () => {
  const st = { specialties: ['MATHS', 'PC'] };
  const ids = subjectsOf(st, TLE_G_SUBJECTS).map((s) => s.id);
  assert.ok(ids.includes('SPE_MATHS') && ids.includes('SPE_PC') && !ids.includes('SPE_SVT'));
  assert.equal(ids.length, TLE_G_SUBJECTS.length - 1);
  assert.deepEqual(specialtyErrors('Terminale Générale', ['MATHS']), ['Terminale Générale : 2 spécialités à choisir (1 choisie).']);
  assert.deepEqual(specialtyErrors('Terminale Générale', ['MATHS', 'SVT']), []);
  assert.deepEqual(specialtyErrors('3e', []), []);
  // moyenne de classe d'une spécialité : seulement les élèves qui la suivent
  const svt = TLE_G_STUDENTS.filter((s) => s.specialties.includes('SVT'));
  assert.equal(subjectClassAverage('SPE_SVT', TLE_G_STUDENTS), subjectClassAverage('SPE_SVT', svt));
  assert.equal(classLine('Terminale Générale', ['MATHS', 'PC']), 'Classe de Tle Générale - Spécialités Mathématiques et Physique-Chimie');
});

test('spécialités : lecture de la colonne d\'import et contrôle', async () => {
  const { parseSpecialties, specialtyErrors } = await import('../src/rules/bulletin.js');
  assert.deepEqual(parseSpecialties('Maths, PC'), ['MATHS', 'PC']);
  assert.deepEqual(parseSpecialties('Mathématiques et Sciences de la vie et de la Terre'), ['MATHS', 'SVT']);
  assert.deepEqual(parseSpecialties('Spé Maths / Physique-Chimie'), ['MATHS', 'PC']);
  assert.deepEqual(specialtyErrors('Terminale Générale', parseSpecialties('Maths / SVT')), []);
  const { normalizeStudentRow } = await import('../src/rules/importer.js');
  const r = normalizeStudentRow({ line: 2, 'N°': 'TG-001', Nom: 'TEST', Prénom: 'Élève', Classe: 'Tle G', 'Née le': '01/01/2009', Spécialités: 'Maths, PC' });
  assert.deepEqual(r.student.specialties, ['MATHS', 'PC']);
});

test('caisse : annulation de reçu validée par la Direction, clôture et versement', async () => {
  const c = await import('../src/rules/cashControl.js');
  const r = { number: 'ECO-TMV-00413', status: 'VALIDE', total: 420_000 };
  assert.ok(c.requestCancel(r, { by: 'Mme Hanta', reason: 'court', at: 't' }).error);
  const asked = c.requestCancel(r, { by: 'Mme Hanta', reason: 'Erreur d\'élève : payé pour le frère', at: 't' });
  assert.equal(asked.receipt.status, 'ANNULATION_DEMANDEE');
  assert.ok(c.decideCancel(asked.receipt, { by: 'Mme Hanta', role: 'BUREAU', approve: true, at: 't' }).error);
  const done = c.decideCancel(asked.receipt, { by: 'Sheena Lo', role: 'DIRECTION', approve: true, at: 't2' });
  assert.equal(done.receipt.status, 'ANNULE');
  assert.equal(done.log.action, 'Annulation validée');
  assert.ok(c.decideCancel(asked.receipt, { by: 'Sheena Lo', role: 'DIRECTION', approve: false, at: 't2' }).error, 'refus sans raison');
  // clôture : fond 200 000 + 420 000 espèces − 85 000 = 535 000
  const mv = [{ dir: 'IN', method: 'Espèces', amount: 420_000 }, { dir: 'IN', method: 'Chèque n° 1', amount: 350_000 }, { dir: 'OUT', method: 'Espèces', amount: 85_000 }];
  assert.equal(c.expectedCash(200_000, mv), 535_000);
  assert.equal(c.countTotal({ 20000: 26, 5000: 3, 100: 50 }), 540_000);
  assert.equal(c.closingCheck(535_000, 540_000).errors.length, 1);
  assert.equal(c.closingCheck(535_000, 535_000).status, 'JUSTE');
  assert.ok(c.depositAlert(3_500_000, '2026-10-09', '2026-10-13').alert);
  assert.deepEqual(c.validateDeposit({ amount: 100, bank: 'BOA', slip: '55' }, 50), ['Le versement dépasse les espèces en caisse.']);
});

test('réductions : redoublant (−25 % scolarité, −50 % inscription), exonération des proches', async () => {
  const { reductionAmount, studentDues } = await import('../src/rules/billing.js');
  const { DEFAULT_SETTINGS } = await import('../src/data/settings.js');
  const { CLASS_FEES } = await import('../src/data/accounting.js');
  assert.equal(reductionAmount(450_000, 25), 112_500);
  assert.equal(reductionAmount(340_000, 33), 112_200);
  assert.equal(reductionAmount(100_000, 150), 100_000);
  const fees = CLASS_FEES.find((f) => f.cls === 'Terminale Générale');
  const redoublant = { isNew: false, enrolledOn: '2026-09-01', paid: [], reduction: { label: 'Redoublant en Terminale', rates: { ECOLAGE: 25, INSCRIPTION: 50 } } };
  const items = studentDues(redoublant, fees, DEFAULT_SETTINGS, '2026-10-13');
  assert.equal(items.find((i) => i.key === 'ECO-09').amount, fees.ecolage * 0.75);
  assert.equal(items.find((i) => i.key === 'REINSCRIPTION').amount, fees.reinscription / 2);
  assert.equal(items.find((i) => i.key === 'FASCICULE').amount, fees.fascicule, 'autres frais à 100 %');
  const proche = { ...redoublant, reduction: { label: 'Exonération famille et proches', rates: { ECOLAGE: 100, INSCRIPTION: 0 } } };
  const items2 = studentDues(proche, fees, DEFAULT_SETTINGS, '2026-10-13');
  assert.equal(items2.find((i) => i.key === 'ECO-09').status, 'EXONERE');
  assert.equal(items2.find((i) => i.key === 'REINSCRIPTION').amount, fees.reinscription);
});

test('manuels : prêt selon le stock, retour, perte à régler et blocage du bulletin', async () => {
  const m = await import('../src/rules/manuals.js');
  let manual = { id: 'm1', title: 'Management 1re STMG', stock: { NEUF: 1, BON: 0, USE: 0, DECHIRE: 3 } };
  assert.ok(m.lend(manual, [], { student: 'A', cls: '1re STMG', state: 'DECHIRE', on: 'd' }).error);
  assert.ok(m.lend(manual, [], { student: 'A', cls: '1re STMG', state: 'BON', on: 'd' }).error);
  const r = m.lend(manual, [], { student: 'A', cls: '1re STMG', state: 'NEUF', on: '2026-09-07', dueBack: '2027-06-30' });
  manual = r.manual;
  assert.equal(manual.stock.NEUF, 0);
  assert.ok(m.lend(manual, [r.loan], { student: 'A', cls: '1re STMG', state: 'NEUF', on: 'd' }).error);
  assert.equal(m.totalCopies(manual, [r.loan]), 4);
  const lost = m.giveBack(manual, r.loan, { state: 'PERDU', on: '2026-10-10' });
  assert.equal(lost.loan.charge, 'A_REGLER');
  assert.equal(m.manualBlocks('A', [lost.loan], [manual], '2026-10-13').length, 1);
  const back = m.giveBack(manual, r.loan, { state: 'USE', on: '2027-06-20' });
  assert.equal(back.manual.stock.USE, 1);
  assert.equal(back.loan.charge, null);
  assert.equal(m.manualBlocks('A', [back.loan], [manual], '2027-07-01').length, 0);
  assert.equal(m.manualBlocks('A', [r.loan], [manual], '2027-07-01').length, 1, 'non rendu après la date prévue');
});

test('versements : rappel le mercredi et le vendredi, jour manqué signalé', async () => {
  const { depositReminder } = await import('../src/rules/cashControl.js');
  const tue = depositReminder('2026-10-13', ['2026-10-09']);
  assert.equal(tue.next, '2026-10-14');
  assert.equal(tue.nextDay, 'mercredi');
  assert.equal(tue.missed, null);
  assert.equal(depositReminder('2026-10-14', ['2026-10-09']).dueToday, true);
  assert.equal(depositReminder('2026-10-14', ['2026-10-14']).dueToday, false);
  const thu = depositReminder('2026-10-15', ['2026-10-09']);
  assert.equal(thu.missed, '2026-10-14', 'versement du mercredi oublié');
});

test('manuels : lot de la classe, location 25 000 Ar, cahiers vendus, spécialités', async () => {
  const m = await import('../src/rules/manuals.js');
  const { MANUALS, RENTAL_PRICE } = await import('../src/data/manuals.js');
  const pc = m.kitFor('Terminale Générale', ['MATHS', 'PC'], MANUALS);
  assert.ok(pc.some((x) => x.specialty === 'PC') && !pc.some((x) => x.specialty === 'SVT'));
  const t = m.kitTotals(pc);
  assert.equal(t.rental, t.rentalCount * RENTAL_PRICE);
  assert.ok(t.soldCount >= 1);
  const cahier = { id: 'c', title: 'Cahier', returnable: false, stock: { NEUF: 1, BON: 0, USE: 0, DECHIRE: 0 } };
  const r = m.lend(cahier, [], { student: 'A', cls: '6e', state: 'NEUF', on: 'd' });
  assert.equal(r.loan.sold, true);
  assert.equal(m.manualBlocks('A', [r.loan], [cahier], '2030-01-01').length, 0, 'un cahier gardé ne bloque rien');
  assert.ok(m.lend({ ...cahier, stock: { NEUF: 5 } }, [r.loan], { student: 'A', cls: '6e', state: 'NEUF', on: 'd' }).error, 'déjà remis');
});

test('semaine des salaires : dernière semaine de cours du mois, pas de rappel de versement', async () => {
  const c = await import('../src/rules/cashControl.js');
  const cal = [{ kind: 'VACANCES', start: '2026-10-24', end: '2026-11-01' }];
  assert.equal(c.lastSchoolDayOfMonth('2026-10-13', cal), '2026-10-23', 'vacances de la Toussaint dès le 24');
  const w = c.salaryWindow('2026-10-13', cal);
  assert.equal(w.start, '2026-10-19');
  assert.equal(w.active, false);
  assert.equal(c.salaryWindow('2026-10-21', cal).active, true);
  assert.equal(c.salaryWindow('2026-10-21', cal, { paid: true }).active, false, 'salaires payés : les rappels reprennent');
  const r = c.depositReminder('2026-10-21', ['2026-10-16'], [3, 5], w.inWindow);
  assert.equal(r.dueToday, false, 'mercredi 21 : pas de rappel pendant la semaine des salaires');
  assert.equal(r.missed, null);
});

test('bibliothèque : un mois pour les élèves, prolongation avec le livre, pas de limite pour les professeurs', async () => {
  const l = await import('../src/rules/library.js');
  const e = l.borrow('ROM-0001', [], { borrower: 'RANDRIA Mamy', kind: 'ELEVE', cls: 'Terminale Générale', on: '2026-10-13' }).loan;
  assert.equal(e.due, '2026-11-12');
  assert.ok(l.borrow('ROM-0001', [e], { borrower: 'X', kind: 'ELEVE', on: '2026-10-14' }).error);
  assert.ok(l.renew(e, { on: '2026-11-10', presented: false }).error);
  assert.equal(l.renew(e, { on: '2026-11-10', presented: true }).loan.due, '2026-12-10');
  const p = l.borrow('ANN-0002', [], { borrower: 'Mme Ranaivo', kind: 'PROF', on: '2026-10-13' }).loan;
  assert.equal(p.due, null);
  assert.equal(l.overdueLoans([e, p], '2026-12-01').length, 1);
  assert.equal(l.nextCode('ROMAN', [{ copies: [{ code: 'ROM-0007' }, { code: 'ANN-0009' }] }]), 'ROM-0008');
  assert.equal(l.designation({ title: 'L\'Étranger', author: 'Albert Camus', editor: 'Gallimard', collection: 'Folio', year: 1972 }), 'L\'Étranger — Albert Camus — Gallimard (Folio, 1972)');
});

test('engagements sur le bulletin : accord et nombre de délégués', async () => {
  const e = await import('../src/rules/engagements.js');
  assert.deepEqual(e.engagementLabels(['DELEGUE', 'SUPPLEANT'], 'F'), ['Déléguée de classe', 'Déléguée suppléante']);
  assert.deepEqual(e.engagementLabels(['DELEGUE']), ['Délégué(e) de classe']);
  assert.equal(e.engagementErrors({ a: ['DELEGUE'], b: ['DELEGUE'], c: ['DELEGUE'] }).length, 1);
});

test('attestations de l\'établissement : imprimées à part des engagements', async () => {
  const e = await import('../src/rules/engagements.js');
  assert.deepEqual(e.engagementLabels(['DELEGUE', 'ASSR1'], 'M'), ['Délégué de classe']);
  assert.deepEqual(e.attestationLabels(['DELEGUE', 'ASSR1', 'NUMERIQUE']), ['Sécurité routière niveau 1 (programme ASSR 1)', 'Compétences numériques (référentiel Pix / B2i)']);
});

test('paie : taux horaire en vigueur selon la date d\'effet, historique des augmentations', async () => {
  const p = await import('../src/rules/payroll.js');
  const rates = [{ staffId: 'x', rate: 18_000, from: '2024-09-01' }, { staffId: 'x', rate: 20_000, from: '2025-09-01' }, { staffId: 'x', rate: 22_000, from: '2026-09-01' }];
  assert.equal(p.rateOn(rates, 'x', '2026-10-01'), 22_000);
  assert.equal(p.rateOn(rates, 'x', '2026-06-01'), 20_000);
  assert.equal(p.rateOn(rates, 'x', '2024-01-01'), null);
  assert.deepEqual(p.rateHistory(rates, 'x').map((r) => r.increase), [10, 11.1, null]);
  assert.equal(p.payOf({ byHour: true, hours: 74 }, 22_000), 1_628_000);
  assert.equal(p.payOf({ monthly: 950_000 }), 950_000);
});

test('appel : état des séances selon l\'heure et bilan', async () => {
  const a = await import('../src/rules/attendance.js');
  const now = { date: '2026-10-13', time: '10:20' };
  const s = (date, start, end) => ({ date, start, end });
  assert.equal(a.sessionState(s('2026-10-13', '10:00', '12:00'), now), 'EN_COURS');
  assert.equal(a.sessionState(s('2026-10-13', '10:25', '11:00'), now), 'EN_COURS', 'ouvert 10 min avant');
  assert.equal(a.sessionState(s('2026-10-13', '13:30', '15:30'), now), 'A_VENIR');
  assert.equal(a.sessionState(s('2026-10-12', '15:30', '17:00'), now), 'OUBLIE');
  assert.equal(a.sessionState(s('2026-10-12', '15:30', '17:00'), now, { at: '15:35' }), 'FAIT');
  const t = a.tally(['A', 'B', 'C', 'D'], { B: { status: 'A' }, C: { status: 'R', minutes: 10 } });
  assert.equal(t.present, 2);
  assert.deepEqual([t.absent, t.late], [['B'], ['C']]);
});

test('grilles de notes : rangs, matières non suivies, export complet', async () => {
  const g = await import('../src/rules/gradeSheet.js');
  assert.deepEqual(g.ranks([12, 15, null, 15]), [3, 1, null, 1]);
  const subjects = [{ id: 'A', label: 'Maths', inAverage: true }, { id: 'B', label: 'SVT', inAverage: true }];
  const sheet = g.averagesSheet({ subjects, rows: [{ name: 'X', avgs: { A: 12, B: undefined } }, { name: 'Y', avgs: { A: 14, B: 10 } }] });
  assert.equal(sheet.rows[0].general, 12, 'spécialité non suivie hors moyenne');
  assert.equal(sheet.stats.B.avg, 10);
  const out = g.averagesCsv({ title: 'Grille', subjects, sheet });
  assert.ok(out.includes('non suivie') && out.includes('Moyenne de la classe') && out.includes('Rang'));
  const d = g.detailSheet({ evaluations: [{ id: 'e1', title: 'DS', date: '2026-10-01', scale: 20, coef: 1 }], students: ['X', 'Y'], grades: { X: { e1: '15' }, Y: { e1: 'ABS' } } });
  assert.equal(d.evStats[0].avg, 15);
  assert.equal(g.cellText(d.rows[1].cells[0]), 'ABS');
});

import { accessCode, guardianKey, nationalityLabels, toggleNationality, hasOtherNationality, nextMatricule } from '../src/rules/enrollment.js';
test('un code personnel par responsable, nationalités proposées', () => {
  const p = { lastName: 'RAKOTO', firstName: 'Éléa', cls: '6e', guardians: [
    { name: 'Mme Rakoto Voahangy', relation: 'Mère', phone: '+261 34 12 345 67', email: 'voahangy@gmail.com' },
    { name: 'M. Rakoto Fidy', relation: 'Père', phone: '+261 32 11 222 33', email: '' }] };
  const [, mere, pere] = accountsFor(p);
  assert.match(mere.code, /^\d{4} \d{4}$/);
  assert.notEqual(mere.code, pere.code); // deux parents, deux accès
  assert.equal(pere.login, null);
  assert.equal(accessCode(guardianKey(p.guardians[0])), mere.code); // même parent, même code pour ses autres enfants
  assert.deepEqual(nationalityLabels(['MG', 'FR', 'KM']), ['Malgache', 'Française', 'Autre (KM)']);
  assert.deepEqual(nationalityLabels(['MG', 'XX'], 'Comorienne'), ['Malgache', 'Comorienne']);
  assert.equal(nextMatricule('Terminale Générale', ['TG-001', 'TG-002', 'TSTMG-005']), 'TG-003');
  assert.equal(nextMatricule('Terminale Générale', ['TG-001', 'TG-004']), 'TG-005'); // un départ ne fait pas reculer
  assert.equal(nextMatricule('1re STMG', []), '1STMG-001');
  assert.ok(hasOtherNationality(['MG', 'KM']));
  assert.deepEqual(toggleNationality(['MG', 'KM'], 'XX'), ['MG']);
  assert.deepEqual(toggleNationality(['MG'], 'XX'), ['MG', 'XX']);
  assert.deepEqual(toggleNationality(['MG', 'FR'], 'FR'), ['MG']);
});

import { shortNames, usualFirstName, splitFullName } from '../src/rules/names.js';
test('prénom d\'usage dans les grilles, initiale en cas de doublon', () => {
  assert.deepEqual(splitFullName('RAKOTO ANDRIA Ny Aina'), { last: 'RAKOTO ANDRIA', first: 'Ny Aina' });
  assert.equal(usualFirstName({ firstName: 'Jean Hery', usualName: 'Hery' }), 'Hery');
  assert.equal(usualFirstName({ firstName: 'Jean Hery' }), 'Jean');
  const m = shortNames(['RAKOTO Jean Hery', 'RABE Hery', 'RASOA Mialy', 'RANDRIA Mialy Fanja'], [{ lastName: 'RAKOTO', firstName: 'Jean Hery', usualName: 'Hery' }]);
  assert.equal(m.get('RAKOTO Jean Hery'), 'Hery R.');
  assert.equal(m.get('RABE Hery'), 'Hery R.');
  assert.equal(m.get('RASOA Mialy'), 'Mialy R.');
  const n = shortNames(['RAKOTO Jean Hery', 'RASOA Mialy'], [{ lastName: 'RAKOTO', firstName: 'Jean Hery', usualName: 'Hery' }]);
  assert.equal(n.get('RAKOTO Jean Hery'), 'Hery');
});

import { studentsCsv, accessSlips, filterStudents } from '../src/rules/studentList.js';
test('liste des élèves : filtre, export complet, codes d\'accès sans doublon', () => {
  const mere = { name: 'Mme Rakoto Voahangy', relation: 'Mère', phone: '+261 34 12 345 67', email: 'voahangy@gmail.com', payer: true, whatsapp: true };
  const list = [
    { lastName: 'RAKOTO', firstName: 'Éléa', cls: '6e', nationalities: ['MG'], guardians: [mere], documents: [], photo: 'data:x' },
    { lastName: 'RAKOTO', firstName: 'Toky', cls: '5e', nationalities: ['MG', 'FR'], guardians: [mere, { name: 'M. Rakoto', relation: 'Père', phone: '+261 32 11 222 33' }], documents: [] },
  ];
  assert.equal(filterStudents(list, { cls: '5e' }).length, 1);
  assert.equal(filterStudents(list, { query: 'éléa' }).length, 1);
  const out = studentsCsv(list, 'Liste');
  assert.match(out, /Nationalité\(s\)/);
  assert.match(out, /5e;RAKOTO;Toky;Toky;;;;Malgache, Française/);
  assert.match(out, /Mme Rakoto Voahangy;Mère;\+261 34 12 345 67;voahangy@gmail.com;oui/); // règle les frais (plus de colonne WhatsApp)
  const slips = accessSlips(list);
  assert.equal(slips.length, 2); // la mère a un seul accès pour ses deux enfants
  assert.equal(slips.find((s) => s.name === mere.name).children.length, 2);
});

import { verificationCode, decisionErrors, nextActions } from '../src/rules/signatures.js';
test('signature des documents : Direction seule, motif du refus, code de vérification', () => {
  assert.match(verificationCode('s1'), /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.notEqual(verificationCode('s1'), verificationCode('s2'));
  assert.deepEqual(decisionErrors({ role: 'DIRECTION', status: 'SIGNEE', signature: 'data:x' }), []);
  assert.equal(decisionErrors({ role: 'BUREAU', status: 'SIGNEE', signature: 'data:x' }).length, 1);
  assert.equal(decisionErrors({ role: 'DIRECTION', status: 'SIGNEE' }).length, 1);
  assert.equal(decisionErrors({ role: 'DIRECTION', status: 'REFUSEE', note: ' ' }).length, 1);
  assert.deepEqual(nextActions({ status: 'SIGNEE', delivery: 'EMAIL' }), ['EMAIL', 'PRINT']);
  assert.deepEqual(nextActions({ status: 'DEMANDEE' }), []);
});

import { receives, recipientCount, audienceLabel, announcementErrors, classInScope } from '../src/rules/announcements.js';
test('annonces : filtres par rôle, site, cycle, niveau, classe', () => {
  const pop = {
    TMV: { classes: { '6e': 20, '1re STMG': 8, 'Terminale STMG': 6 }, teachers: { all: 10, byClass: { 'Terminale STMG': 7 } }, staff: 3 },
    TNR: { classes: { '6e': 25, 'Terminale STMG': 9 }, teachers: { all: 12, byClass: {} }, staff: 2 },
  };
  const all = { roles: ['PARENT', 'ELEVE', 'PROFESSEUR', 'PERSONNEL'], site: 'ALL', scope: 'ALL', values: [] };
  assert.deepEqual(recipientCount(all, pop), { students: 68, families: 68, teachers: 22, staff: 5 });
  const parentsTle = { roles: ['PARENT'], site: 'TMV', scope: 'LEVEL', values: ['Terminale'] };
  assert.deepEqual(recipientCount(parentsTle, pop), { students: 0, families: 6, teachers: 0, staff: 0 });
  assert.equal(recipientCount({ roles: ['ELEVE'], site: 'ALL', scope: 'CYCLE', values: ['LYCEE'] }, pop).students, 23);
  assert.ok(classInScope('1re STMG', { scope: 'LEVEL', values: ['1re'] }));
  assert.ok(receives({ audience: parentsTle }, { role: 'PARENT', site: 'TMV', classes: ['5e', 'Terminale STMG'] }));
  assert.ok(!receives({ audience: parentsTle }, { role: 'PARENT', site: 'TNR', classes: ['Terminale STMG'] }));
  assert.ok(!receives({ audience: parentsTle }, { role: 'ELEVE', site: 'TMV', classes: ['Terminale STMG'] }));
  assert.ok(!receives({ audience: { ...parentsTle, roles: ['PERSONNEL'] } }, { role: 'PERSONNEL', site: 'TMV' }));
  assert.equal(audienceLabel(parentsTle, { TMV: 'Tamatave' }), 'Parents · Tamatave · niveau Terminale');
  const base = { title: 'Sortie', text: 'Jeudi', photos: [], audience: { roles: ['PARENT'], site: 'TMV', scope: 'CLASS', values: ['1re STMG'] } };
  assert.equal(announcementErrors(base, { role: 'ENSEIGNANT' }).length, 1); // aucun droit de rédaction pour les professeurs
  assert.equal(receives({ ...base, status: 'EN_ATTENTE' }, { role: 'PARENT', site: 'TMV', classes: ['1re STMG'] }), false); // jamais diffusée avant validation
  assert.deepEqual(announcementErrors({ ...base, audience: all }, { role: 'DIRECTION' }), []);
  assert.equal(announcementErrors({ ...base, audience: { ...base.audience, scope: 'LEVEL', values: [] } }).length, 1);
});

import { campaignOpen } from '../src/rules/enrollment.js';
test('campagne de pré-inscription : ouverte entre les dates de la Direction', () => {
  const c = { opens: '2027-05-03', closes: '2027-07-16' };
  assert.ok(!campaignOpen(c, '2027-05-02'));
  assert.ok(campaignOpen(c, '2027-05-03'));
  assert.ok(campaignOpen(c, '2027-07-16'));
  assert.ok(!campaignOpen(c, '2027-07-17'));
  assert.ok(!campaignOpen({}, '2027-06-01'));
});

import { averagesRows } from '../src/rules/gradeSheet.js';

test('export Excel en couleurs : rouge sous 10, classeur valide', () => {
  const subjects = [{ id: 'FR', label: 'Français', short: 'Fra', inAverage: true, coef: 1 }];
  const sheet = { rows: [{ name: 'RABE Hery', avgs: { FR: 8.5 }, general: 8.5, rank: 1 }], stats: { FR: { avg: 8.5, min: 8.5, max: 8.5 } }, general: { avg: 8.5, min: 8.5, max: 8.5 } };
  const { rows } = averagesRows({ title: 'Grille', subjects, sheet });
  const line = rows.find((r) => r[0]?.v === 'RABE Hery');
  assert.deepEqual(line[1], { v: 8.5, s: 'red' });
  assert.equal(line[2].s, 'avgRed');
  const bytes = buildXlsx([{ name: 'Moyennes', rows }]);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]); // archive zip
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /xl\/worksheets\/sheet1\.xml/);
  assert.match(text, /<c r="B\d+" s="5"><v>8.5<\/v><\/c>/); // style « red »
});

import { saveText, submit, validate, sendBack, onBulletin } from '../src/rules/generalAppreciation.js';
test('appréciation générale : saisie par le secrétariat, validée par la Direction', () => {
  let e = saveText({}, 'Bon trimestre, continuez ainsi.', 'BUREAU');
  assert.equal(e.status, 'BROUILLON');
  assert.equal(onBulletin(e), ''); // pas encore sur le bulletin
  e = submit(e, 'BUREAU');
  assert.equal(e.status, 'A_VALIDER');
  assert.throws(() => validate(e, 'BUREAU'));
  assert.throws(() => sendBack(e, 'DIRECTION', ' '));
  e = sendBack(e, 'DIRECTION', 'Ajouter un mot sur les absences.');
  assert.equal(e.status, 'A_REVOIR');
  e = submit(saveText(e, 'Bon trimestre ; attention aux absences.', 'BUREAU'), 'BUREAU');
  e = validate(e, 'DIRECTION', 'Bon trimestre ; attention aux absences répétées.');
  assert.equal(onBulletin(e), 'Bon trimestre ; attention aux absences répétées.');
  assert.equal(saveText(e, 'Modifié après validation.', 'BUREAU').status, 'BROUILLON'); // à revalider
  assert.equal(saveText({ status: 'A_VALIDER', text: 'a' }, 'b', 'DIRECTION').status, 'A_VALIDER');
  assert.equal(validate(saveText({}, 'Excellent.', 'DIRECTION'), 'DIRECTION').status, 'VALIDEE');
  assert.throws(() => saveText({}, 'x', 'ENSEIGNANT'));
});

import { pickupStatus, pickupUntil, familyMessage } from '../src/rules/bulletinPickup.js';
test('retrait des bulletins : disponibles du …, délai, rappel, archivage', () => {
  const w = { from: '2026-12-14', days: 14 };
  assert.equal(pickupUntil(w), '2026-12-27');
  assert.equal(pickupStatus('2026-12-10', w), 'A_VENIR');
  assert.equal(pickupStatus('2026-12-14', w), 'A_RETIRER');
  assert.equal(pickupStatus('2026-12-24', w), 'RAPPEL');
  assert.equal(pickupStatus('2026-12-28', w), 'ARCHIVE');
  assert.equal(pickupStatus('2026-12-28', w, { given: true }), 'REMIS');
  assert.equal(pickupStatus('2026-12-15', w, { blocked: true }), 'BLOQUE');
  assert.match(familyMessage('BLOQUE', w, '1er trimestre'), /régularisation/);
  assert.match(familyMessage('A_RETIRER', w, '1er trimestre'), /jusqu'au 27\/12\/2026/);
});

import { trackSteps, defaultTracks, addTrack, closeTrack, trackProgress } from '../src/rules/orientation.js';
test('orientation : pistes par pays, France en plan B, clôture avec motif', () => {
  assert.equal(trackSteps('FRANCE', ['MG']).length, 4); // Parcoursup + Campus France + visa
  assert.equal(trackSteps('FRANCE', ['FR']).length, 2);
  let t = defaultTracks();
  assert.equal(t[0].dest, 'FRANCE');
  t = addTrack(t, 'CANADA');
  assert.equal(addTrack(t, 'CANADA').length, 2); // pas deux fois la même piste ouverte
  assert.throws(() => closeTrack(t[0], ' ', '2026-10-17'));
  const closed = closeTrack(t[0], 'Ne part pas en France', '2026-10-17');
  assert.equal(closed.closed.reason, 'Ne part pas en France');
  assert.deepEqual(trackProgress({ dest: 'CANADA', done: { dossier: true } }, ['MG']), { done: 1, total: 4 });
});

import { agendaItems, toIcs } from '../src/rules/agenda.js';
test('agendas : cours, événements, devoirs ; export iCalendar', () => {
  const items = agendaItems({
    sessions: [{ id: 's1', date: '2026-10-13', start: '07:00', end: '09:00', cls: '1re STMG', subject: 'Management', room: 'Salle 12' }],
    events: [{ id: 'e1', date: '2026-10-24', allDay: true, end: '2026-11-02', title: 'Vacances', classes: [] }, { id: 'e2', date: '2026-10-16', start: '15:30', end: '16:30', title: 'Conseil péda', classes: [], staffOnly: true }],
    homework: [{ id: 'h1', cls: '1re STMG', subject: 'Maths', todo: 'Ex. 12', due: '2026-10-15' }, { id: 'h2', cls: '5e', subject: 'HG', todo: 'Leçon', due: '2026-10-16' }],
    cls: '1re STMG',
  });
  assert.deepEqual(items.map((i) => i.agenda), ['COURS', 'DEVOIRS', 'ECOLE']); // conseil péda réservé au personnel
  const ics = toIcs(items, 'Chateaubriand — 1re STMG');
  assert.match(ics, /DTSTART;TZID=Indian\/Antananarivo:20261013T070000/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261024\r\nDTEND;VALUE=DATE:20261103/);
  assert.match(ics, /SUMMARY:Maths \(1re STMG\) : Ex. 12/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
});

import { toTransactions, treasuryKpis, monthlyFlows, byCategory, expenseErrors } from '../src/rules/treasury.js';
test('trésorerie : transactions unifiées, trésorerie nette, reste à recouvrer, dépenses engagées', () => {
  const tx = toTransactions({
    cash: [{ id: 1, dir: 'IN', amount: 1_000_000, date: '2026-10-02' }, { id: 2, dir: 'OUT', nature: 'Dépense de fonctionnement', amount: 50_000, date: '2026-10-03' }, { id: 3, dir: 'OUT', nature: 'Dépôt en banque', amount: 500_000, date: '2026-10-04' }],
    expenses: [{ id: 'a', category: 'Loyer', amount: 400_000, status: 'PAYE', date: '2026-10-05' }, { id: 'b', category: 'Électricité et eau', amount: 70_000, status: 'EN_ATTENTE', due: '2026-10-20' }, { id: 'c', category: 'Autre', amount: 9, status: 'ANNULE' }],
    payroll: [{ staffId: 'p1', amount: 300_000, paid: null, due: '2026-10-30' }],
    dues: [{ id: 'f1', amount: 420_000, due: '2026-10-05' }],
  });
  assert.deepEqual(treasuryKpis(tx, 100_000), { net: 650_000, toCollect: 420_000, committed: 370_000 });
  assert.deepEqual(monthlyFlows(tx, ['2026-09', '2026-10']), [{ month: '2026-09', in: 0, out: 0 }, { month: '2026-10', in: 1_000_000, out: 450_000 }]);
  assert.deepEqual(byCategory(tx, '2026-10-01', '2026-10-31')[0], ['Loyer', 400_000]);
  assert.deepEqual(expenseErrors({ label: 'Encre', amount: 85_000, category: 'Fournitures', status: 'PAYE', date: '2026-10-13' }), []);
  assert.equal(expenseErrors({ label: 'Loyer', amount: 2_500_000, category: 'Loyer', status: 'PAYE', date: '2026-10-05' }).length, 1); // photo
  assert.equal(expenseErrors({ label: 'x', amount: 12.5, category: 'Autre', status: 'EN_ATTENTE' }).length, 2);
});

import { menuFor } from '../src/rules/familyMenu.js';
test('portail des familles : menu selon la classe de l\'enfant', () => {
  assert.deepEqual(menuFor({ cls: 'Terminale STMG' }), { stages: false, orientation: true, reenrol: false });
  assert.deepEqual(menuFor({ cls: '5e' }), { stages: false, orientation: false, reenrol: true });
  assert.deepEqual(menuFor({ cls: '3e' }), { stages: true, orientation: true, reenrol: true });
  assert.equal(menuFor({ cls: '1re STMG' }, { hasInternships: true }).stages, true); // stage de 2de passé
});

import { searchCatalog, availability, reserve, canReserve, expiredReservations } from '../src/rules/library.js';
test('bibliothèque : catalogue pour tous, recherche livres et manuels, réservation élèves et professeurs', () => {
  const books = [
    { id: 'k1', type: 'ROMAN', title: 'L\'Étranger', author: 'Albert Camus', editor: 'Gallimard', copies: [{ code: 'ROM-0001' }, { code: 'ROM-0002' }] },
    { id: 'k2', type: 'ANNALES', title: 'Annabac — Philosophie', author: '', editor: 'Hatier', copies: [{ code: 'ANN-0001' }] },
  ];
  const manuals = [{ id: 'm1', title: 'Mathématiques 6e', subject: 'Mathématiques', levels: ['6e'], category: 'MANUEL', editor: 'Hachette' }];
  assert.deepEqual(searchCatalog('etranger', books, manuals).map((r) => r.id), ['k1']); // sans accent
  assert.deepEqual(searchCatalog('camus', books, manuals).map((r) => r.id), ['k1']);
  assert.deepEqual(searchCatalog('maths 6e', books, manuals).map((r) => r.id), []);
  assert.deepEqual(searchCatalog('mathématiques 6e', books, manuals).map((r) => r.source), ['MANUEL']);
  assert.equal(searchCatalog('', books, manuals, { type: 'ANNALES' }).length, 1);
  const loans = [{ code: 'ANN-0001', due: '2026-10-28' }];
  assert.deepEqual(availability(books[1], loans), { total: 1, available: 0, nextReturn: '2026-10-28' });
  assert.ok(!canReserve('PARENT'));
  assert.ok(reserve(books[0], { who: 'P', kind: 'PARENT', date: '2026-10-14' }, { loans, reservations: [], today: '2026-10-13' }).error);
  const r1 = reserve(books[0], { who: 'Aina', kind: 'ELEVE', date: '2026-10-15' }, { loans, reservations: [], today: '2026-10-13' }).reservation;
  assert.equal(r1.status, 'A_RETIRER');
  assert.equal(r1.holdUntil, '2026-10-17');
  assert.ok(reserve(books[0], { who: 'Aina', kind: 'ELEVE', date: '2026-10-16' }, { loans, reservations: [r1], today: '2026-10-13' }).error); // déjà réservé
  const r2 = reserve(books[1], { who: 'M. Tojo', kind: 'PROF', date: '2026-10-13' }, { loans, reservations: [], today: '2026-10-13' }).reservation;
  assert.equal(r2.status, 'ATTENTE'); assert.equal(r2.rank, 1);
  assert.ok(reserve(books[0], { who: 'X', kind: 'ELEVE', date: '2026-10-12' }, { loans, reservations: [], today: '2026-10-13' }).error);
  assert.ok(reserve(books[0], { who: 'X', kind: 'ELEVE', date: '2026-12-31' }, { loans, reservations: [], today: '2026-10-13' }).error);
  assert.deepEqual(expiredReservations([r1], '2026-10-18').map((r) => r.id), [r1.id]);
});

import { plannedSessions, teacherHours, absenceErrors, sessionsToSupervise, slotHours } from '../src/rules/teachingHours.js';
test('volume horaire des professeurs : prévu, fait, absences avec ou sans travail laissé', () => {
  const slots = [{ id: 's1', teacherId: 'p1', cls: '1re STMG', subject: 'Management', weekday: 1, start: '07:00', end: '09:00' },
    { id: 's2', teacherId: 'p1', cls: 'Terminale STMG', subject: 'Droit', weekday: 3, start: '13:30', end: '15:00' }];
  assert.equal(slotHours(slots[1]), 1.5);
  // du lundi 19 au vendredi 30 octobre 2026 : vacances à partir du 24 → une seule semaine de cours
  assert.equal(plannedSessions(slots, '2026-10-19', '2026-10-30', EXAMPLE_SETTINGS).length, 2);
  const absences = [{ teacherId: 'p1', date: '2026-10-07', slotIds: ['s2'], work: 'AUCUN' }];
  const h = teacherHours('p1', slots, absences, { from: '2026-10-05', to: '2026-10-23', today: '2026-10-13', settings: EXAMPLE_SETTINGS });
  assert.equal(h.planned, 10.5);        // 3 semaines × 3,5 h
  assert.equal(h.plannedToDate, 5.5);   // 5, 7 et 12 octobre
  assert.equal(h.absent, 1.5);
  assert.equal(h.absentNoWork, 1.5);
  assert.equal(h.done, 4);
  assert.equal(h.remaining, 5);         // 14, 19 et 21 octobre
  assert.deepEqual(h.byClass['Terminale STMG — Droit'], { planned: 4.5, done: 0, absent: 1.5 });
  const base = { teacherId: 'p1', date: '2026-10-20', slotIds: ['s1'], reason: 'Formation', work: 'DEVOIR', workText: 'Exercices p. 40' };
  assert.deepEqual(absenceErrors(base), []);
  assert.equal(absenceErrors({ ...base, workText: '' }).length, 1);
  assert.deepEqual(absenceErrors({ ...base, work: 'AUCUN', workText: '' }), []); // possible, mais signalé
  assert.equal(sessionsToSupervise([base], slots, '2026-10-13')[0].slot.start, '07:00');
});

import { dueSoonLoans, takeGame, returnGame, gameStats, gameIncidents, gamesOut } from '../src/rules/library.js';
test('bibliothèque : rappel 3 jours avant le retour ; jeux de société (sorties, incidents, plus joués)', () => {
  const loans = [{ code: 'A', due: '2026-10-15' }, { code: 'B', due: '2026-10-20' }, { code: 'C', due: '2026-10-12' }, { code: 'D', due: null }];
  assert.deepEqual(dueSoonLoans(loans, '2026-10-13').map((l) => l.code), ['A']);
  const game = { id: 'g1', name: 'Échecs', copies: 1 };
  const first = takeGame(game, [], { cls: '3e', who: 'Hasina', at: '2026-10-13T12:05' }).entry;
  assert.ok(takeGame(game, [first], { cls: '4e', who: 'Fy', at: '2026-10-13T12:06' }).error); // déjà sorti
  assert.equal(gamesOut('g1', [first]).length, 1);
  assert.ok(returnGame(first, { at: '2026-10-13T12:50', complete: false, note: ' ' }).error);
  const back = returnGame(first, { at: '2026-10-13T12:50', complete: false, note: 'Il manque un pion' }).entry;
  assert.equal(gameIncidents([back]).length, 1);
  assert.deepEqual(gameStats([back], [game, { id: 'g2' }], '2026-10-01', '2026-10-31').map((x) => x.count), [1, 0]);
});

import { grantNoWork, latenessBalance } from '../src/rules/teachingHours.js';
test('absences longues dispensées par la Direction, retards cumulés à rattraper', () => {
  const a = { teacherId: 'p1', date: '2026-10-22', slotIds: ['s1'], reason: 'Maladie (5 jours)', work: 'AUCUN' };
  assert.ok(grantNoWork(a, 'BUREAU').error);
  assert.equal(grantNoWork(a, 'DIRECTION').absence.work, 'NON_REQUIS');
  assert.ok(absenceErrors({ ...a, work: 'NON_REQUIS', declaredRole: 'ENSEIGNANT' }).length === 1);
  assert.deepEqual(absenceErrors({ ...a, work: 'NON_REQUIS', declaredRole: 'DIRECTION' }), []);
  const late = [5, 10, 15, 5, 10, 20].map((minutes, i) => ({ teacherId: 'p1', minutes, date: `2026-10-0${i + 1}` }));
  assert.deepEqual(latenessBalance('p1', late), { minutes: 65, owed: 1, madeUp: 0, toMakeUp: 1, beforeNext: 55 });
  assert.equal(latenessBalance('p1', late, [{ teacherId: 'p1', hours: 1 }]).toMakeUp, 0);
});

import { forOf, isProtected, visibleFor, suggestionErrors, answerSuggestion } from '../src/rules/resources.js';
test('documents par public, ressources de l\'équipe protégées, boîte à idées', () => {
  const list = [
    { id: 'reglement', for: ['ELEVES', 'PARENTS'] }, { id: 'charte', for: ['ELEVES', 'PARENTS', 'PROFS'] },
    { id: 'cahier', for: ['PROFS'] }, { id: 'ancienne', audience: 'PERSONNEL' },
  ];
  assert.deepEqual(visibleFor(list, 'PARENT').map((r) => r.id), ['reglement', 'charte']);
  assert.deepEqual(visibleFor(list, 'ENSEIGNANT').map((r) => r.id), ['charte', 'cahier', 'ancienne']);
  assert.equal(visibleFor(list, 'BUREAU').length, 4);
  assert.deepEqual(forOf(list[3]), ['PROFS', 'PERSONNEL']);
  assert.ok(isProtected(list[2]) && !isProtected(list[1]));
  assert.equal(suggestionErrors({ category: 'METHODOLOGIE', text: 'Court' }).length, 1);
  assert.deepEqual(suggestionErrors({ category: 'METHODOLOGIE', text: 'Partager nos fiches méthode entre collègues' }), []);
  const s = { id: 'x', text: 'Une salle informatique ouverte le midi', status: 'NOUVELLE' };
  assert.ok(answerSuggestion(s, { role: 'BUREAU', status: 'RETENUE' }).error);
  assert.ok(answerSuggestion(s, { role: 'DIRECTION', status: 'NON_RETENUE', answer: ' ' }).error);
  assert.equal(answerSuggestion(s, { role: 'DIRECTION', status: 'RETENUE' }).suggestion.status, 'RETENUE');
});

import { changeErrors, changeNotice, applyChanges } from '../src/rules/timetableChanges.js';
import { isMinor, leaveErrors } from '../src/rules/earlyLeave.js';
test('changements d\'emploi du temps annoncés ; sorties anticipées des mineurs', () => {
  const base = { cls: '1re STMG', subject: 'Management', date: '2026-10-20', start: '07:00', end: '09:00' };
  assert.deepEqual(changeErrors({ ...base, type: 'ANNULE' }), []);
  assert.equal(changeErrors({ ...base, type: 'DEPLACE' }).length, 1);
  const moved = { ...base, id: 'c1', type: 'DEPLACE', newDate: '2026-10-22', newStart: '13:30', newEnd: '15:30', room: 'Salle 8' };
  assert.match(changeNotice(moved, (d) => d).text, /déplacé au 2026-10-22, de 13h30 à 15h30, Salle 8/);
  const sessions = [{ id: 's', ...base, room: 'Salle 12' }, { id: 't', ...base, date: '2026-10-21' }];
  const out = applyChanges(sessions, [moved, { ...base, id: 'c2', type: 'ANNULE', date: '2026-10-21' }, { ...base, id: 'c3', type: 'AJOUT', date: '2026-10-24', start: '08:00', end: '10:00' }]);
  assert.deepEqual(out.map((s) => [s.date, s.status ?? '']), [['2026-10-22', 'DEPLACE'], ['2026-10-21', 'ANNULE'], ['2026-10-24', 'AJOUT']]);
  assert.ok(isMinor('2009-10-18', '2026-10-17'));
  assert.ok(!isMinor('2008-10-17', '2026-10-17'));
  assert.ok(isMinor(null, '2026-10-17'));
  assert.equal(leaveErrors({ minor: true, reason: 'Malaise', parentCalled: true }).length, 1); // pas parti seul, même en moto
  assert.equal(leaveErrors({ minor: true, reason: 'Malaise', parentCalled: true, pickedUpBy: 'M. Rabe', relation: 'Oncle' }).length, 1); // confirmation du parent
  assert.deepEqual(leaveErrors({ minor: true, reason: 'Malaise', parentCalled: true, pickedUpBy: 'M. Rabe', relation: 'Oncle', guardianConfirmed: true }), []);
  assert.deepEqual(leaveErrors({ minor: false, reason: 'Rendez-vous', parentCalled: true }), []); // majeur : peut partir seul
});

import { careErrors, frequentVisitors, parentNotice, recentDose } from '../src/rules/care.js';
import { inventoryAlerts, reportBroken, resolveBroken, addPurchase, consume, usable } from '../src/rules/inventory.js';

test('soins : Doliprane refusé si allergie, si déjà donné il y a moins de 6 h, ou sans stock', () => {
  const visits = [{ student: 'A', at: '2026-10-13T08:30', paracetamol: true }];
  const v = { student: 'A', reason: 'Mal de tête', outcome: 'REPOS', paracetamol: true, dose: '1 cp', at: '2026-10-13T11:00' };
  assert.match(careErrors(v, { visits }).join(), /6 heures/);
  assert.equal(recentDose(visits, 'A', '2026-10-13T15:00'), undefined);
  assert.match(careErrors({ ...v, at: '2026-10-13T15:00' }, { visits, allergies: 'Paracétamol' }).join(), /Allergie/);
  assert.match(careErrors({ ...v, at: '2026-10-13T15:00' }, { visits, stock: 0 }).join(), /stock/);
  assert.deepEqual(careErrors({ ...v, at: '2026-10-13T15:00' }, { visits, allergies: 'Arachides', stock: 5 }), []);
  assert.deepEqual(careErrors({ ...v, paracetamol: false }, { visits }), []);
});

test('soins : élèves passés 3 fois dans le mois, message aux parents', () => {
  const visits = ['2026-10-02', '2026-10-07', '2026-10-12', '2026-09-30'].map((d) => ({ student: 'A', at: `${d}T10:00` }));
  assert.deepEqual(frequentVisitors(visits, '2026-10'), [{ student: 'A', count: 3 }]);
  assert.deepEqual(frequentVisitors(visits.slice(1), '2026-10'), []);
  const m = parentNotice({ at: '2026-10-13T10:15', reason: 'Mal de tête', paracetamol: true, dose: '1 comprimé 500 mg', outcome: 'REPOS' }, 'Aina');
  assert.match(m, /Aina .* 10h15 : mal de tête\. Un Doliprane lui a été donné \(1 comprimé 500 mg\)/);
});

test('inventaire : casse, réparation, achat avec facture, stock et péremption', () => {
  let t = { id: 't', name: 'Table double', qty: 10, broken: 0, min: 8 };
  t = reportBroken(t, 2, 'pied cassé', 'Mme Hanta', 'x');
  assert.equal(usable(t), 8);
  assert.throws(() => reportBroken(t, 9, 'x', 'y', 'z'), /Seulement 8/);
  assert.equal(inventoryAlerts([t], '2026-10-13').length, 2);
  t = resolveBroken(t, 1, 'REPARE', 'y', 'z'); assert.deepEqual([t.qty, t.broken], [10, 1]);
  t = resolveBroken(t, 1, 'JETE', 'y', 'z'); assert.deepEqual([t.qty, t.broken], [9, 0]);
  t = addPurchase(t, { n: 3, supplier: 'Menuiserie', price: 150000, invoice: { kind: 'pdf' } }, 'y', 'z');
  assert.deepEqual([t.qty, t.invoices.length], [12, 1]);
  assert.deepEqual(inventoryAlerts([t], '2026-10-13'), []);
  const d = { id: 'd', name: 'Doliprane', qty: 1, broken: 0, expires: '2026-11-01' };
  assert.equal(inventoryAlerts([d], '2026-10-13')[0].kind, 'PEREMPTION');
  assert.equal(inventoryAlerts([d], '2026-11-02')[0].kind, 'PERIME');
  assert.equal(consume(d, 1, 'y', 'z').qty, 0);
  assert.throws(() => consume({ ...d, qty: 0 }, 1, 'y', 'z'));
});

import { agendasFor, closuresAsEvents, isExamClass } from '../src/rules/agenda.js';
import { manualBalance } from '../src/rules/manuals.js';
test('agendas : école pour tous, classes d\'examen, équipe réservée au personnel', () => {
  const events = [
    ...closuresAsEvents([{ id: 'f1', kind: 'FERIE', label: 'Toussaint', start: '2026-11-01', end: '2026-11-01' }]),
    { id: 'x', agenda: 'EXAMENS', date: '2027-01-12', allDay: true, title: 'Brevet blanc', classes: ['3e'] },
    { id: 'y', agenda: 'EQUIPE', date: '2026-11-27', allDay: true, title: 'Arrêt des notes', classes: [] },
  ];
  const titles = (o) => agendaItems({ events, ...o }).map((i) => i.title);
  assert.deepEqual(titles({ cls: '5e' }), ['Jour férié — Toussaint']);
  assert.deepEqual(titles({ cls: '3e' }), ['Jour férié — Toussaint', 'Brevet blanc']);
  assert.deepEqual(titles({ cls: '1re STMG' }), ['Jour férié — Toussaint']); // brevet : 3e seulement
  assert.deepEqual(titles({ staff: true }), ['Jour férié — Toussaint', 'Arrêt des notes', 'Brevet blanc']);
  assert.deepEqual(agendasFor({ staff: false, cls: '4e' }), ['COURS', 'ECOLE', 'DEVOIRS']);
  assert.deepEqual(agendasFor({ staff: false, cls: 'Terminale STMG' }), ['COURS', 'ECOLE', 'EXAMENS', 'DEVOIRS']);
  assert.ok(isExamClass('1re Générale') && !isExamClass('2de'));
});

test('inventaire des manuels : effectif, en prêt, abîmés, perdus, à commander', () => {
  const m = { id: 'm', title: 'Maths', levels: ['5e'], returnable: true, stock: { NEUF: 1, BON: 2, USE: 0, DECHIRE: 2 } };
  const loans = [{ manualId: 'm', student: 'a' }, { manualId: 'm', student: 'b' }, { manualId: 'm', student: 'c', stateIn: 'PERDU' }];
  const b = manualBalance(m, loans, 10);
  assert.deepEqual([b.total, b.lent, b.goodInStock, b.damaged, b.lost, b.missing], [7, 2, 3, 2, 1, 5]);
  const c = { id: 'c', title: 'Cahier', levels: ['5e'], returnable: false, stock: { NEUF: 3 } };
  assert.equal(manualBalance(c, [{ manualId: 'c', sold: true }], 10).missing, 6);
  assert.equal(manualBalance(c, [], null).missing, null);
});

import { EXAMS, examResult, bacProjection, examsForClass, mention, decision, partMark, suggestedCoef } from '../src/rules/mockExam.js';
test('examens blancs : candidats libres, coefficients sur 100, sciences du brevet (2 meilleures sur 3)', () => {
  const sum = (k) => EXAMS[k].parts.reduce((t, p) => t + p.coef, 0);
  assert.equal(sum('PREMIERE_G') + sum('BAC_G'), 100);
  assert.equal(sum('PREMIERE_STMG') + sum('BAC_STMG'), 100);
  assert.equal(sum('DNB'), 10);
  const sci = EXAMS.DNB.parts.find((p) => p.id === 'SCI');
  assert.equal(partMark(sci, { PC: 8, SVT: 14, TECH: 12 }), 13); // PC écartée
  assert.equal(partMark(sci, { PC: 8 }), null);
  const r = examResult(EXAMS.DNB.parts, { FR: 12, MA: 10, HG: 14, EMC: 14, PC: 8, SVT: 14, TECH: 12, ANG: 16 });
  assert.deepEqual([r.points, r.average, r.complete], [130, 13, true]);
  assert.equal(examResult(EXAMS.DNB.parts, { FR: 12, MA: 'ABS', HG: 14, EMC: 14, PC: 8, SVT: 14, TECH: 'ABS', ANG: 16 }).average, 10.6); // absent compté 0 ; sciences : 14 et 8 (techno absent : 0)
  assert.equal(mention(13), 'Assez bien');
  assert.deepEqual([decision(9, 'BAC_G'), decision(9, 'DNB'), decision(7.9, 'BAC_G')], ['Second groupe', 'Non admis', 'Non admis']);
  assert.deepEqual([examsForClass('3e'), examsForClass('1re STMG'), examsForClass('1re Générale'), examsForClass('Terminale STMG'), examsForClass('2de')], [['DNB'], ['PREMIERE_STMG'], ['PREMIERE_G'], ['BAC_STMG'], []]);
  assert.equal(suggestedCoef([{ coef: 2 }, { coef: 1 }]), 3);
});

test('projection au bac : notes officielles de 1re + bac blanc, sans contrôle continu', () => {
  const official = { FR_E: 10, FR_O: 13, MA_EA: 12, SGN: 11, HG: 12, EMC: 12, MA: 9, LVA: 14, LVB: 12 }; // 33 coef.
  const p = bacProjection('BAC_STMG', { official });
  assert.equal(p.total, 100);
  assert.deepEqual([p.acquired, p.acquiredCoef, p.remainingCoef], [380, 33, 67]);
  assert.deepEqual([p.needed[10], p.needed[12], p.needed[16]], [9.25, 12.24, 18.21]);
  const blanc = Object.fromEntries(EXAMS.BAC_STMG.parts.map((x) => [x.id, 12]));
  const q = bacProjection('BAC_STMG', { official, blanc });
  assert.equal(q.blancAverage, 12);
  assert.equal(q.projected, 11.84); // (380 + 12 × 67) / 100
  assert.ok(q.complete);
  assert.equal(bacProjection('BAC_G', { official: { FR_E: 3, FR_O: 4 } }).needed[16], 17.39);
  assert.equal(bacProjection('BAC_G', { official: { FR_E: 2, FR_O: 2, MA_EA: 2, SPE_AB: 2, HG: 2, EMC: 2, ES: 2, LVA: 2, LVB: 2 } }).needed[16], null);
});

import { passport, colleErrors, validateMeasure as vm2 } from '../src/rules/discipline.js';
test('passeport de vie scolaire : carnet selon l\'ancienneté, autres oublis au choix, 3 retards = une colle', () => {
  const attendance = ['2026-10-01', '2026-10-05', '2026-10-08', '2026-10-12'].map((date) => ({ student: 'A', kind: 'RETARD', date }));
  const forgets = [{ id: 'o1', student: 'A', date: '2026-10-07', kind: 'Matériel', note: 'calculatrice', by: 'M. Rasolo' }];
  let p = passport('A', { attendance, forgets, colles: [] });
  assert.equal(p.toGive.length, 1); // matériel : pas de colle automatique
  assert.match(p.toGive[0].reason, /3 retards \(01\/10, 05\/10, 08\/10\)/);
  assert.deepEqual(p.toGive[0].choices, [1, 2]);
  assert.equal(p.latesInCycle, 1);
  p = passport('A', { attendance, forgets: [{ ...forgets[0], colle: true }], colles: [] });
  assert.equal(p.toGive.length, 2); // colle demandée par le professeur
  assert.match(p.toGive[1].reason, /demandée par M. Rasolo/);
  const colles = [{ student: 'A', kind: 'COLLE', cause: 'RETARDS', hours: 2, status: 'FAITE', date: '2026-10-09' }, { student: 'A', kind: 'COLLE', cause: 'OUBLI', forgetId: 'o1', hours: 1, status: 'A_FAIRE', date: '2026-10-08' }, { student: 'A', kind: 'TIG', hours: 1, status: 'A_FAIRE', date: '2026-10-10' }];
  p = passport('A', { attendance, forgets, colles });
  assert.deepEqual([p.toGive.length, p.collesDue, p.collesDone, p.tig], [0, 1, 2, 1]);
  // carnet de liaison : ancien élève 1 oubli = 1 h ; nouvel élève 2 oublis = 1 h
  const carnet = (id, date) => ({ id, student: 'B', date, kind: 'Carnet de liaison' });
  assert.equal(passport('B', { forgets: [carnet('k1', '2026-10-05')] }).toGive.length, 1);
  assert.equal(passport('B', { forgets: [carnet('k1', '2026-10-05')] }, { isNew: true }).toGive.length, 0);
  const two = passport('B', { forgets: [carnet('k1', '2026-10-05'), carnet('k2', '2026-10-09')] }, { isNew: true });
  assert.equal(two.toGive.length, 1);
  assert.equal(two.toGive[0].forgetId, 'k2');
  assert.match(two.toGive[0].reason, /2 fois \(05\/10, 09\/10\) — nouvel élève/);
  assert.equal(passport('B', { forgets: [carnet('k1', '2026-10-05'), carnet('k2', '2026-10-09')], colles: [{ student: 'B', kind: 'COLLE', cause: 'OUBLI', forgetId: 'k2', hours: 1, status: 'A_FAIRE', date: '2026-10-09' }] }, { isNew: true }).toGive.length, 0);
  assert.equal(colleErrors({ kind: 'COLLE', hours: 3, when: '2026-10-21T13:00' }).length, 1);
  // TIG : Direction seulement
  assert.equal(vm2({ measureId: 'TIG', authorRole: 'PROFESSEUR', reason: 'x', student: 'A' }).length, 1);
  assert.equal(vm2({ measureId: 'TIG', authorRole: 'VIE_SCOLAIRE', reason: 'x', student: 'A' }).length, 1);
  assert.deepEqual(vm2({ measureId: 'TIG', authorRole: 'DIRECTION', reason: 'x', student: 'A' }), []);
  assert.deepEqual(vm2({ measureId: 'AVERTISSEMENT', authorRole: 'PROFESSEUR', reason: 'x', student: 'A' }), []);
});

import { justification, justifyDeadline } from '../src/rules/attendance.js';
test('justification : 24 h au plus après le début de l\'absence, ensuite non justifiée', () => {
  const a = { date: '2026-10-13', slot: '07h00–09h00', justified: false };
  assert.equal(justifyDeadline(a), '2026-10-14T07:00');
  assert.deepEqual(justification(a, '2026-10-13T11:00'), { status: 'A_JUSTIFIER', deadline: '2026-10-14T07:00', hoursLeft: 20 });
  assert.equal(justification(a, '2026-10-14T07:00').status, 'NON_JUSTIFIEE');
  assert.equal(justification(a, '2026-10-14T09:30').status, 'NON_JUSTIFIEE'); // même s'ils viennent ensuite
  assert.equal(justifyDeadline({ date: '2026-10-13', slot: 'Journée' }), '2026-10-14T07:00');
  assert.equal(justifyDeadline({ date: '2026-10-13', slot: '13h30–15h30' }), '2026-10-14T13:30');
  assert.equal(justification({ ...a, justified: true }, '2026-10-20T07:00').status, 'JUSTIFIEE');
});

import { objectState, canDecideDuration, objectOf } from '../src/rules/discipline.js';
test('objets confisqués : durée décidée par la Direction ou le secrétariat', () => {
  const settings = { calendar: [] };
  const o = { action: 'CONFISCATION', object: 'Écouteurs sans fil', at: '2026-10-13T10:00', duration: null, returned: null };
  assert.equal(objectState(o, '2026-10-13T11:00', settings), 'A_DECIDER');
  assert.equal(objectState({ ...o, duration: '24H' }, '2026-10-13T11:00', settings), 'EN_GARDE');
  assert.equal(objectState({ ...o, duration: '24H' }, '2026-10-14T10:00', settings), 'A_RENDRE');
  assert.equal(objectState({ ...o, duration: '24H', returned: { at: 'x' } }, '2026-10-14T10:00', settings), 'RENDU');
  assert.deepEqual(['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'ENSEIGNANT'].map(canDecideDuration), [true, true, false, false]);
  assert.equal(objectOf({ object: 'Autre', objectNote: 'Puff' }), 'Puff');
  assert.equal(objectOf({}), 'Téléphone');
});

import { readFileSync } from 'node:fs';
import { readXlsx, sheetRows, excelDate } from '../src/xlsxRead.js';
import { bookToImport, withExtras } from '../src/rules/templateImport.js';

test('modèle Excel : lecture du classeur, ligne « Exemple » ignorée', async () => {
  const book = await readXlsx(readFileSync(new URL('../../modeles/modele-import-chateaubriand.xlsx', import.meta.url)));
  assert.equal(Object.keys(book).length, 11);
  assert.equal(book['1 Élèves'][0][1], 'Nom');
  assert.equal(sheetRows(book['1 Élèves']).length, 0);
  assert.equal(excelDate(46300), '05/10/2026');
});

test('modèle Excel : élèves, responsables, professeurs, notes officielles de 1re, inventaire (données fictives)', async () => {
  const sheet = (name, rows) => ({ name, rows });
  const bytes = buildXlsx([
    sheet('1 Élèves', [['N° (matricule)', 'Nom', 'Prénom(s)', 'Prénom d\'usage', 'Sexe', 'Née le', 'Classe', 'Allergies'], ['Exemple', 'X', 'Y'], ['TS-001', 'RABE', 'Jean Luc', 'Luc', 'M', '01/02/2008', 'Terminale STMG', 'Paracétamol']]),
    sheet('2 Responsables', [['N° élève (matricule)', 'Nom de l\'élève', 'Lien', 'Nom', 'Prénom', 'Téléphone', 'E-mail', 'À appeler en urgence'], ['TS-001', '', 'Mère', 'RABE', 'Lalao', '034 11 222 33', 'L@EX.MG', 'Oui']]),
    sheet('3 Personnel', [['Nom', 'Prénom', 'Fonction', 'Matière(s)', 'Classe(s)'], ['RAKOTO', 'Mia', 'Professeur', 'Management, Droit', '1re STMG, Terminale STMG'], ['BE', 'Paul', 'CPE', '', '']]),
    sheet('6 Notes officielles 1re', [['N° élève (matricule)', 'Nom de l\'élève', 'Français écrit', 'Français oral', 'Mathématiques (anticipée)', 'Spécialité abandonnée (ou SGN)', 'Histoire-géo et EMC', 'Ens. scientifique (ou maths STMG)', 'LVA', 'LVB'], ['TS-001', 'RABE Jean Luc', '11', '13,5', '12', '9', '10', '8', 'abs', '25']]),
    sheet('10 Inventaire', [['Catégorie', 'Article', 'Quantité', 'Dont cassés', 'Lieu', 'Seuil de recommande', 'Péremption'], ['Trousse de secours', 'Doliprane 500 mg', '10', '0', 'Secrétariat', '5', '30/06/2027']]),
  ]);
  const r = bookToImport(await readXlsx(bytes));
  assert.match(r.studentsTsv, /^N° \(matricule\)\tNom/);
  assert.ok(!r.studentsTsv.includes('Exemple'));
  assert.equal(r.staffTsv, 'Nom\tMatière\tClasse\nRAKOTO Mia\tManagement, Droit\t1re STMG, Terminale STMG'); // la CPE n'est pas un enseignement
  assert.equal(r.guardians['RABE JEAN LUC'][0].email, 'l@ex.mg');
  assert.deepEqual(r.official['RABE JEAN LUC'], { FR_E: 11, FR_O: 13.5, MA_EA: 12, SGN: 9, HG: 10, EMC: 10, MA: 8, LVA: 'ABS' }); // STMG : SGN et maths
  assert.equal(r.officialErrors.length, 1); // 25 / 20
  assert.deepEqual([r.inventory[0].cat, r.inventory[0].expires, r.inventory[0].min], ['Trousse de secours', '2027-06-30', 5]);
  const [s] = withExtras([{ lastName: 'RABE', firstName: 'Jean Luc', guardians: [] }], r);
  assert.deepEqual([s.usualName, s.sex, s.health.allergies, s.guardians.length], ['Luc', 'M', 'Paracétamol', 1]);
});

import { AMBIANCES, PALETTES, MOTIFS, NOT_SECULAR, activeAmbiance, ambianceErrors, catalog, ambianceConfig } from '../src/rules/ambiances.js';
test('ambiances : dates (hémisphère sud), Nouvel An lunaire, chevauchements, réglages', () => {
  assert.equal(activeAmbiance('2026-10-18').id, 'OCTOBRE_ROSE');
  assert.equal(activeAmbiance('2026-10-28').id, 'OCTOBRE_ROSE'); // plus d'Halloween
  assert.equal(activeAmbiance('2026-12-24'), null); // plus de Noël
  assert.equal(activeAmbiance('2027-01-03').id, 'NOUVEL_AN'); // décembre → janvier
  assert.equal(activeAmbiance('2026-09-25').id, 'PRINTEMPS'); // printemps austral
  assert.equal(activeAmbiance('2027-03-28').id, 'MEMOIRE_1947'); // la plus courte l'emporte sur l'automne
  assert.equal(activeAmbiance('2027-03-24').id, 'AUTOMNE');
  // Nouvel An lunaire : 6 février 2027 (Chèvre), de 3 jours avant à 4 jours après ; date inconnue → rien
  assert.equal(activeAmbiance('2027-02-03').id, 'NOUVEL_AN_LUNAIRE');
  assert.equal(activeAmbiance('2027-02-06').greeting, 'Bonne année de la Chèvre !');
  assert.equal(activeAmbiance('2027-02-11'), null);
  assert.equal(activeAmbiance('2035-02-08'), null);
  assert.equal(activeAmbiance('2026-11-25'), null);
  assert.equal(activeAmbiance('2026-10-18', { mode: 'OFF' }), null);
  assert.equal(activeAmbiance('2026-11-25', { mode: 'INDEPENDANCE' }).id, 'INDEPENDANCE');
  assert.equal(activeAmbiance('2026-10-18', { mode: 'NOEL' }).id, 'OCTOBRE_ROSE'); // ancienne valeur : automatique
  // anciens réglages (settings.seasonal) repris
  assert.equal(ambianceConfig({ seasonal: { mode: 'OFF' } }).mode, 'OFF');
  // une ambiance ajoutée par la Direction l'emporte sur les ambiances prévues aux mêmes dates
  const custom = { id: 'PERSO_1', label: 'Semaine de la Grande Guerre', from: '11-02', to: '11-13', palette: 'sobre', motif: 'aucun', note: { title: '1914-1918', text: 'Projet des 3e.' } };
  assert.equal(activeAmbiance('2026-11-10', { custom: [custom] }).id, 'PERSO_1');
  // note corrigée par la Direction
  assert.equal(activeAmbiance('2026-10-18', { notes: { OCTOBRE_ROSE: { title: 'T', text: 'X' } } }).note.title, 'T');
});

test('ambiances : école laïque, palettes et motifs connus', () => {
  AMBIANCES.forEach((a) => {
    assert.ok(!NOT_SECULAR.test(`${a.id} ${a.label} ${a.greeting} ${a.note?.title ?? ''} ${a.note?.text ?? ''}`), `${a.id} : connotation religieuse`);
    assert.ok(PALETTES[a.palette] && MOTIFS[a.motif], `${a.id} : palette ou motif inconnu`);
  });
  assert.ok(ambianceErrors({ label: 'Noël à l\'école', from: '12-01', to: '12-20', palette: 'rouge', motif: 'etoiles' }).some((e) => e.includes('laïque')));
  assert.ok(ambianceErrors({ label: 'Thème libre', from: '12-01', to: '12-20', palette: 'fluo', motif: 'etoiles' }).some((e) => e.includes('palette')));
  // une ambiance invalide n'entre pas au catalogue
  assert.equal(catalog({ custom: [{ id: 'X', label: 'Halloween', from: '10-31', to: '10-31', palette: 'ambre', motif: 'aucun' }] }).length, AMBIANCES.length);
  // les commémorations restent sobres : pas d'animation
  ['ARMISTICE', 'MEMOIRE_1947'].forEach((id) => assert.equal(AMBIANCES.find((a) => a.id === id).motif, 'aucun'));
});

test('ambiances : contrastes WCAG lus dans styles/ambiances.css (AAA pour le texte, AA pour la barre)', () => {
  const css = readFileSync(new URL('../src/styles/ambiances.css', import.meta.url), 'utf8');
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const vars = (block) => Object.fromEntries([...block.matchAll(/--amb-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
  const blocks = { defaut: vars(css.match(/:root \{([^}]*)\}/)[1]) };
  Object.keys(PALETTES).forEach((p) => {
    const m = css.match(new RegExp(`:root\\.ambiance--${p}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `palette ${p} absente du CSS`);
    blocks[p] = vars(m[1]);
  });
  Object.entries(blocks).forEach(([p, v]) => {
    ['accent', 'topbar-end', 'band-bg', 'band-fg', 'note-bg', 'note-fg', 'note-border', 'link'].forEach((k) => assert.ok(v[k], `${p} : --amb-${k} manquant`));
    assert.ok(ratio(v['band-fg'], v['band-bg']) >= 7, `${p} : bande ${ratio(v['band-fg'], v['band-bg']).toFixed(2)} < 7`);
    assert.ok(ratio(v['note-fg'], v['note-bg']) >= 7, `${p} : encart ${ratio(v['note-fg'], v['note-bg']).toFixed(2)} < 7`);
    assert.ok(ratio(v.link, v['note-bg']) >= 7, `${p} : lien < 7`);
    assert.ok(ratio('#ffffff', v['topbar-end']) >= 4.5, `${p} : barre du haut ${ratio('#ffffff', v['topbar-end']).toFixed(2)} < 4,5`);
  });
});

import { newPost, moderate, visiblePosts, postErrors, withoutImageRights } from '../src/rules/schoolLife.js';
test('vie de l\'école : seule la Direction publie ; secrétariat, CPE, profs et élèves proposent', () => {
  const photos = ['data:image/png;base64,x'];
  const dir = newPost({ title: 'Octobre rose', photos }, { role: 'DIRECTION', author: 'Direction', at: '2026-10-09T10:00' });
  const cpe = newPost({ title: 'Tournoi', photos }, { role: 'VIE_SCOLAIRE', author: 'M. Be', at: '2026-10-09T11:00' });
  const pupil = newPost({ title: 'Nos photos', photos }, { role: 'ELEVE', author: 'Aina', at: '2026-10-10T12:00' });
  assert.deepEqual([dir.status, cpe.status, pupil.status], ['PUBLIEE', 'EN_ATTENTE', 'EN_ATTENTE']);
  assert.equal(postErrors({ title: '', photos: [] }).length, 2);
  assert.throws(() => moderate(pupil, { role: 'VIE_SCOLAIRE', by: 'M. Be', approve: true, imageRightsChecked: true }), /Seule la Direction/);
  assert.throws(() => moderate(pupil, { role: 'DIRECTION', by: 'Direction', approve: true }), /droit à l'image/);
  assert.throws(() => moderate(pupil, { role: 'DIRECTION', by: 'Direction', approve: false }), /Expliquez/);
  const ok = moderate(pupil, { role: 'DIRECTION', by: 'Direction', approve: true, imageRightsChecked: true });
  assert.equal(ok.status, 'PUBLIEE');
  const posts = [dir, pupil];
  assert.equal(visiblePosts(posts, { role: 'PARENT', author: 'Parent' }).length, 1);
  assert.equal(visiblePosts(posts, { role: 'ELEVE', author: 'Aina' }).length, 2); // l'auteur voit sa proposition
  assert.equal(visiblePosts([cpe], { role: 'VIE_SCOLAIRE', author: 'Autre' }).length, 0); // la CPE ne modère plus
  assert.deepEqual(withoutImageRights([{ cls: '1re STMG', lastName: 'A', firstName: 'B', authorizations: { image: false } }, { cls: '1re STMG', lastName: 'C', firstName: 'D', authorizations: { image: true } }], '1re STMG'), ['A B']);
});

import * as pub from '../src/rules/publication.js';
test('publication : seule la Direction publie, le secrétariat et la CPE passent par la validation', () => {
  const hanta = { role: 'BUREAU', name: 'Mme Hanta', at: '2026-10-12T09:00' };
  const dir = { role: 'DIRECTION', name: 'Cheffe d\'établissement', at: '2026-10-13T08:00' };
  const prof = { role: 'ENSEIGNANT', name: 'Mme Ranaivo', at: '2026-10-12T10:00' };
  assert.throws(() => pub.create('ANNONCE', { title: 'x' }, prof), /Direction, le secrétariat, la CPE, les délégués ou le BDE/);
  let a = pub.create('ANNONCE', { title: 'Réunion', text: 'Mardi' }, hanta);
  assert.equal(a.status, 'BROUILLON');
  assert.throws(() => pub.approve(a, dir), /Rien à valider/);
  a = pub.submit(a, hanta);
  assert.equal(a.status, 'EN_ATTENTE');
  assert.throws(() => pub.edit(a, { title: 'y' }, hanta), /Déjà envoyée/);
  assert.throws(() => pub.approve(a, { ...hanta }), /Seule la Direction/);
  a = pub.sendBack(a, dir, 'Préciser l\'heure');
  assert.deepEqual([a.status, a.note], ['A_REVOIR', 'Préciser l\'heure']);
  a = pub.submit(pub.edit(a, { text: 'Mardi 17h' }, hanta), hanta);
  a = pub.approve(a, dir, { patch: { title: 'Réunion parents-professeurs' } });
  assert.deepEqual([a.status, a.title, a.editedByDirection], ['PUBLIEE', 'Réunion parents-professeurs', true]);
  assert.equal(pub.signature(a), 'Secrétariat · validée par la Direction');
  assert.match(pub.trail(a), /Rédigée par Mme Hanta \(Secrétariat\) le 12\/10, corrigée par la Direction, publiée par Cheffe d'établissement le 13\/10/);
  assert.deepEqual(a.history.map((h) => h.action), ['CREEE', 'ENVOYEE', 'RENVOYEE', 'ENVOYEE', 'CORRIGEE', 'PUBLIEE']);
  const d = pub.create('ANNONCE', { title: 'Portes ouvertes' }, dir, { send: true });
  assert.deepEqual([d.status, pub.signature(d)], ['PUBLIEE', 'Direction']);
  // Vie de l'école : un professeur propose ; publication seulement avec le droit à l'image vérifié
  let v = pub.create('VIE_ECOLE', { title: 'Sortie' }, prof, { send: true });
  assert.equal(v.status, 'EN_ATTENTE');
  assert.throws(() => pub.approve(v, dir), /droit à l'image/);
  v = pub.approve(v, dir, { checks: { imageRights: true } });
  assert.equal(pub.signature({ ...v, authorDisplay: 'Mme Ranaivo' }), 'Proposée par Mme Ranaivo · publiée par la Direction');
  assert.equal(pub.isPublic({ title: 'ancienne' }), true);
});

import { featureVisible, featureMode } from '../src/features.js';
import { saveDecision } from '../src/rules/generalAppreciation.js';
test('rubriques modulaires : visibles, Direction seulement ou masquées ; décision du conseil avec l\'appréciation', () => {
  assert.equal(featureMode({}, 'caisse.tarifs'), 'DIRECTION'); // par défaut, réservée à la Direction
  assert.ok(featureVisible({}, 'caisse.tarifs', 'DIRECTION'));
  assert.ok(!featureVisible({}, 'caisse.tarifs', 'BUREAU'));
  assert.ok(!featureVisible({ features: { 'vie-ecole': 'AUCUN' } }, 'vie-ecole', 'DIRECTION'));
  assert.ok(featureVisible({}, undefined, 'BUREAU'));
  const e = saveDecision({ text: 'Bon trimestre', status: 'VALIDEE' }, 'ENCOURAGEMENTS', 'BUREAU');
  assert.deepEqual([e.decision, e.status], ['ENCOURAGEMENTS', 'BROUILLON']); // à revalider par la Direction
  assert.throws(() => saveDecision({}, 'X', 'ENSEIGNANT'));
});

import { mandatesOf, can, audienceErrors, classMandateErrors, NEVER, serviceLabel } from '../src/rules/mandates.js';
test('mandats d\'élèves : délégué (sa classe), BDE (son site), jamais de notes ni de paramètres, validation obligatoire', () => {
  const delegue = { role: 'ELEVE', mandates: mandatesOf(['DELEGUE'], { cls: '1re STMG' }) };
  const bde = { role: 'ELEVE', mandates: mandatesOf(['BDE_PRESIDENT'], { cls: 'Terminale STMG' }) };
  const eleve = { role: 'ELEVE', mandates: mandatesOf(['ECO_DELEGUE'], { cls: '1re STMG' }) };
  assert.deepEqual([can(delegue, 'ANNONCE_CLASSE'), can(delegue, 'EVENEMENT'), can(bde, 'EVENEMENT'), can(eleve, 'ANNONCE_CLASSE')], [true, false, true, false]);
  assert.equal(bde.mandates[0].president, true);
  NEVER.forEach((c) => assert.equal(can({ mandates: [...delegue.mandates, ...bde.mandates] }, c), false, c));
  const m = delegue.mandates[0];
  assert.deepEqual(audienceErrors(m, { roles: ['ELEVE'], site: 'TMV', scope: 'CLASS', values: ['1re STMG'] }), []);
  assert.equal(audienceErrors(m, { roles: ['ELEVE', 'PARENT'], site: 'TMV', scope: 'CLASS', values: ['1re STMG'] }).length, 1);
  assert.equal(audienceErrors(m, { roles: ['ELEVE'], site: 'TMV', scope: 'CLASS', values: ['2de'] }).length, 1);
  assert.deepEqual(audienceErrors(bde.mandates[0], { roles: ['ELEVE'], site: 'TMV', scope: 'ALL', values: [] }), []);
  assert.equal(classMandateErrors({ a: ['DELEGUE'], b: ['DELEGUE'], c: ['DELEGUE'] }).length, 1);
  // le circuit de la Direction s'applique : jamais publié directement
  const a = pub.create('ANNONCE', { title: 'Sortie de classe', service: serviceLabel(m) }, { role: 'DELEGUE', name: 'Aina', at: '2026-10-13T12:00' }, { send: true });
  // relecture de la CPE d'abord : la Direction ne voit rien avant
  assert.equal(a.status, 'A_RELIRE');
  const dir = { role: 'DIRECTION', name: 'Direction', at: '2026-10-13T16:00' };
  const cpe = { role: 'VIE_SCOLAIRE', name: 'M. Be', at: '2026-10-13T14:00' };
  assert.throws(() => pub.approve(a, dir), /Rien à valider/);
  assert.throws(() => pub.forward(a, { role: 'BUREAU', name: 'Mme Hanta', at: 'x' }), /CPE/);
  assert.throws(() => pub.cpeSendBack(a, cpe, ''), /revoir/);
  const back = pub.cpeSendBack(a, cpe, 'Préciser l\'heure');
  assert.equal(back.status, 'A_REVOIR');
  const again = pub.submit(back, { role: 'DELEGUE', name: 'Aina', at: '2026-10-13T15:00' });
  assert.equal(again.status, 'A_RELIRE');
  const relue = pub.forward(again, cpe);
  assert.equal(relue.status, 'EN_ATTENTE');
  const ok = pub.approve(relue, dir);
  assert.equal(pub.signature(ok), 'Délégués de 1re STMG · validée par la Direction');
  assert.deepEqual(ok.history.map((h) => h.action), ['CREEE', 'ENVOYEE', 'RENVOYEE', 'ENVOYEE', 'RELUE', 'PUBLIEE']);
  const ev = pub.create('EVENEMENT', { title: 'Soirée de fin d\'année', service: 'Bureau des élèves (BDE)' }, { role: 'BDE', name: 'Mamy', at: '2026-10-13T12:00' }, { send: true });
  assert.equal(ev.status, 'A_RELIRE');
  assert.throws(() => pub.create('EVENEMENT', { title: 'x' }, { role: 'DELEGUE', name: 'Aina', at: 'x' }), /proposer/);
  assert.equal(can(delegue, 'CONTACT_CPE'), false); // la messagerie suffit
});

test('annulation d\'un cours le jour même : publiée tout de suite par le secrétariat ou la CPE, sinon validation', () => {
  const at = '2026-10-20T07:15';
  const notice = { title: 'Maths (1re STMG) : cours annulé', text: '…', urgent: 'ANNULATION_JOUR', date: '2026-10-20' };
  const bureau = pub.create('ANNONCE', notice, { role: 'BUREAU', name: 'Mme Hanta', at }, { send: true });
  assert.equal(bureau.status, 'PUBLIEE');
  assert.equal(pub.signature(bureau), 'Secrétariat · annulation du jour');
  assert.equal(pub.create('ANNONCE', notice, { role: 'VIE_SCOLAIRE', name: 'M. Be', at }, { send: true }).status, 'PUBLIEE');
  // pas le jour même, ou un autre type d'avis : circuit normal
  assert.equal(pub.create('ANNONCE', { ...notice, date: '2026-10-21' }, { role: 'BUREAU', name: 'Mme Hanta', at }, { send: true }).status, 'EN_ATTENTE');
  assert.throws(() => pub.create('ANNONCE', notice, { role: 'DELEGUE', name: 'Aina', at }, { send: true }), /jour même/);
});

import { csvCell } from '../src/rules/csv.js';
test('exports CSV : une formule n\'est jamais exécutée par Excel, les nombres restent des nombres', () => {
  assert.equal(csvCell('=HYPERLINK("http://x","clic")'), '"\'=HYPERLINK(""http://x"",""clic"")"');
  assert.equal(csvCell('+33 6 12'), '+33 6 12'); // numéro : reste tel quel
  assert.equal(csvCell('@SUM(A1)'), '\'@SUM(A1)');
  assert.equal(csvCell('-cmd|calc'), '\'-cmd|calc');
  assert.equal(csvCell('-5 000'), '-5 000');
  assert.equal(csvCell(-12.5), '-12.5');
  assert.equal(csvCell('Très bon trimestre ; continuez'), '"Très bon trimestre ; continuez"');
  assert.equal(csvCell(null), '');
});

import { isExpired, wipeLocalData, REAL_DATA_TTL_HOURS } from '../src/privacy.js';
test('données réelles : expiration et effacement de ce navigateur (réglages gardés)', () => {
  const now = Date.parse('2026-10-18T20:00:00Z');
  assert.equal(isExpired('2026-10-18T09:00:00Z', now), REAL_DATA_TTL_HOURS < 11);
  assert.equal(isExpired('2026-10-17T07:00:00Z', now), true);
  assert.equal(isExpired(undefined, now), false);
  const data = { 'ent-import-v1': '{}', 'ent-fiche-v1': '{}', 'ent-chateaubriand-settings-v3': '{}', 'ent-ambiance-prefs-v1': '{}', autre: 'x' };
  const store = { get length() { return Object.keys(data).length; }, key: (i) => Object.keys(data)[i], removeItem: (k) => { delete data[k]; } };
  assert.equal(wipeLocalData(store), 2);
  assert.deepEqual(Object.keys(data).sort(), ['autre', 'ent-ambiance-prefs-v1', 'ent-chateaubriand-settings-v3']);
});

import { DIRECTION_TREE, FAMILY_SECTIONS, arrangeNav } from '../src/rules/navigation.js';
test('navigation : Direction en 5 rubriques, un seul emplacement par écran, rien « bientôt » dans le menu', () => {
  assert.equal(DIRECTION_TREE.length, 5);
  const ids = DIRECTION_TREE.flatMap((g) => g.ids);
  assert.equal(new Set(ids).size, ids.length, 'écran présent deux fois');
  DIRECTION_TREE.forEach((g) => assert.ok(g.ids.length <= 9, `${g.group} : plus de 9 entrées`));
  ['students', 'exams'].forEach((id) => assert.ok(!ids.includes(id), `${id} ne doit pas être dans le menu`));
  assert.ok(ids.includes('timetable'), 'les emplois du temps sont maintenant un vrai écran');
  assert.ok(ids.includes('mandates') && ids.includes('feedback'), 'Délégués et BDE et Avis du pilote sont dans le menu');
});

test('navigation : l\'arborescence ne garde que les entrées existantes, dans son ordre ; un identifiant inconnu est refusé', () => {
  const groups = [{ group: 'A', items: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] }];
  const tree = [{ group: 'Nouveau', ids: ['z', 'x'] }];
  assert.deepEqual(arrangeNav(tree, groups), [{ group: 'Nouveau', items: [{ id: 'z' }, { id: 'x' }] }]);
  assert.throws(() => arrangeNav([{ group: 'B', ids: ['inconnu'] }], groups), /inconnu/);
});

test('navigation : portail famille en 4 sections de 3 au plus, entrées réservées aux parents bien marquées', () => {
  assert.equal(FAMILY_SECTIONS.length, 4);
  const entries = FAMILY_SECTIONS.flatMap(([, items]) => items);
  assert.equal(new Set(entries.map(([id]) => id)).size, entries.length, 'entrée présente deux fois');
  FAMILY_SECTIONS.forEach(([title, items]) => assert.ok(items.length <= 3, `${title} : plus de 3 entrées`));
  const parentOnly = entries.filter((e) => e[3] === 'PARENT').map((e) => e[0]).sort();
  assert.deepEqual(parentOnly, ['fiche', 'payments', 'reenrol', 'signature', 'update']);
});

import { sortTasks, taskErrors, tasksFor, isOverdue } from '../src/rules/tasks.js';
test('tâches : priorité, échéance facultative, retard en tête, chacun voit les siennes', () => {
  const today = '2026-10-20';
  const l = [
    { id: 'a', title: 'A', assignee: 'BUREAU', priority: 'BASSE', due: null, done: false, createdBy: 'DIRECTION' },
    { id: 'b', title: 'B', assignee: 'BUREAU', priority: 'HAUTE', due: '2026-10-25', done: false, createdBy: 'DIRECTION' },
    { id: 'c', title: 'C', assignee: 'BUREAU', priority: 'NORMALE', due: '2026-10-18', done: false, createdBy: 'DIRECTION' },
    { id: 'd', title: 'D', assignee: 'BUREAU', priority: 'HAUTE', due: null, done: true, createdBy: 'DIRECTION' },
    { id: 'e', title: 'E', assignee: 'DIRECTION', priority: 'NORMALE', due: '2026-10-20', done: false, createdBy: 'DIRECTION' },
  ];
  assert.deepEqual(sortTasks(tasksFor(l, 'BUREAU'), today).map((t) => t.id), ['c', 'b', 'a', 'd']); // retard, haute, basse, fait
  assert.equal(isOverdue(l[2], today), true);
  assert.equal(tasksFor(l, 'DIRECTION').length, 5); // la Direction suit aussi ce qu'elle a confié
  assert.equal(tasksFor(l, 'VIE_SCOLAIRE').length, 0);
  assert.deepEqual(taskErrors({ title: 'x', assignee: 'BUREAU', priority: 'NORMALE', due: null }), []);
  assert.equal(taskErrors({ title: ' ', assignee: 'X', priority: 'URGENT' }).length, 3);
});

import { backupSheets } from '../src/rules/backup.js';
test('sauvegarde : un onglet par type de données, sommaire, photos exclues d\'Excel', () => {
  const sheets = backupSheets([
    ['ent-annonces-v2', { list: [{ id: 'n1', title: 'Sortie', photos: ['data:image/jpeg;base64,xx'] }], acks: { 'n1|a': true } }],
    ['ent-taches-v1', [{ id: 't1', title: 'Relire', done: false, due: null }]],
  ], '2026-10-20');
  assert.deepEqual(sheets.map((s) => s.name), ['Sommaire', 'annonces.list', 'annonces', 'taches']);
  assert.deepEqual(sheets[3].rows, [['id', 'title', 'done', 'due'], ['t1', 'Relire', 'non', '']]);
  assert.equal(sheets[1].rows[1][2], '["[photo]"]'); // photos jamais dans Excel, même dans un tableau
  assert.ok(!JSON.stringify(sheets).includes('base64'));
  assert.deepEqual(sheets[0].rows.slice(2), [['annonces.list', 1], ['annonces', 1], ['taches', 1]]);
});

test('ambiances : le message de la bande ne répète ni le libellé ni sa date', () => {
  AMBIANCES.forEach((a) => {
    assert.ok(!a.greeting.toLowerCase().includes(a.label.toLowerCase()), `${a.id} : le message reprend le libellé`);
    (a.label.match(/\d+/g) ?? []).forEach((n) => assert.ok(!a.greeting.includes(n), `${a.id} : la date ${n} est répétée`));
  });
});

import { fullBacTranscript } from '../src/rules/mockExam.js';
test('relevé complet de Terminale : notes officielles de 1re + bac blanc, total sur 100', () => {
  const official = { FR_E: 8, FR_O: 12, MA_EA: 10, SGN: 2, HG: 11, EMC: 14, MA: 9, LVA: 13, LVB: 12 };
  const blanc = { PHI: 10, MSGN: 16, DE: 11, GO: 12, HG: 10, EMC: 12, MA: 10, LVA: 14, LVB: 11, EPS: 15 };
  const t = fullBacTranscript('BAC_STMG', { official, blanc });
  assert.equal(t.total, 100);
  assert.equal(t.sections[0].coef + t.sections[1].coef, 100);
  assert.equal(t.sections[0].rows.find((r) => r.id === 'SGN').points, 16); // 2 × coef 8
  assert.ok(t.complete);
  assert.equal(t.coef, 100);
  assert.equal(t.average, Math.round(t.points) / 100); // points sur 100 coefficients
  const partial = fullBacTranscript('BAC_STMG', { official: {}, blanc });
  assert.ok(partial.officialMissing);
  assert.equal(partial.decision, '');
});

import { importOfficial, officialHeaders } from '../src/rules/mockExam.js';
test('import des notes officielles de 1re : par libellé d\'épreuve, élève de la classe, notes sur 20', () => {
  const h = officialHeaders('BAC_STMG');
  assert.equal(h[0], 'Élève (NOM Prénom)');
  assert.ok(h.some((x) => x.startsWith('Français — écrit')));
  const row = (line, name, fr, ma) => ({ line, [h[0]]: name, [h[1]]: fr, [h.find((x) => x.startsWith('Mathématiques (épreuve'))]: ma });
  const r = importOfficial([row(2, 'RAKOTO Aina', '12,5', 'abs'), row(3, 'INCONNU Paul', '10', ''), row(4, 'RABE Lina', '25', '')], 'BAC_STMG', ['RAKOTO Aina', 'RABE Lina']);
  assert.deepEqual(r.official['RAKOTO Aina'], { FR_E: 12.5, MA_EA: 'ABS' });
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0], /INCONNU Paul/);
  assert.match(r.errors[1], /« 25 »/);
});

import { documentsFor as docsFor, schoolDirectory, knownSchool, validateProfile as vp } from '../src/rules/enrollment.js';
test('inscription : pièces selon la classe (brevet, épreuves anticipées, redoublants) et annuaire des écoles', () => {
  const ids = (k, c, o) => docsFor(k, c, o).map((d) => d.id);
  assert.ok(ids('INSCRIPTION', '2de', { dnb: 'OBTENU' }).includes('RELEVE_DNB'));
  assert.ok(!ids('INSCRIPTION', '2de', { dnb: 'NON_PRESENTE' }).includes('RELEVE_DNB'));
  assert.ok(ids('INSCRIPTION', 'Terminale STMG').includes('RELEVE_ANTICIPEES'));
  assert.ok(!ids('REINSCRIPTION', 'Terminale STMG').includes('RELEVE_ANTICIPEES'));
  assert.ok(ids('REINSCRIPTION', '1re Générale', { repeating: true }).includes('RELEVES_REDOUBLANT'));
  assert.ok(!ids('INSCRIPTION', '4e', { repeating: true }).includes('RELEVES_REDOUBLANT'));
  const dir = schoolDirectory([{ previousSchool: 'Le Petit Prince', previousSystem: 'FRANCAIS' }, { previousSchool: 'le petit prince', previousSystem: 'FRANCAIS' }, { previousSchool: 'EPP Tanambao', previousSystem: 'MALGACHE' }]);
  assert.deepEqual(dir[0], { name: 'Le Petit Prince', count: 2, system: 'FRANCAIS' });
  assert.equal(knownSchool(dir, 'LE PETIT PRINCE').system, 'FRANCAIS');
  assert.equal(knownSchool(dir, 'Inconnue'), null);
  const base = { lastName: 'A', firstName: 'B', birthDate: '2010-01-01', nationalities: ['MG'], cls: '2de', guardians: [{ name: 'X', phone: '+261 34 00 000 00', payer: true }], previousSchool: 'Le Petit Prince' };
  assert.ok(vp(base).some((e) => /système/.test(e)));
  assert.ok(vp({ ...base, previousSystem: 'FRANCAIS' }).some((e) => /brevet/.test(e)));
  assert.deepEqual(vp({ ...base, previousSystem: 'FRANCAIS', dnb: 'OBTENU' }), []);
});

import { toBill, billAmount, settleBill } from '../src/rules/library.js';
test('bibliothèque : livre non rendu après 30 jours facturé au prix du livre, réglé avec un reçu', () => {
  const books = [{ id: 'k1', price: 30000, copies: [{ code: 'ROM-0001' }] }, { id: 'k2', copies: [{ code: 'ROM-0002' }] }];
  const loans = [{ id: 'a', code: 'ROM-0001', kind: 'ELEVE', due: '2026-10-08' }, { id: 'b', code: 'ROM-0002', kind: 'ELEVE', due: '2026-10-20' }, { id: 'c', code: 'ROM-0002', kind: 'ELEVE', due: '2026-10-01', returnedOn: '2026-10-02' }];
  assert.deepEqual(toBill(loans, '2026-10-13').map((l) => l.id), ['a']);
  assert.equal(billAmount(loans[0], books), 30000);
  assert.equal(billAmount(loans[1], books), null);
  assert.ok(settleBill(loans[0], '123').error);
  const r = settleBill(loans[0], 'ANX-TMV-00300', '2026-10-13');
  assert.equal(toBill([r.loan], '2026-10-13').length, 0);
});

import { editItem, usages, consume as useItem } from '../src/rules/inventory.js';
test('inventaire : corriger une fiche, utilisations de la trousse visibles', () => {
  const it = { id: 'i1', name: 'Pansements', qty: 20, broken: 0, log: [] };
  const e = editItem(it, { name: 'Pansements (boîte)', qty: 18 }, 'Direction', '2026-10-13T10:00');
  assert.equal(e.qty, 18);
  assert.equal(e.log[0].kind, 'CORRECTION');
  assert.throws(() => editItem({ ...it, broken: 3 }, { qty: 2 }, 'x', 'y'), /cassé/);
  const used = useItem(it, 2, 'Mme Hanta', '2026-10-13T11:00', 'RAZAKA Feno — genou écorché');
  assert.equal(used.qty, 18);
  assert.deepEqual(usages([used]).map((u) => [u.item, u.n, u.by]), [['Pansements', 2, 'Mme Hanta']]);
});

import { byService } from '../src/rules/activity.js';
test('journal : regroupé par service, tous les enseignants ensemble', () => {
  const e = (who, role, kind) => ({ who, role, kind, at: '2026-10-13T08:00', text: 'x' });
  const g = byService([e('Mme Ranaivo', 'ENSEIGNANT', 'ABSENCE'), e('M. Rasolo', 'ENSEIGNANT', 'OUBLI'), e('M. Be (CPE)', 'VIE_SCOLAIRE', 'COLLE'), e('Direction', 'DIRECTION', 'OBJET')]);
  assert.deepEqual(g.map((x) => [x.label, x.list.length]), [['Direction', 1], ['CPE', 1], ['Enseignants', 2]]);
  assert.deepEqual(g[2].people, ['Mme Ranaivo', 'M. Rasolo']);
  assert.deepEqual(g[2].kinds, { ABSENCE: 1, OUBLI: 1 });
});

import { colleSlotError, colleOverlap, nextColleSlot, upcomingColleSessions } from '../src/rules/discipline.js';
test('colles : mercredi après-midi ou samedi matin, jamais en même temps, successives', () => {
  assert.equal(colleSlotError('2026-10-21T13:00', 1), null); // mercredi
  assert.equal(colleSlotError('2026-10-24T08:00', 2), null); // samedi
  assert.match(colleSlotError('2026-10-22T13:00', 1), /mercredi après-midi/); // jeudi
  assert.match(colleSlotError('2026-10-21T10:00', 1), /entre 13h00 et 17h00/);
  assert.match(colleSlotError('2026-10-21T16:00', 2), /entre 13h00 et 17h00/);
  const colles = [{ student: 'A', kind: 'COLLE', hours: 1, when: '2026-10-21T13:00', status: 'A_FAIRE', reason: 'CPE' }];
  assert.ok(colleOverlap('A', colles, '2026-10-21T13:00', 1));
  assert.equal(colleOverlap('A', colles, '2026-10-21T14:00', 1), null);
  assert.equal(colleOverlap('B', colles, '2026-10-21T13:00', 1), null);
  assert.equal(nextColleSlot('A', colles, 1, '2026-10-20'), '2026-10-21T14:00'); // à la suite
  assert.equal(nextColleSlot('A', [...colles, { student: 'A', kind: 'COLLE', hours: 2, when: '2026-10-21T14:00', status: 'A_FAIRE' }, { student: 'A', kind: 'COLLE', hours: 1, when: '2026-10-21T16:00', status: 'A_FAIRE' }], 1, '2026-10-20'), '2026-10-24T08:00');
  assert.match(colleErrors({ kind: 'COLLE', hours: 1, when: '2026-10-21T13:00', student: 'A', colles }).join(' '), /Proposé : 2026-10-21 à 14h00/);
  assert.deepEqual(upcomingColleSessions([...colles, { student: 'B', kind: 'COLLE', hours: 2, when: '2026-10-21T13:00', status: 'A_FAIRE' }], '2026-10-20'),
    [{ day: '2026-10-21', students: 2, hours: 3, from: '13:00', to: '15:00' }]);
});

import { lateOutcome, tally as tally2 } from '../src/rules/attendance.js';
test('retard de plus de 10 min : absent pour l\'heure, entre à l\'heure pleine suivante', () => {
  assert.deepEqual(lateOutcome({ start: '07:00', end: '09:00' }, 10), { kind: 'RETARD', minutes: 10 });
  assert.deepEqual(lateOutcome({ start: '07:00', end: '09:00' }, 12), { kind: 'ABSENCE', from: '07:00', to: '08:00', enterAt: '08:00', nextCourse: false });
  assert.deepEqual(lateOutcome({ start: '10:00', end: '11:00' }, 15), { kind: 'ABSENCE', from: '10:00', to: '11:00', nextCourse: true });
  const t = tally2(['A', 'B', 'C'], { A: { status: 'R', minutes: 5 }, B: { status: 'R', minutes: 15 } });
  assert.deepEqual([t.present, t.absent, t.late], [1, ['B'], ['A']]);
});

import { catalogue, addToCatalogue, setForStudents, engagementLabels as eLab, attestationLabels as aLab } from '../src/rules/engagements.js';
test('engagements : catalogue de l\'école (ajout, masquage) et saisie groupée', () => {
  const r = addToCatalogue([], { label: 'Parrain / marraine d\'un nouvel élève', kind: 'ENGAGEMENT' });
  const a = addToCatalogue(r.custom, { label: 'Initiation au secourisme', kind: 'ATTESTATION' });
  assert.ok(addToCatalogue(a.custom, { label: 'parrain / marraine d\'un nouvel élève' }).error);
  const [parrain, secours] = a.custom.map((c) => c.id);
  assert.deepEqual(eLab(['DELEGUE', parrain, secours], 'F', a.custom), ['Déléguée de classe', 'Parrain / marraine d\'un nouvel élève']);
  assert.deepEqual(aLab([secours, 'ASSR1'], a.custom), ['Initiation au secourisme', 'Sécurité routière niveau 1 (programme ASSR 1)']);
  assert.ok(catalogue([{ id: 'ASSR2', builtin: true, hidden: true }]).find((x) => x.id === 'ASSR2').hidden);
  const m = setForStudents({ A: ['ASSR1'] }, 'ASSR2', ['A', 'B', 'C'], true);
  assert.deepEqual(m, { A: ['ASSR1', 'ASSR2'], B: ['ASSR2'], C: ['ASSR2'] });
  assert.deepEqual(setForStudents(m, 'ASSR2', ['B'], false).B, []);
});

import { followUpErrors, evaluateFollowUp, followUpReport } from '../src/rules/followup.js';
test('suivis individuels : conditions, alerte, contact extérieur avec accord des parents', () => {
  const f = { student: 'A', kind: 'CONTRAT', referent: 'Direction', conditions: { maxUnjustified: 0, maxLates: 2, minAverage: 12, maxMeasures: '' }, contact: { name: 'Président du club', parentConsent: false } };
  assert.match(followUpErrors(f).join(' '), /accord écrit des parents/);
  assert.deepEqual(followUpErrors({ ...f, contact: { ...f.contact, parentConsent: true } }), []);
  const ok = evaluateFollowUp(f, { unjustified: 0, lates: 1, average: 13.2, measures: 3 });
  assert.equal(ok.status, 'OK');
  assert.equal(ok.checks.length, 3);
  const bad = evaluateFollowUp(f, { unjustified: 1, lates: 3, average: 11.5, measures: 0 });
  assert.equal(bad.status, 'ALERTE');
  assert.deepEqual(bad.failed.map((x) => x.id), ['maxUnjustified', 'maxLates', 'minAverage']);
  assert.match(followUpReport(f, { unjustified: 1, lates: 3, average: 11.5, measures: 0 }, bad, 'octobre'), /✗ Moyenne générale : 11,5 \(au moins 12\)/);
});

import { orderSubjects, moveSubject } from '../src/rules/bulletin.js';
test('bulletin : ordre des matières fixé par la Direction', () => {
  const rows = ['EPS', 'Mathématiques', 'Français', 'Anglais'].map((label) => ({ label }));
  assert.deepEqual(orderSubjects(rows, ['Français', 'mathematiques', 'EPS']).map((r) => r.label), ['Français', 'Mathématiques', 'EPS', 'Anglais']);
  assert.deepEqual(orderSubjects(rows, []).map((r) => r.label), ['EPS', 'Mathématiques', 'Français', 'Anglais']);
  assert.deepEqual(moveSubject(['A', 'B', 'C'], 'C', -1), ['A', 'C', 'B']);
  assert.deepEqual(moveSubject(['A', 'B', 'C'], 'A', -1), ['A', 'B', 'C']);
});

import { withdrawalStatus, counted, pendingWithdrawals } from '../src/cashStore.js';
test('prélèvement Direction : direct si c\'est elle qui saisit, sinon à confirmer par elle', () => {
  assert.equal(withdrawalStatus({ role: 'DIRECTION', accountName: 'Directrice adjointe', who: 'Directrice adjointe' }), 'VALIDE');
  assert.equal(withdrawalStatus({ role: 'DIRECTION', accountName: 'Cheffe d\'établissement', who: 'Directrice adjointe' }), 'A_VALIDER');
  assert.equal(withdrawalStatus({ role: 'BUREAU', accountName: undefined, who: 'Cheffe d\'établissement' }), 'A_VALIDER');
  const m = [{ id: 1, amount: 10 }, { id: 2, status: 'A_VALIDER', withdrawnBy: 'Directrice adjointe' }, { id: 3, status: 'VALIDE' }, { id: 4, status: 'REFUSE' }];
  assert.deepEqual(counted(m).map((x) => x.id), [1, 3]);
  assert.deepEqual(pendingWithdrawals(m, 'Directrice adjointe').map((x) => x.id), [2]);
});

import { manualDraftErrors, manualTitle, isObsolete } from '../src/rules/manuals.js';
test('manuels : désignation facultative, photocopie avec reliure et impression, programme 2019 à 2026', () => {
  const d = { subject: 'Mathématiques', level: '4e', editor: 'Hachette', programYear: '2023', price: 25000, replacementPrice: 60000, returnable: true, kind: 'ORIGINAL', qty: 10, title: '' };
  assert.deepEqual(manualDraftErrors(d), []);
  assert.equal(manualTitle(d), 'Mathématiques 4e');
  assert.match(manualDraftErrors({ ...d, kind: 'PHOTOCOPIE' }).join(' '), /reliure/);
  assert.deepEqual(manualDraftErrors({ ...d, kind: 'PHOTOCOPIE', binding: 'RELIURE', print: 'NB' }), []);
  assert.match(manualDraftErrors({ ...d, programYear: '2016', editor: '' }).join(' '), /éditeur.*année|année.*éditeur/s);
  assert.ok(isObsolete({ programYear: 2016 }));
  assert.ok(!isObsolete({ programYear: 2019 }));
});

import { weekLetter, plannedSessions as planned } from '../src/rules/teachingHours.js';
test('emploi du temps : semaines A et B (calendrier de l\'école, ou vacances non comptées)', () => {
  const school = { calendar: [{ id: 'v', start: '2026-10-19', end: '2026-10-31', kind: 'VACANCES' }], timetable: { weekAStart: '2026-08-31' } };
  // calendrier 2026-2027 de l'école : l'alternance continue pendant les vacances
  assert.equal(weekLetter('2026-09-01', school), 'A');
  assert.equal(weekLetter('2026-09-08', school), 'B');
  assert.equal(weekLetter('2026-10-13', school), 'A');
  assert.equal(weekLetter('2026-10-20', school), 'B'); // vacances (semaine B)
  assert.equal(weekLetter('2026-11-03', school), 'B');
  assert.equal(weekLetter('2027-06-29', school), 'B');
  const settings = { calendar: [{ id: 'v', start: '2026-10-24', end: '2026-11-08', kind: 'VACANCES' }], timetable: { weekAStart: '2026-09-07', skipHolidays: true } };
  assert.equal(weekLetter('2026-09-08', settings), 'A');
  assert.equal(weekLetter('2026-09-15', settings), 'B');
  assert.equal(weekLetter('2026-10-20', settings), 'A'); // 7 semaines de classe plus tard
  assert.equal(weekLetter('2026-11-10', settings), 'B'); // les deux semaines de vacances ne comptent pas
  const slots = [{ id: 'es1', weekday: 2, start: '08:00', end: '10:00', week: 'A' }, { id: 'es2', weekday: 2, start: '08:00', end: '10:00', week: 'B' }];
  assert.deepEqual(planned(slots, '2026-09-07', '2026-09-20', settings).map((x) => `${x.date}:${x.slotId}`), ['2026-09-08:es1', '2026-09-15:es2']);
});

import { parseTimetable, normalizeClass as ttClass, normalizeSubject, hoursByClass, timetableSheet } from '../src/rules/timetableImport.js';
test('import de l\'emploi du temps : format de l\'école, abréviations, semaines A/B, contrôles', () => {
  assert.equal(ttClass('1e G'), '1re Générale');
  assert.equal(ttClass('Tle STMG'), 'Terminale STMG');
  assert.equal(ttClass('2nde'), '2de');
  assert.equal(ttClass('1ère STMG'), '1re STMG');
  assert.equal(ttClass('CM2'), null);
  assert.deepEqual(normalizeSubject('E.S. SVT'), { subject: 'Enseignement scientifique', part: 'SVT' });
  assert.equal(normalizeSubject('Spé Maths').subject, 'Spécialité Mathématiques');
  assert.equal(normalizeSubject('HGE').subject, 'Histoire-Géographie');
  const row = (line, Jour, Classe, c, Matière, Enseignant, Salle = '-', Semaine = '') => ({ line, Jour, Classe, 'Créneau Horaire': c, Matière, Enseignant, Salle, Semaine });
  const r = parseTimetable([
    row(2, 'Lundi', '1e G', '07:30-09:30', 'E.S. P-C', 'Prof A', '-', 'Semaine A'),
    row(3, 'Lundi', '1e G', '07:30-09:30', 'E.S. SVT', 'Prof B', '-', 'Semaine B'),
    row(4, 'Lundi', '3e', '08:00-09:00', 'Maths', 'Prof A'),
    row(5, 'Jeudi', 'CM2', '08:00-09:00', 'Maths', 'Prof C'),
    row(6, 'Vendredi', '4e', '10:00-09:00', 'HGE', 'Prof D'),
    { line: 7, Jour: '', Classe: '', 'Créneau Horaire': ' ', Matière: '', Enseignant: '' },
    row(9, 'Lundi', 'Tle G', '13:30-15:30', 'Spé P-C', 'Prof F'),
    row(10, 'Lundi', 'Tle G', '13:30-15:30', 'Spé SVT', 'Prof G'), // spécialités en groupes : pas d'alerte
    row(11, 'Lundi', 'Tle G', '14:00-15:00', 'Philosophie', 'Prof E'),
    { line: 8, Classe: 'Tle G', Jour: 'Mardi', Début: '13:30', Fin: '15:30', Matière: 'Philosophie', Professeur: 'Prof E', Salle: 'Salle 4' },
  ]);
  assert.equal(r.slots.length, 7);
  assert.equal(r.ignored, 1);
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0], /Ligne 5 : classe « CM2 » inconnue/);
  assert.match(r.errors[1], /finit avant de commencer/);
  assert.deepEqual(r.slots.map((s) => s.week ?? '-'), ['A', 'B', '-', '-', '-', '-', '-']);
  assert.equal(r.slots.find((s) => s.line === 8).room, 'Salle 4');
  assert.equal(r.warnings.length, 3); // Prof A (1re G sem. A et 3e) ; philosophie pendant chacune des deux spécialités
  assert.match(r.warnings[0], /Prof A a deux cours en même temps/);
  assert.ok(!r.warnings.some((w) => /Spécialité Physique-Chimie, Spécialité SVT/.test(w)));
  assert.deepEqual(hoursByClass(r.slots)['1re Générale'], { A: 2, B: 2 });
  assert.equal(timetableSheet({ Instructions: [['Comment']], 'EDT à importer': [['Jour', 'Classe', 'Matière']] })[0][0], 'Jour');
});

import { checkAgainstAssignments } from '../src/rules/timetableImport.js';
import { ASSIGNMENTS, teachersOf, teacherSummary } from '../src/data/staffAssignments.js';
test('enseignements de l\'école et contrôle de l\'emploi du temps', () => {
  assert.deepEqual(teachersOf('Enseignement scientifique', '1re Générale'), ['M. Canusis', 'Mme Félicité']);
  assert.deepEqual(teachersOf('EMC', '6e'), ['Mme Harris']);
  assert.match(teacherSummary('Mme Karele'), /SES \(2de\).*Économie \(1re STMG, Terminale STMG\)/);
  const slot = (line, teacherId, subject, cls) => ({ line, teacherId, subject, cls });
  const w = checkAgainstAssignments([
    slot(2, 'M. Canusis', 'Spécialité Physique-Chimie', 'Terminale Générale'), // spé ↔ physique-chimie : ok
    slot(3, 'Mme Karele', 'Droit et économie', 'Terminale STMG'), // Eco-Droit ↔ économie / droit : ok
    slot(4, 'Mme Pasimiry', 'Anglais — ETLV', 'Terminale STMG'), // ETLV ↔ anglais : ok
    slot(5, 'M. Steven', 'Mathématiques', '3e'), // pas dans ses enseignements (il a la 2de et la 1re STMG)
    slot(6, 'Mme Inconnue', 'Arts plastiques', '6e'),
  ], ASSIGNMENTS);
  assert.equal(w.length, 2);
  assert.match(w[0], /M\. Steven : Mathématiques en 3e ne figure pas/);
  assert.match(w[1], /Mme Inconnue n'est pas dans la liste/);
  assert.equal(checkAgainstAssignments([slot(7, 'Mme Francine', 'Arts plastiques', '5e'), slot(8, 'Mme Sheena', 'Parcours d\'ouverture', '2de'), slot(9, 'M. Steven', 'Mathématiques', '2de')], ASSIGNMENTS).length, 0);
});

import { gridMarks, rowPos, layoutLanes, shortSubject, subjectColor, markLabel } from '../src/rules/timetableGrid.js';
test('grille d\'emploi du temps : repères de l\'école, voies côte à côte, libellés courts', () => {
  const marks = gridMarks();
  assert.equal(marks.length, 21);
  assert.equal(rowPos('09:45', marks), 6);
  assert.equal(rowPos('10:15', marks), 7);
  assert.equal(rowPos('07:15', marks), 0.5);
  assert.equal(markLabel('09:45'), '9h45');
  assert.equal(gridMarks([{ start: '06:30', end: '17:45' }])[0], '06:30');
  assert.equal(gridMarks([{ start: '06:30', end: '17:45' }]).at(-1), '18:00');
  const lanes = layoutLanes([
    { id: 'a', start: '13:30', end: '15:30' }, { id: 'b', start: '15:00', end: '17:00' }, { id: 'c', start: '07:30', end: '09:30' },
  ]);
  assert.deepEqual(lanes.map((x) => `${x.id}:${x.lane}/${x.lanes}`), ['c:0/1', 'a:0/2', 'b:1/2']);
  assert.equal(shortSubject({ subject: 'Spécialité Mathématiques' }), 'Spé Maths');
  assert.equal(shortSubject({ subject: 'Enseignement scientifique', part: 'P-C' }), 'E.S. P-C');
  assert.equal(shortSubject({ subject: 'Histoire-Géographie' }), 'HGE');
  assert.equal(subjectColor({ subject: 'Spécialité SVT' }), subjectColor({ subject: 'Enseignement scientifique', part: 'SVT' }));
  assert.notEqual(subjectColor({ subject: 'Mathématiques' }), subjectColor({ subject: 'Français' }));
});

import { dayCourses, nowNext } from '../src/rules/timetableGrid.js';
test('la journée d\'une classe : bonne semaine, changements, maintenant et ensuite', () => {
  const settings = { calendar: [], timetable: { weekAStart: '2026-08-31' } };
  const slots = [
    { id: 's1', cls: '1re STMG', weekday: 2, start: '07:30', end: '09:30', subject: 'Management', teacherId: 'p1' },
    { id: 's2', cls: '1re STMG', weekday: 2, start: '09:45', end: '11:15', subject: 'Français', teacherId: 'p2' },
    { id: 's3', cls: '1re STMG', weekday: 2, start: '13:00', end: '14:30', subject: 'Espagnol', teacherId: 'p3', week: 'B' },
    { id: 's4', cls: '1re STMG', weekday: 2, start: '15:30', end: '17:00', subject: 'Mathématiques', teacherId: 'p4' },
  ];
  // mardi 13 octobre 2026 : semaine A → pas d'espagnol (semaine B)
  const changes = [{ id: 'c1', type: 'ANNULE', cls: '1re STMG', subject: 'Mathématiques', date: '2026-10-13', start: '15:30', end: '17:00' }];
  const day = dayCourses(slots, '1re STMG', '2026-10-13', settings, changes);
  assert.deepEqual(day.map((c) => `${c.subject}${c.status ? `:${c.status}` : ''}`), ['Management', 'Français', 'Mathématiques:ANNULE']);
  assert.deepEqual([nowNext(day, '10:20').now?.subject, nowNext(day, '10:20').next?.subject], ['Français', undefined]);
  assert.equal(nowNext(day, '09:35').next.subject, 'Français');
  assert.equal(dayCourses(slots, '1re STMG', '2026-10-20', settings).length, 4); // semaine B
});

import { pushPlan, needsEmail, isQuiet } from '../src/rules/pushPolicy.js';
test('notifications sur le téléphone : urgent tout de suite, heures calmes, regroupement, e-mail de secours', () => {
  const items = [
    { id: 'u1', level: 'URGENT', kind: 'SOIN', child: 'Aina', text: 'Aina est à l\'infirmerie' },
    ...[1, 2, 3].map((k) => ({ id: `n${k}`, level: 'IMPORTANT', kind: 'NOTE', child: 'Aina', text: `note ${k}` })),
    { id: 'n4', level: 'IMPORTANT', kind: 'NOTE', child: 'Toky', text: 'note' },
    { id: 'a1', level: 'INFO', kind: 'ANNONCE', text: 'Sortie au musée' },
  ];
  assert.ok(isQuiet('21:15') && isQuiet('06:59') && !isQuiet('07:00'));
  const night = pushPlan(items, '21:15');
  assert.deepEqual(night.send.map((n) => n.id), ['u1']);
  assert.equal(night.held.length, 5);
  const day = pushPlan(items, '17:30');
  assert.deepEqual(day.send.map((n) => n.text), ['Aina est à l\'infirmerie', '3 nouvelles notes pour Aina', 'note', 'Sortie au musée']);
  assert.deepEqual(day.send[1].ids, ['n1', 'n2', 'n3']);
  assert.equal(needsEmail({ level: 'URGENT', sentAt: '2026-10-13T08:00' }, '2026-10-13T10:00'), true);
  assert.equal(needsEmail({ level: 'URGENT', sentAt: '2026-10-13T08:00', openedAt: '2026-10-13T08:05' }, '2026-10-13T10:00'), false);
  assert.equal(needsEmail({ level: 'IMPORTANT', sentAt: '2026-10-13T08:00' }, '2026-10-13T09:30'), false);
  assert.equal(needsEmail({ level: 'INFO', sentAt: '2026-10-13T08:00' }, '2026-10-13T12:00'), false);
});

import { findStudents, searchAll } from '../src/rules/search.js';
test('recherche : élèves sans accents ni majuscules, actions et écrans accessibles seulement', () => {
  const list = [{ name: 'RAMAROSON Fitia', cls: '1re STMG' }, { name: 'RASOA Lova', cls: '6e' }, { name: 'RAKOTO Héry', cls: '6e' }];
  assert.deepEqual(findStudents('fitia', list).map((s) => s.name), ['RAMAROSON Fitia']);
  assert.deepEqual(findStudents('hery', list).map((s) => s.name), ['RAKOTO Héry']);
  assert.equal(findStudents('6e', list).length, 2);
  assert.deepEqual(findStudents('  ', list), []);
  const items = [{ id: 'enrol', label: 'Inscriptions' }, { id: 'vs', label: 'Absences, retards et punitions' }, { id: 'student-file', label: 'Fil de l\'élève' }];
  const r = searchAll('certificat fitia', items, (q) => findStudents(q, list));
  assert.deepEqual(r.map((x) => `${x.type}:${x.id}:${x.label}`), ['ACTION:enrol:Imprimer un certificat de scolarité', 'STUDENT:student-file:RAMAROSON Fitia']);
  assert.equal(searchAll('encaisser', items).length, 0); // la caisse n'est pas dans ses écrans
  assert.deepEqual(searchAll('absences', items).map((x) => x.id), ['vs', 'vs']);
});

import { coveringFor } from '../src/delegationStore.js';
test('remplacement : les alertes de la personne absente vont à sa remplaçante, ce jour-là seulement', () => {
  const all = { VIE_SCOLAIRE: { to: 'BUREAU', day: '2026-10-13' } };
  assert.deepEqual(coveringFor('BUREAU', '2026-10-13', all), ['VIE_SCOLAIRE']);
  assert.deepEqual(coveringFor('BUREAU', '2026-10-14', all), []);
  assert.deepEqual(coveringFor('VIE_SCOLAIRE', '2026-10-13', all), []);
});

import { familyRequestErrors, justificationState, timeLeftLabel } from '../src/rules/attendance.js';
test('justification par la famille : motif, délai de 24 h, en attente de la vie scolaire', () => {
  const a = { id: 'x', date: '2026-10-13', kind: 'ABSENCE', slot: '13h00–15h00', justified: false };
  assert.equal(timeLeftLabel(a, '2026-10-13T18:30'), 'il reste 18 h');
  assert.equal(timeLeftLabel(a, '2026-10-14T12:30'), 'il reste 30 min');
  assert.deepEqual(familyRequestErrors(a, { reason: 'Maladie' }, '2026-10-13T18:30'), []);
  assert.equal(familyRequestErrors(a, { reason: 'Autre', note: ' ' }, '2026-10-13T18:30').length, 1);
  assert.match(familyRequestErrors(a, { reason: 'Maladie' }, '2026-10-14T13:00')[0], /délai de 24 h est dépassé/);
  const sent = { ...a, request: { reason: 'Maladie', at: '2026-10-13T18:31' } };
  assert.equal(justificationState(sent, '2026-10-15T09:00').status, 'EN_ATTENTE'); // déposée à temps : jamais « non justifiée » en attendant
  assert.equal(justificationState({ ...sent, request: { ...sent.request, refused: { why: 'pas de certificat' } } }, '2026-10-15T09:00').status, 'NON_JUSTIFIEE');
  assert.equal(familyRequestErrors(sent, { reason: 'Maladie' }, '2026-10-13T19:00').length, 1);
});

import { atWork, nextOpening, openingLabel } from '../src/rules/workHours.js';
test('horaires de travail : pas de réponse en dehors, message lu à la reprise', () => {
  const s = { ...DEFAULT_SETTINGS, calendar: [{ id: 'v', kind: 'VACANCES', start: '2026-10-19', end: '2026-10-31' }] };
  assert.equal(atWork('2026-10-13T10:00', s), true);
  assert.equal(atWork('2026-10-13T18:30', s), false);
  assert.equal(atWork('2026-10-14T14:00', s), false); // mercredi après-midi
  assert.equal(nextOpening('2026-10-13T18:30', s), '2026-10-14T07:00');
  assert.equal(nextOpening('2026-10-13T06:15', s), '2026-10-13T07:00');
  assert.equal(nextOpening('2026-10-16T19:00', s), '2026-11-02T07:00'); // vendredi soir avant les vacances
  assert.equal(openingLabel('2026-11-02T07:00'), 'lundi 2 novembre à 7h');
});

import { pulse, trend, periodRange, upcoming } from '../src/rules/schoolPulse.js';
test('l\'école sur 7 ou 30 jours : période, période précédente, évolution, à venir', () => {
  assert.deepEqual(periodRange('2026-10-13', 7), { from: '2026-10-07', to: '2026-10-13', prevFrom: '2026-09-30', prevTo: '2026-10-06' });
  const abs = [{ date: '2026-10-13', kind: 'ABSENCE' }, { date: '2026-10-08', kind: 'ABSENCE' }, { date: '2026-10-08', kind: 'RETARD' }, { date: '2026-10-01', kind: 'ABSENCE' }, { date: '2026-09-01', kind: 'ABSENCE' }];
  const p = pulse({ absences: { list: abs, date: (x) => x.date, keep: (x) => x.kind === 'ABSENCE' }, soins: { list: [{ at: '2026-10-12T10:00' }], date: (x) => x.at } }, '2026-10-13', 7);
  assert.deepEqual(p.absences, { now: 2, before: 1 });
  assert.equal(trend(p.absences), '+1');
  assert.equal(trend({ now: 1, before: 3 }), '−2');
  assert.equal(trend(p.soins), '+1');
  assert.equal(pulse({ a: { list: abs, date: (x) => x.date } }, '2026-10-13', 30).a.now, 4);
  const ev = [{ id: 'x', date: '2026-10-20' }, { id: 'y', date: '2026-10-10' }, { id: 'z', date: '2026-10-10', end: '2026-10-15' }, { id: 'w', date: '2026-12-20' }];
  assert.deepEqual(upcoming(ev, '2026-10-13').map((e) => e.id), ['z', 'x']);
});
