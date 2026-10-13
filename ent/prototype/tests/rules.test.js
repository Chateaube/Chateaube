import { test } from 'node:test';
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
  const sch = dunningSchedule('2026-12-05', S);
  assert.deepEqual(sch, { due: '2026-12-05', relance: '2026-12-11', warning: '2026-12-18', suspension: '2027-01-22' });
  assert.deepEqual(pausesBetween(sch.due, sch.suspension, S).map((p) => p.kind), ['VACANCES']);
});

test('échéance de septembre et d\'octobre : octobre gelé', () => {
  const sept = dunningSchedule('2026-09-05', S);
  assert.equal(sept.relance, '2026-09-11');
  assert.equal(sept.suspension, '2026-11-10');
  const oct = dunningSchedule('2026-10-05', S);
  assert.equal(oct.relance, '2026-11-06');
  assert.equal(oct.suspension, '2026-12-04');
});

test('paramètres : décompte depuis l\'étape précédente, samedi compté', () => {
  assert.deepEqual(dunningSchedule('2026-12-05', withDunning({ countFrom: 'ETAPE_PRECEDENTE' })),
    { due: '2026-12-05', relance: '2026-12-11', warning: '2027-01-08', suspension: '2027-02-12' });
  assert.equal(dunningSchedule('2026-11-05', S).relance, '2026-11-12');
  assert.equal(dunningSchedule('2026-11-05', withDunning({ countedWeekdays: [1, 2, 3, 4, 5, 6] })).relance, '2026-11-11');
});

test('étape d\'un dossier à une date donnée', () => {
  const sch = dunningSchedule('2026-12-05', S);
  assert.equal(stageOn('2026-12-08', sch, S), 'DANS_LES_DELAIS');
  assert.equal(stageOn('2026-12-11', sch, S), 'RELANCE');
  assert.equal(stageOn('2027-01-05', sch, S), 'AVERTISSEMENT');
  assert.equal(stageOn('2027-01-22', sch, S), 'A_VALIDER');
  assert.equal(stageOn('2027-01-22', sch, withDunning({ suspensionRequiresDirection: false })), 'MISE_A_PIED');
  assert.match(dunningStages(S)[2].delay, /25 jours comptés après l'échéance — validation Direction/);
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

test('plans d\'écolage Tamatave : 9 mois pour 1re/Tle, 10 mois sinon', () => {
  const [college, , premiere, terminale] = S.tuition.plans;
  assert.equal(planMonths(premiere).length, 9);
  assert.equal(planMonths(terminale).at(-1), 5);
  assert.equal(planMonths(college).length, 10);
});

// --- Comptabilité -------------------------------------------------------------
import { accountStatement, annualCost, cashBalance } from '../src/rules/accounting.js';
import { FAMILIES, CLASS_FEES, CASH_MOVEMENTS, CASH_OPENING } from '../src/data/accounting.js';

test('état de compte : soldes séparés par journal', () => {
  const { byJournal, totals, rows } = accountStatement(FAMILIES[0].lines);
  assert.equal(byJournal.ECOLAGE.balance, 760_000);          // écolage d'octobre impayé
  assert.equal(byJournal.FRAIS_ANNEXES.balance, 30_000);     // natation
  assert.equal(byJournal.DROITS_EXAMEN.balance, 0);
  assert.equal(totals.balance, 790_000);
  assert.equal(rows.find((r) => r.label.startsWith('Écolage octobre — Toky')).journalBalance, 760_000);
  assert.ok(rows.every((r) => r.journalBalance >= 0), 'aucun solde de journal négatif dans la démo');
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].date <= r.date));
});

test('coût annuel : 9 mois d\'écolage pour la Terminale, 10 pour la 6e', () => {
  const plans = DEFAULT_SETTINGS.tuition.plans;
  const tle = CLASS_FEES.find((r) => r.cls === 'Terminale STMG');
  assert.equal(annualCost(tle, plans), 180_000 + 450_000 * 9 + 90_000 + 120_000);
  const six = CLASS_FEES.find((r) => r.cls === '6e');
  assert.equal(annualCost(six, plans, { newStudent: true }), 250_000 + 330_000 * 10 + 60_000 + 80_000);
});

