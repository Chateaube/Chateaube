import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAccess, levelFor, setLevel, baseLevel, exceptionsOf } from '../src/rules/access.js';

const BOOKING = { id: 'booking', label: 'Réservations' };
const RES = { id: 'resources', label: 'Ressources' };
const CARE = { id: 'care', label: 'Soins' };
const catalogue = [BOOKING, RES, CARE, { id: 'settings', label: 'Paramètres' }];
const cpeNav = [{ group: 'Aujourd\'hui', items: [{ id: 'cpe-home' }, CARE] }, { group: 'Ressources', items: [{ ...BOOKING, readOnly: true }, RES] }];
const ids = (nav) => nav.flatMap((g) => g.items.map((i) => `${i.id}${i.readOnly ? ':lecture' : ''}`));

test('droits d\'accès : sans réglage, le menu d\'origine', () => {
  assert.equal(baseLevel(cpeNav, 'booking'), 'LECTURE');
  assert.deepEqual(ids(applyAccess({ profile: 'VIE_SCOLAIRE', baseNav: cpeNav, catalogue })), ['cpe-home', 'care', 'booking:lecture', 'resources']);
});

test('droits d\'accès : le profil puis la personne l\'emportent', () => {
  let a = setLevel({}, { profile: 'VIE_SCOLAIRE', id: 'booking', level: 'ECRITURE' });
  a = setLevel(a, { profile: 'VIE_SCOLAIRE', id: 'care', level: 'AUCUN' });
  assert.deepEqual(ids(applyAccess({ profile: 'VIE_SCOLAIRE', person: 'p8', baseNav: cpeNav, catalogue, access: a })), ['cpe-home', 'booking', 'resources']);
  a = setLevel(a, { person: 'p8', id: 'care', level: 'LECTURE' });
  assert.equal(levelFor({ profile: 'VIE_SCOLAIRE', person: 'p8', id: 'care', baseNav: cpeNav, access: a }), 'LECTURE');
  assert.equal(levelFor({ profile: 'VIE_SCOLAIRE', person: 'p11', id: 'care', baseNav: cpeNav, access: a }), 'AUCUN');
  assert.equal(exceptionsOf(a, 'p8'), 1);
  a = setLevel(a, { person: 'p8', id: 'care', level: null });
  assert.equal(exceptionsOf(a, 'p8'), 0);
});

test('droits d\'accès : écran accordé en plus, écrans de la Direction jamais délégués', () => {
  const tNav = [{ group: 'Ma journée', items: [{ id: 'teacher' }] }];
  let a = setLevel({}, { profile: 'ENSEIGNANT', id: 'care', level: 'LECTURE' });
  a = setLevel(a, { profile: 'ENSEIGNANT', id: 'settings', level: 'ECRITURE' });
  const nav = applyAccess({ profile: 'ENSEIGNANT', baseNav: tNav, catalogue, access: a });
  assert.deepEqual(nav.map((g) => g.group), ['Ma journée', 'Accès accordés']);
  assert.deepEqual(ids(nav), ['teacher', 'care:lecture']);
  assert.equal(levelFor({ profile: 'DIRECTION', id: 'care', baseNav: [], access: setLevel({}, { profile: 'DIRECTION', id: 'care', level: 'AUCUN' }) }), 'ECRITURE');
});
