import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGrade } from '../src/rules/gradeInput.js';
import { checkAppreciation, autoFix, decisionText } from '../src/rules/appreciation.js';
import { validateSlot, findConflicts, suggestAlternatives } from '../src/rules/booking.js';
import { isDunningMonth, splitExamFee, billableMonths } from '../src/rules/finance.js';
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
test('calendrier de relance : octobre sauté', () => {
  assert.equal(isDunningMonth('2026-10-13'), false);
  assert.equal(isDunningMonth('2026-11-02'), true);
  assert.equal(isDunningMonth('2027-01-10'), false);
});

test('droits d\'examen : 40 000 Ar conservés', () => {
  assert.deepEqual(splitExamFee(600_000), { retained: 40_000, toRemit: 560_000 });
  assert.deepEqual(splitExamFee(30_000), { retained: 30_000, toRemit: 0 });
});

test('échéancier : mai = dernier mois pour 1re/Tle de Tamatave', () => {
  assert.equal(billableMonths({ siteCode: 'TMV', levelCode: 'TLE' }).at(-1), 5);
  assert.equal(billableMonths({ siteCode: 'TMV', levelCode: '3E' }).at(-1), 6);
  assert.equal(billableMonths({ siteCode: 'TANA', levelCode: 'TLE' }).at(-1), 6);
});
