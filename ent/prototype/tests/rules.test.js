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
  const p = { lastName: 'RAKOTO', firstName: 'Éléa', birthDate: '2013-04-02', nationalities: ['MG'], cls: '6e', previousSchool: 'EPP Tamatave',
    guardians: [{ name: 'Mme Rakoto Voahangy', relation: 'Mère', phone: '+261 34 12 345 67', email: 'voahangy@gmail.com', payer: true }, { name: 'M. Rakoto', relation: 'Père', phone: '+261 32 11 222 33' }] };
  assert.deepEqual(validateProfile(p), []);
  assert.ok(validateProfile({ ...p, guardians: [{ ...p.guardians[0], payer: false }] }).includes('Indiquer le responsable qui règle les frais.'));
  assert.ok(validateProfile({ ...p, previousSchool: '' }).length === 1);
  assert.deepEqual(validateProfile({ ...p, previousSchool: '' }, { kind: 'REINSCRIPTION' }), []);
  const acc = accountsFor(p);
  assert.equal(acc[0].login, 'elea.rakoto@chateaubriand-tamatave.mg');
  assert.equal(acc[1].login, 'voahangy@gmail.com');
  assert.equal(acc[2].login, null); // pas d'e-mail : code d'activation
  assert.equal(missingDocuments({ documents: ['ACTE', 'PHOTOS'] }, 'REINSCRIPTION').length, 2);
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