test('caisse : entrées et sorties par journal', () => {
  const b = cashBalance(CASH_OPENING, CASH_MOVEMENTS);
  assert.equal(b.ECOLAGE, 250_000 + 420_000 - 85_000 - 400_000);
  assert.equal(b.DROITS_EXAMEN, 950_000);
  assert.equal(b.FRAIS_ANNEXES, 110_000);
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
import { SERVICES, EVALUATIONS, GRADES, CLASS_SUBJECTS, competenciesFor } from '../src/data/grades.js';

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

test('compétences : référentiel officiel commun à un même niveau (1re Générale = 1re STMG)', () => {
  const emc1STMG = SERVICES.find((s) => s.id === 's3');
  const emc1G = SERVICES.find((s) => s.id === 's4');
  assert.deepEqual(competenciesFor(emc1G, DEFAULT_SETTINGS), competenciesFor(emc1STMG, DEFAULT_SETTINGS));
  assert.equal(competenciesFor(emc1G, DEFAULT_SETTINGS).length, 3);
  assert.notDeepEqual(competenciesFor(SERVICES[0], DEFAULT_SETTINGS), competenciesFor(SERVICES[1], DEFAULT_SETTINGS)); // Management 1re ≠ Terminale
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
  assert.deepEqual(validateMeasure({ measureId: 'BLAME', authorRole: 'DIRECTION', reason: 'Insolence', student: 'X' }), []);
});

test('téléphone : 24 h ou 5 jours ouvrés, vacances et week-ends exclus', () => {
  assert.equal(phoneReturnAt('2026-10-13T15:00', '24H', DEFAULT_SETTINGS), '2026-10-14T15:00');
  assert.equal(phoneReturnAt('2026-10-13T15:00', '5J', DEFAULT_SETTINGS), '2026-10-20T15:00');
  assert.equal(phoneReturnAt('2026-10-22T10:00', '5J', DEFAULT_SETTINGS), '2026-11-05T10:00'); // vacances de la Toussaint
  assert.equal(phoneReturnAt('2026-12-18T09:00', '24H', DEFAULT_SETTINGS), '2027-01-04T09:00'); // vacances de Noël
  assert.equal(phoneReturnAt('2026-12-17T10:00', '5J', DEFAULT_SETTINGS), '2027-01-07T10:00');
  assert.equal(isSchoolDay('2026-10-14', DEFAULT_SETTINGS), true); // octobre n'est pas gelé pour la vie scolaire
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
  assert.deepEqual(phoneDurationFor('A', phones), { duration: '5J', previous: 1 });
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
import { higherEdProcedure, exportWindowOpen, campusFranceCsv } from '../src/rules/orientation.js';
test('Terminale : Parcoursup ou Études en France selon la nationalité', () => {
  assert.equal(higherEdProcedure(['FR']), 'PARCOURSUP');
  assert.equal(higherEdProcedure(['MG']), 'CAMPUS_FRANCE');
  assert.equal(higherEdProcedure(['MG', 'FR']), 'PARCOURSUP');       // double nationalité
  assert.equal(higherEdProcedure(['BE']), 'PARCOURSUP');
  assert.equal(higherEdProcedure(['KM']), 'CAMPUS_FRANCE');
});

test('export Campus France : après le Bac, jusqu\'à début septembre', () => {
  const w = { opensOn: '2027-07-05', closesOn: '2027-09-05' };
  assert.equal(exportWindowOpen('2026-10-13', w), false);
  assert.equal(exportWindowOpen('2027-08-01', w), true);
  const csv = campusFranceCsv([{ lastName: 'RANDRIA', firstName: 'Mamy', birthDate: '2008-04-02', nationalities: ['MG'], cls: 'Terminale Générale', bac: 'Admis', mention: 'Bien', email: 'm@ex.mg' }]);
  assert.equal(csv.split('\r\n')[1], 'RANDRIA;Mamy;02/04/2008;MG;Terminale Générale;Admis;Bien;Études en France (Campus France);m@ex.mg');
});

import { formatDateFr } from '../src/rules/calendar.js';
test('dates en français : « 1er » pour le premier du mois', () => {
  assert.equal(formatDateFr('2026-10-01'), 'jeudi 1er octobre 2026');
  assert.equal(formatDateFr('2027-01-20'), 'mercredi 20 janvier 2027');
});
